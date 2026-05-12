# Part 9.4 Settings Page

Part 9.4 replaces the old placeholder settings blocks with realistic SecureOps configuration visibility.

## What Changed

- The Admin Settings page now shows real authenticated admin profile details from the current session.
- Implemented security and system controls are displayed as read-only platform configuration.
- Notification and theme preferences are safe editable local browser preferences stored in `localStorage`.
- Unfinished modules are labeled as `Coming soon`, `Partial`, or managed outside the UI.
- The misleading generic `Save Changes` action was replaced with `Save Local Preferences`.
- Danger Zone actions are visible but disabled to avoid unsafe demo configuration changes.

## Real / Read-Only Settings

The following settings describe implemented platform behavior and are not editable from the UI:

- Profile email, role, email verification status, 2FA requirement, and 2FA method
- JWT authentication
- RBAC
- Mandatory 2FA
- Email verification
- Audit logging
- Internal API key protection
- Nginx API Gateway
- Internal service authentication through `X-Internal-API-Key`
- Public API authentication through JWT bearer tokens
- Service-to-service audit ingestion
- Stock deduction internal calls
- Nginx rate limit policy
- Route protection and admin-only page separation
- RabbitMQ Management UI localhost restriction
- Worker jobs

## Local Preferences

These preferences are stored only in the browser:

- Show notifications: accept or reject notification display in this browser
- Theme preference: system default, light, or dark

The notification display preference and theme preference are stored locally and applied in the current browser. They do not call a backend settings API.

Click `Save Local Preferences` to persist these values to `localStorage`. After saving, the page shows `Local preferences saved successfully.`

Security and platform settings are read-only because they are managed by backend policy, `.env`, Docker, or Nginx.

## Coming Soon / Partial Settings

The Secure File Vault and file encryption controls are marked `Coming soon` because the feature is not implemented in Part 9.4.

Planned file controls include:

- Allowed extensions
- Blocked dangerous extensions
- File size limit
- Encrypted storage
- SHA-256 integrity verification

OAuth is marked `Partial` / `Coming soon` because the flow is documented or placeholder-only unless provider credentials and full activation are configured.

## Secrets

Secrets are never displayed in the frontend.

The Settings page only states where secrets are managed:

- Secrets are loaded from `.env`
- `.env` is ignored by Git
- `.env.example` uses placeholders
- SMTP password is hidden
- Internal API key is hidden
- RabbitMQ credentials are hidden

This avoids leaking sensitive values into browser DOM, screenshots, logs, or support sessions.

Secrets are not editable from the Settings page.

## Browser Test Flow

1. Login as admin.
2. Open `/admin/settings`.
3. Confirm profile info loads.
4. Toggle notification preferences.
5. Change theme preference.
6. Click `Save Local Preferences`.
7. Refresh the page and confirm preferences persist.
8. Confirm security settings show JWT/RBAC/2FA/Audit enabled and remain read-only.
9. Confirm rate limiting reflects Part 9.3 and remains read-only.
10. Confirm File Upload Policy is Coming soon, not fake enabled.
11. Confirm OAuth is Partial/Coming soon unless fully implemented.
12. Confirm no secrets are displayed or editable.
13. Confirm Danger Zone buttons are disabled/safe.
14. Confirm no existing admin pages break.
