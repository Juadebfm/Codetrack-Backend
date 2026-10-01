How do we relate CORS to security, validation, authentication in our backend? Seeing that it validates "ports" from the frontend. Does it go into validations and authentication?

Where does HELMENT come to play in all these seeing that it deals on security.

#Explain these in relation to security.
Authentication
     ↓
Authorization
     ↓
Input validation
     ↓
Password hashing
     ↓
Rate limiting
     ↓
CORS configuration
     ↓
Helmet
     ↓
Database security