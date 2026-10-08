import { render } from "solid-js/web";
import { LibraryProvider } from "./library/context";
import { App } from "./App";
import "./styles.css";

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
