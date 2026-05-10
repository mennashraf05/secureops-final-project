# Part 8 Risk Score Realism

This update makes the Security Center risk score more realistic and explainable.

## What Changed

- Risk is calculated from recent audit events, preferring the last 24 hours.
- If no recent events exist, the latest 100 security-related audit logs are used as a fallback.
- Event weights are lower so a small number of failed logins does not immediately create Critical risk.
- Repeated suspicious behavior adds escalation points.
- Alerts are unchanged.
- Per-user risk uses the same shared scoring helper.

## Event Weights

- `auth.login.failed`: +5
- `auth.unauthorized`: +10
- `*.admin.denied`: +15
- `orders.ownership.denied`: +20
- `reports.job.failed`: +10
- `inventory.stock.deduct.failed`: +20
- `malicious.file.upload`: +30
- `file.integrity.failed`: +35

Generic failure or blocked statuses only add small fallback impact when no action-specific weight exists.

## Escalation Rules

- Failed login count >= 5: +15
- Failed login count >= 10: +25
- Unauthorized count >= 3: +20
- Admin denied count >= 3: +20
- Ownership denied count >= 1: +15

## Risk Levels

- `0-24`: Low
- `25-49`: Medium
- `50-74`: High
- `75-100`: Critical

Critical is now reserved for repeated suspicious behavior or high-impact events, not a handful of failed logins.
