import { lazy, Suspense } from "solid-js";
import { PageLoader } from "../components/PageLoader";
import { PlaybackQueue } from "../components/PlaybackQueue";
import { PlaylistsView } from "../components/PlaylistsView";
const M3UPage = lazy(() => import("./M3UPage").then((module) => ({ default: module.M3UPage })));
/** The shared session queue is the default; file inventory is loaded only on explicit navigation. */
export function PlaylistsPage(props: { query: string }) {
  return (
    <PlaylistsView
      queue={(navigation) => (
        <section class="playback-page playlist-page">
          <PlaybackQueue standalone query={props.query} navigation={navigation} />
        </section>
      )}
      files={(navigation) => (
        <Suspense fallback={<PageLoader />}>
          <M3UPage query={props.query} navigation={navigation} />
        </Suspense>
      )}
    />
  );
}
