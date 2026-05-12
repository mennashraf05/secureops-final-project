# Part 9.7 Telegram Admin Notifications

Part 9.7 adds backend-controlled Telegram alerts for important admin events and adds a safe Accept / Reject control in Admin Settings.

## What Changed

- Added `SystemSetting` storage in Audit Service for `telegram_admin_notifications_enabled`.
- Added `backend/audit-service/telegram_service.py` for best-effort Telegram delivery.
- Added admin-only notification settings endpoints.
- Updated Admin Settings with separate controls for:
  - In-app notifications stored in browser localStorage.
  - Telegram Admin Notifications stored in backend settings.
- Updated Docker Compose and `.env.example` with Telegram placeholders.

## Environment Variables

Required in local `.env` when Telegram is enabled:

```env
TELEGRAM_NOTIFICATIONS_ENABLED=true
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_ADMIN_CHAT_ID=your-telegram-admin-chat-id
```

`.env.example` contains placeholders only. Real tokens and chat IDs must stay in `.env`.

## Bot And Chat Setup

1. Create a Telegram bot with BotFather.
2. Copy the bot token into `TELEGRAM_BOT_TOKEN`.
3. Send a message to the bot or add it to the intended admin channel/group.
4. Resolve the chat ID and place it in `TELEGRAM_ADMIN_CHAT_ID`.
5. Set `TELEGRAM_NOTIFICATIONS_ENABLED=true`.
6. Restart `audit-service`.

## Settings Behavior

In-app notifications are local UI preferences. They control whether the bell fetches and shows notifications in the current browser.

Telegram Admin Notifications are backend settings. Accept means important admin events may be sent to Telegram when environment variables are configured. Reject disables Telegram delivery at the application level.

Telegram sends only when all are true:

- `TELEGRAM_NOTIFICATIONS_ENABLED=true`
- `TELEGRAM_BOT_TOKEN` is present
- `TELEGRAM_ADMIN_CHAT_ID` is present
- `telegram_admin_notifications_enabled=true`

## Endpoints

- `GET /audit/settings/notifications`
- `PATCH /audit/settings/notifications`

Both require an admin JWT. Normal users receive `403`. Missing or invalid JWTs receive `401`.

The response never includes the bot token or chat ID. It only reports whether Telegram is globally enabled, configured, and accepted.

## Telegram Trigger Events

Telegram alerts are generated from audit events for:

- `auth.login.failed`
- `auth.unauthorized`
- `*.admin.denied`
- `orders.ownership.denied`
- `orders.order.created`
- `reports.job.completed`
- `reports.job.failed`
- `inventory.stock.deduct.failed`

The following are ignored to avoid loops:

- `notification.telegram.*`
- `settings.telegram_notifications.updated`

## Security Notes

- Telegram bot token and chat ID are never displayed in the UI.
- Telegram secrets stay in `.env`.
- Telegram failures do not break audit logging or business flows.
- Audit logs still record the source event even when Telegram is disabled or delivery fails.

## Browser Test Flow

1. Login as admin.
2. Open `/admin/settings`.
3. Confirm Notification Preferences shows In-App Notifications and Telegram Admin Notifications.
4. Confirm Token and Chat ID display as Hidden.
5. Click Accept for Telegram.
6. Trigger a failed login.
7. Confirm a Telegram message arrives.
8. Click Reject for Telegram.
9. Trigger a failed login again.
10. Confirm no Telegram message arrives.
11. Confirm Audit Logs still record failed login events.
12. Confirm `settings.telegram_notifications.updated` appears in Audit Logs.
13. Login as a normal user.
14. Confirm the user cannot update `/audit/settings/notifications`.

## Verification Commands

```powershell
python -m py_compile backend/audit-service/main.py backend/audit-service/models.py backend/audit-service/schemas.py backend/audit-service/service.py backend/audit-service/telegram_service.py
npm run build
docker compose build audit-service frontend
docker compose up -d audit-service frontend nginx
git status --short
```
