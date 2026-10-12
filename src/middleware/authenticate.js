import { User } from "../models/user.model.js";
import { Session } from "../models/session.model.js";
import { sessionCookies, verifyAccessToken } from "../utils/session-token.js";

export async function authenticate(request, response, next) {
  let data;
  try {
    data = verifyAccessToken(request.cookies?.[sessionCookies.accessCookieName]);
  } catch {
    return response.status(401).json({ error: { message: "Log in to use this route" } });
  }
  try {
    const [user, session] = await Promise.all([
      User.findById(data.sub).select("+sessionVersion"),
      Session.exists({ _id: data.sid, user: data.sub, expiresAt: { $gt: new Date() } }),
    ]);
    if (!user || !session || !user.emailVerifiedAt || user.sessionVersion !== data.sessionVersion) {
      return response.status(401).json({ error: { message: "Your session has ended. Please log in again" } });
    }
    request.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
