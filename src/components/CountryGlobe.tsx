import { createEffect, createResource, createSignal, onCleanup, onMount, Show } from "solid-js";
import {
  countryAt,
  unproject,
  wrapLongitude,
  type Country,
  type Point,
} from "../geography/projection";
import { drawGlobe } from "../geography/draw";
import type { Artist } from "../library/types";
const names = new Intl.DisplayNames(["fr"], { type: "region" });
const countryName = (code: string) => (/^[A-Z]{2}$/.test(code) ? names.of(code) : undefined);
/** Locally bundled borders and a manual, keyboard-accessible globe. */
export function CountryGlobe(props: {
  artists: readonly Artist[];
  selected: string | null | undefined;
  onSelect: (value: string | undefined) => void;
}) {
  const [countries] = createResource(async () => {
    const response = await fetch("/geography/countries.json");
    if (!response.ok) throw new Error("Frontières indisponibles");
    return (await response.json()) as Country[];
  });
  const [center, setCenter] = createSignal<Point>([8, 22]),
    [zoom, setZoom] = createSignal(1),
    [hover, setHover] = createSignal<string>("Explorez les pays");
  let canvas: HTMLCanvasElement | undefined;
  let frame = 0;
  let drag: { x: number; y: number; center: Point; moved: boolean } | undefined;
  const codeFor = (artist: Artist) =>
    artist.countryCode ??
    countries()?.find((c) => c.name === artist.country || countryName(c.code) === artist.country)
      ?.code;
  const available = () =>
    new Set(props.artists.map(codeFor).filter((code): code is string => !!code));
  const selectedCode = () =>
    typeof props.selected === "string"
      ? countries()?.find(
          (c) =>
            c.name === props.selected ||
            countryName(c.code) === props.selected ||
            c.code === props.selected,
        )?.code
      : undefined;
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (canvas)
        drawGlobe(canvas, countries() ?? [], center(), zoom(), selectedCode(), available());
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
  const pick = (event: PointerEvent) => {
    if (!canvas) return;
    const box = canvas.getBoundingClientRect(),
      radius = Math.min(box.width, box.height) * 0.42 * zoom();
    const point = unproject(
      [
        (event.clientX - box.left - box.width / 2) / radius,
        (event.clientY - box.top - box.height / 2) / radius,
      ],
      center(),
    );
    return point ? countryAt(point, countries() ?? []) : undefined;
  };
  function move(event: PointerEvent) {
    if (drag) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) drag.moved = true;
      if (drag.moved)
        setCenter([
          wrapLongitude(drag.center[0] - ((event.clientX - drag.x) * 0.45) / zoom()),
          Math.max(-80, Math.min(80, drag.center[1] + ((event.clientY - drag.y) * 0.35) / zoom())),
        ]);
    } else setHover(pick(event)?.name ?? "Explorez les pays");
  }
  function finish(event: PointerEvent) {
    if (drag && !drag.moved) {
      const country = pick(event);
      if (country) {
        const match = props.artists.find((a) => codeFor(a) === country.code);
        props.onSelect(match?.country ?? countryName(country.code) ?? country.name);
        setHover(country.name);
      }
    }
    drag = undefined;
  }
  return (
    <div class="globe-panel">
      <div class="globe-display">
        <canvas
          ref={(element) => {
            canvas = element;
          }}
          tabindex="0"
          role="img"
          aria-label="Globe des pays. Glissez pour tourner, molette pour zoomer. Flèches au clavier, plus et moins pour le zoom. Les boutons Pays offrent la sélection au clavier."
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag = { x: event.clientX, y: event.clientY, center: center(), moved: false };
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
          <button aria-label="Réduire le globe" onClick={() => zoomBy(-0.2)}>
            −
          </button>
          <button aria-label="Agrandir le globe" onClick={() => zoomBy(0.2)}>
            +
          </button>
          <button
            aria-label="Réinitialiser le globe"
            onClick={() => {
              setCenter([8, 22]);
              setZoom(1);
            }}
          >
            ↺
          </button>
        </div>
      </div>
      <div class="globe-caption">
        <p class="eyebrow">EXPLORATION GÉOGRAPHIQUE</p>
        <p class="globe-country" aria-live="polite">
          {hover()}
        </p>
        <p>
          Tournez le globe, zoomez et choisissez un pays. Les pays représentés dans la bibliothèque
          sont illuminés.
        </p>
        <small>L’origine vient des informations d’artiste disponibles dans Aède.</small>
        <Show when={countries.error}>
          <p role="alert">Impossible de charger les frontières. Utilisez les boutons de pays.</p>
        </Show>
        <button class="quiet" onClick={() => props.onSelect(undefined)}>
          Tous les pays
        </button>
      </div>
    </div>
  );
}
