# Keeping accounts safe

We will learn simple safety habits from the first day.

## Passwords

We will never save a real password in MongoDB. We will save a password hash instead. When a user logs in, the backend will compare the password to the saved hash.

## Private values

Database addresses, Mailtrap keys, and token secrets will go in a local `.env` file. That file will not be uploaded to GitHub.

## Email links

Verification and password-reset links will use random tokens. They will expire after a short time. A reset link will expire after 15 minutes. A verification link will expire after 24 hours.

## User ownership

When we add logs and goals, the backend will use the signed-in user’s identity. It will not trust a user ID sent by the frontend. This will stop one user from editing another user’s data.

## Slow down repeated attempts

Later, we will limit repeated login and reset-password requests. This is called rate limiting.

Security is a habit. We will keep asking: “What information should this user be allowed to see or change?”
