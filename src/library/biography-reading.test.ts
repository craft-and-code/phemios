import { expect, it } from "vitest";
import { biographyTarget, readingTypography } from "./biography-reading";
it("follows the attributed title rather than an artist-name search or arbitrary URL", () => {
  expect(biographyTarget("https://fr.wikipedia.org/wiki/Exemple_(groupe)")).toEqual({
    language: "fr",
    title: "Exemple (groupe)",
  });
  expect(biographyTarget("https://en.wikipedia.org/wiki/Music_%26_art")).toEqual({
    language: "en",
    title: "Music & art",
  });
  for (const url of [
    undefined,
    "https://fr.wikipedia.org.evil.invalid/wiki/A",
    "http://fr.wikipedia.org/wiki/A",
    "https://user@fr.wikipedia.org/wiki/A",
    "https://de.wikipedia.org/wiki/A",
    "https://fr.wikipedia.org/wiki/A%7CB",
    "https://fr.wikipedia.org/wiki/A#Other",
    "https://fr.wikipedia.org/wiki/%0A",
    "https://fr.wikipedia.org/wiki/%ZZ",
  ])
    expect(biographyTarget(url)).toBeUndefined();
});
it("keeps French punctuation together without altering paragraphs, existing NBSP or English", () => {
  expect(readingTypography("« Un texte » : vrai !\n\nSuite ; oui ?", "fr")).toBe(
    "«\u202fUn texte\u202f»\u00a0: vrai\u202f!\n\nSuite\u202f; oui\u202f?",
  );
  expect(readingTypography("Déjà\u00a0: ici\u202f!", "fr")).toBe("Déjà\u00a0: ici\u202f!");
  expect(readingTypography("Text : words !", "en")).toBe("Text : words !");
});
