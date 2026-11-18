import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/utils/send-emails.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// Keep endpoint tests independent from the shared in-memory rate-limit counter.
vi.mock("../src/middleware/auth-rate-limit.js", () => ({
  authRateLimit: (request, response, next) => next(),
}));

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.FRONTEND_URL = "http://localhost:5173";

const { default: app } = await import("../src/app.js");
const { User } = await import("../src/models/user.model.js");
const { sendEmail } = await import("../src/utils/send-emails.js");

let database;

beforeAll(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
});

afterEach(async () => {
  vi.mocked(sendEmail).mockReset().mockResolvedValue(undefined);
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (database) await database.stop();
});

async function registerTestUser() {
  return request(app).post("/api/v1/auth/register").send({
    displayName: "Alex Rivera",
    email: "alex@example.com",
    password: "safe-password-123",
  });
}

describe("email verification code", () => {
  it("emails both verification choices and reports the expiry", async () => {
    const registration = await registerTestUser();

    expect(registration.status).toBe(201);
    expect(registration.body.verificationExpiresInSeconds).toBe(86400);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][3]).toContain("/verify-email?token=");
    expect(sendEmail.mock.calls[0][4]).toMatch(/^\d{6}$/);

    const user = await User.findOne({ email: "alex@example.com" }).select(
      "+emailVerificationCodeHash",
    );
    expect(user.emailVerificationCodeHash).not.toBe(sendEmail.mock.calls[0][4]);
  });

  it("verifies a valid code once and clears both credentials", async () => {
    await registerTestUser();
    const code = sendEmail.mock.calls[0][4];

    const verification = await request(app)
      .post("/api/v1/auth/verify-email/code")
      .send({ email: "alex@example.com", code });
    expect(verification.status).toBe(200);

    const replay = await request(app)
      .post("/api/v1/auth/verify-email/code")
      .send({ email: "alex@example.com", code });
    expect(replay.status).toBe(400);

    const user = await User.findOne({ email: "alex@example.com" }).select(
      "+emailVerificationCodeHash +emailVerificationTokenHash",
    );
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user.emailVerificationCodeHash).toBeUndefined();
    expect(user.emailVerificationTokenHash).toBeUndefined();
  });

  it("continues to verify email through the existing link", async () => {
    await registerTestUser();
    const token = new URL(sendEmail.mock.calls[0][3]).searchParams.get("token");

    const verification = await request(app).get(
      `/api/v1/auth/verify-email?token=${token}`,
    );
    expect(verification.status).toBe(200);

    const user = await User.findOne({ email: "alex@example.com" }).select(
      "+emailVerificationCodeHash",
    );
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user.emailVerificationCodeHash).toBeUndefined();
  });

  it("rejects incorrect and expired codes", async () => {
    await registerTestUser();
    const realCode = sendEmail.mock.calls[0][4];
    const wrongCode = realCode === "000000" ? "000001" : "000000";

    const incorrect = await request(app)
      .post("/api/v1/auth/verify-email/code")
      .send({ email: "alex@example.com", code: wrongCode });
    expect(incorrect.status).toBe(400);

    await User.updateOne(
      { email: "alex@example.com" },
      { emailVerificationExpiresAt: new Date(Date.now() - 1000) },
    );
    const expired = await request(app)
      .post("/api/v1/auth/verify-email/code")
      .send({ email: "alex@example.com", code: realCode });
    expect(expired.status).toBe(400);
  });

  it("resends a new link and code and invalidates the old pair", async () => {
    await registerTestUser();
    const oldLink = sendEmail.mock.calls[0][3];
    const oldCode = sendEmail.mock.calls[0][4];

    const resend = await request(app)
      .post("/api/v1/auth/resend-verification")
      .send({ email: "alex@example.com" });
    expect(resend.status).toBe(200);
    expect(resend.body.verificationExpiresInSeconds).toBe(86400);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[1][3]).not.toBe(oldLink);
    expect(sendEmail.mock.calls[1][4]).not.toBe(oldCode);

    const oldToken = new URL(oldLink).searchParams.get("token");
    const oldLinkResult = await request(app).get(
      `/api/v1/auth/verify-email?token=${oldToken}`,
    );
    expect(oldLinkResult.status).toBe(400);

    const oldCodeResult = await request(app)
      .post("/api/v1/auth/verify-email/code")
      .send({ email: "alex@example.com", code: oldCode });
    expect(oldCodeResult.status).toBe(400);

    const newCodeResult = await request(app)
      .post("/api/v1/auth/verify-email/code")
      .send({ email: "alex@example.com", code: sendEmail.mock.calls[1][4] });
    expect(newCodeResult.status).toBe(200);
  }, 20000);

  it("keeps resend responses generic when no account exists", async () => {
    const resend = await request(app)
      .post("/api/v1/auth/resend-verification")
      .send({ email: "missing@example.com" });

    expect(resend.status).toBe(200);
    expect(resend.body).toEqual({
      message: "If an unverified account exists, a verification email has been sent",
      verificationExpiresInSeconds: 86400,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
