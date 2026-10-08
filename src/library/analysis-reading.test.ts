import { it, expect } from "vitest";
import { analysisReading } from "./analysis-reading";
const report = {
  md5: "",
  stale: false,
  error: "",
  summary: "Clean",
  eventCount: 0,
  clipped: undefined,
};
it("never turns missing checks or stale MD5 into verified quality", () => {
  expect(analysisReading({ ...report, md5: "NoSignature" })[0]?.tone).toBe("unknown");
  expect(analysisReading({ ...report, md5: "Match" })[0]?.tone).toBe("good");
  expect(analysisReading({ ...report, md5: "Match", stale: true })[0]?.tone).toBe("unknown");
  expect(analysisReading({ ...report, md5: "Mismatch" })[0]?.tone).toBe("bad");
  expect(analysisReading(report)[2]?.label).toBe("Contrôles partiels");
  expect(analysisReading({ ...report, clipped: false })[2]?.label).toBe("Aucun événement signalé");
  expect(analysisReading({ ...report, summary: "Flagged", eventCount: 5 })[1]?.tone).toBe(
    "warning",
  );
});
