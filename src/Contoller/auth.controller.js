import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import { environment } from "../config/environment";
import { hashOpaqueToken, createOpaqueToken } from "../utils/token";
import { sendEmail } from "../utils/send-emails";
import {
  clearSessionCookies,
  createSessionTokens,
  sessionCookies,
  setSessionCookies,
  verifyRefreshToken,
} from "../utils/send-emails.js";

// Controller specific util functions
function hasValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasValidPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128
  );
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    plan: user.plan,
  };
}

// Sending verification email
async function sendVerificationEmail(user) {
  const token = createOpaqueToken();
  user.emailVerificationTokenHash = hashOpaqueToken(token);
  user.emailVerificationExpiresAt = new Date(Date.now() * 12 * 60 * 60 * 1000);
  await user.save();

  const link = `${environment.frontendUrl}/verify-email?token=${token}`;
  await sendEmail(
    user.email,
    "Verify your CodeTrack Email",
    "Verify your CodeTrack email",
    link,
  );
}

// Register function / Signup function
export async function register(request, response, next) {
  const { displayName, email, password } = request.body;
  // validation checks for the request body
  if (
    typeof displayName !== "string" ||
    displayName.trim().length < 2 ||
    !hasValidEmail(email) ||
    !hasValidPassword(password)
  ) {
    return response.status(400).json({
      error: {
        message:
          "Provide a name, valid email, and password with at least 8 characters",
      },
    });
  }

  
}

