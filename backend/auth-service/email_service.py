import os
import smtplib
from email.message import EmailMessage


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _smtp_password() -> str:
    return os.getenv("SMTP_PASSWORD", "").replace(" ", "")


def send_email(to_email: str, subject: str, body: str) -> None:
    dev_mode = _env_bool("EMAIL_DEV_MODE", True)
    if dev_mode:
        print(f"DEV EMAIL to {to_email}: {body}")
        return

    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    use_tls = _env_bool("SMTP_USE_TLS", True)
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = _smtp_password()
    smtp_from = os.getenv("SMTP_FROM", smtp_user)
    redirect_to = os.getenv("SMTP_REDIRECT_TO", "").strip()

    actual_recipient = redirect_to or to_email
    actual_body = body
    if redirect_to:
        actual_body = f"Original recipient: {to_email}\n\n{body}"

    message = EmailMessage()
    message["From"] = smtp_from
    message["To"] = actual_recipient
    message["Subject"] = subject
    message.set_content(actual_body)

    with smtplib.SMTP(host, port, timeout=15) as smtp:
        if use_tls:
            smtp.starttls()
        smtp.login(smtp_user, smtp_password)
        smtp.send_message(message)
