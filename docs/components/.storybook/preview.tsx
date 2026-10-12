import { createEffect } from "solid-js";
import { createJSXDecorator, type Preview } from "storybook-solidjs-vite";
import { changeLanguage } from "../../../src/i18n";
import "../../../src/styles.css";
import "../explorer.css";

const preview: Preview = {
  tags: ["autodocs"],
  parameters: { layout: "padded", controls: { expanded: true } },
  globalTypes: {
    language: {
      description: "Component language only; no account preference is read or written.",
      toolbar: { title: "Language", items: ["fr", "en"], dynamicTitle: true },
    },
  },
  initialGlobals: { language: "fr" },
  decorators: [
    createJSXDecorator((Story, context) => {
      createEffect(() => changeLanguage(context.globals.language === "en" ? "en" : "fr"));
      return (
        <section class="component-frame">
          <Story />
        </section>
      );
    }),
  ],
};
export default preview;
