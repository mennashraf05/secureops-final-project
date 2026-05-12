import os

import requests
from sqlalchemy.orm import Session

from models import AuditLog, SystemSetting
from shared.database import SessionLocal


TELEGRAM_SETTING_KEY = "telegram_admin_notifications_enabled"
TELEGRAM_TRIGGER_ACTIONS = {
    "auth.login.failed",
    "auth.unauthorized",
    "orders.ownership.denied",
    "orders.order.created",
    "reports.job.completed",
    "reports.job.failed",
    "inventory.stock.deduct.failed",
}
TELEGRAM_IGNORED_ACTIONS = {
    "settings.telegram_notifications.updated",
}


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def telegram_global_enabled() -> bool:
    return env_flag("TELEGRAM_NOTIFICATIONS_ENABLED")


def telegram_env_configured() -> bool:
    return bool(os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_ADMIN_CHAT_ID"))


def get_telegram_admin_notifications_enabled(db: Session) -> bool:
    setting = db.query(SystemSetting).filter(SystemSetting.key == TELEGRAM_SETTING_KEY).first()
    if not setting:
        return True
    return setting.value.strip().lower() == "true"


def set_telegram_admin_notifications_enabled(db: Session, enabled: bool) -> SystemSetting:
    setting = db.query(SystemSetting).filter(SystemSetting.key == TELEGRAM_SETTING_KEY).first()
    if not setting:
        setting = SystemSetting(key=TELEGRAM_SETTING_KEY, value="true" if enabled else "false")
    else:
        setting.value = "true" if enabled else "false"
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


def telegram_notification_settings(db: Session) -> dict[str, object]:
    return {
        "telegram_admin_notifications_enabled": get_telegram_admin_notifications_enabled(db),
        "telegram_env_configured": telegram_env_configured(),
        "telegram_global_enabled": telegram_global_enabled(),
        "telegram_target": "Admin Telegram channel",
        "telegram_token_visible": False,
        "telegram_chat_id_visible": False,
    }


def should_trigger_telegram(action: str) -> bool:
    if action in TELEGRAM_IGNORED_ACTIONS or action.startswith("notification.telegram."):
        return False
    return action in TELEGRAM_TRIGGER_ACTIONS or action.endswith(".admin.denied")


def format_telegram_audit_message(log: AuditLog) -> str:
    user = str(log.user_id) if log.user_id is not None else "System"
    ip_address = log.ip_address or "Unknown"

    if log.action == "orders.order.created":
        return "\U0001f4e6 New Product Request\nA user submitted a new product request."
    if log.action == "reports.job.completed":
        return "\u2705 SecureOps Report Completed\nReport job completed successfully."
    if log.action == "reports.job.failed":
        return "\u26a0\ufe0f SecureOps Report Failed\nA report job failed."

    title = "\U0001f6a8 SecureOps Security Alert"
    if log.action == "auth.login.failed":
        title = "\U0001f6a8 Failed Login Detected"
    elif log.action.endswith(".admin.denied"):
        title = "\U0001f6a8 Admin Access Denied"

    return (
        f"{title}\n"
        f"Action: {log.action}\n"
        f"User: {user}\n"
        f"IP: {ip_address}\n"
        f"Status: {log.status}"
    )


def send_telegram_admin_message(message: str) -> None:
    if not telegram_global_enabled() or not telegram_env_configured():
        return

    db = SessionLocal()
    try:
        if not get_telegram_admin_notifications_enabled(db):
            return

        token = os.getenv("TELEGRAM_BOT_TOKEN")
        chat_id = os.getenv("TELEGRAM_ADMIN_CHAT_ID")
        if not token or not chat_id:
            return

        response = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": message},
            timeout=4,
        )
        if response.status_code >= 400:
            print(f"Telegram warning: sendMessage returned HTTP {response.status_code}", flush=True)
    except requests.RequestException as exc:
        print(f"Telegram warning: could not send admin notification: {exc.__class__.__name__}", flush=True)
    except Exception as exc:
        print(f"Telegram warning: admin notification skipped: {exc.__class__.__name__}", flush=True)
    finally:
        db.close()


def send_telegram_for_audit_log(log: AuditLog) -> None:
    if not should_trigger_telegram(log.action):
        return
    send_telegram_admin_message(format_telegram_audit_message(log))
