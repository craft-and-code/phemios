import { expect, it } from "vitest";
import { apiUrl, boundedBody, sameOriginServer } from "./http";
it("allows only the current secure authority and path-free server address", () => {
  expect(sameOriginServer("https://music.example/", "https://music.example")).toBe(
    "https://music.example",
  );
  for (const address of [
    "http://music.example",
    "https://other.example",
    "https://user:secret@music.example",
    "https://music.example/path",
    "https://music.example/?secret=x",
  ])
    expect(() => sameOriginServer(address, "https://music.example")).toThrow();
  expect(sameOriginServer("http://127.0.0.1:1441", "http://127.0.0.1:1441")).toBe(
    "http://127.0.0.1:1441",
  );
});
it("keeps reference values in query arguments without admitting alternate authorities or paths", () => {
  const url = new URL(
    apiUrl("https://music.example", "/api/v1/track", { ref: "track:a&token=bad" }),
  );
  expect(url.searchParams.get("ref")).toBe("track:a&token=bad");
  expect(url.searchParams.has("token")).toBe(false);
  for (const path of [
    "https://other.example/api/v1/track",
    "//other.example/api/v1/track",
    "/api/v1/../private",
    "/api/v1/track?token=x",
    "/api/v1/track#x",
    "/api/v1\\track",
  ])
    expect(() => apiUrl(url.origin, path, {})).toThrow();
});
it("bounds response bytes even without content-length and cancels oversized streams", async () => {
  expect(await boundedBody(new Response("abcd"), 4)).toEqual(new TextEncoder().encode("abcd"));
  await expect(boundedBody(new Response("abcde"), 4)).rejects.toThrow("volumineuse");
  await expect(
    boundedBody(new Response("a", { headers: { "content-length": "999" } }), 4),
  ).rejects.toThrow("volumineuse");
});
