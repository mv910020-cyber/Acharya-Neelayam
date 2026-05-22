from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import mimetypes
import smtplib
import ssl
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from html import escape
from pathlib import Path
from typing import Any, Dict, Iterator, List
from urllib import error as urllib_error
from urllib import request as urllib_request
from urllib.parse import urlencode, urljoin, urlparse
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from .config import (
    get_api_host,
    get_api_port,
    get_database_url,
    get_gemini_api_key,
    get_setting,
    is_debug_enabled,
)
from .database import get_auth_storage_mode, get_db_connection as open_database, initialize_database as init_database
from .routes_ai import create_ai_router
from .routes_auth import auth_router

try:
    import psycopg
except ImportError:  # pragma: no cover - handled by dependency install/runtime config
    psycopg = None


logger = logging.getLogger(__name__)
IN_MEMORY_INQUIRIES: List[dict] = []
POSTGRES_STORAGE_AVAILABLE = bool(get_database_url()) and psycopg is not None
BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FRONTEND_PUBLIC_DIRS = (
    BACKEND_ROOT.parent / "frontend" / "public",
    BACKEND_ROOT / "frontend-public",
)
DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
]


def load_cors_origins() -> List[str]:
    raw_origins = get_setting("CORS_ORIGINS")
    if not raw_origins:
        return DEFAULT_CORS_ORIGINS

    try:
        parsed_origins = json.loads(raw_origins)
    except json.JSONDecodeError:
        parsed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    else:
        if isinstance(parsed_origins, list):
            parsed_origins = [
                origin.strip()
                for origin in parsed_origins
                if isinstance(origin, str) and origin.strip()
            ]
        else:
            parsed_origins = []

    if parsed_origins:
        return parsed_origins

    logger.warning("Unable to parse CORS_ORIGINS=%r, falling back to defaults", raw_origins)
    return DEFAULT_CORS_ORIGINS


CORS_ORIGINS = load_cors_origins()
ALLOW_ALL_CORS = "*" in CORS_ORIGINS


