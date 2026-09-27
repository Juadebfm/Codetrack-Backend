import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../src/app.js";
import { User } from "../src/models/user.model.js";
import { Goal } from "../src/models/goal.model.js";
import { LearningLog } from "../src/models/learning-log.model.js";
import { errorHandler } from "../src/middleware/error-handler.js";

test("health and unknown routes return the expected responses", async () => {
  await request(app).get("/api/v1/health").expect(200, { status: "ok" });
  const response = await request(app).get("/missing").expect(404);
  assert.match(response.body.error.message, /GET \/missing/);
});

test("malformed JSON is a client error", async () => {
  await request(app).post("/missing").set("Content-Type", "application/json")
    .send('{"broken":').expect(400);
});

test("error handler delegates after headers have been sent", () => {
  const error = new Error("stream failed");
  let delegated;
  errorHandler(error, {}, { headersSent: true }, (value) => { delegated = value; });
  assert.equal(delegated, error);
});

test("production errors hide server details but preserve client statuses", (t) => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  t.after(() => {
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  });
  let actualStatus;
  let body;
  const response = {
    status(value) { actualStatus = value; return this; },
    json(value) { body = value; },
  };
  errorHandler(new Error("private information"), {}, response, () => {});
  assert.equal(actualStatus, 500);
  assert.doesNotMatch(body.error.message, /private information/);
  errorHandler(Object.assign(new Error("Invalid input"), { status: 422 }), {}, response, () => {});
  assert.equal(actualStatus, 422);
  assert.equal(body.error.message, "Invalid input");
});

test("users accept the default plan and validate email and dates", async () => {
  const user = new User({ displayName: "Ada", email: " ADA@EXAMPLE.COM ", password: "test password" });
  await user.validate();
  assert.equal(user.email, "ada@example.com");
  assert.equal(user.plan, "free");
  user.email = "invalid";
  await assert.rejects(user.validate(), /valid email/);
  user.email = "ada@example.com";
  user.passwordResetExpiresAt = "invalid date";
  await assert.rejects(user.validate(), /Cast to date/);
});

test("saving a password hashes it, preserves it on other edits, and hashes replacements", async (t) => {
  let inserted;
  t.mock.method(User.collection, "insertOne", async (document) => {
    inserted = { ...document };
    return { acknowledged: true, insertedId: document._id };
  });
  t.mock.method(User.collection, "updateOne", async () => ({ acknowledged: true, matchedCount: 1 }));
  const user = new User({ displayName: "Ada", email: "ada@example.com", password: "first password" });
  await user.save();
  assert.notEqual(inserted.password, "first password");
  assert.equal(await bcrypt.compare("first password", inserted.password), true);
  const firstHash = user.password;
  user.displayName = "Ada Lovelace";
  await user.save();
  assert.equal(user.password, firstHash);
  user.password = "second password";
  await user.save();
  assert.equal(await bcrypt.compare("second password", user.password), true);
});

test("goals accept text values and reject out-of-range progress", async () => {
  const goal = new Goal({ user: new mongoose.Types.ObjectId(), title: "Study", targetValue: 10, Value: "hours" });
  await goal.validate();
  assert.equal(goal.currentValue, 0);
  goal.currentValue = -1;
  await assert.rejects(goal.validate(), /currentValue/);
  goal.currentValue = 0;
  goal.targetValue = 0;
  await assert.rejects(goal.validate(), /targetValue/);
});

test("learning logs validate ownership, duration, and dates", async () => {
  const log = new LearningLog({ user: new mongoose.Types.ObjectId(), title: "Learn Node", tag: " NODE ", durationMinutes: 30, loggedAt: new Date() });
  await log.validate();
  assert.equal(log.tag, "node");
  log.durationMinutes = 1441;
  await assert.rejects(log.validate(), /durationMinutes/);
  log.durationMinutes = 30;
  log.user = "invalid";
  await assert.rejects(log.validate(), /user/);
});

test("startup rejects missing configuration before connecting", () => {
  const result = spawnSync(process.execPath, ["src/server.js"], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test", MONGODB_URI: "", JWT_ACCESS_SECRET: "", JWT_REFRESH_SECRET: "" },
    timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required environment variables: MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET/);
});

test("runtime configuration rejects invalid ports and requires email outside tests", () => {
  const script = 'import { assertRuntimeConfiguration } from "./src/config/environment.js"; assertRuntimeConfiguration();';
  const baseEnv = { ...process.env, NODE_ENV: "test", MONGODB_URI: "mongodb://localhost/test", JWT_ACCESS_SECRET: "test-access", JWT_REFRESH_SECRET: "test-refresh", MAILTRAP_TOKEN: "" };
  for (const port of ["abc", "0", "65536", "1.5"]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf8", env: { ...baseEnv, PORT: port }, timeout: 10000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PORT must be an integer/);
  }
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8", env: { ...baseEnv, NODE_ENV: "production", PORT: "4000" }, timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required environment variables: MAILTRAP_TOKEN/);
});
