import { Switch, Match } from "solid-js";
import { type Section } from "../navigation/routes";
import { RatedPage } from "./RatedPage";
import { RadioPage } from "./RadioPage";
import { DoctorPage } from "./DoctorPage";
import { StatisticsPage } from "./StatisticsPage";
import { RelationsPage } from "./RelationsPage";
import { PersonalPage } from "./PersonalPage";
import { PlayersPage } from "./PlayersPage";
import { AnalysisPage } from "./AnalysisPage";
/** Section services stay reactive while navigation keeps the same workspace owner. */
export function WorkspacePage(props: { section: Section; query: string }) {
  return (
    <Switch>
      <Match when={props.section === "rated"}>
        <RatedPage query={props.query} />
      </Match>
      <Match when={props.section === "radio"}>
        <RadioPage query={props.query} />
      </Match>
      <Match when={props.section === "doctor"}>
        <DoctorPage />
      </Match>
      <Match when={props.section === "statistics"}>
        <StatisticsPage />
      </Match>
      <Match when={props.section === "relations"}>
        <RelationsPage query={props.query} />
      </Match>
      <Match when={props.section === "analysis"}>
        <AnalysisPage query={props.query} />
      </Match>
      <Match when={props.section === "players"}>
        <PlayersPage />
      </Match>
      <Match when={["favourites", "collections", "history", "playlists"].includes(props.section)}>
        <PersonalPage section={props.section} query={props.query} />
      </Match>
    </Switch>
  );
}
