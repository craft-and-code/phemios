import { expect, it } from "vitest";
import { queueAppendReason } from "./queue-append-policy";
const state = { role: "user", busy: false, device: "", first: "track:one" };
it("admits same-source occurrences but never changes an existing queue authority", () => {
  expect(queueAppendReason("release:two", state)).toBe("");
  expect(queueAppendReason("release:@phemios/local/two", state)).toContain("origines");
  expect(queueAppendReason("release:@phemios/local/two", { ...state, first: undefined })).toBe("");
});
it("explains missing, read-only, unsupported and pending admission", () => {
  expect(queueAppendReason("release:two", { ...state, role: undefined })).toContain("Connectez");
  expect(queueAppendReason("release:two", { ...state, role: "auditor" })).toContain("compte");
  expect(queueAppendReason("release:two", { ...state, device: "@hqplayer" })).toContain("HQPlayer");
  expect(queueAppendReason("release:two", { ...state, busy: true })).toContain("occupé");
});
