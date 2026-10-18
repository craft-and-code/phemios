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
