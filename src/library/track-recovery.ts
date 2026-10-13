import { t } from "../i18n";
import type { SourceId } from "./sources";
/** Explicit repair reconnects only a managed local source; remote authority must already exist. */
export async function restoreTrackCache(
  source: SourceId,
  ports: {
    connected: boolean;
    connectLocal: () => Promise<void>;
    sync: (source: SourceId) => Promise<void>;
    hasTracks: (source: SourceId) => boolean;
    failure: () => string;
  },
  current: () => boolean,
) {
  if (!current()) return;
  if (!ports.connected && source === "server")
    throw new Error(t("Connectez Aède pour consulter toutes les pistes."));
  if (!ports.connected) await ports.connectLocal();
  else await ports.sync(source);
  if (!current()) return;
  if (!ports.hasTracks(source))
    throw new Error(
      ports.failure() ||
        t(
          "Les pistes ne sont pas encore enregistrées dans ce cache. Synchronisez la bibliothèque.",
        ),
    );
  return true;
}
