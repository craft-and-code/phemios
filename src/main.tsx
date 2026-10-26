import { webEnabled } from "./web/runtime";
import { interfacePreferences } from "./library/account-preferences";
import { applyPreferences, readPreferences } from "./library/preferences";
import { render } from "solid-js/web";
import { LibraryProvider } from "./library/context";
import { App } from "./App";
import "./styles.css";

try {
  applyPreferences(readPreferences(interfacePreferences));
} catch (error) {
  console.error("Appearance preferences could not be restored", error);
}
if (webEnabled() && !location.hash) history.replaceState(null, "", "#/albums");
const root = document.getElementById("root");
if (!root) throw new Error("Phémios root element is missing.");
render(
  () => (
    <LibraryProvider>
      <App />
    </LibraryProvider>
  ),
  root,
);
