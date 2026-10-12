import "dotenv/config";

export const environment = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  mailFromEmail: process.env.MAIL_FROM_EMAIL,
  mailFromName: process.env.MAIL_FROM_NAME,
};

export function assertRuntimeConfiguration() {
  if (!Number.isInteger(environment.port) || environment.port < 1 || environment.port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  try {
    const url = new URL(environment.frontendUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) throw new Error();
    environment.frontendUrl = url.origin;
  } catch {
    throw new Error("FRONTEND_URL must be an HTTP or HTTPS origin without a path, query, or credentials");
  }
  if (environment.nodeEnv !== "test" && environment.mailFromEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(environment.mailFromEmail)) {
    throw new Error("MAIL_FROM_EMAIL must be a valid email address");
  }
  const requiredNames = [
    "MONGODB_URI",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
  ];

  const missingNames = requiredNames.filter((name) => !process.env[name]?.trim());

  if (environment.nodeEnv !== "test") {
    for (const name of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) {
      if (!process.env[name]?.trim()) missingNames.push(name);
    }
    if (!Number.isInteger(environment.smtpPort) || environment.smtpPort < 1 || environment.smtpPort > 65535) {
      throw new Error("SMTP_PORT must be an integer between 1 and 65535");
    }
  }

  if (environment.nodeEnv !== "test" && !environment.mailFromEmail?.trim()) {
    missingNames.push("MAIL_FROM_EMAIL");
  }
  if (missingNames.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingNames.join(", ")}`,
    );
  }
  if (environment.accessSecret === environment.refreshSecret) {
    throw new Error("JWT access and refresh secrets must be different");
  }
  if (environment.nodeEnv !== "test" && [environment.accessSecret, environment.refreshSecret].some(secret => Buffer.byteLength(secret) < 32)) {
    throw new Error("JWT secrets must each contain at least 32 bytes");
  }
}
