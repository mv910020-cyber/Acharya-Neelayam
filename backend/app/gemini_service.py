from __future__ import annotations

import base64
import binascii
import json
import logging
from functools import lru_cache
from typing import Any, Literal, Mapping, Sequence

from pydantic import BaseModel, Field, ValidationError

from .config import get_gemini_api_key, get_gemini_model
from .rag_engine import RetrievedContext

try:
    from google import genai
    from google.genai import types
except ImportError:  # pragma: no cover - dependency installed in runtime environments
    genai = None
    types = None


logger = logging.getLogger(__name__)
DEFAULT_MODEL = "gemini-2.5-flash"
MAX_INLINE_FILE_BYTES = 10 * 1024 * 1024


class AssistantServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


AssistantAction = Literal["add_to_cart", "buy_now"]


class StructuredAssistantReply(BaseModel):
    text: str = Field(min_length=1, max_length=400)
    productId: str | None = Field(default=None, max_length=120)
    actions: list[AssistantAction] = Field(default_factory=list, max_length=2)


@lru_cache(maxsize=1)
def _build_gemini_client(api_key: str):
    assert genai is not None
    return genai.Client(api_key=api_key)


def _get_gemini_client():
    if genai is None:
        raise AssistantServiceError(
            "The Google GenAI SDK is not installed on the backend yet.",
            status_code=503,
        )

    api_key = get_gemini_api_key()
    if not api_key:
        raise AssistantServiceError(
            "The AI assistant is not configured yet. Add GEMINI_API_KEY to the backend environment.",
            status_code=503,
        )

    return _build_gemini_client(api_key)


def _attachment_to_part(attachment: Mapping[str, Any]):
    assert types is not None

    mime_type = str(attachment.get("mimeType", "")).strip().lower()
    if not mime_type:
        raise AssistantServiceError("Attached files must include a mime type.")

    if mime_type != "application/pdf" and not mime_type.startswith("image/"):
        raise AssistantServiceError(
            "Only image files and PDFs are supported right now."
        )

    raw_base64 = str(attachment.get("data", "")).strip()
    if not raw_base64:
        raise AssistantServiceError("Attached files must include Base64 data.")

    try:
        file_bytes = base64.b64decode(raw_base64.encode("utf-8"), validate=True)
    except (ValueError, binascii.Error) as exc:
        raise AssistantServiceError("The uploaded file data is not valid Base64.") from exc

    if not file_bytes:
        raise AssistantServiceError("The uploaded file is empty.")

    if len(file_bytes) > MAX_INLINE_FILE_BYTES:
        raise AssistantServiceError(
            "The uploaded file is too large for inline processing. Please use a file under 10 MB."
        )

    return types.Part.from_bytes(data=file_bytes, mime_type=mime_type)


def _message_to_content(
    role: str,
    text: str,
    attachment: Mapping[str, Any] | None = None,
):
    assert types is not None

    parts = []
    if attachment is not None:
        parts.append(_attachment_to_part(attachment))

    cleaned_text = text.strip()
    if cleaned_text:
        parts.append(types.Part(text=cleaned_text))

    if not parts:
        return None

    sdk_role = "model" if role == "assistant" else "user"
    return types.Content(role=sdk_role, parts=parts)


def _build_system_instruction(platform_context: RetrievedContext, language: str) -> str:
    response_language = "Telugu" if language == "te" else "English"
    matched_titles = ", ".join(platform_context.matched_titles) or "general platform guidance"

    return (
        "You are an exclusive customer support assistant for Aachara Nilayam. "
        "Your ONLY job is to provide details about the puja products available on this website. "
        "Do not answer general knowledge questions, write code, or discuss topics outside of this store's inventory. "
        "If asked something unrelated, politely decline and steer the conversation back to our products. "
        f"Reply in {response_language}. "
        "Keep all responses extremely short, concise, and to the point. "
        "Use the retrieved context below as your primary source of truth. "
        "Only mention pricing when it is explicitly present in the context. "
        "Never invent stock counts, delivery dates, refund rules, or other store policies that are not explicitly provided. "
        "If the user uploads an image or PDF, use it only to identify or explain products from this store when relevant. "
        "When the user asks about a specific product, keep the reply to plain field lines only. "
        "Use exactly this format: `Product Name :- ...` newline `Price :- ...` newline `Quantity :- ...`. "
        "If quantity is 0, write `Quantity :- Not available`. "
        "Do not add descriptions, benefits, reviews, or extra theory. "
        "When recommending exactly one specific catalog product, set `productId` to the exact Product ID from the context and set `actions` to both `add_to_cart` and `buy_now` only when quantity is above 0. "
        "If you are not recommending one exact product, leave `productId` null and `actions` empty.\n\n"
        f"Retrieved context focus: {matched_titles}\n"
        f"{platform_context.context_text}"
    )


