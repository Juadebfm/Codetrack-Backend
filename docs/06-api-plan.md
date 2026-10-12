# Implemented API

See [the OpenAPI specification](../openapi.json) for request and response fields.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/v1/health | HTTP availability |
| GET | /api/v1/ready | Database connection readiness |
| POST | /api/v1/auth/register | Create an account |
| GET | /api/v1/auth/verify-email | Consume a verification link |
| POST | /api/v1/auth/resend-verification | Retry verification delivery |
| POST | /api/v1/auth/login | Start a browser session |
| POST | /api/v1/auth/refresh | Rotate refresh credentials |
| POST | /api/v1/auth/logout | Revoke the browser session |
| GET | /api/v1/auth/me | Public profile |
| POST | /api/v1/auth/forgot-password | Request a reset link |
| POST | /api/v1/auth/reset-password | Change password using a link |
| GET, POST | /api/v1/logs | List or create owned logs |
| GET, PATCH, DELETE | /api/v1/logs/{id} | Read, edit or delete an owned log |
| GET, POST | /api/v1/goals | List or create owned goals |
| GET, PATCH, DELETE | /api/v1/goals/{id} | Read, edit or delete an owned goal |
| GET | /api/v1/dashboard | Totals and UTC streaks |
