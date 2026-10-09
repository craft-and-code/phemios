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
