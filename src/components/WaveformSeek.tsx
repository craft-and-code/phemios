import { createWaveformPointer } from "../library/waveform-pointer";
import { cdReference } from "../cd/model";
import { createMemo, createResource, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { createWaveformPresentation } from "../library/waveform-presentation";
import { createWaveformHover } from "../library/waveform-hover";
import { parseWaveform, waveformPosition } from "../library/waveform";
/** Retains the full envelope on pause; an ordinary keyboard range supplies accessible seeking. */
export function WaveformSeek() {
  const player = useLibrary().player;
  const [result] = createResource(
    () =>
      (!cdReference(player.state().reference) &&
        ["playing", "paused", "connecting"].includes(player.state().status) &&
        player.state().reference) ||
      false,
    async (reference) => {
      try {
        return {
          waveform: parseWaveform(
            await requestAede("/api/v1/waveform", { ref: reference }),
            reference,
          ),
          reference,
        };
      } catch (failure) {
        return { error: String(failure), reference };
      }
    },
  );
  const duration = () => display().duration_ms || player.state().duration_ms || 0;
  function position(event: PointerEvent & { currentTarget: HTMLInputElement }) {
    const rect = event.currentTarget.getBoundingClientRect();
    return waveformPosition(event.clientX, rect.left, rect.width, duration());
  }
  const display = createWaveformPresentation(player.state, () => {
    const state = player.state();
    return cdReference(state.reference)
      ? {
          reference: state.reference,
          ...(state.cd_waveform ? { waveform: state.cd_waveform } : {}),
        }
      : result.latest;
  });
  const path = createMemo(() => display().path);
  const disabled = () =>
    !["playing", "paused"].includes(player.state().status) || player.busy() || !duration();
  const hover = createWaveformHover(() => player.state().reference ?? "", disabled);
  function hoverPosition(event: PointerEvent & { currentTarget: HTMLInputElement }) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientY < rect.top || event.clientY > rect.bottom) hover.clear();
    else hover.move(event.clientX, rect.left, rect.width, duration());
  }
  const gesture = createWaveformPointer({
    state: player.state,
    disabled,
    position,
    hover: hoverPosition,
    preview: player.previewSeek,
    seek: (value) => void player.seek(value),
    clear: () => {
      hover.clear();
      player.clearSeekPreview();
    },
  });
  const progress = () =>
    Math.max(0, Math.min(100, (player.seekPosition() / (duration() || 1)) * 100));
  return (
    <div
      class="waveform-seek"
      classList={{ "waveform-idle": player.state().status === "idle" }}
      aria-busy={result.loading}
      title={
        display().error ||
        (player.isCd() ? t("La forme d’onde du CD se construit pendant la lecture.") : undefined)
      }
    >
      <svg viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" x2="1000" y1="20" y2="20" class="waveform-baseline" />
        <path class="waveform-envelope" d={path()} />
        <line
          class="waveform-cursor"
          visibility={
            duration() > 0 && ["playing", "paused", "connecting"].includes(player.state().status)
              ? "visible"
              : "hidden"
          }
          x1={progress() * 10}
          x2={progress() * 10}
          y1="2"
          y2="38"
        />
      </svg>
      <svg
        class="waveform-played-layer"
        viewBox="0 0 1000 40"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ "clip-path": `inset(0 ${100 - progress()}% 0 0)` }}
      >
        <path class="waveform-played" d={path()} />
      </svg>
      <svg
        class="waveform-hover-layer"
        viewBox="0 0 1000 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          class="waveform-hover-cursor"
          visibility={hover.position() === undefined ? "hidden" : "visible"}
          x1={((hover.position() ?? 0) / (duration() || 1)) * 1000}
          x2={((hover.position() ?? 0) / (duration() || 1)) * 1000}
          y1="0"
          y2="40"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <input
        type="range"
        min="0"
        max={duration() || 1}
        step="1"
        value={player.seekPosition()}
        disabled={disabled()}
        aria-label={t("Position de lecture")}
        onInput={(event) => player.previewSeek(Number(event.currentTarget.value))}
        onChange={(event) => void player.seek(Number(event.currentTarget.value))}
        onPointerDown={gesture.down}
        onPointerMove={gesture.move}
        onPointerUp={gesture.up}
        onPointerLeave={hover.clear}
        onPointerCancel={gesture.cancel}
        onLostPointerCapture={gesture.cancel}
        onBlur={gesture.cancel}
      />
      <Show when={result.loading}>
        <span class="spinner waveform-loader" aria-label={t("Calcul de la forme d’onde…")} />
      </Show>
      <Show when={display().error}>
        <span class="waveform-warning" role="status">
          {t("Forme d’onde indisponible")}
        </span>
      </Show>
    </div>
  );
}
