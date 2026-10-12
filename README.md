# CodeTrack backend

Express and MongoDB API for accounts, learning logs, goals, and a learning dashboard.

## Run locally

1. Install Node.js 24 or later and MongoDB.
2. Run `npm install`.
3. Copy `.env.example` to `.env`. Set the database URI, two different random JWT secrets of at least 32 bytes each, frontend origin, and Mailtrap token and sender email. Never commit secrets.
4. Run `npm run dev` (or `npm start`).

The default port is 4000. On PowerShell with script execution disabled, use `npm.cmd` instead of `npm`. Generate each secret independently, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

## API

[openapi.json](openapi.json) documents all 22 operations, input limits, cookies and responses. Health is `GET /api/v1/health`; database readiness is `GET /api/v1/ready`. Auth routes live under `/api/v1/auth`; logs, goals and dashboard under `/api/v1`.

Controllers are in `src/controllers`. Logs and goals support create, list, get, patch and delete. Lists accept `page` (default 1, maximum 100000) and `limit` (default 20, maximum 100). Ownership always comes from the session. Streaks use UTC calendar days.

## Accounts and sessions

Passwords require at least eight characters and at most 72 UTF-8 bytes. The controller hashes passwords; the User model stores the hash without hashing it again. The plan value is `Free`.

Verification links expire after 24 hours; reset links after 15 minutes. Earlier links remain valid during a resend, and successful use consumes all outstanding links for that purpose atomically. Failed delivery removes the candidate link while preserving older links. Registration still returns 201 with `verificationEmailSent: false` when the account exists but delivery failed. Offer resend-verification to retry. Resend and forgot-password return a generic response; users can retry if no email arrives. Delivery is attempted during the request; there is no background retry queue.

Each login creates a database session. Access cookies and JWTs last 15 minutes; refresh cookies and JWTs last seven days. Refresh rotates the token. Reusing an old refresh token revokes that session, so clients must serialize refresh requests. Logout revokes that browser session, while password reset invalidates all sessions. Existing sessions from older versions lack a session ID and require a fresh login. Existing email links using the older token fields remain supported.

Browser requests must use `credentials: "include"`. Cookies are HttpOnly, SameSite=Lax, and Secure in production. Deploy the frontend and API on the same site with HTTPS; different-site hosting requires a separate cookie and CSRF design. JWT secrets must differ and should be independently generated.

Auth endpoints share a limit of 10 attempts per IP per 15 minutes. The current limiter uses process memory; multiple server instances need a shared store and an explicitly configured trusted proxy topology.

## Checks

Run `npm test` and `npm run lint`. Integration tests use a disposable MongoDB instance via mongodb-memory-server and stub email delivery. The first test run may download a MongoDB binary. Tests never use the configured application database or send real email. Live Mailtrap delivery must be checked separately with your sender configuration.

The server drains HTTP requests and disconnects MongoDB on SIGINT/SIGTERM, with a ten-second shutdown deadline.
