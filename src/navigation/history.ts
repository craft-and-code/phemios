import { isCollectionMenuId, type CollectionMenuId } from "./collection-menu";
import { t } from "../i18n";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  type Accessor,
} from "solid-js";
import { navigationViewport, restoreElementPosition } from "./scroll-position";
import { parseRoute, sections, type Section } from "./routes";
interface Entry {
  hash: string;
  top: number;
  section?: Section;
  collectionMenu?: CollectionMenuId;
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
  cancelRestore?: () => void;
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
      ...(value.section === "collections" && isCollectionMenuId(value.collectionMenu)
        ? { collectionMenu: value.collectionMenu }
        : {}),
      ...(safeHash(origin.href) && typeof origin.label === "string"
        ? { origin: { href: origin.href, label: origin.label } }
        : {}),
    };
  return { hash, top: 0 };
}
/** Sections retain their viewport and detail Back restores its exact history entry.
 * Traversal, owner epochs and viewport retirement deliberately share one state machine.
 */
export function createNavigation(
  host: NavigationHost,
  labelFor: (hash: string) => string,
  identity?: Accessor<unknown>,
) {
  const initial = host.current();
  // A previous frontend lifetime cannot establish ownership of retained private display names.
  const [entry, setEntry] = createSignal<Entry>({ hash: initial.hash || "#/artists", top: 0 });
  const route = createMemo(() => parseRoute(entry().hash));
  const activeSection = createMemo(() => {
    const current = route();
    return current.kind === "section" ? current.section : (entry().section ?? "artists");
  });
  const collectionMenu = createMemo(() => {
    const current = route();
    return current.kind === "section" ? current.collectionMenu : entry().collectionMenu;
  });
  const positions = new Map<string, number>();
  let pendingDestination: { hash: string; options: { resetScroll?: boolean } } | undefined;
  let alive = true,
    backPending = false,
    restoration = 0,
    positionEpoch = crypto.randomUUID(),
    epochResetPending = false;
  const wrapped = (value: Entry) => ({
    ...record(host.current().state),
    phemiosNavigation: { version: 1, ...value, positionEpoch },
  });
  host.replace(wrapped(entry()));
  function restore(next: Entry) {
    host.cancelRestore?.();
    const ticket = ++restoration;
    host.defer(() => {
      if (alive && ticket === restoration && entry().hash === next.hash) {
        host.restore(next.top);
        epochResetPending = false;
      }
    });
  }
  function remember() {
    const top = epochResetPending ? 0 : host.top();
    const current = {
      ...entry(),
      top: Number.isFinite(top) ? Math.max(0, Math.min(2 ** 24, top)) : 0,
    };
    if (parseRoute(current.hash).kind === "section") {
      positions.delete(current.hash);
      positions.set(current.hash, current.top);
      if (positions.size > 128) positions.delete(positions.keys().next().value!);
    }
    return current;
  }
  if (identity)
    createEffect(
      on(
        identity,
        () => {
          positionEpoch = crypto.randomUUID();
          epochResetPending = true;
          positions.clear();
          pendingDestination = backPending
            ? { hash: entry().hash, options: { resetScroll: true } }
            : undefined;
          const next: Entry = { hash: entry().hash, top: 0 };
          host.replace(wrapped(next));
          setEntry(next);
          restore(next);
        },
        { defer: true },
      ),
    );
  const unlisten = host.listen(() => {
    const current = host.current(),
      hash = current.hash || "#/artists";
    if (hash === entry().hash) return;
    remember();
    const sameOwner =
      record(record(current.state).phemiosNavigation).positionEpoch === positionEpoch;
    // Historical display names and collection context are private to the initiating owner too.
    const next = sameOwner ? read(hash, current.state) : { hash, top: 0 };
    const queued = pendingDestination;
    pendingDestination = undefined;
    backPending = false;
    batch(() => {
      setEntry(next);
      restore(next);
      if (queued) navigate(queued.hash, queued.options);
    });
  });
  onCleanup(() => {
    alive = false;
    restoration++;
    positions.clear();
    pendingDestination = undefined;
    host.cancelRestore?.();
    unlisten();
  });
  function navigate(hash: string, options: { resetScroll?: boolean } = {}) {
    if (!safeHash(hash)) return false;
    if (backPending) {
      pendingDestination = { hash, options: { ...options } };
      return true;
    }
    if (hash === entry().hash) {
      if (options.resetScroll) {
        positions.delete(hash);
        const next = { ...entry(), top: 0 };
        host.replace(wrapped(next));
        setEntry(next);
        restore(next);
      }
      return true;
    }
    const current = remember();
    host.replace(wrapped(current));
    const next: Entry = {
      hash,
      top: options.resetScroll ? 0 : (positions.get(hash) ?? 0),
      section: activeSection(),
      ...(collectionMenu() ? { collectionMenu: collectionMenu()! } : {}),
      origin: { href: current.hash, label: labelFor(current.hash) },
    };
    host.push(hash, wrapped(next));
    setEntry(next);
    restore(next);
    return true;
  }
  const backLink = () => {
    if (!["album", "artist", "track", "label"].includes(route().kind)) return undefined;
    return (
      entry().origin ??
      (route().kind === "label"
        ? { href: "#/labels", label: t("Tous les labels") }
        : route().kind === "track"
          ? { href: "#/tracks", label: t("Toutes les pistes") }
          : route().kind === "album"
            ? { href: "#/albums", label: t("Tous les albums") }
            : { href: "#/artists", label: t("Tous les artistes") })
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
  /** Re-clicking either view icon returns through its actual history entry and viewport. */
  function toggleSection(section: "settings" | "playback") {
    const current = route();
    if (backPending) {
      if (current.kind !== "section" || current.section !== section) navigate(`#/${section}`);
      return;
    }
    if (current.kind === "section" && current.section === section) {
      if (entry().origin) goBack();
      else navigate("#/artists");
    } else navigate(`#/${section}`);
  }
  return {
    route,
    section: activeSection,
    collectionMenu,
    backLink,
    navigate,
    goBack,
    toggleSection,
  };
}

/** Native and browser hash histories share the same origin/scroll contract. */
export function browserNavigationHost(): NavigationHost {
  let cancelRestore = () => {};
  return {
    current: () => ({ hash: window.location.hash, state: window.history.state }),
    push: (hash, state) => window.history.pushState(state, "", hash),
    replace: (state) => window.history.replaceState(state, ""),
    back: () => window.history.back(),
    top: () => navigationViewport(document.getElementById("content"))?.scrollTop ?? 0,
    restore: (top) => {
      cancelRestore();
      const element = navigationViewport(document.getElementById("content"));
      cancelRestore = element ? restoreElementPosition(element, top) : () => {};
    },
    cancelRestore: () => cancelRestore(),
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
