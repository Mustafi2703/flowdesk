"""Role definitions and permission helpers.

Mirrors section 3 of the requirements doc. Authorization is enforced at the
API layer (see app/api/v1/deps.py); RLS is enabled at the DB level as
defense-in-depth (see alembic migration).
"""

from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    OWNER = "owner"
    MANAGER = "manager"
    TEAM = "team"
    HR = "hr"
    ACCOUNTANT = "accountant"
    DEVELOPER = "developer"


ALL_ROLES: frozenset[Role] = frozenset(Role)

MANAGEMENT: frozenset[Role] = frozenset({Role.OWNER, Role.MANAGER})
HR_AND_ABOVE: frozenset[Role] = frozenset({Role.OWNER, Role.MANAGER, Role.HR})
BILLING_VIEW: frozenset[Role] = frozenset({Role.OWNER, Role.MANAGER, Role.ACCOUNTANT})
BILLING_EDIT: frozenset[Role] = frozenset({Role.OWNER, Role.ACCOUNTANT})
BILLING_PRICE: frozenset[Role] = frozenset({Role.OWNER, Role.MANAGER, Role.ACCOUNTANT})


def can_manage(role: Role) -> bool:
    """Create / edit / delete tasks and brands."""
    return role in MANAGEMENT


def can_delete_anything(role: Role) -> bool:
    """Only Owner can delete tasks and deactivate users."""
    return role is Role.OWNER


def can_view_billing(role: Role) -> bool:
    return role in BILLING_VIEW


def can_edit_billing(role: Role) -> bool:
    """Mark billed."""
    return role in BILLING_EDIT


def can_set_price(role: Role) -> bool:
    """Set billable amount on tasks."""
    return role in BILLING_PRICE


def can_approve_leave(role: Role) -> bool:
    return role in {Role.OWNER, Role.HR}


def can_view_team(role: Role) -> bool:
    return role in HR_AND_ABOVE


def can_view_performance(role: Role) -> bool:
    return role in HR_AND_ABOVE


def can_post_announcement(role: Role) -> bool:
    return role in MANAGEMENT
