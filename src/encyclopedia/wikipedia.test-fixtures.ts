import type { WikipediaArticle } from "./wikipedia";
/** Fictional public article and isolated disposable store; no real private or licensed prose. */
export const article: WikipediaArticle = {
  language: "fr",
  pageId: 42,
  revision: 91,
  title: "Example music",
  text: "Original fictional example text.",
  retrievedAt: 1_790_000_000_000,
};
export function storageFixture() {
  let raw: string | null = null,
    fail = false;
  return {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      if (fail) throw new Error("Quota");
      raw = value;
    },
    corrupt: (value: string) => {
      raw = value;
    },
    fail: () => {
      fail = true;
    },
  };
}
