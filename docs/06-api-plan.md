# The API plan

An API is a list of requests the frontend will be able to make. We will build these one by one during class.

## First route

| Method | URL | What it will do |
| --- | --- | --- |
| GET | `/api/v1/health` | Tell us the server is running. |

## Account routes we will add later

| Method | URL | What it will do |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Create an account and send an email-verification link. |
| GET | `/api/v1/auth/verify-email` | Verify an email from a link. |
| POST | `/api/v1/auth/login` | Check login details and start a session. |
| POST | `/api/v1/auth/logout` | End a session. |
| POST | `/api/v1/auth/forgot-password` | Ask for a password-reset email. |
| POST | `/api/v1/auth/reset-password` | Choose a new password with a reset link. |

## Learning routes we will add later

| Method | URL | What it will do |
| --- | --- | --- |
| GET | `/api/v1/logs` | Get the signed-in user’s learning logs. |
| POST | `/api/v1/logs` | Add a learning log. |
| PATCH | `/api/v1/logs/:logId` | Change one learning log. |
| DELETE | `/api/v1/logs/:logId` | Remove one learning log. |
| GET | `/api/v1/goals` | Get the signed-in user’s goals. |
| POST | `/api/v1/goals` | Add a goal. |
| GET | `/api/v1/dashboard` | Get dashboard information. |

`GET` means “read”. `POST` means “create or ask the server to do something”. `PATCH` means “change part of something”. `DELETE` means “remove something”.
