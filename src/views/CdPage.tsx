import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { useLibrary } from "../library/context";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { ejectCd, isNative, scanCd, openCdImage } from "../platform/desktop";
import { cdReference, cdPlaying, parseCd } from "../cd/model";
import { CdContent } from "../components/CdContent";
import { StickyHeader } from "../components/StickyHeader";
import { RefreshButton } from "../components/RefreshButton";
import { ActionButton } from "../components/ActionButton";
import { t } from "../i18n";
/** Native optical discovery never connects to Aède or imports audio into the catalogue. */
export function CdPage() {
  const player = useLibrary().player;
  const [selected, setSelected] = createSignal("");
  const [opening, setOpening] = createSignal(false);
  const [ejecting, setEjecting] = createSignal(false),
    [failure, setFailure] = createSignal("");
  const read = createDiagnosticRead(
    () => (isNative() ? { native: true } : false),
    async () => parseCd(await scanCd(selected() || undefined)),
  );
  const drives = () => read.current() ?? [];
  const active = createMemo(
    () => drives().find((d) => d.id === selected()) ?? drives().find((d) => d.disc) ?? drives()[0],
  );
  createEffect(() => player.setDiscTarget(active()?.disc ?? undefined));
  onCleanup(() => player.setDiscTarget(undefined));
  // With manual Refresh unavailable for an empty source, notice insertion without remounting.
  // Keep the last empty view mounted; never probe during active/paused optical reading.
  const discovery = setInterval(() => {
    if (
      isNative() &&
      document.visibilityState === "visible" &&
      !read.pending() &&
      !opening() &&
      !ejecting() &&
      !active()?.disc &&
      !(player.isCd() && ["playing", "paused", "connecting"].includes(player.state().status))
    )
      read.refetch();
  }, 5000);
  onCleanup(() => clearInterval(discovery));
  const discPlaying = () =>
    cdPlaying(active()?.disc?.token, player.state().reference, player.state().status);
  async function openImage() {
    if (!isNative() || opening() || read.pending()) return;
    setOpening(true);
    setFailure("");
    try {
      const id = await openCdImage();
      if (id) {
        setSelected(id);
        await read.refetch();
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t("Ouverture de l’image CD impossible."));
    } finally {
      setOpening(false);
    }
  }
  async function eject() {
    const drive = active();
    if (!drive?.disc || ejecting() || discPlaying()) return;
    setEjecting(true);
    setFailure("");
    try {
      const queueId = player.state().queue_id;
      const ownsDisc =
        !!drive.disc &&
        player.isCd() &&
        cdReference(player.queue()[0]?.reference ?? "")?.token === drive.disc.token;
      await ejectCd(drive.id);
      if (ownsDisc && player.isCd() && !player.busy() && player.state().queue_id === queueId)
        await player.clearQueue();
      setSelected("");
      read.refetch();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t("Éjection du CD impossible."));
    } finally {
      setEjecting(false);
    }
  }
  return (
    <section class="page result-page cd-page">
      <StickyHeader>
        <div class="page-heading">
          <span>{t("Lecteurs CD audio")}</span>
          <div class="cd-header-actions">
            <ActionButton
              icon="folder"
              busy={opening()}
              disabled={
                !isNative() ||
                read.pending() ||
                ejecting() ||
                (player.isCd() &&
                  ["playing", "paused", "connecting"].includes(player.state().status))
              }
              onClick={() => void openImage()}
            >
              {t("Ouvrir une image CUE")}
            </ActionButton>
            <RefreshButton
              busy={read.loading()}
              rotate
              disabled={
                !isNative() ||
                !active()?.disc ||
                ejecting() ||
                opening() ||
                (player.isCd() &&
                  ["playing", "paused", "connecting"].includes(player.state().status))
              }
              onCancel={read.cancel}
              onRefresh={read.refetch}
            />
          </div>
        </div>
      </StickyHeader>
      <CdContent
        drives={drives()}
        selected={active()?.id ?? ""}
        busy={read.loading() && !read.current()}
        error={failure() || read.error() || ""}
        native={isNative()}
        playing={player.state().reference}
        canPlay={!!active()?.disc && player.canStart(active()?.disc?.tracks[0]?.reference)}
        transportBusy={player.busy() || opening()}
        discPlaying={discPlaying()}
        ejecting={ejecting()}
        onSelect={setSelected}
        onPlay={(index) => {
          const disc = active()?.disc;
          if (disc) void player.startDisc(disc, index);
        }}
        onEject={() => void eject()}
      />
    </section>
  );
}
