# Part 9.3 Rate Limiting + RabbitMQ Hardening

Part 9.3 refines Nginx API Gateway rate limiting and hardens local RabbitMQ Management UI exposure without adding services or changing application business logic.

## Nginx Rate Limiting

The gateway now defines separate request limit zones:

- General API: `secureops_api`, `60r/m`
- Authentication: `secureops_auth`, `10r/m`
- Strict auth-sensitive endpoints: `secureops_auth_strict`, `5r/m`

Rate-limited requests return HTTP `429` through `limit_req_status 429`.

General API routes use `secureops_api` with `burst=20 nodelay`:

- `/products`
- `/orders`
- `/reports`
- `/audit`
- `/files`
- `/security`

Auth-sensitive routes use stricter limits:

- `/auth/login`: `secureops_auth`, `burst=5 nodelay`
- `/auth/register`: `secureops_auth`, `burst=5 nodelay`
- `/auth/2fa/verify`: `secureops_auth_strict`, `burst=3 nodelay`
- `/auth/verify-email`: `secureops_auth_strict`, `burst=3 nodelay`
- `/auth/resend-verification`: `secureops_auth_strict`, `burst=2 nodelay`

Other `/auth/*` routes use the auth zone with a moderate burst so existing authenticated workflows keep working.

Exact health endpoints are not rate limited so container and demo health checks remain reliable during throttling tests.

## Request Size Limit

Nginx now sets:

```nginx
client_max_body_size 10m;
```

This is enough for the current API surface. If Secure File Vault later needs larger uploads, the limit can be adjusted during that integration.

## Security Headers

Nginx keeps basic safe headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

No CSP was added in this part to avoid risking the current Vite frontend.

## RabbitMQ Management UI

RabbitMQ continues to use custom credentials. The project does not use `guest/guest`.

For local/demo use, RabbitMQ Management UI remains available at:

```text
http://localhost:15673
```

The Docker port mapping is bound to localhost only:

```yaml
127.0.0.1:15673:15672
```

This keeps the UI reachable from the local machine for demos but prevents exposure on the wider network. In production, RabbitMQ Management UI should not be exposed publicly.

AMQP communication remains internal over the Docker network using the `rabbitmq` hostname and port `5672`; no public AMQP port mapping is required.

## Verification

Run:

```bash
docker compose config
docker compose up -d nginx rabbitmq
docker exec secureops-nginx nginx -t
```

Health routes:

- `GET http://localhost:8080/auth/health`
- `GET http://localhost:8080/products/health`
- `GET http://localhost:8080/orders/health`
- `GET http://localhost:8080/reports/health`
- `GET http://localhost:8080/audit/health`

Repeated invalid login or 2FA requests should eventually return HTTP `429`, while normal API and frontend routes should continue to work.
