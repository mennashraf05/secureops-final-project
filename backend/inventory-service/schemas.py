from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    sku: str = Field(..., min_length=1, max_length=80)
    category: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price: Decimal = Field(..., ge=0, max_digits=12, decimal_places=2)
    quantity: int = Field(..., ge=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)


class StockUpdate(BaseModel):
    quantity: int = Field(..., ge=0)


class InternalStockDeductItem(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)


class InternalStockDeductRequest(BaseModel):
    items: list[InternalStockDeductItem] = Field(..., min_length=1)


class ProductResponse(BaseModel):
    id: int
    name: str
    sku: str
    category: str
    description: str | None
    price: Decimal
    quantity: int
    created_by: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
