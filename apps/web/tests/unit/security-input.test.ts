import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUuid, safeInternalPath } from "../../lib/security/input";

describe("safeInternalPath", () => {
  it("keeps an internal path, query, and fragment", () => {
    assert.equal(safeInternalPath("/art?sort=oldest#gallery"), "/art?sort=oldest#gallery");
  });

  it("falls back for external and protocol-relative redirects", () => {
    assert.equal(safeInternalPath("https://attacker.example/steal"), "/");
    assert.equal(safeInternalPath("//attacker.example/steal"), "/");
    assert.equal(safeInternalPath("/\\attacker.example"), "/");
  });

  it("rejects control characters and applies a caller fallback", () => {
    assert.equal(safeInternalPath("/art\nLocation: https://attacker.example", "/art"), "/art");
    assert.equal(safeInternalPath(undefined, "/art"), "/art");
  });
});

describe("isUuid", () => {
  it("accepts UUIDs used by database-backed actions", () => {
    assert.equal(isUuid("8a7e0f8c-21e4-4dd3-8e62-c4fc0efbe1d9"), true);
  });

  it("rejects malformed and non-RFC variant values", () => {
    assert.equal(isUuid("not-a-uuid"), false);
    assert.equal(isUuid("00000000-0000-4000-0000-000000000000"), false);
  });
});
