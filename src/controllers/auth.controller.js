import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Session } from "../models/session.model.js";
import { environment } from "../config/environment.js";
import { hashOpaqueToken, createOpaqueToken } from "../utils/token.js";
import { emailTransport } from "../utils/send-emails.js";
import { bodyOf, badRequest, validEmail, validPassword, validToken } from "../utils/validation.js";
import { clearSessionCookies, createSessionTokens, sessionCookies, setSessionCookies,
  verifyRefreshToken, verifyAccessToken, refreshLifetimeMs } from "../utils/session-token.js";

function publicUser(user) {
  return { id: user.id, displayName: user.displayName, email: user.email, emailVerifiedAt: user.emailVerifiedAt, plan: user.plan };
}
function getEmail(body) {
  if (!validEmail(body.email)) throw badRequest("Provide a valid email address");
  return body.email.trim().toLowerCase();
}
function checkPassword(password) {
  if (!validPassword(password)) throw badRequest("Password must contain at least 8 characters and at most 72 UTF-8 bytes");
}

// Save a separate candidate so a failed delivery does not invalidate earlier links.
async function sendLink(user, purpose) {
  const verification = purpose === "verification";
  const field = verification ? "verificationTokens" : "resetTokens";
  const token = createOpaqueToken();
  const hash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + (verification ? 24 * 60 : 15) * 60 * 1000);
  const filter = { _id: user._id, ...(verification ? { emailVerifiedAt: null } : {}) };
  await User.updateOne(filter, { $pull: { [field]: { expiresAt: { $lte: new Date() } } } });
  const added = await User.updateOne(filter, { $push: { [field]: { hash, expiresAt } } });
  if (!added.matchedCount) return true;
  const action = verification ? "verify-email" : "reset-password";
  const subject = verification ? "Verify your CodeTrack email" : "Reset your CodeTrack password";
  try {
    await emailTransport.send(user.email, subject, subject, environment.frontendUrl + "/" + action + "?token=" + token);
    return true;
  } catch {
    await User.updateOne({ _id: user._id }, { $pull: { [field]: { hash } } });
    console.error("Account email delivery failed; the user can request another link");
    return false;
  }
}

export async function register(request, response) {
  const body = bodyOf(request);
  const email = getEmail(body);
  checkPassword(body.password);
  if (typeof body.displayName !== "string" || body.displayName.trim().length < 2 || body.displayName.trim().length > 80) {
    throw badRequest("Display name must contain 2 to 80 characters");
  }
  const user = await User.create({ displayName: body.displayName.trim(), email, passwordHash: await bcrypt.hash(body.password, 12) });
  const sent = await sendLink(user, "verification");
  return response.status(201).json({
    message: sent ? "Account created. Check your email to verify it" : "Account created. Email delivery failed; request another verification email",
    verificationEmailSent: sent, user: publicUser(user),
  });
}

// Include legacy fields so links issued before this update can still be used.
function tokenFilter(token, field, legacy) {
  return { $or: [
    { [field]: { $elemMatch: { hash: hashOpaqueToken(token), expiresAt: { $gt: new Date() } } } },
    { [legacy + "TokenHash"]: hashOpaqueToken(token), [legacy + "ExpiresAt"]: { $gt: new Date() } },
  ] };
}
export async function verifyEmail(request, response) {
  const { token } = request.query;
  if (!validToken(token)) throw badRequest("A valid verification token is required");
  const user = await User.findOneAndUpdate({ ...tokenFilter(token, "verificationTokens", "emailVerification"), emailVerifiedAt: null }, {
    $set: { emailVerifiedAt: new Date(), verificationTokens: [] },
    $unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 },
  });
  if (!user) throw badRequest("That verification link is invalid or has expired");
  return response.json({ message: "Email verified. You can log in now" });
}
export async function resendVerification(request, response) {
  const email = getEmail(bodyOf(request));
  const user = await User.findOne({ email, emailVerifiedAt: null });
  if (user) await sendLink(user, "verification");
  return response.json({ message: "If an unverified account exists, delivery was requested. If no email arrives, try again later" });
}
export async function login(request, response) {
  const body = bodyOf(request);
  const email = getEmail(body);
  checkPassword(body.password);
  const user = await User.findOne({ email }).select("+passwordHash +sessionVersion");
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    return response.status(401).json({ error: { message: "Email or password is incorrect" } });
  }
  if (!user.emailVerifiedAt) return response.status(401).json({ error: { message: "Verify your email before you can log in" } });
  const sid = new mongoose.Types.ObjectId();
  const tokens = createSessionTokens(user, sid);
  await Session.create({ _id: sid, user: user._id, refreshTokenHash: hashOpaqueToken(tokens.refreshToken), expiresAt: new Date(Date.now() + refreshLifetimeMs) });
  setSessionCookies(response, tokens);
  return response.json({ message: "Logged in successfully", user: publicUser(user) });
}
function unauthorized(response) {
  clearSessionCookies(response);
  return response.status(401).json({ error: { message: "Your session has ended. Please log in again" } });
}
export async function refresh(request, response) {
  const token = request.cookies?.[sessionCookies.refreshCookieName];
  let data;
  try { data = verifyRefreshToken(token); } catch { return unauthorized(response); }
  const user = await User.findById(data.sub).select("+sessionVersion");
  if (!user || !user.emailVerifiedAt || user.sessionVersion !== data.sessionVersion) return unauthorized(response);
  const tokens = createSessionTokens(user, data.sid);
  const session = await Session.findOneAndUpdate({ _id: data.sid, user: user._id,
    refreshTokenHash: hashOpaqueToken(token), expiresAt: { $gt: new Date() },
  }, { $set: { refreshTokenHash: hashOpaqueToken(tokens.refreshToken), expiresAt: new Date(Date.now() + refreshLifetimeMs) } });
  if (!session) {
    // Reuse of a rotated refresh token revokes this browser session.
    await Session.deleteOne({ _id: data.sid, user: user._id });
    return unauthorized(response);
  }
  setSessionCookies(response, tokens);
  return response.json({ message: "Session refreshed" });
}
export async function logout(request, response) {
  const sessions = [];
  for (const [cookie, verify] of [[sessionCookies.accessCookieName, verifyAccessToken], [sessionCookies.refreshCookieName, verifyRefreshToken]]) {
    try { const data = verify(request.cookies?.[cookie]); sessions.push({ _id: data.sid, user: data.sub }); } catch { /* Already expired or absent. */ }
  }
  if (sessions.length) await Session.deleteMany({ $or: sessions });
  clearSessionCookies(response);
  return response.json({ message: "Logged out successfully" });
}
export async function forgotPassword(request, response) {
  const email = getEmail(bodyOf(request));
  const user = await User.findOne({ email });
  if (user) await sendLink(user, "reset");
  return response.json({ message: "If an account exists, delivery was requested. If no email arrives, try again later" });
}
export async function resetPassword(request, response) {
  const { token, password } = bodyOf(request);
  if (!validToken(token)) throw badRequest("A valid password-reset token is required");
  checkPassword(password);
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(tokenFilter(token, "resetTokens", "passwordReset"), {
    $set: { passwordHash, resetTokens: [] }, $inc: { sessionVersion: 1 },
    $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
  });
  if (!user) throw badRequest("That password-reset link is invalid or has expired");
  clearSessionCookies(response);
  return response.json({ message: "Password reset successfully. Please log in with your new password" });
}
export function me(request, response) {
  return response.json({ user: publicUser(request.user) });
}
