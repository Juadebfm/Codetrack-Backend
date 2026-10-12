# Account and data protection

Passwords are hashed by the controller with bcrypt. Inputs require at least eight characters and at most 72 UTF-8 bytes. Hashes and email-token hashes are excluded from public responses.

Email links expire and are consumed with a conditional database update. Earlier links survive failed resend attempts. Registration reports a delivery failure separately from account creation; users can retry through the resend route.

Sessions are stored in MongoDB and checked on every protected request. JWT access and refresh secrets are distinct. Refresh tokens rotate, reuse revokes the session, logout revokes the current browser session, and a password reset changes the account session version to invalidate all sessions.

All learning queries include the authenticated user ID. Requests cannot set or change ownership. Another user's record produces 404.

Repeated authentication attempts are rate-limited. Browser cookies are HttpOnly and SameSite=Lax, with Secure enabled in production. CORS permits the configured frontend origin. Production errors hide internal server details.

Keep database credentials, signing secrets, and Mailtrap credentials in an untracked environment file. Use HTTPS and same-site frontend/API hosting. See the README for multi-instance rate-limit and deployment considerations.
