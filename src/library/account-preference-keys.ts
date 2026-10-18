/** Only these non-secret interface settings participate in owner profiles and portable backups. */
export const accountSettingKeys = [
  "phemios.appearance",
  "phemios.navigation.v1",
  "phemios.tools.v1",
  "phemios.duration",
  "phemios.keep-awake",
  "phemios.visualizer",
  "phemios.spectrum",
  "phemios.spectrum-style",
  "phemios.shortcuts.v1",
  "phemios.audio.v1",
] as const;
