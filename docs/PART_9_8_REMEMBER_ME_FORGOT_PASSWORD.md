# Part 9.8 Remember Me + Forgot Password

Part 9.8 makes the login Remember me option functional and adds a secure forgot-password flow using email reset codes.

## Remember Me

The login flow remains:

1. `POST /auth/login`
2. Authenticator App 2FA
3. `POST /auth/2fa/verify`
4. JWT issued only after successful 2FA

The Remember me selection is preserved from the password step through the 2FA step.

- Remember me accepted: token is stored in `localStorage` and expires in 7 days.
- Remember me rejected: token is stored in `sessionStorage` and uses the normal configured JWT lifetime.

Tokens never become permanent.

## Forgot Password

The forgot-password flow uses the existing `AuthCode` table with purpose `password_reset`.

Endpoints:

- `POST /auth/password/forgot`
- `POST /auth/password/reset`

Request reset always returns the same safe message:

```text
If this email exists, a password reset code has been sent.
```

This avoids account enumeration.

## Reset Code Security

- Reset codes are 6 digits for this local demo.
- Only hashed codes are stored.
- Codes expire after 10 minutes.
- Codes are limited to 5 attempts.
- Used codes cannot be reused.
- Reset responses never expose hashes or secrets.

## 2FA Behavior

Password reset does not issue a JWT and does not log the user in automatically.

After reset, the user must sign in normally:

1. Email/password
2. Authenticator App 2FA
3. JWT issued after 2FA

## Audit Events

Audit events include:

- `auth.password_reset.requested`
- `auth.password_reset.requested_unknown`
- `auth.password_reset.success`
- `auth.password_reset.failed`
- Existing `auth.login.success` after successful 2FA

## Browser Test Flow

1. Open `/login`.
2. Check Remember me.
3. Login with password and authenticator code.
4. Refresh the browser and confirm the session persists.
5. Logout.
6. Login with Remember me unchecked.
7. Confirm the app uses session storage for the session token.
8. Click Forgot password.
9. Enter email and send reset code.
10. Enter the reset code, new password, and matching confirmation.
11. Confirm the success message.
12. Login with the new password.
13. Confirm 2FA is still required.
14. Confirm dashboard opens after 2FA.

## PowerShell Test Flow

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/auth/password/forgot' `
  -ContentType 'application/json' `
  -Body (@{ email = 'user@secureops.com' } | ConvertTo-Json)

Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/auth/password/reset' `
  -ContentType 'application/json' `
  -Body (@{
    email = 'user@secureops.com'
    code = '123456'
    new_password = 'NewStrongPassword@123'
  } | ConvertTo-Json)
```

Use the real reset code from the email/dev log.

## Verification Commands

```powershell
python -m py_compile backend/auth-service/main.py backend/auth-service/models.py backend/auth-service/schemas.py backend/auth-service/service.py backend/auth-service/security.py
npm run build
docker compose build auth-service frontend
docker compose up -d auth-service frontend nginx
git status --short .env
```
