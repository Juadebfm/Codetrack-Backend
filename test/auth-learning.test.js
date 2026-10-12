import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ipKeyGenerator } from "express-rate-limit";
import { app } from "../src/app.js";
import { environment } from "../src/config/environment.js";
import { User } from "../src/models/user.model.js";
import { Session } from "../src/models/session.model.js";
import { LearningLog } from "../src/models/learning-log.model.js";
import { Goal } from "../src/models/goal.model.js";
import { emailTransport } from "../src/utils/send-emails.js";
import { authRateLimit } from "../src/middleware/auth-rate-limit.js";
import { hashOpaqueToken } from "../src/utils/token.js";
import { createSessionTokens, verifyAccessToken } from "../src/utils/session-token.js";
import { streaks } from "../src/controllers/learning.controller.js";

let mongo;
const emails = [];
const password = "correct password";
function resetLimit() {
  for (const ip of ["127.0.0.1", "::ffff:127.0.0.1", "::1"]) authRateLimit.resetKey(ipKeyGenerator(ip));
}
function call(method, path, cookies) {
  resetLimit();
  const req = request(app)[method]("/api/v1" + path);
  return cookies ? req.set("Cookie", cookies) : req;
}
function cookies(response) {
  return response.headers["set-cookie"].filter(value => !value.includes("Expires=Thu, 01 Jan 1970")).map(value => value.split(";")[0]);
}
function tokenFromEmail() { return new URL(emails.at(-1)[3]).searchParams.get("token"); }
async function account(email = "ada@example.com") {
  const user = await User.create({ displayName: "Ada", email, passwordHash: await bcrypt.hash(password, 4), emailVerifiedAt: new Date() });
  const response = await call("post", "/auth/login").send({ email, password }).expect(200);
  return { user, cookies: cookies(response) };
}
before(async () => {
  environment.nodeEnv = "test";
  environment.accessSecret = "test-access-secret";
  environment.refreshSecret = "test-refresh-secret";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Session.init(), LearningLog.init(), Goal.init()]);
});
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async (t) => {
  await Promise.all([User.deleteMany({}), Session.deleteMany({}), LearningLog.deleteMany({}), Goal.deleteMany({})]);
  emails.length = 0;
  t.mock.method(emailTransport, "send", async (...args) => { emails.push(args); });
  resetLimit();
});

test("missing bodies and oversized UTF-8 passwords are client errors", async () => {
  for (const route of ["register", "login", "resend-verification", "forgot-password", "reset-password"]) {
    await call("post", "/auth/" + route).expect(400);
  }
  for (const value of ["a".repeat(73), "\u00e9".repeat(37)]) {
    await call("post", "/auth/register").send({ displayName: "Ada", email: "ada@example.com", password: value }).expect(400);
  }
  await call("post", "/auth/register").send({ displayName: "a".repeat(81), email: "ada@example.com", password }).expect(400);
});

