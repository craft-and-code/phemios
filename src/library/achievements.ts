import { t } from "../i18n";
export interface Achievement {
  slot: number;
  unlocked_at: number | null;
  title?: { fr: string; en: string };
  description?: { fr: string; en: string };
  icon?: string;
}
export interface Achievements {
  items: Achievement[];
  total: number;
  unlocked: number;
}
/** Refuse leaked locked details, duplicated slots and inconsistent confirmed counts. */
export function parseAchievements(raw: unknown): Achievements {
  const value = raw as Achievements;
  const text = (v: unknown): v is { fr: string; en: string } =>
    !!v &&
    typeof (v as { fr: unknown }).fr === "string" &&
    typeof (v as { en: unknown }).en === "string";
  if (
    !value ||
    !Array.isArray(value.items) ||
    value.items.length > 256 ||
    value.total !== value.items.length ||
    new Set(value.items.map((r) => r?.slot)).size !== value.total ||
    value.unlocked !== value.items.filter((r) => r?.unlocked_at !== null).length ||
    value.items.some(
      (r) =>
        !r ||
        !Number.isSafeInteger(r.slot) ||
        r.slot < 0 ||
        (r.unlocked_at === null
          ? Object.keys(r).some((k) => !["slot", "unlocked_at"].includes(k))
          : !Number.isSafeInteger(r.unlocked_at) ||
            r.unlocked_at < 0 ||
            r.unlocked_at > 8_640_000_000_000 ||
            !text(r.title) ||
            !text(r.description) ||
            typeof r.icon !== "string"),
    )
  )
    throw new Error(t("Trophées Aède invalides."));
  return value;
}
