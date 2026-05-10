import json
import os
from typing import Any

import requests

from shared.config import settings


def _details_value(details: dict[str, Any] | str | None) -> str | None:
    if details is None:
        return None
    if isinstance(details, str):
        return details
    return json.dumps(details, default=str)


def send_audit_event(
    action: str,
    service_name: str,
    status: str,
    user_id: int | None = None,
    ip_address: str | None = None,
    details: dict[str, Any] | str | None = None,
) -> None:
    audit_url = os.getenv("AUDIT_SERVICE_URL", "http://audit-service:8000/audit/events")
    payload = {
        "user_id": user_id,
        "action": action,
        "service_name": service_name,
        "ip_address": ip_address,
        "status": status,
        "details": _details_value(details),
    }
    headers = {"X-Internal-API-Key": settings.internal_api_key}

    try:
        requests.post(audit_url, json=payload, headers=headers, timeout=1.5)
    except requests.RequestException as exc:
        print(f"Audit warning: could not record {service_name}:{action}: {exc.__class__.__name__}", flush=True)
