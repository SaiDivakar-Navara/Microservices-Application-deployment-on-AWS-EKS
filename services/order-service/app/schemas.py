from typing import Literal, Optional

from pydantic import BaseModel, Field


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=20)


class Address(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(default="", max_length=30)
    line1: str = Field(min_length=3, max_length=200)
    line2: Optional[str] = Field(default="", max_length=200)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    postal_code: str = Field(min_length=3, max_length=12)


class OrderCreate(BaseModel):
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)
    shipping_address: Address


class StatusUpdate(BaseModel):
    status: Literal["SHIPPED", "DELIVERED"]
