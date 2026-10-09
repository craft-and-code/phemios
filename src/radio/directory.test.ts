import { expect, it } from "vitest";
import { parseResolved, parseStations, stationCount, streamUrl } from "./directory";
const station = {
  stationuuid: "12345678-1234-1234-1234-123456789012",
  name: "Test Radio",
  country: "France",
  tags: "rock",
  codec: "MP3",
  bitrate: 128,
};
it("bounds directory pages and reports a next page without inventing a total", () => {
  const page = parseStations(Array.from({ length: 51 }, () => station));
  expect(page.stations).toHaveLength(50);
  expect(page.more).toBe(true);
  expect(parseStations([]).more).toBe(false);
  expect(() => parseStations(Array.from({ length: 52 }, () => station))).toThrow();
  expect(() => parseStations([{ ...station, bitrate: null }])).toThrow();
  expect(stationCount({ stations: 50000 })).toBe(50000);
  expect(() => stationCount({ stations: "50000" })).toThrow();
});
it("rejects credential-bearing, local and executable stream URLs", () => {
  expect(streamUrl("https://radio.example.org/live.mp3")).toBe(
    "https://radio.example.org/live.mp3",
  );
  for (const url of [
    "javascript:alert(1)",
    "file:///music/one.flac",
    "https://user:pass@radio.example.org/",
    "http://127.0.0.1/x",
    "http://192.168.1.2/x",
    "http://10.0.0.1/x",
    "http://169.254.1.1/x",
    "http://localhost/x",
    "http://host.local/x",
    "http://[::1]/x",
  ])
    expect(() => streamUrl(url)).toThrow();
  expect(() =>
    parseResolved(
      { stationuuid: "other", url: "https://radio.example.org/live" },
      station.stationuuid,
    ),
  ).toThrow();
});
