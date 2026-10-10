import { describe, expect, it } from "vitest";
import request from "supertest";

import app from "../src/app.js";
import { User } from "../src/models/user.model.js";

describe("auth routes", () => {
  it("returns 401 for /me when no access cookie is present", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Log in to use this route");
  });

  it("returns 401 for an invalid access cookie", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", "codetrack_access=invalid");

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe(
      "Your session has ended. Please login again",
    );
  });
});

describe("User plan default", () => {
  it("defaults to the allowed Free plan", async () => {
    const user = new User({
      displayName: "Test User",
      email: "test@example.com",
      passwordHash: "test-hash",
    });

    await expect(user.validate()).resolves.toBeUndefined();
    expect(user.plan).toBe("Free");
  });
});
