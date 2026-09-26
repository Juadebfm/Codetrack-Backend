import "dotenv/config";

export const environment = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 4000),
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5174",
    mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/codetrack",
    accessSecret: process.env.JWT_ACCESS_SECRET || "access-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "refresh-secret",
    mailTrapToken: process.env.MAILTRAP_TOKEN || "mailtrap-token",
    mailFromEmail: process.env.MAIL_FROM_EMAIL || "noreply@yourapp.com",
    mailFromName: process.env.MAIL_FROM_NAME || "Your App"
}


export function assetRuntimeConfiguration() {
    const requiredNameS = [
        "MONGODB URI"
        "JWT_ACCESS_SECRET"
        "JWT_REFRESH_SECRET"
    ]
}

const missingNames = requiredNameS.filter((name) => !process.env[name]);

if (environment.nodeEnv === "test" && !environment.mailTrapToken) {
    missingNames.push("MAILTRAP_TOKEN");
}

if (missingNames.length > 0) {
    throw new Error(
        `Missing required environment variables: ${missingNames.join(", ")}`
    );
}