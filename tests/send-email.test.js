import { afterEach, describe, expect, it, vi } from "vitest";

const smtpMocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: smtpMocks.createTransport },
}));

process.env.NODE_ENV = "development";
process.env.MAILTRAP_HOST = "sandbox.smtp.mailtrap.io";
process.env.MAILTRAP_PORT = "2525";
process.env.MAILTRAP_USER = "test-user";
process.env.MAILTRAP_PASSWORD = "test-password";
process.env.MAIL_FROM_EMAIL = "no-reply@example.com";
process.env.MAIL_FROM_NAME = "CodeTrack";

smtpMocks.sendMail.mockResolvedValue({ messageId: "test-message" });
smtpMocks.createTransport.mockReturnValue({ sendMail: smtpMocks.sendMail });

const { sendEmail } = await import("../src/utils/send-emails.js");

afterEach(() => {
  vi.clearAllMocks();
});

describe("sendEmail", () => {
  it("includes the six-digit code in verification email text and HTML", async () => {
    await sendEmail(
      "learner@example.com",
      "Verify your CodeTrack email",
      "Verify your CodeTrack email",
      "http://localhost:5173/verify-email?token=test-token",
      "012345",
    );

    const message = smtpMocks.sendMail.mock.calls[0][0];
    expect(message.text).toContain("012345");
    expect(message.html).toContain("012345");
  });

  it("keeps password-reset email link-only", async () => {
    await sendEmail(
      "learner@example.com",
      "Reset your CodeTrack password",
      "Reset your CodeTrack password",
      "http://localhost:5173/reset-password?token=test-token",
      "012345",
    );

    const message = smtpMocks.sendMail.mock.calls[0][0];
    expect(message.text).not.toContain("six-digit verification code");
    expect(message.html).not.toContain("012345");
  });
});
