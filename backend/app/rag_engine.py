from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Mapping, Sequence


WORD_PATTERN = re.compile(r"[a-z0-9]+")


@dataclass(frozen=True)
class KnowledgeDocument:
    id: str
    title: str
    body: str
    tags: tuple[str, ...]


@dataclass(frozen=True)
class RetrievedContext:
    context_text: str
    matched_titles: tuple[str, ...]


def _normalize_text(value: str) -> str:
    return " ".join(WORD_PATTERN.findall(value.lower()))


def _tokenize(value: str) -> set[str]:
    return set(WORD_PATTERN.findall(value.lower()))


def _core_documents() -> list[KnowledgeDocument]:
    return [
        KnowledgeDocument(
            id="platform-overview",
            title="Platform Overview",
            body=(
                "Aachara Nilayam is a devotional storefront for puja products, brass "
                "items, temple accessories, return gifts, and festival special kits. "
                "The website is built around browsing products, adding items to cart, "
                "using Buy Now for a guided checkout, and contacting the store for "
                "availability or custom planning."
            ),
            tags=("aachara nilayam", "storefront", "puja", "festival kits"),
        ),
        KnowledgeDocument(
            id="order-flow",
            title="Order and Inquiry Flow",
            body=(
                "Authenticated users can browse products, add them to a live cart, "
                "use Buy Now to open a multi-step checkout flow for a single item, "
                "and continue with direct inquiries for product availability, bulk orders, "
                "custom kits, and festival planning."
            ),
            tags=("cart", "checkout", "inquiry", "bulk order"),
        ),
        KnowledgeDocument(
            id="assistant-scope",
            title="Assistant Scope and Guardrails",
            body=(
                "The assistant should only help with product discovery, category "
                "guidance, festival kit planning, devotional use cases, and identifying "
                "catalog items from uploaded images or PDFs when relevant. It must "
                "decline unrelated questions and must not invent stock counts, delivery "
                "dates, refund rules, or store policies that are not explicitly present."
            ),
            tags=("assistant", "pricing", "stock", "policy", "uploads"),
        ),
        KnowledgeDocument(
            id="support-guidance",
            title="Store Support Guidance",
            body=(
                "When exact availability or delivery timing is not present in the "
                "catalog, the assistant should direct the user to contact the store "
                "through phone or email for confirmation. Catalog prices "
                "may be shared only when they are explicitly available in product data."
            ),
            tags=("availability", "pricing", "delivery", "support", "contact"),
        ),
        KnowledgeDocument(
            id="festival-guidance",
            title="Festival Planning Guidance",
            body=(
                "The storefront highlights kits and assortments for Sankranti, Ugadi, "
                "Vinayaka Chavithi, and Varalakshmi Vratham, along with related gifting "
                "and puja essentials."
            ),
            tags=(
                "festival",
                "sankranti",
                "ugadi",
                "vinayaka chavithi",
                "varalakshmi vratham",
            ),
        ),
    ]


def _category_documents(
    products_database: Mapping[str, Mapping[str, object]],
    category_details: Sequence[Mapping[str, object]],
) -> list[KnowledgeDocument]:
    documents: list[KnowledgeDocument] = []

    for detail in category_details:
        label = str(detail.get("label", "")).strip()
        if not label:
            continue

        description = str(detail.get("description", "")).strip()
        category_products = [
            str(product.get("name", "")).strip()
            for product in products_database.values()
            if str(product.get("category", "")).strip() == label
        ]
        category_products = [name for name in category_products if name]
        preview_names = ", ".join(category_products[:4]) if category_products else "No products listed yet"

        documents.append(
            KnowledgeDocument(
                id=f"category-{str(detail.get('slug', label)).strip()}",
                title=f"{label} Category",
                body=(
                    f"{label} covers the following concept on the website: {description} "
                    f"Current catalog examples include {preview_names}."
                ),
                tags=(
                    label,
                    str(detail.get("key", "")).strip(),
                    str(detail.get("slug", "")).strip(),
                ),
            )
        )

    return documents


def _product_documents(
    products_database: Mapping[str, Mapping[str, object]],
) -> list[KnowledgeDocument]:
    documents: list[KnowledgeDocument] = []

    for product_id, product in products_database.items():
        name = str(product.get("name", "")).strip()
        if not name:
            continue

        category = str(product.get("category", "")).strip()
        description = str(product.get("description", "")).strip()
        use_case = str(product.get("useCase", "")).strip()
        badge = str(product.get("badge", "")).strip()
        price = int(product.get("price", 0) or 0)
        rating = float(product.get("rating", 0) or 0)
        review_count = int(product.get("reviewCount", 0) or 0)
        quantity = int(product.get("quantity", 0) or 0)
        tags = tuple(
            str(tag).strip()
            for tag in product.get("tags", [])
            if str(tag).strip()
        )

        documents.append(
            KnowledgeDocument(
                id=f"product-{product_id}",
                title=name,
                body=(
                    f"Product ID: {product_id}. "
                    f"{name} belongs to the {category} category. "
                    f"Description: {description} "
                    f"Use case: {use_case} "
                    f"Badge: {badge}. "
                    f"Price: INR {price}. "
                    f"Quantity: {quantity}. "
                    f"Rating: {rating:.1f} out of 5 from {review_count} ratings."
                ),
                tags=(product_id, category, badge, *tags),
            )
        )

    return documents


def build_knowledge_documents(
    products_database: Mapping[str, Mapping[str, object]],
    category_details: Sequence[Mapping[str, object]],
) -> list[KnowledgeDocument]:
    return [
        *_core_documents(),
        *_category_documents(products_database, category_details),
        *_product_documents(products_database),
    ]


def _score_document(query_text: str, query_tokens: set[str], document: KnowledgeDocument) -> float:
    title_text = _normalize_text(document.title)
    body_text = _normalize_text(document.body)
    title_tokens = _tokenize(document.title)
    body_tokens = _tokenize(document.body)
    tag_tokens = _tokenize(" ".join(document.tags))

    overlap_title = query_tokens & title_tokens
    overlap_body = query_tokens & body_tokens
    overlap_tags = query_tokens & tag_tokens

    score = 0.0
    score += len(overlap_title) * 4.5
    score += len(overlap_tags) * 2.5
    score += len(overlap_body) * 1.25

    if title_text and title_text in query_text:
        score += 7.0

    for tag in document.tags:
        normalized_tag = _normalize_text(tag)
        if normalized_tag and normalized_tag in query_text:
            score += 3.0

    return score


def retrieve_context(
    user_query: str,
    products_database: Mapping[str, Mapping[str, object]],
    category_details: Sequence[Mapping[str, object]],
    max_documents: int = 5,
) -> RetrievedContext:
    query_text = _normalize_text(user_query)
    query_tokens = _tokenize(user_query)
    documents = build_knowledge_documents(products_database, category_details)

    scored_documents = [
        (document, _score_document(query_text, query_tokens, document))
        for document in documents
    ]
    scored_documents.sort(
        key=lambda item: (-item[1], item[0].title.lower(), item[0].id)
    )

    matched_documents = [
        document for document, score in scored_documents if score > 0
    ][:max_documents]

    if not matched_documents:
        matched_documents = documents[:3]

    context_blocks = [
        f"{index}. {document.title}: {document.body}"
        for index, document in enumerate(matched_documents, start=1)
    ]

    return RetrievedContext(
        context_text="\n".join(context_blocks),
        matched_titles=tuple(document.title for document in matched_documents),
    )
