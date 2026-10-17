import { describe, expect, it } from "vitest";
import {
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
} from "@/features/auth/schemas";

describe("loginSchema", () => {
  it("requires identifier and password", () => {
    const result = loginSchema.safeParse({ identifier: "", password: "" });
    expect(result.success).toBe(false);
  });

  it("accepts email or username identifiers", () => {
    expect(
      loginSchema.safeParse({ identifier: "alice", password: "x" }).success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({ identifier: "a@b.com", password: "x" }).success,
    ).toBe(true);
  });
});

describe("registerSchema", () => {
  it("rejects bad usernames", () => {
    for (const username of ["ab", "bad name!", "a".repeat(31)]) {
      const result = registerSchema.safeParse({
        email: "a@b.com",
        username,
        password: "supersecret1",
      });
      expect(result.success).toBe(false);
    }
  });

  it("accepts valid payloads and optional display name", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      username: "alice_01",
      password: "supersecret1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short passwords", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      username: "alice",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("forgotSchema / resetSchema", () => {
  it("validates email and token payloads", () => {
    expect(forgotSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
    expect(forgotSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
    expect(
      resetSchema.safeParse({ token: "", new_password: "supersecret1" })
        .success,
    ).toBe(false);
    expect(
      resetSchema.safeParse({ token: "tok", new_password: "supersecret1" })
        .success,
    ).toBe(true);
  });
});
