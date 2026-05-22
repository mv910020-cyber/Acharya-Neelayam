from __future__ import annotations

from typing import Any, Literal, Mapping, Sequence

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .gemini_service import AssistantAction, AssistantServiceError, generate_assistant_reply
from .rag_engine import retrieve_context


MAX_HISTORY_ITEMS = 12


class ChatAttachmentInput(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=200)
    mime_type: str = Field(..., alias="mimeType", min_length=3, max_length=120)
    data: str = Field(..., min_length=8)


class ChatHistoryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    text: str = Field(default="", max_length=4000)
    attachment: ChatAttachmentInput | None = None


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=MAX_HISTORY_ITEMS)
    message: str = Field(..., min_length=1, max_length=4000)
    attachment: ChatAttachmentInput | None = None
    language: Literal["en", "te"] = "en"


class ChatResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    text: str
    product_id: str | None = Field(default=None, alias="productId")
    actions: list[AssistantAction] = Field(default_factory=list)
    contextMatches: list[str] = Field(default_factory=list)


def _build_product_reply(product: Mapping[str, object]) -> str:
    product_name = str(product.get("name", "")).strip()
    price = int(product.get("price", 0) or 0)
    quantity = int(product.get("quantity", 0) or 0)
    quantity_label = "Not available" if quantity <= 0 else str(quantity)

    return (
        f"Product Name :- {product_name}\n"
        f"Price :- ₹{price}\n"
        f"Quantity :- {quantity_label}"
    )


def create_ai_router(
    products_database: Mapping[str, Mapping[str, object]],
    category_details: Sequence[Mapping[str, object]],
) -> APIRouter:
    router = APIRouter(tags=["AI Assistant"])

    @router.post("/api/chat", response_model=ChatResponse)
    async def chat_with_assistant(payload: ChatRequest) -> ChatResponse:
        context = retrieve_context(
            user_query=payload.message,
            products_database=products_database,
            category_details=category_details,
        )

        history_payload = [
            message.model_dump(by_alias=True)
            for message in payload.history[-MAX_HISTORY_ITEMS:]
        ]
        attachment_payload = (
            payload.attachment.model_dump(by_alias=True)
            if payload.attachment is not None
            else None
        )

        try:
            assistant_message = generate_assistant_reply(
                history=history_payload,
                user_message=payload.message,
                attachment=attachment_payload,
                platform_context=context,
                language=payload.language,
            )
        except AssistantServiceError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
        except Exception as exc:  # pragma: no cover - defensive safeguard
            raise HTTPException(
                status_code=500,
                detail="The AI assistant encountered an unexpected error.",
            ) from exc

        product_id = (
            assistant_message.productId
            if assistant_message.productId in products_database
            else None
        )
        response_text = assistant_message.text
        actions = assistant_message.actions if product_id else []

        if product_id:
            product = products_database[product_id]
            quantity = int(product.get("quantity", 0) or 0)
            response_text = _build_product_reply(product)
            actions = assistant_message.actions if quantity > 0 else []

        return ChatResponse(
            text=response_text,
            productId=product_id,
            actions=actions,
            contextMatches=list(context.matched_titles),
        )

    return router
