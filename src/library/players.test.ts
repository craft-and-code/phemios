import { expect, it } from "vitest";
import { parsePlayers } from "./players";
it("keeps distinct mounted destinations and rejects invalid or duplicate identities", () => {
  const rows = [
    { name: "Player", path: "/Volumes/Player", kind: "volume", format: "exfat" },
    { name: "Music", path: "/Volumes/Music", kind: "network", format: "smbfs" },
  ];
  expect(parsePlayers(rows)).toEqual(rows);
  expect(() => parsePlayers([...rows, rows[0]])).toThrow();
  expect(() => parsePlayers([{ ...rows[0], path: "relative" }])).toThrow();
  expect(() => parsePlayers([{ ...rows[0], kind: "internet" }])).toThrow();
});

it("keeps MTP storages and native tokens distinct from arbitrary filesystem paths", async () => {
  const { parsePlayerDiscovery } = await import("./players");
  const row = {
    id: "mtp:3",
    adapter: "mtp",
    available: true,
    name: "Example",
    path: "mtp:123:StorageId(1)",
    kind: "removable",
    format: "MTP",
    free: 1000,
  };
  expect(parsePlayerDiscovery({ volumes: [row], warning: "" }).volumes).toEqual([row]);
  expect(() => parsePlayers([{ ...row, path: "../../file" }])).toThrow();
  expect(() => parsePlayers([{ ...row, id: "arbitrary:path" }])).toThrow();
});

it("validates native model, compatibility and safe ejection metadata", () => {
  const row = {
    id: "mount:8",
    name: "Example iPod",
    path: "/Volumes/Example",
    kind: "volume",
    format: "fat",
    adapter: "ipod",
    available: false,
    model: "iPod nano 7G",
    icon: "ipod-touch",
    ipodSupported: false,
    ejectable: true,
    unavailableReason: "Unsupported model",
  };
  expect(parsePlayers([row])).toEqual([row]);
  for (const patch of [
    { model: 7 },
    { icon: "shell" },
    { ipodSupported: "yes" },
    { ejectable: "yes" },
    { unavailableReason: "x".repeat(513) },
  ])
    expect(() => parsePlayers([{ ...row, ...patch }])).toThrow();
});

it("accepts native-picked local and Windows folders without pretending they are ejectable volumes", () => {
  for (const path of [
    "/Users/example/Exports",
    String.raw`C:\Exports\Music`,
    String.raw`\\server\share\Music`,
    String.raw`\\?\C:\Exports`,
  ]) {
    const row = {
      id: "mount:4",
      adapter: "mounted",
      name: "Exports",
      path,
      format: "",
      kind: "folder",
      icon: "folder",
      available: true,
      ejectable: false,
    };
    expect(parsePlayers([row])).toEqual([row]);
  }
  expect(() =>
    parsePlayers([{ name: "Bad", path: "relative/output", kind: "folder", format: "" }]),
  ).toThrow();
});
