import { expect, it, vi } from "vitest";
import { activateExternalLink } from "./external-links";
it("hands public source links to the native browser, including modifier clicks, without navigating the WebView", async () => {
  const launch = vi.fn(async () => {}),
    fail = vi.fn(),
    prevent = vi.fn();
  expect(
    activateExternalLink(
      {
        href: "https://fr.wikipedia.org/w/index.php?curid=42&action=history",
        button: 0,
        preventDefault: prevent,
      },
      true,
      launch,
      fail,
    ),
  ).toBe(true);
  await Promise.resolve();
  expect(prevent).toHaveBeenCalledTimes(1);
  expect(launch).toHaveBeenCalledWith(
    "https://fr.wikipedia.org/w/index.php?curid=42&action=history",
  );
  expect(
    activateExternalLink(
      { href: "#/album/42", button: 0, preventDefault: prevent },
      true,
      launch,
      fail,
    ),
  ).toBe(false);
  expect(
    activateExternalLink(
      { href: "https://example.org", button: 0, preventDefault: prevent },
      false,
      launch,
      fail,
    ),
  ).toBe(false);
  expect(
    activateExternalLink(
      { href: "https://example.org", button: 2, preventDefault: prevent },
      true,
      launch,
      fail,
    ),
  ).toBe(false);
});
it("reports failed browser handoff instead of leaving a silent dead link", async () => {
  const fail = vi.fn();
  activateExternalLink(
    { href: "https://example.org", button: 1, preventDefault: () => {} },
    true,
    async () => {
      throw Error("Unavailable");
    },
    fail,
  );
  await vi.waitFor(() => expect(fail.mock.calls[0]?.[0]).toContain("Unavailable"));
});

it("hands legacy HTTP resource links to the native browser without navigating the authenticated WebView", async () => {
  const launch = vi.fn(async () => {}),
    prevent = vi.fn();
  expect(
    activateExternalLink(
      { href: "http://public.example/artist", button: 0, preventDefault: prevent },
      true,
      launch,
      vi.fn(),
    ),
  ).toBe(true);
  await Promise.resolve();
  expect(prevent).toHaveBeenCalledOnce();
  expect(launch).toHaveBeenCalledExactlyOnceWith("http://public.example/artist");
});
