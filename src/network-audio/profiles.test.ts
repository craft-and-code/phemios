import { expect, it } from "vitest";
import { deviceKey, parseDevices, slimprotoDevice } from "./profiles";
it("orders explicit protocols and keeps a shared endpoint distinguishable", () => {
  const devices = parseDevices({
    items: [
      { name: "Renderer", endpoint: "http://192.168.1.20/device.xml", protocol: "upnp" },
      { name: "Renderer", endpoint: "http://192.168.1.20/device.xml", protocol: "openhome" },
      { name: "Speaker", endpoint: "192.168.1.21:8009", protocol: "googlecast" },
      slimprotoDevice("192.168.1.22"),
    ],
  });
  expect(devices.map((row) => row.protocol)).toEqual([
    "openhome",
    "googlecast",
    "slimproto",
    "upnp",
  ]);
  expect(new Set(devices.map(deviceKey)).size).toBe(4);
});
it("refuses malformed, duplicate or excessive discovery rows while retaining legacy UPnP", () => {
  const row = { name: "Renderer", endpoint: "http://192.168.1.20/device.xml" };
  expect(parseDevices({ items: [row] })[0]?.protocol).toBe("upnp");
  for (const items of [
    [row, row],
    Array(97).fill(row),
    [{ ...row, protocol: "airplay" }],
    [null],
    [{ ...row, name: "" }],
  ])
    expect(() => parseDevices({ items })).toThrow();
});
it("manual SlimProto peers never resolve DNS or accept public, wildcard or ambiguous addresses", () => {
  for (const ip of [
    "0.0.0.0",
    "8.8.8.8",
    "localhost",
    "192.168.001.2",
    "192.168.1.2:3483",
    "239.1.2.3",
    "192.168.1.999",
  ])
    expect(() => slimprotoDevice(ip)).toThrow();
  expect(slimprotoDevice("127.0.0.1").endpoint).toBe("127.0.0.1");
});
