from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OrderItemCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    product_name: str = Field(..., min_length=1, max_length=160)
    product_sku: str = Field(..., min_length=1, max_length=80)
    quantity: int = Field(..., gt=0)

    model_config = ConfigDict(str_strip_whitespace=True)


class OrderCreate(BaseModel):
    items: list[OrderItemCreate] = Field(..., min_length=1)


class OrderRejectRequest(BaseModel):
    admin_response: str = Field(..., min_length=1, max_length=2000)

    model_config = ConfigDict(str_strip_whitespace=True)


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
    status: str
    admin_response: str | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse]

    model_config = {"from_attributes": True}
