import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { spawnSync } from "node:child_process";
import { app } from "../src/app.js";

test("authentication routes are mounted and reject invalid input without a database", async () => {
  await request(app).post("/api/v1/auth/register").send({}).expect(400);
  await request(app).get("/api/v1/auth/verify-email?token=bad").expect(400);
  await request(app).get("/api/v1/auth/me").expect(401);
  await request(app).post("/api/v1/auth/logout").expect(200);
});

test("oversized JSON returns 413", async () => {
  await request(app).post("/api/v1/auth/register").send({ value: "a".repeat(110000) }).expect(413);
});

test("readiness follows database state while health remains available", async () => {
  const previous = mongoose.connection.readyState;
  try {
    mongoose.connection.readyState = 0;
    await request(app).get("/api/v1/ready").expect(503, { status: "unavailable" });
    await request(app).get("/api/v1/health").expect(200);
    mongoose.connection.readyState = 1;
    await request(app).get("/api/v1/ready").expect(200, { status: "ready" });
  } finally {
    mongoose.connection.readyState = previous;
  }
});

test("configuration rejects invalid frontend origins and missing sender", () => {
  const script = 'import { assertRuntimeConfiguration } from "./src/config/environment.js"; assertRuntimeConfiguration();';
  const env = { ...process.env, NODE_ENV: "test", PORT: "4000", MONGODB_URI: "mongodb://localhost/test", JWT_ACCESS_SECRET: "test", JWT_REFRESH_SECRET: "test", FRONTEND_URL: "https://example.com" };
  for (const FRONTEND_URL of ["invalid", "ftp://example.com", "https://example.com/path"]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...env, FRONTEND_URL }, encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /FRONTEND_URL must/);
  }
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...env, NODE_ENV: "production", MAILTRAP_TOKEN: "test", MAIL_FROM_EMAIL: "" }, encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MAIL_FROM_EMAIL/);
});
