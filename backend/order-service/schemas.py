from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("Field cannot be blank.")
    return value


class OrderItemCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    product_name: str = Field(..., min_length=1, max_length=160)
    product_sku: str = Field(..., min_length=1, max_length=80)
    quantity: int = Field(..., gt=0)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("product_name", "product_sku")
    @classmethod
    def text_not_blank(cls, value: str) -> str:
        return non_blank(value)


class OrderCreate(BaseModel):
    items: list[OrderItemCreate] = Field(..., min_length=1)


class OrderRejectRequest(BaseModel):
    admin_response: str = Field(..., min_length=1, max_length=2000)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("admin_response")
    @classmethod
    def response_not_blank(cls, value: str) -> str:
        return non_blank(value)


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_sku: str
    quantity: int

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: int
    user_id: int
    user_name: str | None
    user_email: str | None
    status: str
    admin_response: str | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse]

    model_config = {"from_attributes": True}
