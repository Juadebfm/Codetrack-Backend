import { User } from "../models/user.model.js";
import { sessionCookies, verifyAccessToken } from "../utils/session-token.js";

export async function authenticate(request, response, next) {
  const accessToken = request.cookies(sessionCookies.accessCookieName);

  if (!accessToken) {
    return response
      .status(401)
      .json({ error: { message: "Log in to use this route" } });
  }

  try {
    const tokenData = verifyAccessToken(accessToken);
    const user = await User.findById(tokenData.sub).select("+sessionVersion");

    if (!user || user.sessionVersion !== tokenData.sessionVersion) {
      return response.status(401).json({
        error: { message: "Your session has ended. Please log in again" },
      });
    }

    request.user = user;
    return next();
  } catch {
    return response.status(401).json({
      error: { message: "Your session has ended. Please login again" },
    });
  }
}