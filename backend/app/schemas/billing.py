"""Billing schemas."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field


class SetPriceRequest(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)


class MarkBilledRequest(BaseModel):
    billed: bool = True


class BillingSummary(BaseModel):
    total_billable: Decimal | None = None
    pending: Decimal | None = None
    billed: Decimal | None = None
    unpriced: int
    pending_count: int = 0
    billed_count: int = 0
    total_count: int = 0
