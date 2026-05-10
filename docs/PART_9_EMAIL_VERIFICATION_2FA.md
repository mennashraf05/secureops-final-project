# Part 9 Email Verification + Mandatory Authenticator 2FA

Part 9 adds email verification for new registrations, email-based account setup links for admin-created users, and mandatory authenticator-app 2FA for both admin and normal user accounts.

## What Was Implemented

- New self-registered accounts must verify their email before login can continue.
- Admin-created users are created with name, email, and role only. The user receives an email setup link and chooses their own password.
- Password login never issues a JWT directly.
- Verified users must complete authenticator-app 2FA before JWT issuance.
- First login after verification prompts the user to connect Google Authenticator or a compatible TOTP app.
- Seeded demo accounts are email verified and still require authenticator-app 2FA setup.
- Admin user listings and `/auth/me` include email verification and 2FA status fields.

## Gmail SMTP Configuration

Local `.env` supports:

```env
EMAIL_DEV_MODE=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USER=sentinel.ai.app@gmail.com
SMTP_PASSWORD=<local-gmail-app-password>
SMTP_FROM=sentinel.ai.app@gmail.com
SMTP_REDIRECT_TO=
APP_BASE_URL=http://localhost:8080
```

`SMTP_REDIRECT_TO` is optional. If set, outgoing setup and verification emails are redirected to that inbox and the body includes the original intended recipient. Leave it empty to send to the real user email.

`.env.example` contains placeholders only. The real Gmail app password belongs only in local `.env`, which is ignored by git.

## Security Notes

- Email setup and verification codes are six-digit numeric codes.
- Email codes are stored as hashes, never as plain text.
- Email verification and setup codes expire after 10 minutes.
- Each email code allows at most 5 failed attempts.
- Used email codes cannot be reused.
- Authenticator 2FA uses a per-user TOTP secret.
- JWT tokens are issued only after successful password verification and authenticator 2FA verification.
- API responses never expose password hashes, OTP hashes, or SMTP secrets.
- 2FA cannot be disabled for admin or normal user accounts.

## Browser Test Flow

1. Open `/register`.
2. Register a new user email.
3. Confirm the verification email arrives.
4. Enter the six-digit verification code.
5. Open `/login`.
6. Sign in with email and password.
7. Confirm the page asks to set up an authenticator app and no dashboard opens yet.
8. Add the displayed secret or authenticator link to Google Authenticator.
9. Enter the six-digit authenticator code.
10. Confirm the correct dashboard opens based on role.

## Admin-Created Account Setup

1. Open `/admin/users`.
2. Add a user or admin with name, email, and role only.
3. Confirm the setup link arrives at that user's email address.
4. Open the `/setup-account` link from the email.
5. Enter the setup code if it is not already filled from the link.
6. Choose a password that is at least 8 characters and includes uppercase, lowercase, and a number or symbol.
7. Add the displayed secret or authenticator link to Google Authenticator.
8. Enter the six-digit authenticator code.
9. Confirm the dashboard opens after JWT issuance.

## PowerShell Test Flow

```powershell
$registerBody = @{ name = 'Part 9 User'; email = 'part9.user@example.com'; password = 'User@12345' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/auth/register' -ContentType 'application/json' -Body $registerBody

$loginBody = @{ email = 'admin@secureops.com'; password = 'Admin@12345' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/auth/login' -ContentType 'application/json' -Body $loginBody

$verify2faBody = @{ email = 'admin@secureops.com'; code = '<code-from-authenticator-app>' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/auth/2fa/verify' -ContentType 'application/json' -Body $verify2faBody
```

## Audit Events

Part 9 emits:

- `auth.register.success`
- `auth.email_verification.sent`
- `auth.email_verified`
- `auth.email_verification.failed`
- `auth.email_verification.resent`
- `auth.login.failed`
- `auth.login.2fa_required`
- `auth.2fa.setup_required`
- `auth.2fa.success`
- `auth.2fa.failed`
- `auth.login.success`
- `auth.logout`

`auth.login.success` is recorded only after successful 2FA and JWT issuance.
