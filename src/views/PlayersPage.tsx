import { createTransferMonitor } from "../library/transfer-monitor";
import { createDiagnosticRead } from "../library/diagnostic-read";
import { RefreshButton } from "../components/RefreshButton";
import { StickyHeader } from "../components/StickyHeader";
import { TransferDestination } from "../components/TransferDestination";
import { TransferSelection } from "../components/TransferSelection";
import { TransferPanel } from "../components/TransferPanel";
import { QueueAdd } from "../components/QueueAdd";
import { createSignal, createEffect, createMemo, onCleanup, onMount } from "solid-js";
import { t } from "../i18n";
import {
  discoverPlayers,
  ejectPlayer,
  pickTransferFolder,
  forgetTransferFolder,
  isNative,
  prepareTransfer,
  startTransfer,
  transferStatus,
  cancelTransfer,
} from "../platform/desktop";
import { createTransferRecipe } from "../library/transfer-recipe";
import { parsePlayerDiscovery, parsePlayers } from "../library/players";
import { useLibrary } from "../library/context";
import type { PlayableSelection } from "../library/playback-selection";
import { addTransferSelection, type TransferPreview } from "../library/transfers";
/** Discovery is public; transfer sources remain bound to their exact native account sessions. */
export function PlayersPage() {
  const library = useLibrary();
  const [rows, setRows] = createSignal<PlayableSelection[]>([]),
    [choosing, setChoosing] = createSignal(false),
    [folderError, setFolderError] = createSignal(""),
    [removing, setRemoving] = createSignal(""),
    [preview, setPreview] = createSignal<TransferPreview>(),
    [preparing, setPreparing] = createSignal(false),
    [ejecting, setEjecting] = createSignal(""),
    [error, setError] = createSignal("");
  const ownerScope = createMemo(() => ({
    local: library.localSession(),
    server: library.serverSession(),
  }));
  const { status, poll, command } = createTransferMonitor(
    ownerScope,
    transferStatus,
    isNative,
    (failure) => setError(failure instanceof Error ? failure.message : String(failure)),
  );
  let disposed = false,
    operation = 0;
  const read = createDiagnosticRead(
    () => (isNative() ? { native: true } : false),
    async () => parsePlayerDiscovery(await discoverPlayers()),
  );
  const {
    selected,
    select: setSelected,
    options,
    setOptions,
  } = createTransferRecipe(() => read.current()?.volumes, read.pending);
  const destinationBusy = () => !!ejecting() || !!removing() || choosing();
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
  onMount(() => {
    void poll();
    const timer = setInterval(() => void poll(), 1000);
    onCleanup(() => clearInterval(timer));
  });
  onCleanup(() => {
    disposed = true;
    operation++;
  });
  async function chooseFolder() {
    if (status().running || preparing() || destinationBusy() || read.pending()) return;
    const ticket = ++operation;
    setChoosing(true);
    setFolderError("");
    try {
      const raw = await pickTransferFolder();
      if (disposed || ticket !== operation || raw === null) return;
      const folder = parsePlayers([raw])[0]!;
      setPreview(undefined);
      setSelected("");
      await read.refetch();
      if (disposed || ticket !== operation) return;
      const registered = read.current()?.volumes.find((row) => row.path === folder.path);
      if (!registered?.id || registered.available === false)
        throw Error(
          read.error() ||
            registered?.unavailableReason ||
            t("Dossier de destination indisponible."),
        );
      setSelected(registered.id);
    } catch (failure) {
      if (!disposed && ticket === operation) setFolderError(String(failure));
    } finally {
      if (!disposed) setChoosing(false);
    }
  }
  async function eject(id: string) {
    if (status().running || preparing() || destinationBusy()) return;
    setEjecting(id);
    reset();
    try {
      await ejectPlayer(id);
      if (!disposed) {
        setSelected("");
        await read.refetch();
      }
    } catch (failure) {
      if (!disposed) setError(String(failure));
    } finally {
      if (!disposed) setEjecting("");
    }
  }
  async function removeFolder(id: string) {
    if (status().running || preparing() || destinationBusy() || read.pending()) return;
    setRemoving(id);
    reset();
    try {
      await forgetTransferFolder(id);
      if (!disposed) {
        if (selected() === id) setSelected("");
        await read.refetch();
      }
    } catch (failure) {
      if (!disposed) setFolderError(String(failure));
    } finally {
      if (!disposed) setRemoving("");
    }
  }
  async function prepare() {
    if (status().running || preparing() || destinationBusy()) return;
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
    if (!value || status().running || preparing() || destinationBusy()) return;
    setPreparing(true);
    setError("");
    try {
      await command(
        () => startTransfer(value.id),
        () => setPreview(undefined),
      );
    } finally {
      if (!disposed) setPreparing(false);
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
            disabled={!isNative() || status().running || preparing() || destinationBusy()}
            onRefresh={() => {
              reset();
              setSelected("");
              void read.refetch();
            }}
            onCancel={read.cancel}
          />
        </div>
      </StickyHeader>
      <div class="transfer-workspace">
        <QueueAdd
          disabled={status().running || preparing() || destinationBusy()}
          onSelect={(added) => {
            setRows((existing) => addTransferSelection(existing, added));
            reset();
          }}
        />
        <TransferSelection
          rows={rows()}
          disabled={status().running || preparing() || destinationBusy()}
          onRemove={(reference) => {
            setRows((value) => value.filter((row) => row.reference !== reference));
            reset();
          }}
        />
      </div>
      <TransferDestination
        canChoose={
          isNative() && !status().running && !preparing() && !destinationBusy() && !read.pending()
        }
        choosing={choosing()}
        chooseError={folderError()}
        onChoose={() => void chooseFolder()}
        onDismissError={() => setFolderError("")}
        warning={read.current()?.warning ?? ""}
        busy={read.loading()}
        error={read.error()}
        volumes={read.current()?.volumes}
        selected={selected()}
        ejecting={ejecting()}
        onEject={(id) => void eject(id)}
        removing={removing()}
        onRemove={(id) => void removeFolder(id)}
        disabled={status().running || preparing() || destinationBusy()}
        onSelect={(value) => {
          setSelected(value);
          reset();
        }}
      />
      <TransferPanel
        rows={rows()}
        destination={selected()}
        mtp={read.current()?.volumes.find((row) => row.id === selected())?.adapter === "mtp"}
        ipod={read.current()?.volumes.find((row) => row.id === selected())?.adapter === "ipod"}
        options={options()}
        preview={preview()}
        status={status()}
        preparing={preparing()}
        disabled={destinationBusy()}
        error={error()}
        onOptions={(value) => {
          setOptions(value);
          reset();
        }}
        onPreview={() => void prepare()}
        onStart={() => void start()}
        onCancel={() => void command(cancelTransfer)}
      />
    </section>
  );
}
