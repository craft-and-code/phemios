import { expect, it } from "vitest";
import { networkAudioAddress } from "./address";
it("reuses a literal LAN IPv4 from the configured server without depending on its port", () => {
  expect(networkAudioAddress("server", "https://192.168.1.20:3412")).toBe("192.168.1.20");
  expect(networkAudioAddress("server", "https://10.0.0.2:8443")).toBe("10.0.0.2");
  expect(networkAudioAddress("server", "http://172.16.0.2:3412")).toBe("172.16.0.2");
});
it("keeps local engines, loopback, names, IPv6 and public endpoints in explicit manual mode", () => {
  expect(networkAudioAddress("local", "https://192.168.1.20:3412")).toBe("");
  for (const value of [
    undefined,
    "https://localhost:3412",
    "https://127.0.0.1:3412",
    "https://music.example",
    "https://[::1]:3412",
    "https://8.8.8.8",
    "https://172.32.0.1",
    "file:///music",
    "invalid",
    "https://user:secret@192.168.1.20",
  ])
    expect(networkAudioAddress("server", value)).toBe("");
});
