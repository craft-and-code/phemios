/** The same owner-private query/rating interval is evaluated again by Aède as annotations evolve. */
export function personalCollectionExpression(
  view: "rated" | "favourites",
  query: string,
  minimum = 1,
  maximum = 5,
): string {
  return `browse-v1:${JSON.stringify({ view, mode: "none", years: [0, 9999], alphabet: [0, 26], includeUnknownYear: true, query, ...(view === "rated" ? { ratings: [minimum, maximum] } : {}) })}`;
}
