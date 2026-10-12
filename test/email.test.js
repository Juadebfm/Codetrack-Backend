import { test } from "node:test";
import assert from "node:assert/strict";
import { MailtrapClient } from "mailtrap";
import { environment } from "../src/config/environment.js";
import { sendEmail } from "../src/utils/send-emails.js";

test("email helper forwards the supplied subject without sending real email", async (t) => {
  let payload;
  const old = environment.nodeEnv;
  environment.nodeEnv = "development";
  t.after(() => { environment.nodeEnv = old; });
  t.mock.method(MailtrapClient.prototype, "send", async value => { payload = value; });
  await sendEmail("ada@example.com", "Reset your password", "Reset", "https://example.com/reset?token=test");
  assert.equal(payload.subject, "Reset your password");
  assert.equal(payload.to[0].email, "ada@example.com");
});