test("registration hashes passwords, handles duplicates and consumes verification once", async () => {
  const body = { displayName: "Ada", email: " ADA@EXAMPLE.COM ", password };
  const response = await call("post", "/auth/register").send(body).expect(201);
  assert.equal(response.body.verificationEmailSent, true);
  assert.equal(response.body.user.plan, "Free");
  assert.equal(response.body.user.passwordHash, undefined);
  const user = await User.findOne().select("+passwordHash");
  assert.equal(await bcrypt.compare(password, user.passwordHash), true);
  await call("post", "/auth/login").send({ email: user.email, password }).expect(401);
  await call("post", "/auth/register").send(body).expect(409);
  const token = tokenFromEmail();
  const results = await Promise.all([call("get", "/auth/verify-email?token=" + token), call("get", "/auth/verify-email?token=" + token)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  await call("post", "/auth/login").send({ email: user.email, password }).expect(200);
});

test("simultaneous registrations yield one account and one conflict", async () => {
  const body = { displayName: "Ada", email: "ada@example.com", password };
  const results = await Promise.all([call("post", "/auth/register").send(body), call("post", "/auth/register").send(body)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  assert.equal(await User.countDocuments(), 1);
});

test("failed email delivery preserves account and earlier verification links", async (t) => {
  await call("post", "/auth/register").send({ displayName: "Ada", email: "ada@example.com", password }).expect(201);
  const token = tokenFromEmail();
  t.mock.method(emailTransport, "send", async () => { throw Error("offline"); });
  await call("post", "/auth/resend-verification").send({ email: "ada@example.com" }).expect(200);
  await call("get", "/auth/verify-email?token=" + token).expect(200);
  const response = await call("post", "/auth/register").send({ displayName: "Bob", email: "bob@example.com", password }).expect(201);
  assert.equal(response.body.verificationEmailSent, false);
  assert.equal(await User.countDocuments(), 2);
});

test("refresh rotates tokens, detects reuse, and logout revokes copied cookies", async () => {
  const a = await account();
  const refreshed = await call("post", "/auth/refresh", a.cookies).expect(200);
  const newer = cookies(refreshed);
  await call("get", "/auth/me", newer).expect(200);
  await call("post", "/auth/refresh", a.cookies).expect(401);
  await call("get", "/auth/me", newer).expect(401);
  const login = await call("post", "/auth/login").send({ email: a.user.email, password }).expect(200);
  const active = cookies(login);
  await call("post", "/auth/logout", active).expect(200);
  await call("get", "/auth/me", active).expect(401);
  await call("post", "/auth/refresh", active).expect(401);
  const accessHeader = login.headers["set-cookie"].find(value => value.includes("Max-Age=900"));
  assert.match(accessHeader, /Path=\/api\/v1;/);
});

test("atomic reset rejects reuse and invalidates prior sessions", async () => {
  const a = await account();
  await call("post", "/auth/forgot-password").send({ email: a.user.email }).expect(200);
  const token = tokenFromEmail();
  const results = await Promise.all([call("post", "/auth/reset-password").send({ token, password: "replacement one" }), call("post", "/auth/reset-password").send({ token, password: "replacement two" })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  await call("get", "/auth/me", a.cookies).expect(401);
  await call("post", "/auth/refresh", a.cookies).expect(401);
  const winner = results[0].status === 200 ? "replacement one" : "replacement two";
  await call("post", "/auth/login").send({ email: a.user.email, password: winner }).expect(200);
});

test("expired email tokens are rejected and failed reset delivery preserves earlier links", async (t) => {
  const a = await account();
  await call("post", "/auth/forgot-password").send({ email: a.user.email }).expect(200);
  const token = tokenFromEmail();
  t.mock.method(emailTransport, "send", async () => { throw Error("offline"); });
  const known = await call("post", "/auth/forgot-password").send({ email: a.user.email }).expect(200);
  const unknown = await call("post", "/auth/forgot-password").send({ email: "missing@example.com" }).expect(200);
  assert.deepEqual(known.body, unknown.body);
  await call("post", "/auth/reset-password").send({ token, password: "replacement password" }).expect(200);
  await User.updateOne({ _id: a.user._id }, { $set: { resetTokens: [{ hash: hashOpaqueToken(token), expiresAt: new Date(0) }] } });
  await call("post", "/auth/reset-password").send({ token, password }).expect(400);
});

test("database failures are server errors and refresh tokens are rejected as access", async (t) => {
  const a = await account();
  const data = createSessionTokens({ id: a.user.id, sessionVersion: 0 }, new mongoose.Types.ObjectId());
  const previous = environment.accessSecret;
  environment.accessSecret = environment.refreshSecret;
  try { assert.throws(() => verifyAccessToken(data.refreshToken), /Invalid session token/); }
  finally { environment.accessSecret = previous; }
  t.mock.method(Session, "exists", async () => { throw Error("database unavailable"); });
  await call("get", "/auth/me", a.cookies).expect(500);
});

test("logs and goals enforce ownership, pagination and editable fields", async () => {
  const a = await account();
  const b = await account("bob@example.com");
  for (const kind of ["logs", "goals"]) {
    const body = kind === "logs" ? { title: "Node", tag: " NODE ", durationMinutes: 30 } : { title: "Study", targetValue: 10, unit: "hours" };
    const key = kind === "logs" ? "log" : "goal";
    const created = await call("post", "/" + kind, a.cookies).send(body).expect(201);
    const id = created.body[key].id;
    await call("get", "/" + kind + "/" + id, b.cookies).expect(404);
    await call("patch", "/" + kind + "/" + id, b.cookies).send({ title: "stolen" }).expect(404);
    await call("delete", "/" + kind + "/" + id, b.cookies).expect(404);
    await call("patch", "/" + kind + "/" + id, a.cookies).send({ user: b.user.id }).expect(400);
    await call("patch", "/" + kind + "/" + id, a.cookies).send({ title: "Updated" }).expect(200);
    await call("get", "/" + kind + "/bad-id", a.cookies).expect(400);
    await call("get", "/" + kind + "?limit=101", a.cookies).expect(400);
    const own = await call("get", "/" + kind + "?page=1&limit=1", a.cookies).expect(200);
    assert.equal(own.body.pagination.total, 1);
    const other = await call("get", "/" + kind, b.cookies).expect(200);
    assert.equal(other.body.pagination.total, 0);
    await call("delete", "/" + kind + "/" + id, a.cookies).expect(204);
    await call("get", "/" + kind + "/" + id, a.cookies).expect(404);
  }
});

test("dashboard counts only the owner's records and uses UTC streaks", async () => {
  const a = await account();
  const b = await account("bob@example.com");
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (const daysAgo of [0, 1, 2]) await LearningLog.create({ user: a.user._id, title: "Study", tag: "node", durationMinutes: 30, loggedAt: new Date(today.getTime() - daysAgo * 86400000) });
  await LearningLog.create({ user: b.user._id, title: "Other", tag: "node", durationMinutes: 100 });
  await Goal.create({ user: a.user._id, title: "Study", targetValue: 10, currentValue: 10, unit: "hours" });
  const result = await call("get", "/dashboard", a.cookies).expect(200);
  assert.equal(result.body.totalMinutes, 90);
  assert.equal(result.body.currentStreakDays, 3);
  assert.equal(result.body.completedGoals, 1);
  assert.equal(result.body.recentLogs.length, 3);
  assert.deepEqual(streaks(["2026-10-05", "2026-10-04"], new Date("2026-10-10")), { currentStreakDays: 0, longestStreakDays: 2 });
});


test("auth limiter rejects the eleventh request in its shared window", async () => {
  resetLimit();
  for (let i = 0; i < 10; i++) await request(app).post("/api/v1/auth/login").send({}).expect(400);
  await request(app).post("/api/v1/auth/login").send({}).expect(429);
});

test("server handles graceful termination against temporary MongoDB", async () => {
  const { createServer } = await import("node:net");
  const { spawnSync } = await import("node:child_process");
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const script = 'const log = console.log; console.log = (...args) => { log(...args); if (String(args[0]).startsWith("CodeTrack API listening")) setTimeout(() => process.emit("SIGTERM"), 20); }; await import("./src/server.js");';
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8", timeout: 15000,
    env: { ...process.env, NODE_ENV: "test", PORT: String(port), MONGODB_URI: mongo.getUri(), FRONTEND_URL: "http://localhost:5173", JWT_ACCESS_SECRET: "test-access", JWT_REFRESH_SECRET: "test-refresh" },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CodeTrack API listening/);
  assert.doesNotMatch(result.stderr, /timed out/);
});

test("cleanup errors preserve failure exit status without an unhandled rejection", async () => {
  const { spawnSync } = await import("node:child_process");
  const script = 'import mongoose from "mongoose"; mongoose.disconnect = async () => { throw new Error("cleanup failed"); }; await import("./src/server.js");';
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8", timeout: 10000,
    env: { ...process.env, NODE_ENV: "test", PORT: "4000", FRONTEND_URL: "http://localhost:5173", MONGODB_URI: "", JWT_ACCESS_SECRET: "", JWT_REFRESH_SECRET: "" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not disconnect MongoDB: cleanup failed/);
  assert.doesNotMatch(result.stderr, /UnhandledPromiseRejection/);
});
