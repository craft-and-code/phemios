import { createDiagnosticRead } from "../library/diagnostic-read";
import { RefreshButton } from "../components/RefreshButton";
import { StickyHeader } from "../components/StickyHeader";
import { PlayersContent } from "../components/PlayersContent";
import { createSignal } from "solid-js";
import { t } from "../i18n";
import { discoverPlayers, isNative } from "../platform/desktop";
import { parsePlayers } from "../library/players";
/** OS-mounted destinations are discovered independently from Aède's local or remote library. */
export function PlayersPage() {
  const [selected, setSelected] = createSignal("");
  const read = createDiagnosticRead(
    () => (isNative() ? { native: true } : false),
    async () => parsePlayers(await discoverPlayers()),
  );
  const volumes = read.current;
  return (
    <section class="page result-page players-page">
      <StickyHeader>
        <div class="page-heading">
          <span>{t("Lecteurs, cartes et volumes montés")}</span>
          <RefreshButton
            busyIndicator="stop"
            busy={read.loading()}
            disabled={!isNative() || (read.pending() && !read.loading())}
            onCancel={read.cancel}
            onRefresh={read.refetch}
          />
        </div>
      </StickyHeader>
      <PlayersContent
        busy={read.loading()}
        error={read.error()}
        volumes={volumes()}
        selected={selected()}
        onSelect={setSelected}
      />
    </section>
  );
}