def _normalize_structured_reply(payload: StructuredAssistantReply) -> StructuredAssistantReply:
    text = " ".join(payload.text.split()).strip()
    if not text:
        text = "I can help only with Aachara Nilayam products."
    actions = [action for action in payload.actions if action in {"add_to_cart", "buy_now"}]

    if not payload.productId:
        return StructuredAssistantReply(text=text, productId=None, actions=[])

    return StructuredAssistantReply(text=text, productId=payload.productId, actions=actions)


def _extract_structured_reply(response: Any) -> StructuredAssistantReply:
    parsed = getattr(response, "parsed", None)
    response_text = _extract_response_text(response)

    if isinstance(parsed, StructuredAssistantReply):
        return _normalize_structured_reply(parsed)

    if isinstance(parsed, dict):
        try:
            return _normalize_structured_reply(StructuredAssistantReply.model_validate(parsed))
        except ValidationError:
            pass

    try:
        payload = json.loads(response_text)
    except json.JSONDecodeError:
        return StructuredAssistantReply(text=response_text[:400] or "I can help only with Aachara Nilayam products.")

    try:
        return _normalize_structured_reply(StructuredAssistantReply.model_validate(payload))
    except ValidationError:
        return StructuredAssistantReply(text=response_text[:400] or "I can help only with Aachara Nilayam products.")


def _extract_response_text(response: Any) -> str:
    direct_text = getattr(response, "text", "") or ""
    direct_text = direct_text.strip()
    if direct_text:
        return direct_text

    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or []
        text_parts = [
            str(getattr(part, "text", "")).strip()
            for part in parts
            if getattr(part, "text", None)
        ]
        combined = "\n".join(part for part in text_parts if part)
        if combined:
            return combined

    raise AssistantServiceError("The AI assistant returned an empty response.", status_code=502)


def generate_assistant_reply(
    history: Sequence[Mapping[str, Any]],
    user_message: str,
    platform_context: RetrievedContext,
    language: str = "en",
    attachment: Mapping[str, Any] | None = None,
) -> StructuredAssistantReply:
    if types is None:
        _get_gemini_client()
        raise AssistantServiceError("The AI assistant dependencies could not be loaded.", status_code=503)

    client = _get_gemini_client()
    contents = []

    for history_item in history:
        content = _message_to_content(
            role=str(history_item.get("role", "user")).strip(),
            text=str(history_item.get("text", "") or ""),
            attachment=history_item.get("attachment"),
        )
        if content is not None:
            contents.append(content)

    current_message = _message_to_content(
        role="user",
        text=user_message,
        attachment=attachment,
    )
    if current_message is not None:
        contents.append(current_message)

    if not contents:
        raise AssistantServiceError("A chat message is required before sending.")

    model_name = get_gemini_model() or DEFAULT_MODEL

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=_build_system_instruction(platform_context, language),
                response_mime_type="application/json",
                response_schema=StructuredAssistantReply,
            ),
        )
    except AssistantServiceError:
        raise
    except Exception as exc:  # pragma: no cover - depends on external provider
        logger.exception("Gemini request failed")
        raise AssistantServiceError(
            "The AI assistant could not complete the request right now. Please try again in a moment.",
            status_code=502,
        ) from exc

    return _extract_structured_reply(response)
