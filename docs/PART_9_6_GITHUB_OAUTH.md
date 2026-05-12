# Part 9.6 GitHub OAuth

Part 9.6 implements real GitHub OAuth login using the existing Auth Service.

## What Was Implemented

- `GET /auth/oauth/github/login` redirects to GitHub with `scope=user:email`.
- `GET /auth/oauth/github/callback` validates OAuth state, exchanges the code for a GitHub access token, fetches the GitHub profile and verified email, maps the email to a SecureOps user, issues a normal SecureOps JWT, and redirects to the frontend callback page.
- Local users are created automatically when a verified GitHub email is not already registered.
- Existing email/password login, email verification, and authenticator app 2FA remain unchanged.
- OAuth audit events are recorded for start, success, failure, and user creation.

## GitHub OAuth App Settings

Use these local development settings in the GitHub OAuth App:

- Homepage URL: `http://localhost:8080`
- Authorization callback URL: `http://localhost:8080/auth/oauth/github/callback`

## Required Environment Variables

Local `.env` must provide:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_OAUTH_REDIRECT_URI`
- `FRONTEND_URL`

`.env.example` contains placeholders only. Do not commit real OAuth credentials.

## Login Flow

1. User opens `/login`.
2. User clicks `Continue with GitHub`.
3. Auth Service redirects to GitHub authorization.
4. GitHub redirects back to `/auth/oauth/github/callback`.
5. Auth Service validates state, exchanges the code, and fetches GitHub email data.
6. Auth Service finds or creates a local SecureOps user.
7. Auth Service issues a JWT and redirects to `/oauth/callback`.
8. Frontend stores the JWT, calls `/auth/me`, removes the token from the URL, and redirects by role.

GitHub OAuth relies on GitHub for external identity verification. The local email/password login path still requires local email verification and authenticator app 2FA. For production, avoid passing JWTs in URLs; use a one-time code exchange or secure httpOnly cookie.

## Audit Events

- `auth.oauth.github.started`
- `auth.oauth.github.success`
- `auth.oauth.github.failed`
- `auth.oauth.github.user.created`
- `auth.login.success` with provider `github`

## Browser Test Flow

1. Open `/login`.
2. Click `Continue with GitHub`.
3. Authorize the GitHub OAuth App.
4. Confirm redirect to SecureOps.
5. Confirm the dashboard opens.
6. Open `/admin/audit-logs` and confirm OAuth events are present.

## Troubleshooting

- Bad callback URL: confirm the GitHub OAuth App callback exactly matches `GITHUB_OAUTH_REDIRECT_URI`.
- Missing OAuth credentials: `/auth/oauth/github/login` returns `GitHub OAuth is not configured.`
- GitHub email not verified: ensure the GitHub account has a primary verified email.
- `.env` not loaded: restart `auth-service` after changing OAuth environment variables.
