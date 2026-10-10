import { t } from "../i18n";
export const shortcutKey = "phemios.shortcuts.v1";
export const defaultShortcuts = {
  toggle: "Space",
  stop: "KeyS",
  previous: "Mod+ArrowLeft",
  next: "Mod+ArrowRight",
  mute: "KeyM",
  search: "Mod+KeyF",
  advanced: "Mod+Shift+KeyF",
  playback: "Mod+KeyL",
  settings: "Mod+Comma",
  queue: "KeyQ",
};
export type ShortcutAction = keyof typeof defaultShortcuts;
export type Shortcuts = Record<ShortcutAction, string>;
type KeyEvent = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat"
>;
const validCode =
  /^(Space|Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Enter|Escape|Home|End|Tab|Backspace|Delete|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backquote|Minus|Equal|Backslash|F([1-9]|1[0-2]))$/;
/** Mod is portable: Command on macOS, Control elsewhere; typing contexts never trigger actions. */
export function keyBinding(event: KeyEvent): string | undefined {
  if (!validCode.test(event.code)) return;
  return `${event.metaKey || event.ctrlKey ? "Mod+" : ""}${event.altKey ? "Alt+" : ""}${event.shiftKey ? "Shift+" : ""}${event.code}`;
}
export function parseShortcuts(raw: string | null): Shortcuts {
  if (raw === null) return { ...defaultShortcuts };
  const value = JSON.parse(raw) as Shortcuts;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== Object.keys(defaultShortcuts).length
  )
    throw new Error(t("Raccourcis invalides."));
  const used = new Set<string>();
  for (const action of Object.keys(defaultShortcuts) as ShortcutAction[]) {
    const binding = value[action];
    if (
      typeof binding !== "string" ||
      (binding && !/^(Mod\+)?(Alt\+)?(Shift\+)?[^+]+$/.test(binding)) ||
      (binding && !validCode.test(binding.split("+").at(-1)!)) ||
      (binding && used.has(binding))
    )
      throw new Error(t("Ce raccourci est invalide ou déjà utilisé."));
    if (binding) used.add(binding);
  }
  return { ...value };
}
export function shortcutAction(
  event: KeyEvent,
  bindings: Shortcuts,
  editing: boolean,
): ShortcutAction | undefined {
  if (editing || event.repeat) return;
  const key = keyBinding(event);
  return (Object.keys(bindings) as ShortcutAction[]).find(
    (action) => !!key && bindings[action] === key,
  );
}
