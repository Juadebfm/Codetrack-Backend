# Email Verification Code Changes

Document to track changes we are going to be making to this codebase from the commit hash number `ba80b5`

## Files to be changed

- auth.controller : create and check six digit code, then we rotate credentials on (any of the platform MailTrap / Resend), we return verification expiry timeframe
- user.model.js : stores the code as a hidden hash
- auth.routes.js: add rate limiter and code verification
- send email: to include code sending
- 2 tests auth.test and send-email.test
