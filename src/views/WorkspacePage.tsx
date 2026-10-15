import { PageLoader } from "../components/PageLoader";
import { EncyclopediaPage } from "./EncyclopediaPage";
import { AchievementsPage } from "./AchievementsPage";
import { AdvancedSearchPage } from "./AdvancedSearchPage";

import { PlaybackPage } from "./PlaybackPage";

import { Switch, Match, lazy, Suspense } from "solid-js";
import { t } from "../i18n";
const ConcertsPage = lazy(() =>
  import("./ConcertsPage").then((module) => ({ default: module.ConcertsPage })),
);
import { PlaylistsPage } from "./PlaylistsPage";
const MoodsPage = lazy(() =>
  import("./MoodsPage").then((module) => ({ default: module.MoodsPage })),
);
import { type Section } from "../navigation/routes";
import { RatedPage } from "./RatedPage";
import { PodcastsPage } from "./PodcastsPage";
import { RadioPage } from "./RadioPage";
import { DoctorPage } from "./DoctorPage";
import { StatisticsPage } from "./StatisticsPage";
import { RelationsPage } from "./RelationsPage";
import { PersonalPage } from "./PersonalPage";
import { PlayersPage } from "./PlayersPage";
import { AnalysisPage } from "./AnalysisPage";
/** Section services stay reactive while navigation keeps the same workspace owner. */
export function WorkspacePage(props: {
  section: Section;
  query: string;
  compact: boolean;
  onStatisticsBrowse: Parameters<typeof StatisticsPage>[0]["onBrowse"];
}) {
  return (
    <Suspense
      fallback={
        props.section === "players" ? (
          <PageLoader label={t("Détection des lecteurs…")} />
        ) : (
          <PageLoader />
        )
      }
    >
      <Switch>
        <Match when={props.section === "encyclopedia"}>
          <EncyclopediaPage query={props.query} />
        </Match>
        <Match when={props.section === "achievements"}>
          <AchievementsPage />
        </Match>
        <Match when={props.section === "advanced-search"}>
          <AdvancedSearchPage />
        </Match>
        <Match when={props.section === "playlists"}>
          <PlaylistsPage query={props.query} />
        </Match>
        <Match when={props.section === "playback"}>
          <PlaybackPage />
        </Match>
        <Match when={props.section === "moods"}>
          <MoodsPage />
        </Match>
        <Match when={props.section === "rated"}>
          <RatedPage query={props.query} />
        </Match>
        <Match when={props.section === "podcasts"}>
          <PodcastsPage query={props.query} />
        </Match>
        <Match when={props.section === "concerts"}>
          <ConcertsPage query={props.query} />
        </Match>
        <Match when={props.section === "radio"}>
          <RadioPage query={props.query} />
        </Match>
        <Match when={props.section === "doctor"}>
          <DoctorPage />
        </Match>
        <Match when={props.section === "statistics"}>
          <StatisticsPage onBrowse={props.onStatisticsBrowse} />
        </Match>
        <Match when={props.section === "relations"}>
          <RelationsPage query={props.query} compact={props.compact} />
        </Match>
        <Match when={props.section === "analysis"}>
          <AnalysisPage query={props.query} />
        </Match>
        <Match when={props.section === "players"}>
          <PlayersPage />
        </Match>
        <Match when={["favourites", "collections", "history"].includes(props.section)}>
          <PersonalPage
            section={props.section}
            query={props.query}
            catalogCompact={props.compact}
          />
        </Match>
      </Switch>
    </Suspense>
  );
}
