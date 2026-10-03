import jwt from "jsonwebtoken";

import { environment } from "../config/environment";

const accessCookieName = "codetrack_access";
const refreshCookieName = "codetrack_refresh";

// Token creation function for both access and refresh token- Authentication - when a user is registered or signed-in
function signToken(user, secret, type, expiresIn) {
  return jwt.sign(
    { sub: user.id, type, sessionVersion: user.sessionVersion },
    secret,
    { expiresIn },
  );
}

export function createSessionTokens(user) {
  return {
    accessToken: signToken(user, environment.accessSecret, "access", "15m"),
    refreshToken: signToken(user, environment.refreshSecret, "refresh", "7d"),
  };
}

// Verifies the tokens created (when they come from the client/request)
export function verifyAccessToken(token) {
  return jwt.verify(token, environment.accessSecret);
}
export function verifyRefreshToken(token) {
  return jwt.verify(token, environment.refreshSecret);
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: environment.nodeEnv === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge,
  };
}

// add values to the cookie table
function setSessionCookies(response, tokens) {
  response.cookie(
    accessCookieName,
    tokens.accessToken,
    cookieOptions(30 * 60 * 1000), // 30 minutes
  );
  // accesstoken = auth token = bearer token = token

  response.cookie(
    refreshCookieName,
    tokens.refreshToken,
    cookieOptions(7 * 24 * 60 * 60 * 1000), // 7days
  );
}

// Clear value from cookie table
function clearSessionCookies(response) {
  response.clearCookie(accessCookieName, cookieOptions(0));
  response.cookie(refreshCookieName, cookieOptions(0));
}

export const sessionCookies = { accessCookieName, refreshCookieName };