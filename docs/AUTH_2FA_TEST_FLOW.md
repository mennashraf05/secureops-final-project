# Auth 2FA Test Flow

Login is now a two-step flow because 2FA is mandatory for all accounts. `/auth/login` validates the email and password, but it does not issue a JWT. JWT tokens are issued only after `/auth/2fa/verify` succeeds.

Current implementation note: email is used for registration verification and admin-created account setup links. Login 2FA uses an authenticator app such as Google Authenticator.

## Seeded Accounts

- Admin: `admin@secureops.com` / `Admin@12345`
- User: `user@secureops.com` / `User@12345`

Seeded accounts are already email verified and require 2FA.

## Admin Login With 2FA

```powershell
$adminLoginStart = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body (@{ email = "admin@secureops.com"; password = "Admin@12345" } | ConvertTo-Json)

$adminLoginStart
```

If the account has not finished authenticator setup, scan the QR code in the browser login flow first. Then enter the current authenticator code:

```powershell
$admin2FA = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/2fa/verify" `
  -ContentType "application/json" `
  -Body (@{ email = "admin@secureops.com"; code = "PUT_AUTHENTICATOR_CODE_HERE" } | ConvertTo-Json)

$adminToken = $admin2FA.data.access_token
$adminHeaders = @{ Authorization = "Bearer $adminToken" }
```

## User Login With 2FA

```powershell
$userLoginStart = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body (@{ email = "user@secureops.com"; password = "User@12345" } | ConvertTo-Json)

$userLoginStart
```

If the account has not finished authenticator setup, scan the QR code in the browser login flow first. Then enter the current authenticator code:

```powershell
$user2FA = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/2fa/verify" `
  -ContentType "application/json" `
  -Body (@{ email = "user@secureops.com"; code = "PUT_AUTHENTICATOR_CODE_HERE" } | ConvertTo-Json)

$userToken = $user2FA.data.access_token
$userHeaders = @{ Authorization = "Bearer $userToken" }
```

## Register And Verify Email

```powershell
$newEmail = "student+$(Get-Date -Format yyyyMMddHHmmss)@secureops.com"

$register = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/register" `
  -ContentType "application/json" `
  -Body (@{ name = "Demo Student"; email = $newEmail; password = "Student@12345" } | ConvertTo-Json)

$register
```

Get the verification code from the email inbox, or from logs only when `EMAIL_DEV_MODE=true`:

```powershell
$verifyEmail = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/verify-email" `
  -ContentType "application/json" `
  -Body (@{ email = $newEmail; code = "PUT_EMAIL_VERIFICATION_CODE_HERE" } | ConvertTo-Json)

$verifyEmail
```

After verification, log in with the mandatory 2FA flow above.

## Reading Codes

When `EMAIL_DEV_MODE=false`, verification/setup emails are sent through SMTP and codes should not appear in service logs.

When `EMAIL_DEV_MODE=true`, dev email messages can be read from auth-service logs:

```powershell
docker logs secureops-auth-service --tail 100
```

## Response Shape

`/auth/2fa/verify` returns the token under `data.access_token`:

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "access_token": "...",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "email": "admin@secureops.com",
      "role": "admin"
    }
  }
}
```
