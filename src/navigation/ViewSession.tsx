import { createContext, createEffect, on, useContext, type ParentProps } from "solid-js";
import { locale } from "../i18n";
import { createViewSession } from "./view-session";

const Context = createContext<ReturnType<typeof createViewSession>>();

/** The shell lifetime, rather than a page mount or a global singleton, owns display choices. */
export function ViewSessionProvider(props: ParentProps) {
  const session = createViewSession();
  // Account settings can change the interface language while Encyclopedia is not mounted.
  createEffect(on(locale, session.control("encyclopediaLanguage")[1], { defer: true }));
  return <Context.Provider value={session}>{props.children}</Context.Provider>;
}

/** Bind a typed display control; private content continues to use its existing owner guards. */
export function useViewSession() {
  const session = useContext(Context);
  if (!session) throw new Error("ViewSessionProvider is required.");
  return session;
}
