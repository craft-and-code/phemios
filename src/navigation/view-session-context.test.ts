import { createComponent, createRoot } from "solid-js";
import { expect, it } from "vitest";
import { changeLanguage, locale } from "../i18n";
import { ViewSessionProvider, useViewSession } from "./ViewSession";

it("shares controls within an App provider and isolates another App provider", () => {
  createRoot((dispose) => {
    try {
      createComponent(ViewSessionProvider, {
        get children() {
          useViewSession().control("labelsDescending")[1](true);
          expect(useViewSession().control("labelsDescending")[0]()).toBe(true);
          return undefined;
        },
      });
      createComponent(ViewSessionProvider, {
        get children() {
          expect(useViewSession().control("labelsDescending")[0]()).toBe(false);
          return undefined;
        },
      });
    } finally {
      dispose();
    }
  });
});

it("applies a changed interface language even while Encyclopedia is unmounted", () => {
  const previous = locale();
  changeLanguage("fr");
  let dispose!: () => void;
  const controls = createRoot((end) => {
    dispose = end;
    let value: ReturnType<typeof useViewSession> | undefined;
    createComponent(ViewSessionProvider, {
      get children() {
        value = useViewSession();
        return undefined;
      },
    });
    return value;
  });
  try {
    expect(controls?.control("encyclopediaLanguage")[0]()).toBe("fr");
    changeLanguage("en");
    expect(controls?.control("encyclopediaLanguage")[0]()).toBe("en");
    controls?.control("encyclopediaLanguage")[1]("fr");
    expect(controls?.control("encyclopediaLanguage")[0]()).toBe("fr");
  } finally {
    dispose();
    changeLanguage(previous);
  }
});
