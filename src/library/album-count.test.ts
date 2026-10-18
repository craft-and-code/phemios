import { expect, it } from "vitest";
import { albumCount } from "./album-count";
it("uses a singular only for one album in both interface languages", () => {
  for (const language of ["fr", "en"] as const) {
    expect(albumCount(0, language)).toBe("0 albums");
    expect(albumCount(1, language)).toBe("1 album");
    expect(albumCount(2, language)).toBe("2 albums");
    expect(albumCount(1_200, language)).toBe(`${(1_200).toLocaleString(language)} albums`);
  }
});
