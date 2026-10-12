export function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export function bodyOf(request) {
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("Provide a JSON object as the request body");
  }
  return body;
}

export function validEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && Buffer.byteLength(password, "utf8") <= 72;
}

export function validToken(token) {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}
