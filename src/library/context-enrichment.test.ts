import { expect, it, vi } from "vitest";
import { mountLibrary } from "./context-test-fixtures";
import { requestAede, syncAede } from "../platform/desktop";
vi.mock("../platform/desktop", async () => {
  const { mockLibraryDesktop } = await import("./context-desktop-test-fixtures");
  return mockLibraryDesktop();
});

it.each(["local", "server"] as const)(
  "publishes an enriched %s biography and attribution to an already selected artist after task completion",
  async (source) => {
    const snapshot = (complete: boolean) => ({
      server: "https://fixture.example",
      accountId: "fixture-admin",
      scannedAt: 1,
      albums: [],
      artists: [
        {
          reference: "artist:example ensemble",
          name: "Example Ensemble",
          genre: "",
          country: null,
          biography: complete ? "An attributed fixture biography." : "",
          ...(complete
            ? {
                biography_credit: {
                  url: "https://en.wikipedia.org/wiki/Example_Ensemble",
                  lang: "en",
                  licence: "CC BY-SA 4.0",
                },
              }
            : {}),
        },
      ],
    });
    vi.mocked(syncAede).mockResolvedValueOnce(snapshot(false));
    const library = mountLibrary();
    if (source === "local") await library.enableLocal();
    else await library.connect("https://fixture.example", "fixture-admin", "fixture");
    const selected = () => library.artists().find((artist) => artist.name === "Example Ensemble");
    const reference = selected()?.reference;
    expect(reference).toBeTruthy();
    expect(selected()?.biography).toBe("");
    vi.mocked(syncAede).mockResolvedValue(snapshot(true));
    const request = vi.mocked(requestAede),
      original = request.getMockImplementation()!;
    request.mockImplementation(async (...args) =>
      args[0] === "/api/admin/v1/tasks/11"
        ? { task_id: 11, status: "completed" }
        : original(...args),
    );
    Object.assign(window, {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    library.tasks.track({ task_id: 11 }, "fetch", source);
    await vi.advanceTimersByTimeAsync(300);
    expect(syncAede).toHaveBeenCalledTimes(2);
    expect(syncAede).toHaveBeenLastCalledWith(source);
    expect(selected()).toMatchObject({
      reference,
      biography: "An attributed fixture biography.",
      biographyCredit: {
        url: "https://en.wikipedia.org/wiki/Example_Ensemble",
        lang: "en",
        licence: "CC BY-SA 4.0",
      },
    });
    expect(request.mock.calls.some(([path]) => path === "/api/admin/v1/fetch")).toBe(false);
  },
);
