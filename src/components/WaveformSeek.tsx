import { createResource, createUniqueId, Show } from "solid-js";
import { t } from "../i18n";
import { useLibrary } from "../library/context";
import { requestAede } from "../platform/desktop";
import { parseWaveform, waveformPath, waveformPosition } from "../library/waveform";
/** Retains the full envelope on pause; an ordinary keyboard range supplies accessible seeking. */
export function WaveformSeek() {
  const player = useLibrary().player,
    id = createUniqueId();
  const [result] = createResource(
    () =>
      (["playing", "paused", "connecting"].includes(player.state().status) &&
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
  let pointer: number | undefined;
  function position(event: PointerEvent & { currentTarget: HTMLInputElement }) {
    const rect = event.currentTarget.getBoundingClientRect();
    return waveformPosition(event.clientX, rect.left, rect.width, player.state().duration_ms ?? 0);
  }
  const current = () =>
    ["playing", "paused", "connecting"].includes(player.state().status) &&
    result()?.reference === player.state().reference
      ? result()
      : undefined;
  const disabled = () =>
    !["playing", "paused"].includes(player.state().status) ||
    player.busy() ||
    !player.state().duration_ms;
  const progress = () =>
    Math.max(0, Math.min(100, (player.seekPosition() / (player.state().duration_ms ?? 1)) * 100));
  return (
    <div class="waveform-seek" aria-busy={result.loading} title={current()?.error ?? ""}>
      <svg viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id={id}>
            <rect x="0" y="0" width={progress() * 10} height="40" />
          </clipPath>
        </defs>
        <line x1="0" x2="1000" y1="20" y2="20" class="waveform-baseline" />
        <Show when={current()?.waveform}>
          {(waveform) => (
            <>
              <path class="waveform-envelope" d={waveformPath(waveform())} />
              <path
                class="waveform-played"
                clip-path={`url(#${id})`}
                d={waveformPath(waveform())}
              />
            </>
          )}
        </Show>
        <Show when={current()?.waveform}>
          <line class="waveform-cursor" x1={progress() * 10} x2={progress() * 10} y1="2" y2="38" />
        </Show>
      </svg>
      <input
        type="range"
        min="0"
        max={player.state().duration_ms ?? 1}
        step="1"
        value={player.seekPosition()}
        disabled={disabled()}
        aria-label={t("Position de lecture")}
        onInput={(event) => player.previewSeek(Number(event.currentTarget.value))}
        onChange={(event) => void player.seek(Number(event.currentTarget.value))}
        onPointerDown={(event) => {
          if (disabled() || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          pointer = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          player.previewSeek(position(event));
        }}
        onPointerMove={(event) => {
          if (pointer === event.pointerId) player.previewSeek(position(event));
        }}
        onPointerUp={(event) => {
          if (pointer !== event.pointerId) return;
          pointer = undefined;
          event.currentTarget.releasePointerCapture(event.pointerId);
          void player.seek(position(event));
        }}
        onPointerCancel={() => {
          pointer = undefined;
          player.clearSeekPreview();
        }}
        onBlur={player.clearSeekPreview}
      />
      <Show when={result.loading}>
        <span class="spinner waveform-loader" aria-label={t("Calcul de la forme d’onde…")} />
      </Show>
      <Show when={current()?.error}>
        <span class="waveform-warning" role="status">
          {t("Forme d’onde indisponible")}
        </span>
      </Show>
    </div>
  );
}
