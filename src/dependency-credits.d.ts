/** Build-time lockfile inventory; never secrets or native runtime filesystem access. */
declare const __PHEMIOS_DEPENDENCIES__: readonly {
  name: string;
  version: string;
  ecosystem: string;
  url: string;
}[];
