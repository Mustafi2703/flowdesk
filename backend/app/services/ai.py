"""Claude-backed AI helpers."""

from __future__ import annotations

import httpx

from app.core.config import settings


def write_task_description(*, title: str, brand_name: str | None, task_type: str | None) -> str:
    if not settings.anthropic_api_key:
        brand_part = f" for {brand_name}" if brand_name else ""
        type_part = f" ({task_type})" if task_type else ""
        return (
            f"Deliver {title}{brand_part}{type_part}. "
            "Include clear deliverables, brand guidelines, review checkpoints, "
            "and final export formats agreed with the account manager."
        )

    prompt = (
        "Write a concise, professional task description for a creative agency task.\n"
        f"Title: {title}\n"
        f"Brand: {brand_name or 'N/A'}\n"
        f"Type: {task_type or 'general'}\n"
        "Keep it practical, under 90 words, and include expected deliverables."
    )
    response = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": settings.anthropic_model,
            "max_tokens": 220,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return "".join(block.get("text", "") for block in data.get("content", [])).strip()
