import { describe, expect, it } from "vitest";
import { swBlocked } from "./pwa";

describe("offline worker registration", () => {
  it("never registers inside an iframe", () => {
    expect(swBlocked("myclub.com", "", true, true)).toBe(true);
  });
  it("never registers in development", () => {
    expect(swBlocked("myclub.com", "", false, false)).toBe(true);
  });
  it("can be switched off with ?sw=off", () => {
    expect(swBlocked("myclub.com", "?sw=off", false, true)).toBe(true);
  });
  it("registers on the published site", () => {
    expect(swBlocked("myclub.com", "", false, true)).toBe(false);
  });
});
