import { createMemo, createSignal, onCleanup } from "solid-js";
import { parseRoute, sections, type Section } from "./routes";
interface Entry {
  hash: string;
  top: number;
  section?: Section;
  origin?: { href: string; label: string };
}
/** Host adapter keeps navigation policy testable without a DOM or a second router. */
export interface NavigationHost {
  current: () => { hash: string; state: unknown };
  push: (hash: string, state: unknown) => void;
  replace: (state: unknown) => void;
  back: () => void;
  top: () => number;
  restore: (top: number) => void;
  defer: (fn: () => void) => void;
  listen: (fn: () => void) => () => void;
}
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const safeHash = (hash: unknown): hash is string =>
  typeof hash === "string" && hash.startsWith("#/") && parseRoute(hash).kind !== "not-found";
function read(hash: string, state: unknown): Entry {
  const value = record(record(state).phemiosNavigation),
    origin = record(value.origin);
  if (
    value.version === 1 &&
    value.hash === hash &&
    typeof value.top === "number" &&
    Number.isFinite(value.top) &&
    value.top >= 0 &&
    value.top <= 2 ** 24
  )
    return {
      hash,
      top: value.top,
      ...(sections.some((s) => s.id === value.section)
        ? { section: value.section as Section }
        : {}),
      ...(safeHash(origin.href) && typeof origin.label === "string"
        ? { origin: { href: origin.href, label: origin.label } }
        : {}),
    };
  return { hash, top: 0 };
}
/** Each detail remembers its actual preceding page; Back restores that history entry's scroll. */
export function createNavigation(host: NavigationHost, labelFor: (hash: string) => string) {
  const initial = host.current();
  const [entry, setEntry] = createSignal(read(initial.hash || "#/artists", initial.state));
  const route = createMemo(() => parseRoute(entry().hash));
  const activeSection = createMemo(() => {
    const current = route();
    return current.kind === "section" ? current.section : (entry().section ?? "artists");
  });
  let alive = true,
    backPending = false;
  const wrapped = (value: Entry) => ({
    ...record(host.current().state),
    phemiosNavigation: { version: 1, ...value },
  });
  function restore(next: Entry) {
    host.defer(() => {
      if (alive && entry().hash === next.hash) host.restore(next.top);
    });
  }
  const unlisten = host.listen(() => {
    const current = host.current(),
      hash = current.hash || "#/artists";
    if (hash === entry().hash) return;
    const next = read(hash, current.state);
    setEntry(next);
    backPending = false;
    restore(next);
  });
  onCleanup(() => {
    alive = false;
    unlisten();
  });
  function navigate(hash: string) {
    if (!safeHash(hash)) return false;
    if (hash === entry().hash) return true;
    const current = { ...entry(), top: host.top() };
    host.replace(wrapped(current));
    const next: Entry = {
      hash,
      top: 0,
      section: activeSection(),
      origin: { href: current.hash, label: labelFor(current.hash) },
    };
    host.push(hash, wrapped(next));
    setEntry(next);
    restore(next);
    return true;
  }
  const backLink = () => {
    if (!["album", "artist"].includes(route().kind)) return undefined;
    return (
      entry().origin ??
      (route().kind === "album"
        ? { href: "#/albums", label: "Tous les albums" }
        : { href: "#/artists", label: "Tous les artistes" })
    );
  };
  function goBack() {
    if (backPending) return;
    if (entry().origin) {
      backPending = true;
      host.back();
    } else {
      const fallback = backLink();
      if (fallback) navigate(fallback.href);
    }
  }
  return { route, section: activeSection, backLink, navigate, goBack };
}

/** Native and browser hash histories share the same origin/scroll contract. */
export function browserNavigationHost(): NavigationHost {
  return {
    current: () => ({ hash: window.location.hash, state: window.history.state }),
    push: (hash, state) => window.history.pushState(state, "", hash),
    replace: (state) => window.history.replaceState(state, ""),
    back: () => window.history.back(),
    top: () => document.getElementById("content")?.scrollTop ?? 0,
    restore: (top) => document.getElementById("content")?.scrollTo({ top }),
    defer: (fn) => {
      requestAnimationFrame(fn);
    },
    listen: (fn) => {
      window.addEventListener("popstate", fn);
      window.addEventListener("hashchange", fn);
      return () => {
        window.removeEventListener("popstate", fn);
        window.removeEventListener("hashchange", fn);
      };
    },
  };
}
