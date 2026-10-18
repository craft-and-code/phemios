import { createDiagnosticRead } from "../library/diagnostic-read";
import { RefreshButton } from "../components/RefreshButton";
import { StickyHeader } from "../components/StickyHeader";
import { PlayersContent } from "../components/PlayersContent";
import { TransferPanel } from "../components/TransferPanel";
import { QueueAdd } from "../components/QueueAdd";
import { Show, createSignal, createEffect, onCleanup, onMount } from "solid-js";
import { t } from "../i18n";
import {
  discoverPlayers,
  isNative,
  prepareTransfer,
  startTransfer,
  transferStatus,
  cancelTransfer,
} from "../platform/desktop";
import { parsePlayerDiscovery } from "../library/players";
import { useLibrary } from "../library/context";
import type { PlayableSelection } from "../library/playback-selection";
import {
  addTransferSelection,
  type TransferOptions,
  type TransferPreview,
  type TransferStatus,
} from "../library/transfers";
import { Feedback } from "../components/Feedback";
/** Discovery is public; transfer sources remain bound to their exact native account sessions. */
export function PlayersPage() {
  const library = useLibrary();
  const [selected, setSelected] = createSignal(""),
    [rows, setRows] = createSignal<PlayableSelection[]>([]),
    [picker, setPicker] = createSignal(false),
    [options, setOptions] = createSignal<TransferOptions>({
      format: "original",
      verify: true,
      replace: false,
    }),
    [preview, setPreview] = createSignal<TransferPreview>(),
    [preparing, setPreparing] = createSignal(false),
    [error, setError] = createSignal(""),
    [status, setStatus] = createSignal<TransferStatus>({ phase: "idle", running: false });
  let disposed = false,
    operation = 0,
    polling = false;
  const read = createDiagnosticRead(
    () => (isNative() ? { native: true } : false),
    async () => parsePlayerDiscovery(await discoverPlayers()),
  );
  const reset = () => {
    operation++;
    setPreview(undefined);
    setError("");
  };
  createEffect(() => {
    library.localSession();
    library.serverSession();
    setRows([]);
    reset();
  });
  async function poll() {
    if (polling || !isNative()) return;
    polling = true;
    try {
      const next = await transferStatus();
      if (!disposed) setStatus(next);
    } catch (failure) {
      if (!disposed) setError(String(failure));
    } finally {
      polling = false;
    }
  }
  onMount(() => {
    void poll();
    const timer = setInterval(() => void poll(), 1000);
    onCleanup(() => clearInterval(timer));
  });
  onCleanup(() => {
    disposed = true;
    operation++;
  });
  async function prepare() {
    if (status().running || preparing()) return;
    const ticket = ++operation;
    setPreparing(true);
    setPreview(undefined);
    setError("");
    try {
      const value = await prepareTransfer(
        selected(),
        rows().map((row) => row.reference),
        options(),
      );
      if (!disposed && ticket === operation) setPreview(value);
    } catch (failure) {
      if (!disposed && ticket === operation)
        setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      if (!disposed) setPreparing(false);
    }
  }
  async function start() {
    const value = preview();
    if (!value || status().running) return;
    setPreparing(true);
    setError("");
    try {
      await startTransfer(value.id);
      setPreview(undefined);
      await poll();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setPreparing(false);
    }
  }
  return (
    <section class="page result-page players-page">
      <StickyHeader>
        <div class="page-heading">
          <span>{t("Lecteurs externes")}</span>
          <RefreshButton
            rotate
            busy={read.loading()}
            disabled={!isNative() || status().running || preparing()}
            onRefresh={() => {
              reset();
              setSelected("");
              void read.refetch();
            }}
            onCancel={read.cancel}
          />
        </div>
      </StickyHeader>
      <PlayersContent
        busy={read.loading()}
        error={read.error()}
        volumes={read.current()?.volumes}
        selected={selected()}
        disabled={status().running || preparing()}
        onSelect={(value) => {
          setSelected(value);
          const adapter = read.current()?.volumes.find((row) => row.id === value)?.adapter;
          if (adapter === "ipod") setOptions({ format: "original", verify: false, replace: false });
          else if (adapter === "mtp") setOptions((previous) => ({ ...previous, replace: false }));
          reset();
        }}
      />
      <Show when={read.current()?.warning}>
        <Feedback error persistent message={read.current()!.warning} />
      </Show>
      <div class="transfer-workspace">
        <TransferPanel
          rows={rows()}
          destination={selected()}
          mtp={read.current()?.volumes.find((row) => row.id === selected())?.adapter === "mtp"}
          ipod={read.current()?.volumes.find((row) => row.id === selected())?.adapter === "ipod"}
          options={options()}
          preview={preview()}
          status={status()}
          preparing={preparing()}
          error={error()}
          onOptions={(value) => {
            setOptions(value);
            reset();
          }}
          onChoose={() => setPicker(!picker())}
          onRemove={(reference) => {
            setRows((value) => value.filter((row) => row.reference !== reference));
            reset();
          }}
          onPreview={() => void prepare()}
          onStart={() => void start()}
          onCancel={() =>
            void cancelTransfer()
              .then(poll)
              .catch((failure) => setError(String(failure)))
          }
        />
        <Show when={picker()}>
          <QueueAdd
            disabled={status().running || preparing()}
            onClose={() => setPicker(false)}
            onSelect={(added) => {
              setRows((existing) => addTransferSelection(existing, added));
              reset();
            }}
          />
        </Show>
      </div>
    </section>
  );
}
