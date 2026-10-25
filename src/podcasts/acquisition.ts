import { podcastUrl } from "./feed";
import { t } from "../i18n";
/** Explicit public acquisition; an Apple episode link subscribes to its show, without playback.
 * Every awaited stage retires with its initiating account/view; policy applies to the actual RSS.
 */
export async function acquirePodcastFeed(
  value: string,
  io: {
    resolve: (url: string) => Promise<string>;
    read: (url: string) => Promise<string>;
    current: () => boolean;
    allowed: (url: string) => boolean;
  },
): Promise<{ url: string; xml: string } | undefined> {
  if (!io.current()) return;
  let url = podcastUrl(value.trim());
  if (new URL(url).hostname === "podcasts.apple.com") {
    url = podcastUrl(await io.resolve(url));
    if (!io.current()) return;
  }
  if (!io.allowed(url)) throw Error(t("Ce podcast est masqué pour ce compte."));
  const xml = await io.read(url);
  if (io.current()) return { url, xml };
}
