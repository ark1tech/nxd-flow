import { describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

describe("fixture auth service", () => {
  it("logs in and reads a bearer-protected profile", async () => {
    const app = buildServer();
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "demo@example.com", password: "password" }
    });
    expect(login.statusCode).toBe(200);
    const token = login.json<{ token: string }>().token;
    const profile = await app.inject({
      method: "GET",
      url: "/profile",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toEqual({ id: "fixture-user", name: "Fixture User" });
  });
});
