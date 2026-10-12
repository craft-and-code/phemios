import { ChoiceSelect } from "./ChoiceSelect";
import { geoCentroid } from "d3-geo";
import { countryGeometry } from "../geography/geometry";
import { t, countryName as displayCountry } from "../i18n";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  countryAt,
  globePoint,
  unproject,
  wrapLongitude,
  type Country,
  type Point,
} from "../geography/projection";
import { additiveCountrySelection, isMac } from "../library/selection";
import { drawGlobe } from "../geography/draw";
import type { Artist } from "../library/types";
import { Icon } from "./Icon";
const names = new Intl.DisplayNames(["fr"], { type: "region" });
const countryName = (code: string) => (/^[A-Z]{2}$/.test(code) ? names.of(code) : undefined);
/** Locally bundled borders and a manual, keyboard-accessible globe. */
export function CountryGlobe(props: {
  directory?: boolean;
  focus?: string;
  onReset?: () => string;
  /** Optional local geometry loader; the app defaults to its bundled HTTP asset. */
  loadCountries?: (() => Promise<readonly Country[]>) | undefined;
  artists: readonly Artist[];
  selected: readonly (string | null)[];
  onSelect: (value: string | undefined, additive?: boolean) => void;
}) {
  const [countries] = createResource(async () => {
    if (props.loadCountries) return props.loadCountries();
    const response = await fetch("/geography/countries.json");
    if (!response.ok) throw new Error(t("Frontières indisponibles"));
    return (await response.json()) as Country[];
  });
  const [center, setCenter] = createSignal<Point>([8, 22]),
    [zoom, setZoom] = createSignal(1),
    [hover, setHover] = createSignal<Country | undefined>();
  let canvas: HTMLCanvasElement | undefined;
  let frame = 0;
  let keyboardFocus = false;
  let drag: { x: number; y: number; center: Point; moved: boolean } | undefined;
  const codeFor = (artist: Artist) =>
    artist.countryCode ??
    countries()?.find((c) => c.name === artist.country || countryName(c.code) === artist.country)
      ?.code;
  // Frame and pointer callbacks read owned snapshots rather than instantiate JSX prop memos.
  const available = createMemo(
    () =>
      new Set(
        props.directory
          ? (countries() ?? []).map((country) => country.code)
          : props.artists.map(codeFor).filter((code): code is string => !!code),
      ),
  );
  const selectedCodes = createMemo(() => {
    const selected = props.selected;
    return new Set(
      (countries() ?? [])
        .filter((c) =>
          selected.some(
            (value) => value === c.name || value === countryName(c.code) || value === c.code,
          ),
        )
        .map((c) => c.code),
    );
  });
  const focusCountry = (value: string | undefined) => {
    const country = countries()?.find(
      (country) => value === country.code || value === country.name,
    );
    if (country) {
      const point = geoCentroid(countryGeometry(country));
      if (point.every(Number.isFinite)) setCenter([point[0], point[1]]);
    }
  };
  createEffect(() => focusCountry(props.focus));
  const selectCountry = (code: string) => {
    const country = countries()?.find((row) => row.code === code);
    const match = props.artists.find((artist) => codeFor(artist) === code);
    props.onSelect(
      code
        ? props.directory
          ? code
          : (match?.country ?? countryName(code) ?? country?.name ?? code)
        : undefined,
    );
    if (code) focusCountry(code);
  };
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (canvas)
        drawGlobe(
          canvas,
          countries() ?? [],
          center(),
          zoom(),
          selectedCodes(),
          available(),
          keyboardFocus,
        );
    });
  };
  createEffect(() => {
    countries();
    center();
    zoom();
    void props.selected;
    void props.artists;
    redraw();
  });
  onMount(() => {
    const observer = new ResizeObserver(redraw);
    if (canvas) observer.observe(canvas);
    onCleanup(() => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    });
  });
  const zoomBy = (delta: number) => setZoom((value) => Math.min(2.4, Math.max(0.8, value + delta)));
  const pointAt = (event: MouseEvent) => {
    if (!canvas) return null;
    const box = canvas.getBoundingClientRect();
    return globePoint(
      [event.clientX - box.left, event.clientY - box.top],
      box.width,
      box.height,
      zoom(),
    );
  };
  const pick = (event: PointerEvent) => {
    const hit = pointAt(event);
    const point = hit ? unproject(hit, center()) : null;
    return point ? countryAt(point, countries() ?? []) : undefined;
  };
  function move(event: PointerEvent) {
    if (canvas) canvas.style.cursor = drag ? "grabbing" : pointAt(event) ? "grab" : "default";
    if (drag) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) drag.moved = true;
      if (drag.moved)
        setCenter([
          wrapLongitude(drag.center[0] - ((event.clientX - drag.x) * 0.45) / zoom()),
          Math.max(-80, Math.min(80, drag.center[1] + ((event.clientY - drag.y) * 0.35) / zoom())),
        ]);
    } else setHover(pick(event));
  }
  function finish(event: PointerEvent) {
    if (drag && !drag.moved) {
      const country = pick(event);
      if (country) {
        const match = props.artists.find((a) => codeFor(a) === country.code);
        props.onSelect(
          props.directory
            ? country.code
            : (match?.country ?? countryName(country.code) ?? country.name),
          additiveCountrySelection(event, isMac()),
        );
        setHover(country);
      }
    }
    drag = undefined;
  }
  return (
    <div class="globe-panel">
      <Show when={countries()?.length}>
        <label class="radio-globe-country">
          {t("Pays")}
          <ChoiceSelect
            label={t("Pays")}
            value={[...selectedCodes()][0] ?? ""}
            onChange={selectCountry}
            options={[
              { value: "", label: t("Tous") },
              ...(countries() ?? [])
                .slice()
                .sort((a, b) =>
                  displayCountry(a.code, a.name).localeCompare(displayCountry(b.code, b.name)),
                )
                .map((country) => ({
                  value: country.code,
                  label: displayCountry(country.code, country.name),
                })),
            ]}
          />
        </label>
      </Show>
      <div class="globe-display">
        <canvas
          ref={(element) => {
            canvas = element;
          }}
          tabindex="0"
          role="img"
          aria-label={t(
            "Globe des pays. Glissez pour tourner, molette pour zoomer. Flèches au clavier, plus et moins pour le zoom. Command-clic sur Mac, Control-clic ailleurs pour sélectionner plusieurs pays. Les boutons Pays offrent la sélection au clavier.",
          )}
          onPointerDown={(event) => {
            event.preventDefault();
            if (event.button !== 0 || !pointAt(event)) return;
            keyboardFocus = false;
            redraw();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag = { x: event.clientX, y: event.clientY, center: center(), moved: false };
          }}
          onFocus={(event) => {
            keyboardFocus = event.currentTarget.matches(":focus-visible");
            redraw();
          }}
          onBlur={() => {
            keyboardFocus = false;
            redraw();
          }}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={() => {
            drag = undefined;
          }}
          onLostPointerCapture={() => {
            drag = undefined;
          }}
          onWheel={(event) => {
            if (!pointAt(event)) return;
            event.preventDefault();
            zoomBy(event.deltaY < 0 ? 0.1 : -0.1);
          }}
          onKeyDown={(event) => {
            const [lon, lat] = center();
            const values: Record<string, Point> = {
              ArrowLeft: [lon - 10, lat],
              ArrowRight: [lon + 10, lat],
              ArrowUp: [lon, Math.min(80, lat + 10)],
              ArrowDown: [lon, Math.max(-80, lat - 10)],
              Home: [8, 22],
            };
            const value = values[event.key];
            if (value) {
              event.preventDefault();
              setCenter([wrapLongitude(value[0]), value[1]]);
            } else if (["+", "=", "-"].includes(event.key)) {
              event.preventDefault();
              zoomBy(event.key === "-" ? -0.1 : 0.1);
            }
          }}
        />
        <div class="globe-zoom">
          <button
            class="icon-button"
            aria-label={t("Réduire le globe")}
            onClick={() => zoomBy(-0.2)}
          >
            <Icon name="minus" />
          </button>
          <button
            class="icon-button"
            aria-label={t("Agrandir le globe")}
            onClick={() => zoomBy(0.2)}
          >
            <Icon name="plus" />
          </button>
          <button
            class="icon-button"
            aria-label={t("Réinitialiser le globe")}
            onClick={() => {
              setCenter([8, 22]);
              setZoom(1);
              setHover(undefined);
              if (props.onReset) focusCountry(props.onReset());
            }}
          >
            <Icon name="refresh" />
          </button>
        </div>
      </div>
      <div class="globe-caption">
        <p class="eyebrow">{t("EXPLORATION GÉOGRAPHIQUE")}</p>
        <p class="globe-country" aria-live="polite">
          {hover() ? displayCountry(hover()!.code, hover()!.name) : t("Explorez les pays")}
        </p>
        <details class="globe-help">
          <summary>{t("Comment utiliser le globe")}</summary>
          <p>
            {t(
              "Tournez le globe, zoomez et choisissez un pays. Les pays représentés dans la bibliothèque sont illuminés.",
            )}{" "}
            {isMac() ? t("⌘ + clic") : t("Ctrl + clic")}{" "}
            {t("pour ajouter ou retirer un pays de la sélection.")}{" "}
          </p>
          <small>{t("L’origine vient des informations d’artiste disponibles dans Aède.")}</small>
        </details>
        <Show when={countries.error}>
          <p role="alert">
            {t("Impossible de charger les frontières. Utilisez les boutons de pays.")}
          </p>
        </Show>
      </div>
    </div>
  );
}
