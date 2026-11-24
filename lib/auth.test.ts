import { test, describe } from "node:test";
import assert from "node:assert";
import {
  decodeSessionJwt,
  isOwner,
  isTeacher,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
} from "./auth.ts";

describe("Auth Library & Session Helpers", () => {
  test("cookie constants adhere to standard specifications", () => {
    assert.strictEqual(SESSION_COOKIE_NAME, "__session");
    assert.strictEqual(SESSION_COOKIE_MAX_AGE, 5 * 24 * 60 * 60);
  });

  test("role verification helpers identify owner and teacher correctly", () => {
    assert.strictEqual(isOwner("owner"), true);
    assert.strictEqual(isOwner("teacher"), false);
    assert.strictEqual(isOwner(null), false);

    assert.strictEqual(isTeacher("teacher"), true);
    assert.strictEqual(isTeacher("owner"), false);
    assert.strictEqual(isTeacher(undefined), false);
  });

  test("decodeSessionJwt successfully parses base64url encoded JWT payloads", () => {
    const payload = {
      uid: "usr_12345",
      email: "owner@college.lk",
      role: "owner",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    // Construct mock JWT (header.payload.signature)
    const headerBase64 = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const mockJwt = `${headerBase64}.${payloadBase64}.mockSignature`;

    const decoded = decodeSessionJwt(mockJwt);
    assert.notStrictEqual(decoded, null);
    assert.strictEqual(decoded?.uid, "usr_12345");
    assert.strictEqual(decoded?.email, "owner@college.lk");
    assert.strictEqual(decoded?.role, "owner");
  });

  test("decodeSessionJwt returns null on invalid or malformed tokens", () => {
    assert.strictEqual(decodeSessionJwt("not-a-jwt"), null);
    assert.strictEqual(decodeSessionJwt(""), null);
    assert.strictEqual(decodeSessionJwt("header.invalid_base64!json.sig"), null);
  });
});
