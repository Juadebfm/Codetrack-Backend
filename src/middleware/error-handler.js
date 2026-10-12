export function notFoundHandler(request, response) {
  response.status(404).json({
    error: {
      message: `Route ${request.method} ${request.originalUrl} was not found`,
    },
  });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  if (error.code === 11000) return response.status(409).json({ error: { message: "An account with this email already exists" } });
  if (error.name === "ValidationError" || error.name === "CastError") return response.status(400).json({ error: { message: "Invalid input" } });
  const candidate = error.status ?? error.statusCode;
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
  const message =
    process.env.NODE_ENV === "production" && status >= 500
      ? "Something went wrong. Please try again later"
      : error.message;

  return response.status(status).json({ error: { message } });
}