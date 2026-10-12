import { test } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { environment } from "../src/config/environment.js";
import { sendEmail, safeEmailError } from "../src/utils/send-emails.js";

function setup(t, port = 587) {
  const previous = { ...environment };
  Object.assign(environment, { nodeEnv: "development", smtpHost: "smtp.example.com", smtpPort: port, smtpUser: "test-user", smtpPass: "test-password", mailFromEmail: "sender@example.com", mailFromName: "CodeTrack" });
  t.after(() => Object.assign(environment, previous));
}
test("SMTP helper sends the supplied subject, sender and escaped link over STARTTLS", async (t) => {
  setup(t);
  let options, payload;
  t.mock.method(nodemailer, "createTransport", value => {
    options = value;
    return { sendMail: async message => { payload = message; return { accepted: ["ada@example.com"], rejected: [] }; } };
  });
  await sendEmail("ada@example.com", "Reset your password", "Reset & continue", "https://example.com/reset?token=test&next=home");
  assert.equal(options.host, "smtp.example.com");
  assert.deepEqual(options.auth, { user: "test-user", pass: "test-password" });
  assert.equal(options.secure, false);
  assert.equal(options.requireTLS, true);
  assert.equal(payload.subject, "Reset your password");
  assert.equal(payload.from.address, "sender@example.com");
  assert.equal(payload.to, "ada@example.com");
  assert.match(payload.html, /Reset &amp; continue/);
  assert.match(payload.html, /&amp;next=home/);
});
test("port 465 uses implicit TLS and propagates failures for retry handling", async (t) => {
  setup(t, 465);
  const failure = Object.assign(new Error("private provider response"), { code: "EAUTH", responseCode: 535 });
  t.mock.method(nodemailer, "createTransport", options => {
    assert.equal(options.secure, true);
    return { sendMail: async () => { throw failure; } };
  });
  await assert.rejects(sendEmail("ada@example.com", "Test", "Test", "https://example.com"), error => error === failure);
  assert.deepEqual(safeEmailError(failure), { code: "EAUTH", responseCode: 535 });
  assert.deepEqual(safeEmailError({ code: "private-token", response: "private response" }), { code: "EMAIL_DELIVERY_FAILED" });
});
test("recipient rejection is treated as failed delivery", async (t) => {
  setup(t);
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async () => ({ accepted: [], rejected: ["ada@example.com"] }) }));
  await assert.rejects(sendEmail("ada@example.com", "Test", "Test", "https://example.com"), { code: "EENVELOPE" });
});
test("test mode never opens an SMTP connection", async (t) => {
  setup(t);
  environment.nodeEnv = "test";
  t.mock.method(nodemailer, "createTransport", () => { assert.fail("Unexpected SMTP connection"); });
  await sendEmail("ada@example.com", "Test", "Test", "https://example.com");
});
