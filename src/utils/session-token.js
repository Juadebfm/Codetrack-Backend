import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { environment } from "../config/environment.js";

const accessCookieName = "codetrack_access";
const refreshCookieName = "codetrack_refresh";
export const refreshLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export function createSessionTokens(user, sessionId) {
  const payload = { sub: user.id, sid: String(sessionId), sessionVersion: user.sessionVersion };
  return {
    accessToken: jwt.sign({ ...payload, type: "access" }, environment.accessSecret, { algorithm: "HS256", expiresIn: "15m", jwtid: randomUUID() }),
    refreshToken: jwt.sign({ ...payload, type: "refresh" }, environment.refreshSecret, { algorithm: "HS256", expiresIn: "7d", jwtid: randomUUID() }),
  };
}

function verify(token, secret, type) {
  const data = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (data.type !== type || !/^[a-f0-9]{24}$/i.test(data.sub ?? "") ||
      !/^[a-f0-9]{24}$/i.test(data.sid ?? "") || !Number.isInteger(data.sessionVersion)) {
    throw new Error("Invalid session token");
  }
  return data;
}
export const verifyAccessToken = token => verify(token, environment.accessSecret, "access");
export const verifyRefreshToken = token => verify(token, environment.refreshSecret, "refresh");

function cookieOptions(path) {
  return { httpOnly: true, secure: environment.nodeEnv === "production", sameSite: "lax", path };
}
export function setSessionCookies(response, tokens) {
  // Remove the old, narrower access cookie before setting the replacement.
  response.clearCookie(accessCookieName, cookieOptions("/api/v1/auth"));
  response.cookie(accessCookieName, tokens.accessToken, { ...cookieOptions("/api/v1"), maxAge: 15 * 60 * 1000 });
  response.cookie(refreshCookieName, tokens.refreshToken, { ...cookieOptions("/api/v1/auth"), maxAge: refreshLifetimeMs });
}
export function clearSessionCookies(response) {
  response.clearCookie(accessCookieName, cookieOptions("/api/v1"));
  response.clearCookie(accessCookieName, cookieOptions("/api/v1/auth"));
  response.clearCookie(refreshCookieName, cookieOptions("/api/v1/auth"));
}
export const sessionCookies = { accessCookieName, refreshCookieName };
