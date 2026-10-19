import { it, expect } from "vitest";
import { analysisModel } from "./model";
import { integrityReading } from "./presentation";
const report = (state: string, stale?: boolean) =>
  analysisModel({
    source: "flaccompagnon",
    ...(stale === undefined ? {} : { stale }),
    source_data: { format: "FLAC", flac_md5: { state } },
  });
it("distinguishes digest states, current validity and a complete comparison from read failures", () => {
  expect(integrityReading(report("Match", false)).tone).toBe("good");
  expect(integrityReading(report("Match")).tone).toBe("good");
  expect(integrityReading(report("Match")).detail).toContain(
    "le fichier actuel n’a pas été vérifié",
  );
  expect(integrityReading(report("Match", true)).tone).toBe("warning");
  expect(integrityReading(report("Mismatch", false)).label).toContain("différent");
  expect(integrityReading(report("Error", false)).label).toContain("interrompue");
  for (const state of ["NoSignature", "Present"])
    expect(integrityReading(report(state, false)).tone).toBe("unknown");
});
it("does not apply FLAC MD5 or whole-file checksums to Ogg page integrity", () => {
  const result = analysisModel({
    source: "flaccompagnon",
    stale: false,
    source_data: { format: "OGG", flac_md5: { state: "Match" }, file_md5: "a".repeat(32) },
  });
  expect(integrityReading(result).tone).toBe("unknown");
  expect(integrityReading(result).label).toContain("Ogg");
});
