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
  expect(streamUrl("http://radio.example.org:8000/live")).toBe(
    "http://radio.example.org:8000/live",
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

it("refuses non-public numeric aliases, reserved ranges and local host suffixes before browser audio", () => {
  for (const url of [
    "http://100.64.0.1/audio",
    "http://100.127.255.254/audio",
    "http://198.18.0.1/audio",
    "http://192.0.2.1/audio",
    "http://198.51.100.1/audio",
    "http://203.0.113.1/audio",
    "http://224.0.0.1/audio",
    "http://240.0.0.1/audio",
    "http://localhost./audio",
    "http://host.localhost/audio",
    "http://host.local./audio",
    "http://2130706433/audio",
    "http://0x7f000001/audio",
    "http://0177.0.0.1/audio",
  ])
    expect(() => streamUrl(url)).toThrow();
  expect(streamUrl("https://1.1.1.1/audio")).toBe("https://1.1.1.1/audio");
});

it("refuses protocol-only and retired relay literals while preserving public anycast addresses", () => {
  for (const host of [
    "192.0.0.0",
    "192.0.0.1",
    "192.0.0.8",
    "192.0.0.170",
    "192.0.0.171",
    "192.0.0.255",
    "192.88.99.1",
    "192.88.99.2",
  ])
    expect(() => streamUrl(`https://${host}/audio`)).toThrow();
  for (const host of ["192.0.0.9", "192.0.0.10"])
    expect(streamUrl(`https://${host}/audio`)).toBe(`https://${host}/audio`);
});
