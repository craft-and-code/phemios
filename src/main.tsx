import { applyPreferences, readPreferences } from "./library/preferences";
import { render } from "solid-js/web";
import { LibraryProvider } from "./library/context";
import { App } from "./App";
import "./styles.css";

try {
  applyPreferences(readPreferences(localStorage));
} catch (error) {
  console.error("Appearance preferences could not be restored", error);
}
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
