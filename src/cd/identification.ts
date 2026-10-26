import { createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import { t } from "../i18n";
import type { CdDisc, CdDrive } from "./model";
type Names = { title: string; artist: string; tracks: { title: string; artist: string }[] };
type Answer =
  { status: "matched"; names: Names } | { status: "not_found" | "ambiguous" | "failed" };
/** Public metadata is accepted only for the captured token and complete physical track order. */
export function cdIdentification(value: unknown, disc: CdDisc): Answer {
  const raw = value as { token?: unknown; metadata?: Record<string, unknown> } | null;
  const data = raw?.metadata;
  const invalid = () => new Error(t("Réponse MusicBrainz invalide."));
  if (raw?.token !== disc.token || !data) throw invalid();
  if (data.status === "not_found" || data.status === "ambiguous") return { status: data.status };
  const text = (v: unknown): v is string =>
    typeof v === "string" && !!v.trim() && [...v].length <= 1000 && !/\p{Cc}/u.test(v);
  if (
    data.status !== "matched" ||
    !text(data.title) ||
    !text(data.artist) ||
    !Array.isArray(data.tracks) ||
    data.tracks.length !== disc.tracks.length ||
    data.tracks.some((v) => !v || !text(v.title) || !text(v.artist))
  )
    throw invalid();
  return {
    status: "matched",
    names: { title: data.title, artist: data.artist, tracks: data.tracks },
  };
}
/** Insertion starts one serial public lookup per physical selection, independent of accounts and playback.
 * Disposal/ejection/cancellation retire admission; an already dispatched native HTTP call may finish.
 */
export function createCdIdentification(
  drives: () => readonly CdDrive[],
  lookup: (token: string) => Promise<unknown>,
) {
  const [answers, setAnswers] = createSignal<ReadonlyMap<string, Answer>>(new Map());
  const [active, setActive] = createSignal("");
  const attempted = new Set<string>();
  let alive = true,
    running = false,
    generation = 0;
  const eligible = () =>
    drives()
      .filter((d) => !d.image && d.disc?.tracks.some((track) => !track.title))
      .map((d) => d.disc!);
  async function drain() {
    if (running || !alive) return;
    running = true;
    try {
      while (alive) {
        const disc = eligible().find((d) => !attempted.has(d.token));
        if (!disc) break;
        attempted.add(disc.token);
        const ticket = generation;
        setActive(disc.token);
        let answer: Answer;
        try {
          answer = cdIdentification(await lookup(disc.token), disc);
        } catch {
          answer = { status: "failed" };
        }
        if (alive && ticket === generation && eligible().some((d) => d.token === disc.token))
          setAnswers((rows) => new Map(rows).set(disc.token, answer));
        if (alive && active() === disc.token) setActive("");
      }
    } finally {
      running = false;
    }
  }
  createEffect(() => {
    const tokens = new Set(drives().flatMap((d) => (d.disc ? [d.disc.token] : [])));
    untrack(() => {
      for (const token of attempted) if (!tokens.has(token)) attempted.delete(token);
      setAnswers((rows) => new Map([...rows].filter(([token]) => tokens.has(token))));
      void drain();
    });
  });
  onCleanup(() => {
    alive = false;
    generation++;
  });
  const enriched = createMemo(() =>
    drives().map((drive) => {
      const disc = drive.disc,
        result = disc && answers().get(disc.token);
      if (!disc || result?.status !== "matched") return drive;
      const names = result.names;
      return {
        ...drive,
        disc: {
          ...disc,
          title: disc.title || names.title,
          artist: disc.artist || names.artist,
          tracks: disc.tracks.map((track, i) => ({
            ...track,
            title: track.title || names.tracks[i]!.title,
            artist: track.artist || names.tracks[i]!.artist,
          })),
        },
      };
    }),
  );
  return {
    drives: enriched,
    cancel() {
      generation++;
      for (const disc of eligible()) attempted.add(disc.token);
      setActive("");
    },
    message(token: string | undefined) {
      if (!token) return "";
      if (active() === token) return t("Identification MusicBrainz…");
      switch (answers().get(token)?.status) {
        case "matched":
          return t("Titres complétés avec MusicBrainz.");
        case "not_found":
          return t("Ce CD n’a pas été identifié dans MusicBrainz.");
        case "ambiguous":
          return t(
            "Plusieurs listes de titres MusicBrainz correspondent à ce CD. Les noms restent inchangés.",
          );
        case "failed":
          return t("Identification MusicBrainz indisponible. La lecture reste disponible.");
        default:
          return "";
      }
    },
  };
}
