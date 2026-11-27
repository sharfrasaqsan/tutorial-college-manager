import { describe, it, expect, vi } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";
import { verifyApiAuth, parseJwtClaims, isOwner, isTeacher } from "@/lib/auth";
import { NextRequest } from "next/server";

describe("Integration: API Auth & Health Gateways", () => {
  it("GET /api/health returns 200 with operational metadata and Colombo timezone", async () => {
    const response = await healthGet();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.app).toBe("Tutorial College Manager");
    expect(data.timezone).toBe("Asia/Colombo");
    expect(data.currency).toBe("LKR");
    expect(data.timestamp).toBeDefined();
  });

  it("verifyApiAuth blocks unauthenticated requests with 401 status", async () => {
    const req = new NextRequest("http://localhost:3000/api/owner/classes");
    const { user, errorResponse } = await verifyApiAuth(req, ["owner"]);

    expect(user).toBeNull();
    expect(errorResponse).not.toBeNull();
    expect(errorResponse!.status).toBe(401);

    const json = await errorResponse!.json();
    expect(json.error).toMatch(/authentication required/i);
  });

  it("verifyApiAuth blocks invalid session cookie with 401 status", async () => {
    const req = new NextRequest("http://localhost:3000/api/owner/classes", {
      headers: {
        cookie: "__session=invalid_mock_token_xyz123",
      },
    });

    const { user, errorResponse } = await verifyApiAuth(req, ["owner"]);
    expect(user).toBeNull();
    expect(errorResponse).not.toBeNull();
    expect(errorResponse!.status).toBe(401);

    const json = await errorResponse!.json();
    expect(json.error).toMatch(/session invalid or expired/i);
  });

  it("role verification helpers accurately classify roles", () => {
    expect(isOwner("owner")).toBe(true);
    expect(isOwner("teacher")).toBe(false);
    expect(isOwner(null)).toBe(false);

    expect(isTeacher("teacher")).toBe(true);
    expect(isTeacher("owner")).toBe(false);
    expect(isTeacher(undefined)).toBe(false);
  });

  it("parseJwtClaims safely decodes well-formed token payloads", () => {
    const payload = { sub: "usr_123", role: "owner", email: "owner@college.lk" };
    const base64UrlPayload = Buffer.from(JSON.stringify(payload))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const mockJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${base64UrlPayload}.mockSignature`;

    const parsed = parseJwtClaims(mockJwt);
    expect(parsed).toEqual(payload);
    expect(parsed?.role).toBe("owner");
  });
});