app = FastAPI(
    title="Aachara Nilayam API",
    description="Catalog and inquiry API for a puja products storefront",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ALLOW_ALL_CORS else CORS_ORIGINS,
    allow_credentials=not ALLOW_ALL_CORS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include authentication routes
app.include_router(auth_router)


class Product(BaseModel):
    id: str
    name: str
    category: str
    categoryKey: str
    categorySlug: str
    description: str
    imageUrl: str
    featured: bool
    badge: str
    useCase: str
    tags: List[str]
    price: int
    rating: float
    reviewCount: int
    quantity: int
    sortOrder: int
    isCollection: bool = False


class Category(BaseModel):
    label: str
    key: str
    slug: str
    description: str
    productCount: int


class InquiryInput(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    phone: str = Field(..., min_length=7, max_length=24)
    message: str = Field(..., min_length=10, max_length=600)
    productId: str | None = None


class Inquiry(BaseModel):
    id: str
    name: str
    phone: str
    message: str
    productId: str | None = None
    createdAt: str


class OrderEmailItemInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    orderNumber: str = Field(..., min_length=3, max_length=50)
    quantity: int = Field(..., ge=1, le=999)
    unitPrice: str = Field(..., min_length=1, max_length=50)
    lineTotal: str = Field(..., min_length=1, max_length=50)
    imageUrl: str | None = Field(default=None, max_length=500)


class OrderEmailInput(BaseModel):
    message: str = Field(..., min_length=10, max_length=4000)
    customerName: str | None = Field(default=None, min_length=2, max_length=80)
    customerEmail: EmailStr | None = None
    customerPhone: str | None = Field(default=None, min_length=7, max_length=24)
    deliveryAddress: str | None = Field(default=None, min_length=10, max_length=300)
    primaryOrderNumber: str | None = Field(default=None, min_length=3, max_length=50)
    storeUrl: str | None = Field(default=None, max_length=300)
    items: List[OrderEmailItemInput] = Field(default_factory=list)
    totalAmount: str | None = Field(default=None, min_length=1, max_length=50)
    estimatedDeliveryDate: str | None = Field(default=None, min_length=3, max_length=80)
    paymentMethod: str | None = Field(default=None, min_length=2, max_length=40)
    orderDateTime: str | None = Field(default=None, min_length=3, max_length=80)


class RazorpayOrderInput(BaseModel):
    amount: int = Field(..., ge=100)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    receipt: str = Field(..., min_length=3, max_length=40)
    description: str | None = Field(default=None, min_length=3, max_length=200)
    notes: Dict[str, str] = Field(default_factory=dict)


class RazorpayVerifyInput(BaseModel):
    orderId: str = Field(..., min_length=10, max_length=80)
    razorpayOrderId: str = Field(..., min_length=10, max_length=80)
    razorpayPaymentId: str = Field(..., min_length=10, max_length=80)
    razorpaySignature: str = Field(..., min_length=10, max_length=200)


CATEGORY_DETAILS = [
    {
        "label": "Puja Samagri",
        "key": "pujaSamagri",
        "slug": "puja-samagri",
        "description": "Daily ritual essentials, fragrances, powders, and wick sets.",
    },
    {
        "label": "Brass Items",
        "key": "brassItems",
        "slug": "brass-items",
        "description": "Traditional brass decor, lamps, vessels, and puja accessories.",
    },
    {
        "label": "Return Gifts",
        "key": "returnGifts",
        "slug": "return-gifts",
        "description": "Gift-ready devotional assortments for families, guests, and events.",
    },
    {
        "label": "Temple Accessories",
        "key": "templeAccessories",
        "slug": "temple-accessories",
        "description": "Mandir styling, altar support pieces, and devotional display items.",
    },
    {
        "label": "Festival Special Items",
        "key": "festivalSpecial",
        "slug": "festival-special-items",
        "description": "Seasonal kits curated for major pujas and auspicious celebrations.",
    },
]


CATEGORY_DETAILS_BY_LABEL = {detail["label"]: detail for detail in CATEGORY_DETAILS}


PRODUCT_IMAGE_FALLBACKS = {
    "aarti-essentials-tray": "/products/feature-aarti-essentials.jpg",
    "brass-diya-lamp": "/products/feature-brass-vessels.jpg",
    "brass-kalash": "/products/feature-brass-vessels.jpg",
    "brass-vessel-pair": "/products/feature-brass-vessels.jpg",
}


PRODUCTS_DATABASE: Dict[str, dict] = {
    "puja-thali-set": {
        "id": "puja-thali-set",
        "name": "Puja Thali Set",
        "category": "Puja Samagri",
        "categoryKey": "pujaSamagri",
        "categorySlug": "puja-samagri",
        "description": "A complete puja thali arrangement for daily archana, harathi, and home mandir rituals with a rich brass presentation.",
        "imageUrl": "/products/puja-thali-set.jpg",
        "featured": True,
        "badge": "Daily Essential",
        "useCase": "Ideal for morning puja, evening deepam, and special family prayers.",
        "tags": ["harathi", "daily puja", "altar setup"],
        "sortOrder": 1,
    },
    "kumkum-turmeric-set": {
        "id": "kumkum-turmeric-set",
        "name": "Kumkum & Turmeric Set",
        "category": "Puja Samagri",
        "categoryKey": "pujaSamagri",
        "categorySlug": "puja-samagri",
        "description": "A ready-to-use haldi and kumkum pairing for prasadam plates, vratam use, and festive welcome rituals.",
        "imageUrl": "/products/kumkum-turmeric-set.jpg",
        "featured": True,
        "badge": "Festival Favourite",
        "useCase": "Useful for vratams, house visits, and auspicious welcome rituals.",
        "tags": ["haldi", "kumkum", "vratam"],
        "sortOrder": 2,
    },
    "incense-sticks-pack": {
        "id": "incense-sticks-pack",
        "name": "Incense Sticks Pack",
        "category": "Puja Samagri",
        "categoryKey": "pujaSamagri",
        "categorySlug": "puja-samagri",
        "description": "A fragrant incense assortment designed to bring a warm devotional atmosphere to everyday puja and special celebrations.",
        "imageUrl": "/products/incense-sticks-pack.jpg",
        "featured": True,
        "badge": "Fragrance",
        "useCase": "Best for daily lighting, meditation corners, and spiritual gifting.",
        "tags": ["agarbatti", "fragrance", "meditation"],
        "sortOrder": 3,
    },
    "camphor-box": {
        "id": "camphor-box",
        "name": "Camphor Box",
        "category": "Puja Samagri",
        "categoryKey": "pujaSamagri",
        "categorySlug": "puja-samagri",
        "description": "Camphor cubes for harathi, cleansing rituals, and traditional temple-style puja finishes.",
        "imageUrl": "/products/camphor-box.jpg",
        "featured": True,
        "badge": "Best Seller",
        "useCase": "Commonly used for deepa harathi and prayer room purification.",
        "tags": ["karpooram", "harathi", "purification"],
        "sortOrder": 4,
    },
    "vibhuti-kumkum-set": {
        "id": "vibhuti-kumkum-set",
        "name": "Vibhuti & Kumkum Set",
        "category": "Puja Samagri",
        "categoryKey": "pujaSamagri",
        "categorySlug": "puja-samagri",
        "description": "A compact tray-style pairing of vibhuti, turmeric, and kumkum for quick and clean ritual setup.",
        "imageUrl": "/products/vibhuti-kumkum-set.jpg",
        "featured": False,
        "badge": "Compact Set",
        "useCase": "Handy for daily puja shelves, travel kits, and gifting.",
        "tags": ["vibhuti", "kumkum", "travel kit"],
        "sortOrder": 5,
    },
    "puja-oil-set": {
        "id": "puja-oil-set",
        "name": "Puja Oil Set",
        "category": "Puja Samagri",
        "categoryKey": "pujaSamagri",
        "categorySlug": "puja-samagri",
        "description": "Lamp oil for daily deepam, festive lighting, and temple-style devotional arrangements.",
        "imageUrl": "/products/puja-oil-set.jpg",
        "featured": False,
        "badge": "Deepam Care",
        "useCase": "Pairs well with cotton wicks, brass diyas, and evening prayers.",
        "tags": ["deepam", "oil", "lamp care"],
        "sortOrder": 6,
    },
    "aarti-essentials-tray": {
        "id": "aarti-essentials-tray",
        "name": "Aarti Essentials Tray",
        "category": "Puja Samagri",
        "useCase": "Works beautifully in pooja counters, decor shelves, and ceremonial setups.",
        "tags": ["vessels", "decor", "brassware"],
        "sortOrder": 10,
        "isCollection": True,
    },
    "sacred-return-gift-set": {
        "id": "sacred-return-gift-set",
        "name": "Sacred Return Gift Set",
        "category": "Return Gifts",
        "categoryKey": "returnGifts",
        "categorySlug": "return-gifts",
        "description": "A devotional gift-ready assortment with rich festive tones, suitable for family functions and spiritual giveaways.",
        "imageUrl": "/products/feature-gift-sets.jpg",
        "featured": False,
        "badge": "Gift Ready",
        "useCase": "A strong match for vratam functions, Navaratri visits, and return gifting.",
        "tags": ["return gifts", "event packs", "function orders"],
        "sortOrder": 11,
        "isCollection": True,
    },
    "temple-decor-collection": {
        "id": "temple-decor-collection",
        "name": "Temple Decor Collection",
        "category": "Temple Accessories",
        "categoryKey": "templeAccessories",
        "categorySlug": "temple-accessories",
        "description": "An altar styling collection inspired by temple brass decor, floral presentation, and devotional focal pieces.",
        "imageUrl": "/products/feature-deity-decor.jpg",
        "featured": False,
        "badge": "Decor Focus",
        "useCase": "Best for pooja rooms, festive mantap styling, and centerpiece arrangements.",
        "tags": ["altar decor", "mandir styling", "devotional display"],
        "sortOrder": 12,
        "isCollection": True,
    },
    "sankranti-puja-kit": {
        "id": "sankranti-puja-kit",
        "name": "Sankranti Puja Kit",
        "category": "Festival Special Items",
        "categoryKey": "festivalSpecial",
        "categorySlug": "festival-special-items",
        "description": "A festival-ready Sankranti kit that groups core samagri items in one tray for family celebrations and gifting.",
        "imageUrl": "/products/sankranti-puja-kit.jpg",
        "featured": True,
        "badge": "Seasonal Kit",
        "useCase": "Planned for family puja, festive visits, and ready-to-carry seasonal needs.",
        "tags": ["Sankranti", "festival kit", "samagri combo"],
        "sortOrder": 13,
    },
    "vinayaka-chavithi-set": {
        "id": "vinayaka-chavithi-set",
        "name": "Vinayaka Chavithi Set",
        "category": "Festival Special Items",
        "categoryKey": "festivalSpecial",
        "categorySlug": "festival-special-items",
        "description": "A curated Ganesha festival assortment assembled for eco-friendly and home-friendly Vinayaka Chavithi rituals.",
        "imageUrl": "/products/vinayaka-chavithi-set.jpg",
        "featured": False,
        "badge": "Eco-Friendly",
        "useCase": "Useful when families want a ready ritual set for Ganesh puja at home.",
        "tags": ["Ganesha", "eco-friendly", "festival set"],
        "sortOrder": 14,
    },
    "varalakshmi-vratham-kit": {
        "id": "varalakshmi-vratham-kit",
        "name": "Varalakshmi Vratham Kit",
        "category": "Festival Special Items",
        "categoryKey": "festivalSpecial",
        "categorySlug": "festival-special-items",
        "description": "A full vratham arrangement for Lakshmi-focused rituals, including visual setup pieces and supporting puja materials.",
        "imageUrl": "/products/varalakshmi-vratham-kit.jpg",
        "featured": False,
        "badge": "Vratham Special",
        "useCase": "Built for family Lakshmi puja, vratam prep, and function gifting.",
        "tags": ["Lakshmi", "vratham", "festival combo"],
        "sortOrder": 15,
    },
    "ugadi-special-set": {
        "id": "ugadi-special-set",
        "name": "Ugadi Special Set",
        "category": "Festival Special Items",
        "categoryKey": "festivalSpecial",
        "categorySlug": "festival-special-items",
        "description": "A bright festive pack arranged for Ugadi gifting, puja shelves, and auspicious new-year celebrations.",
        "imageUrl": "/products/ugadi-special-set.jpg",
        "featured": False,
        "badge": "New Year Ready",
        "useCase": "Designed for new-year puja, family sharing, and celebratory gifting.",
        "tags": ["Ugadi", "festival", "gift pack"],
        "sortOrder": 16,
    },
}


PRODUCT_COMMERCE_DETAILS: Dict[str, dict] = {
    "puja-thali-set": {"price": 299, "rating": 4.5, "reviewCount": 120, "quantity": 12},
    "kumkum-turmeric-set": {"price": 149, "rating": 4.4, "reviewCount": 86, "quantity": 20},
    "incense-sticks-pack": {"price": 99, "rating": 4.3, "reviewCount": 74, "quantity": 34},
    "camphor-box": {"price": 129, "rating": 4.6, "reviewCount": 163, "quantity": 18},
    "vibhuti-kumkum-set": {"price": 189, "rating": 4.2, "reviewCount": 58, "quantity": 11},
    "puja-oil-set": {"price": 219, "rating": 4.4, "reviewCount": 91, "quantity": 16},
    "aarti-essentials-tray": {"price": 399, "rating": 4.7, "reviewCount": 112, "quantity": 9},
    "brass-diya-lamp": {"price": 549, "rating": 4.6, "reviewCount": 104, "quantity": 8},
    "brass-kalash": {"price": 699, "rating": 4.8, "reviewCount": 96, "quantity": 6},
    "brass-vessel-pair": {"price": 749, "rating": 4.5, "reviewCount": 67, "quantity": 5},
    "sacred-return-gift-set": {"price": 499, "rating": 4.7, "reviewCount": 81, "quantity": 14},
    "temple-decor-collection": {"price": 899, "rating": 4.8, "reviewCount": 54, "quantity": 0},
    "sankranti-puja-kit": {"price": 459, "rating": 4.6, "reviewCount": 138, "quantity": 10},
    "vinayaka-chavithi-set": {"price": 529, "rating": 4.7, "reviewCount": 117, "quantity": 7},
    "varalakshmi-vratham-kit": {"price": 799, "rating": 4.9, "reviewCount": 145, "quantity": 4},
    "ugadi-special-set": {"price": 489, "rating": 4.5, "reviewCount": 88, "quantity": 13},
}


for product_id, product in PRODUCTS_DATABASE.items():
    product.update(
        PRODUCT_COMMERCE_DETAILS.get(
            product_id,
            {"price": 299, "rating": 4.5, "reviewCount": 100, "quantity": 10},
        )
    )


for product_id, product in PRODUCTS_DATABASE.items():
    category = str(product.get("category", "")).strip()
    category_details = CATEGORY_DETAILS_BY_LABEL.get(category, {})
    tags = product.get("tags", [])
    if isinstance(tags, list):
        normalized_tags = [str(tag).strip() for tag in tags if str(tag).strip()]
    else:
        normalized_tags = []

    product.setdefault("categoryKey", str(category_details.get("key", "")).strip())
    product.setdefault("categorySlug", str(category_details.get("slug", "")).strip())
    product.setdefault(
        "description",
        str(
            product.get("useCase")
            or category_details.get("description", "")
            or f"{product.get('name', 'This product')} is part of the {category or 'catalog'} collection."
        ).strip(),
    )
    product.setdefault("imageUrl", PRODUCT_IMAGE_FALLBACKS.get(product_id, f"/products/{product_id}.jpg"))
    product.setdefault("featured", False)
    product.setdefault("badge", "Collection" if product.get("isCollection") else category or "Featured")
    product.setdefault("useCase", product.get("description", ""))
    product["tags"] = normalized_tags
    product.setdefault("sortOrder", 0)
    product.setdefault("isCollection", False)


def postgres_enabled() -> bool:
    return POSTGRES_STORAGE_AVAILABLE


def set_postgres_storage_available(value: bool) -> None:
    global POSTGRES_STORAGE_AVAILABLE
    POSTGRES_STORAGE_AVAILABLE = value


def summarize_exception(exc: Exception) -> str:
    return str(exc).splitlines()[0].strip()


def get_smtp_host() -> str:
    return get_setting("SMTP_HOST")


def get_smtp_port() -> int:
    raw_port = get_setting("SMTP_PORT", "465")
    try:
        return int(raw_port)
    except ValueError:
        return 465


def get_smtp_user() -> str:
    return get_setting("SMTP_USER")


def get_smtp_password() -> str:
    return "".join(get_setting("SMTP_PASSWORD").split())


def get_smtp_sender() -> str:
    sender = get_setting("SMTP_SENDER")
    if sender:
        return sender
    return get_smtp_user()


def get_order_email_recipient() -> str:
    return get_setting("ORDER_EMAIL_TO", "mv910020@gmail.com") or get_smtp_sender() or get_smtp_user()


def get_smtp_secure_mode() -> str:
    return get_setting("SMTP_SECURE", "ssl").lower()


def get_razorpay_key_id() -> str:
    return get_setting("RAZORPAY_KEY_ID")


def get_razorpay_key_secret() -> str:
    return get_setting("RAZORPAY_KEY_SECRET")


def get_razorpay_business_name() -> str:
    business_name = get_setting("RAZORPAY_BUSINESS_NAME", "Aachara Nilayam")
    return business_name or "Aachara Nilayam"


def ensure_razorpay_configured() -> None:
    if get_razorpay_key_id() and get_razorpay_key_secret():
        return

    raise RuntimeError("Razorpay Test Mode is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.")


def build_razorpay_authorization_header() -> str:
    credentials = f"{get_razorpay_key_id()}:{get_razorpay_key_secret()}".encode("utf-8")
    return f"Basic {base64.b64encode(credentials).decode('ascii')}"


def sanitize_razorpay_notes(notes: Dict[str, str] | None) -> Dict[str, str]:
    cleaned_notes: Dict[str, str] = {}
    if not notes:
        return cleaned_notes

    for raw_key, raw_value in notes.items():
        note_key = str(raw_key).strip()
        note_value = str(raw_value).strip()
        if not note_key or not note_value:
            continue

        cleaned_notes[note_key[:256]] = note_value[:256]
        if len(cleaned_notes) >= 15:
            break

    return cleaned_notes


def describe_razorpay_http_error(exc: urllib_error.HTTPError) -> str:
    try:
        response_body = exc.read().decode("utf-8", errors="replace")
    except Exception:  # pragma: no cover - defensive fallback
        return summarize_exception(exc)

    try:
        parsed_response = json.loads(response_body)
    except json.JSONDecodeError:
        return response_body or summarize_exception(exc)

    error_payload = parsed_response.get("error")
    if isinstance(error_payload, dict):
        description = error_payload.get("description")
        if isinstance(description, str) and description.strip():
            return description.strip()

    return response_body or summarize_exception(exc)


def create_razorpay_order(payment_request: RazorpayOrderInput) -> dict:
    ensure_razorpay_configured()

    payload = {
        "amount": payment_request.amount,
        "currency": payment_request.currency.upper(),
        "receipt": payment_request.receipt.strip(),
        "notes": sanitize_razorpay_notes(payment_request.notes),
    }
    encoded_payload = json.dumps(payload).encode("utf-8")
    request = urllib_request.Request(
        "https://api.razorpay.com/v1/orders",
        data=encoded_payload,
        headers={
            "Authorization": build_razorpay_authorization_header(),
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        raise RuntimeError(f"Unable to create Razorpay order: {describe_razorpay_http_error(exc)}") from exc
    except urllib_error.URLError as exc:
        raise RuntimeError(f"Unable to reach Razorpay: {summarize_exception(exc)}") from exc


def verify_razorpay_payment_signature(payment_details: RazorpayVerifyInput) -> None:
    ensure_razorpay_configured()

    if payment_details.orderId != payment_details.razorpayOrderId:
        raise RuntimeError("Razorpay order verification failed because the order IDs do not match.")

    signature_payload = (
        f"{payment_details.orderId}|{payment_details.razorpayPaymentId}".encode("utf-8")
    )
    generated_signature = hmac.new(
        get_razorpay_key_secret().encode("utf-8"),
        signature_payload,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(generated_signature, payment_details.razorpaySignature):
        raise RuntimeError("Razorpay payment signature verification failed.")


def format_order_email_message(order_message: str) -> EmailMessage:
    email_message = EmailMessage()
    email_message["Subject"] = "New order received"
    email_message["From"] = get_smtp_sender()
    email_message["To"] = get_order_email_recipient()
    email_message.set_content(order_message)
    return email_message


def get_default_estimated_delivery_date() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%d %b %Y")


def get_primary_order_number(order_email: OrderEmailInput) -> str:
    if order_email.primaryOrderNumber and order_email.primaryOrderNumber.strip():
        return order_email.primaryOrderNumber.strip()

    for item in order_email.items:
        if item.orderNumber.strip():
            return item.orderNumber.strip()

    return "Aachara Nilayam order"


def get_customer_support_email() -> str:
    return get_order_email_recipient() or get_smtp_sender() or get_smtp_user()


def get_frontend_public_directories() -> List[Path]:
    configured_path = get_setting("FRONTEND_PUBLIC_DIR")
    candidate_directories: List[Path] = []

    if configured_path:
        candidate_directories.append(Path(configured_path).expanduser())

    candidate_directories.extend(DEFAULT_FRONTEND_PUBLIC_DIRS)

    resolved_directories: List[Path] = []
    seen_directories: set[str] = set()
    for candidate_directory in candidate_directories:
        resolved_directory = candidate_directory.resolve()
        resolved_directory_key = str(resolved_directory)

        if resolved_directory_key in seen_directories or not resolved_directory.is_dir():
            continue

        seen_directories.add(resolved_directory_key)
        resolved_directories.append(resolved_directory)

    return resolved_directories


def resolve_public_asset_path(asset_url: str | None) -> Path | None:
    if not asset_url:
        return None

    parsed_url = urlparse(asset_url.strip())
    asset_path = (parsed_url.path or asset_url).strip()
    if not asset_path:
        return None

    for public_directory in get_frontend_public_directories():
        candidate_path = (public_directory / asset_path.lstrip("/")).resolve()
        try:
            candidate_path.relative_to(public_directory)
        except ValueError:
            continue

        if candidate_path.is_file():
            return candidate_path

    return None


def resolve_customer_order_image_source(
    image_url: str | None,
    store_url: str | None = None,
) -> str | None:
    if not image_url:
        return None

    normalized_image_url = image_url.strip()
    parsed_url = urlparse(normalized_image_url)
    if parsed_url.scheme in {"http", "https"} and parsed_url.netloc:
        return normalized_image_url

    asset_path = (parsed_url.path or normalized_image_url).strip()
    if not asset_path or not store_url:
        return None

    return urljoin(f"{store_url.rstrip('/')}/", asset_path.lstrip("/"))


def build_customer_order_email_inline_images(order_email: OrderEmailInput) -> tuple[List[str | None], List[dict]]:
    image_sources: List[str | None] = []
    inline_assets: List[dict] = []
    store_url = get_customer_order_store_url(order_email)

    for index, item in enumerate(order_email.items):
        local_asset_path = resolve_public_asset_path(item.imageUrl)
        if local_asset_path:
            mime_type, _ = mimetypes.guess_type(local_asset_path.name)
            maintype, subtype = ("image", "jpeg")
            if mime_type and "/" in mime_type:
                maintype, subtype = mime_type.split("/", 1)

            content_id = f"order-item-{index}-{uuid4().hex}"
            image_sources.append(f"cid:{content_id}")
            inline_assets.append(
                {
                    "cid": content_id,
                    "data": local_asset_path.read_bytes(),
                    "maintype": maintype,
                    "subtype": subtype,
                }
            )
            continue

        image_sources.append(resolve_customer_order_image_source(item.imageUrl, store_url))

    return image_sources, inline_assets


def get_customer_order_store_url(order_email: OrderEmailInput) -> str | None:
    if order_email.storeUrl:
        parsed_store_url = urlparse(order_email.storeUrl.strip())
        if parsed_store_url.scheme in {"http", "https"} and parsed_store_url.netloc:
            return f"{parsed_store_url.scheme}://{parsed_store_url.netloc}"

    for item in order_email.items:
        if not item.imageUrl:
            continue

        parsed_url = urlparse(item.imageUrl.strip())
        if parsed_url.scheme in {"http", "https"} and parsed_url.netloc:
            return f"{parsed_url.scheme}://{parsed_url.netloc}"

    return None


def get_customer_order_page_url(order_email: OrderEmailInput) -> str | None:
    store_url = get_customer_order_store_url(order_email)
    if not store_url:
        return None

    order_page_url = f"{store_url.rstrip('/')}/orders"
    primary_order_number = get_primary_order_number(order_email)
    if not primary_order_number:
        return order_page_url

    query_string = urlencode(
        {
            "orderNumber": primary_order_number,
            "showConfirmation": "1",
        }
    )
    return f"{order_page_url}?{query_string}"


def build_customer_order_email_body(order_email: OrderEmailInput) -> str:
    customer_name = order_email.customerName.strip() if order_email.customerName else "Customer"
    primary_order_number = get_primary_order_number(order_email)
    total_amount = order_email.totalAmount.strip() if order_email.totalAmount else ""

    item_lines: List[str] = []
    for item in order_email.items:
        item_lines.extend(
            [
                f"- {item.name} x {item.quantity}",
                f"  {item.lineTotal}",
            ]
        )

    if not item_lines:
        item_lines.append("- Your confirmed items are included in this order.")

    support_email = get_customer_support_email()

    lines = [
            f"Hello {customer_name},",
            "",
            "Your order has been confirmed.",
            f"Order number: {primary_order_number}",
    ]
    if total_amount:
        lines.append(f"Total amount: {total_amount}")
    lines.extend(
        [
            "",
            "Items in this shipment:",
            *item_lines,
            "",
            f"Need help? Contact us at {support_email}.",
            "",
            "Aachara Nilayam",
        ]
    )
    return "\n".join(lines)


def build_customer_order_item_html(
    item: OrderEmailItemInput,
    image_source: str | None = None,
    store_url: str | None = None,
) -> str:
    item_name = escape(item.name)
    item_quantity = escape(str(item.quantity))
    item_line_total = escape(item.lineTotal)

    image_html = (
        '<div style="width:88px;height:88px;border-radius:12px;'
        'background:#f6f6f6;border:1px solid #e7e7e7;'
        'font-size:12px;line-height:1.5;color:#7a7a7a;'
        'text-align:center;padding:22px 10px;box-sizing:border-box;">'
        "Item image"
        "</div>"
    )

    resolved_image_source = image_source
    if not resolved_image_source:
        resolved_image_source = resolve_customer_order_image_source(item.imageUrl, store_url)

    if resolved_image_source:
        safe_image_url = escape(resolved_image_source, quote=True)
        safe_alt_text = escape(item.name, quote=True)
        image_html = (
            f'<img src="{safe_image_url}" alt="{safe_alt_text}" width="88" height="88" '
            'style="display:block;width:88px;height:88px;border-radius:12px;'
            'object-fit:cover;border:1px solid #e7e7e7;background:#ffffff;" />'
        )

    return f"""
        <tr>
          <td style="padding:18px 0;border-top:1px solid #ededed;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="104" style="padding:0 16px 0 0;vertical-align:top;">
                  {image_html}
                </td>
                <td style="vertical-align:top;">
                  <div style="font-size:16px;font-weight:700;line-height:1.5;color:#1f1f1f;">{item_name} x {item_quantity}</div>
                  <div style="margin-top:6px;font-size:14px;line-height:1.5;color:#666666;">{item_line_total}</div>
                  <div style="margin-top:4px;font-size:13px;line-height:1.5;color:#8a8a8a;">Order #{escape(item.orderNumber)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
    """


def build_customer_order_email_html(order_email: OrderEmailInput, item_image_sources: List[str | None] | None = None) -> str:
    primary_order_number = get_primary_order_number(order_email)
    total_amount = order_email.totalAmount.strip() if order_email.totalAmount else "Shared in your order summary"
    support_email = get_customer_support_email()
    store_url = get_customer_order_store_url(order_email)
    order_page_url = get_customer_order_page_url(order_email)
    item_image_sources = item_image_sources or [None] * len(order_email.items)

    item_rows_html = "".join(
        build_customer_order_item_html(
            item,
            item_image_sources[index] if index < len(item_image_sources) else None,
            store_url,
        )
        for index, item in enumerate(order_email.items)
    )
    if not item_rows_html:
        item_rows_html = """
        <tr>
          <td style="padding:18px 0;border-top:1px solid #ededed;font-size:15px;line-height:1.7;color:#4b5563;">
            Your order items were confirmed successfully. Item details will be shared in your store summary.
          </td>
        </tr>
        """

    view_order_html = ""
    visit_store_html = ""
    if order_page_url:
        safe_order_page_url = escape(order_page_url, quote=True)
        view_order_html = (
            f'<a href="{safe_order_page_url}" '
            'style="display:inline-block;margin-top:18px;padding:15px 32px;'
            'background:#7c0a0a;border-radius:6px;color:#fff8ea;text-decoration:none;'
            'font-size:16px;font-weight:700;">View your order</a>'
        )

    if store_url:
        safe_store_url = escape(store_url, quote=True)
        visit_store_html = (
            f'<div style="margin-top:22px;font-size:15px;line-height:1.6;color:#444444;">'
            f'or <a href="{safe_store_url}" style="color:#94600b;text-decoration:none;font-weight:700;">Visit our store</a>'
            "</div>"
        )

    return f"""\
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#fff8ea;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8ea;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;background:#ffffff;border:1px solid #f1e2be;">
            <tr>
              <td style="padding:16px 24px 0 24px;background:#fff4d3;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:18px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#7c0a0a;">
                      Aachara Nilayam
                    </td>
                    <td align="right" style="font-size:16px;color:#94600b;">
                      ORDER #{escape(primary_order_number)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 24px 0 24px;">
                <div style="font-size:28px;line-height:1.25;font-weight:700;color:#540404;">Your order has been confirmed</div>
                <div style="margin-top:14px;font-size:15px;line-height:1.7;color:#6a432f;">
                  Need help with your order?
                  <a href="mailto:{escape(support_email, quote=True)}" style="color:#7c0a0a;text-decoration:none;font-weight:700;"> Let us know</a>
                </div>
                {view_order_html}
                {visit_store_html}
                <div style="margin-top:26px;font-size:15px;line-height:1.6;color:#6a432f;">
                  Total amount: <span style="color:#540404;font-weight:700;">{escape(total_amount)}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:56px 24px 12px 24px;">
                <div style="font-size:20px;font-weight:700;color:#540404;">Items in this shipment</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  {item_rows_html}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def format_customer_order_email_message(order_email: OrderEmailInput) -> EmailMessage:
    if not order_email.customerEmail:
        raise RuntimeError("Customer email is required for the order confirmation email")

    item_image_sources, inline_assets = build_customer_order_email_inline_images(order_email)

    email_message = EmailMessage()
    email_message["Subject"] = f"Your Aachara Nilayam order {get_primary_order_number(order_email)} is confirmed"
    email_message["From"] = get_smtp_sender()
    email_message["To"] = str(order_email.customerEmail)
    email_message["Reply-To"] = get_order_email_recipient()
    email_message.set_content(build_customer_order_email_body(order_email))
    email_message.add_alternative(
        build_customer_order_email_html(order_email, item_image_sources),
        subtype="html",
    )

    html_part = email_message.get_payload()[-1]
    for inline_asset in inline_assets:
        html_part.add_related(
            inline_asset["data"],
            maintype=inline_asset["maintype"],
            subtype=inline_asset["subtype"],
            cid=f"<{inline_asset['cid']}>",
        )

    return email_message


def send_email_messages(email_messages: List[EmailMessage]) -> dict:
    smtp_host = get_smtp_host()
    smtp_port = get_smtp_port()
    smtp_user = get_smtp_user()
    smtp_password = get_smtp_password()
    smtp_sender = get_smtp_sender()
    recipients = [str(email_message["To"]) for email_message in email_messages if email_message["To"]]

    if not smtp_host or not smtp_user or not smtp_password or not smtp_sender or not recipients:
        raise RuntimeError("SMTP email is not configured")

    tls_context = ssl.create_default_context()

    try:
        if get_smtp_secure_mode() == "ssl":
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=tls_context, timeout=15) as server:
                server.login(smtp_user, smtp_password)
                for email_message in email_messages:
                    server.send_message(email_message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.ehlo()
                if get_smtp_secure_mode() in {"starttls", "tls"}:
                    server.starttls(context=tls_context)
                    server.ehlo()
                server.login(smtp_user, smtp_password)
                for email_message in email_messages:
                    server.send_message(email_message)
    except (smtplib.SMTPException, OSError) as exc:
        raise RuntimeError(f"Unable to send order email: {exc}") from exc

    return {
        "recipients": recipients,
        "sender": smtp_sender,
        "status": "sent",
        "count": len(recipients),
    }


def send_order_email(order_message: str, order_email: OrderEmailInput | None = None) -> dict:
    if not order_email or not order_email.customerEmail:
        raise RuntimeError("Customer email is required for the order confirmation email")

    email_messages = [format_order_email_message(order_message)]
    customer_recipient = None

    customer_message = format_customer_order_email_message(order_email)
    email_messages.append(customer_message)
    customer_recipient = str(order_email.customerEmail)

    provider_response = send_email_messages(email_messages)
    provider_response["storeRecipient"] = get_order_email_recipient()
    provider_response["customerRecipient"] = customer_recipient
    return provider_response


def list_products() -> List[Product]:
    products = [Product(**product) for product in PRODUCTS_DATABASE.values()]
    products.sort(key=lambda product: (-int(product.featured), product.sortOrder, product.name))
    return products


def build_categories(products: List[Product]) -> List[Category]:
    counts = {detail["label"]: 0 for detail in CATEGORY_DETAILS}
    for product in products:
        counts[product.category] = counts.get(product.category, 0) + 1

    return [
        Category(
            label=detail["label"],
            key=detail["key"],
            slug=detail["slug"],
            description=detail["description"],
            productCount=counts.get(detail["label"], 0),
        )
        for detail in CATEGORY_DETAILS
    ]


def persist_inquiry(inquiry_record: dict) -> None:
    if not postgres_enabled():
        IN_MEMORY_INQUIRIES.append(inquiry_record)
        return

    try:
        with open_database() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO customer_inquiries (
                        id,
                        name,
                        phone,
                        message,
                        product_id,
                        created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        inquiry_record["id"],
                        inquiry_record["name"],
                        inquiry_record["phone"],
                        inquiry_record["message"],
                        inquiry_record["productId"],
                        inquiry_record["createdAt"],
                    ),
                )
            connection.commit()
    except Exception as exc:  # pragma: no cover - fallback path
        logger.warning(
            "PostgreSQL insert failed, using in-memory inquiry storage: %s",
            summarize_exception(exc),
        )
        set_postgres_storage_available(False)
        IN_MEMORY_INQUIRIES.append(inquiry_record)


app.include_router(create_ai_router(PRODUCTS_DATABASE, CATEGORY_DETAILS))


@app.on_event("startup")
async def startup() -> None:
    """Initialize database schema and other startup tasks."""
    init_database()


@app.get("/api/products", response_model=List[Product], tags=["Products"])
async def get_products() -> List[Product]:
    return list_products()


@app.get("/api/products/{product_id}", response_model=Product, tags=["Products"])
async def get_product(product_id: str) -> Product:
    product = PRODUCTS_DATABASE.get(product_id)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")

    return Product(**product)


@app.get("/api/categories", response_model=List[Category], tags=["Categories"])
async def get_categories() -> List[Category]:
    return build_categories(list_products())


@app.post("/api/payments/razorpay/order", tags=["Payments"])
async def create_razorpay_payment_order(payload: RazorpayOrderInput):
    try:
        razorpay_order = create_razorpay_order(payload)
    except RuntimeError as exc:
        logger.warning("Razorpay order creation failed: %s", exc)
        status_code = 503 if "not configured" in str(exc).lower() else 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive safeguard
        logger.exception("Unexpected Razorpay order error")
        raise HTTPException(
            status_code=500,
            detail="Unable to initialize Razorpay payment right now.",
        ) from exc

    return {
        "amount": razorpay_order.get("amount"),
        "currency": razorpay_order.get("currency"),
        "description": payload.description or "Aachara Nilayam order",
        "keyId": get_razorpay_key_id(),
        "name": get_razorpay_business_name(),
        "orderId": razorpay_order.get("id"),
        "receipt": razorpay_order.get("receipt"),
        "status": razorpay_order.get("status"),
    }


@app.post("/api/payments/razorpay/verify", tags=["Payments"])
async def verify_razorpay_payment(payload: RazorpayVerifyInput):
    try:
        verify_razorpay_payment_signature(payload)
    except RuntimeError as exc:
        logger.warning("Razorpay verification failed: %s", exc)
        status_code = 503 if "not configured" in str(exc).lower() else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive safeguard
        logger.exception("Unexpected Razorpay verification error")
        raise HTTPException(
            status_code=500,
            detail="Unable to verify the payment right now.",
        ) from exc

    return {
        "orderId": payload.orderId,
        "paymentId": payload.razorpayPaymentId,
        "verified": True,
    }


@app.post("/api/inquiries", response_model=Inquiry, tags=["Inquiries"])
async def create_inquiry(inquiry: InquiryInput) -> Inquiry:
    if inquiry.productId and inquiry.productId not in PRODUCTS_DATABASE:
        raise HTTPException(status_code=404, detail="Selected product could not be found")

    inquiry_record = {
        "id": str(uuid4()),
        "name": inquiry.name.strip(),
        "phone": inquiry.phone.strip(),
        "message": inquiry.message.strip(),
        "productId": inquiry.productId,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    persist_inquiry(inquiry_record)
    return Inquiry(**inquiry_record)


@app.post("/api/orders/send-order-email", tags=["Orders"])
async def send_order_email_notification(payload: OrderEmailInput):
    message = payload.message.strip() if payload.message else ""

    if not message:
        raise HTTPException(
            status_code=422,
            detail="Provide an order message.",
        )

    if not payload.customerEmail:
        raise HTTPException(
            status_code=422,
            detail="Enter the customer email in Delivery Address to send the confirmation email.",
        )

    try:
        provider_response = send_order_email(message, payload)
    except RuntimeError as exc:
        logger.warning("Order email failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive safeguard
        logger.exception("Unexpected order email error")
        raise HTTPException(
            status_code=500,
            detail="Unable to send the order email right now.",
        ) from exc

    logger.info(
        "Order emails accepted for store %s and customer %s: %s",
        get_order_email_recipient(),
        payload.customerEmail or "not-requested",
        provider_response,
    )

    return {
        "recipient": get_order_email_recipient(),
        "customerRecipient": str(payload.customerEmail) if payload.customerEmail else None,
        "providerResponse": provider_response,
        "sent": True,
    }


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "Aachara Nilayam API",
        "version": "3.0.0",
        "catalogStorage": "application-memory",
        "authStorage": get_auth_storage_mode(),
        "inquiryStorage": "postgres" if postgres_enabled() else "memory",
        "assistantConfigured": bool(get_gemini_api_key()),
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to the Aachara Nilayam API",
        "docs": "/docs",
        "apiVersion": "3.0.0",
        "endpoints": {
            "products": "/api/products",
            "product_detail": "/api/products/{product_id}",
            "categories": "/api/categories",
            "inquiries": "POST /api/inquiries",
            "chat": "POST /api/chat",
            "health": "/api/health",
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=get_api_host(),
        port=get_api_port(),
        reload=is_debug_enabled(),
    )
