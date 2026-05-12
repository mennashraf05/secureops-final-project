from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


SKU_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]*$"


def non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("Field cannot be blank.")
    return value


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    sku: str = Field(..., min_length=1, max_length=80, pattern=SKU_PATTERN)
    category: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price: Decimal = Field(..., ge=0, max_digits=12, decimal_places=2)
    quantity: int = Field(..., ge=0)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("name", "sku", "category")
    @classmethod
    def required_text_not_blank(cls, value: str) -> str:
        return non_blank(value)

    @field_validator("description")
    @classmethod
    def description_not_blank_if_present(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("name", "category")
    @classmethod
    def optional_text_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return non_blank(value)

    @field_validator("description")
    @classmethod
    def optional_description_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


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
