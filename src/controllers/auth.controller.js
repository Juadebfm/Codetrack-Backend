import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";
import { environment } from "../config/environment.js";
import { hashOpaqueToken, createOpaqueToken } from "../utils/token.js";
import { sendEmail } from "../utils/send-emails.js";
import {
  clearSessionCookies,
  createSessionTokens,
  sessionCookies,
  setSessionCookies,
  verifyRefreshToken,
} from "../utils/session-token.js";

const opaqueTokenLength = 64;
const passwordResetTokenLifetimeMs = 15 * 60 * 1000;

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
  user.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
  // Coming from the FE
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

  try {
    // Check the email
    const cleanEmail = normalizeEmail(email);
    const existingUser = await User.findOne({ email: cleanEmail });

    if (existingUser)
      return response.status(409).json({
        error: {
          message:
            "An account with that email already exists, Please go to login if you are the account owner",
        },
      });

    // We have confirmed that the email doesn't excsit so here we are ready to store the user in teh db and we are trying to hash the password submitted
    const passwordHash = await bcrypt.hash(password, 12); // salt = 12

    // we now save / create / register the user into the db
    const user = await User.create({
      displayName: displayName.trim(),
      email: cleanEmail,
      passwordHash,
    });

    // Send verification now that user email is saved
    await sendVerificationEmail(user);

    return response.status(201).json({
      message: "Account created successfully, Check your email to verify it",
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

// Verify email
export async function verifyEmail(request, response, next) {
  const { token } = request.query;
  // validate the token we got from the email is accurate
  if (typeof token !== "string" || token.length !== 64)
    return response.status(400).json({
      error: { message: "Verifying email failed, A valid token is required" },
    });

  try {
    const tokenHash = hashOpaqueToken(token);
    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { $gt: new Date() },
    });

    if (!user)
      return response.status(400).json({
        error: {
          message: "That verification link is invalid or has expired",
        },
      });

    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;

    await user.save();

    return response.json({ message: "Email verified. You can login now" });
  } catch (error) {
    return next(error);
  }
}

// resend verification email
export async function resendVerification(request, response, next) {
  const { email } = request.body;
  if (!hasValidEmail(email))
    return response
      .status(400)
      .json({ error: { message: "Provide a valid email address" } });

  try {
    const user = await User.findOne({ email: normalizeEmail(email) });

    if (user && !user.emailVerifiedAt) await sendVerificationEmail(user);

    return response.json({
      message:
        "If an unverified account exists, a verification email has been sent",
    });
  } catch (error) {
    return next(error);
  }
}

// Login
export async function login(request, response, next) {
  // coming from FE
  const { email, password } = request.body;

  if (!hasValidEmail(email) || typeof password !== "string")
    return response
      .status(400)
      .json({ error: { message: "Provide a valid email and/or password" } });

  try {
    // email present in db ?
    const user = await User.findOne({ email: normalizeEmail(email) }).select(
      "+passwordHash +sessionVersion",
    );
    // check if the pw is the same as stored in the db
    const passwordMatches =
      user && (await bcrypt.compare(password, user.passwordHash));

    if (!passwordMatches)
      return response
        .status(401)
        .json({ error: { message: "Email or password is incorrect" } });
    // user is not verified
    if (!user.emailVerifiedAt)
      return response.status(401).json({
        error: { message: "Verify your email before you can log in" },
      });

    setSessionCookies(response, createSessionTokens(user));

    return response.json({
      message: "Logged In successfully",
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

// Refresh the access and refresh cookies using the current refresh cookie.
export async function refresh(request, response, next) {
  const refreshToken = request.cookies?.[sessionCookies.refreshCookieName];

  if (!refreshToken) {
    clearSessionCookies(response);
    return response
      .status(401)
      .json({ error: { message: "Log in to refresh your session" } });
  }

  let tokenData;
  try {
    tokenData = verifyRefreshToken(refreshToken);
  } catch {
    clearSessionCookies(response);
    return response
      .status(401)
      .json({
        error: { message: "Your session has ended. Please log in again" },
      });
  }

  if (tokenData.type !== "refresh" || !tokenData.sub) {
    clearSessionCookies(response);
    return response
      .status(401)
      .json({
        error: { message: "Your session has ended. Please log in again" },
      });
  }

  try {
    const user = await User.findById(tokenData.sub).select("+sessionVersion");

    if (!user || user.sessionVersion !== tokenData.sessionVersion) {
      clearSessionCookies(response);
      return response
        .status(401)
        .json({
          error: { message: "Your session has ended. Please log in again" },
        });
    }

    setSessionCookies(response, createSessionTokens(user));
    return response.json({ message: "Session refreshed" });
  } catch (error) {
    return next(error);
  }
}

// End the browser session by clearing both session cookies.
export function logout(request, response) {
  clearSessionCookies(response);
  return response.json({ message: "Logged out successfully" });
}

// Request a password-reset link without revealing whether the email exists.
export async function forgotPassword(request, response, next) {
  const { email } = request.body;

  if (!hasValidEmail(email)) {
    return response
      .status(400)
      .json({ error: { message: "Provide a valid email address" } });
  }

  try {
    const user = await User.findOne({ email: normalizeEmail(email) }).select(
      "+passwordResetTokenHash +passwordResetExpiresAt",
    );

    if (user) {
      const token = createOpaqueToken();
      user.passwordResetTokenHash = hashOpaqueToken(token);
      user.passwordResetExpiresAt = new Date(
        Date.now() + passwordResetTokenLifetimeMs,
      );
      await user.save();

      const link = `${environment.frontendUrl}/reset-password?token=${token}`;
      await sendEmail(
        user.email,
        "Reset your CodeTrack password",
        "Reset your CodeTrack password",
        link,
      );
    }

    return response.json({
      message:
        "If an account exists for that email, a password-reset link has been sent",
    });
  } catch (error) {
    return next(error);
  }
}

// Set a new password using a valid, unexpired reset token.
export async function resetPassword(request, response, next) {
  const { token, password } = request.body;

  if (typeof token !== "string" || token.length !== opaqueTokenLength) {
    return response
      .status(400)
      .json({ error: { message: "A valid password-reset token is required" } });
  }

  if (!hasValidPassword(password)) {
    return response.status(400).json({
      error: { message: "Password must be between 8 and 128 characters" },
    });
  }

  try {
    const user = await User.findOne({
      passwordResetTokenHash: hashOpaqueToken(token),
      passwordResetExpiresAt: { $gt: new Date() },
    }).select(
      "+passwordHash +passwordResetTokenHash +passwordResetExpiresAt +sessionVersion",
    );

    if (!user) {
      return response.status(400).json({
        error: {
          message: "That password-reset link is invalid or has expired",
        },
      });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.sessionVersion += 1;
    await user.save();

    clearSessionCookies(response);
    return response.json({
      message:
        "Password reset successfully. Please log in with your new password",
    });
  } catch (error) {
    return next(error);
  }
}

// Return the signed-in user's public profile.
export function me(request, response) {
  if (!request.user) {
    return response
      .status(401)
      .json({ error: { message: "Log in to view your account" } });
  }

  return response.json({ user: publicUser(request.user) });
}
