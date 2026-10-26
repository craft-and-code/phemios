import { bundledAsset } from "../bundled-assets";
import { t } from "../i18n";
import type { Country } from "./projection";
/** Read the locally bundled country geometry; no external map service is contacted. */
export async function readCountryBorders(): Promise<readonly Country[]> {
  const response = await fetch(bundledAsset("geography/countries.json"));
  if (!response.ok) throw new Error(t("Frontières indisponibles"));
  return (await response.json()) as Country[];
}
