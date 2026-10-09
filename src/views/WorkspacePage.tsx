import { RatedPage } from "./RatedPage";
import { t } from "../i18n";
import { RadioPage } from "./RadioPage";
import { DoctorPage } from "./DoctorPage";
import { StatisticsPage } from "./StatisticsPage";
import { RelationsPage } from "./RelationsPage";
import { PersonalPage } from "./PersonalPage";
import { createSignal, Show } from "solid-js";
import { type Section } from "../navigation/routes";

const descriptions: Partial<Record<Section, string>> = {
  favourites: t("Retrouvez les artistes et albums marqués comme favoris."),
  collections: t("Créez des collections et choisissez leurs règles ou leurs albums."),
  history: t("Retrouvez les dernières écoutes et reprenez vos découvertes."),
  playlists: t("Enregistrez vos listes M3U sur Aède et téléchargez-les pour le lecteur choisi."),
  analysis: t(
    "Lancez une analyse FlacCompagnon ou la génération des spectres, puis consultez leurs résultats.",
  ),
  relations: t(
    "Découvrez les membres, invités et collaborations entre groupes avec leurs rôles et leurs périodes.",
  ),
  players: t("Préparez la copie d’une sélection vers un lecteur, une carte ou un disque connecté."),
};

/** Future services remain unavailable; changing a plan never writes music files. */
export function WorkspacePage(props: { section: Section; query: string }) {
  const [convert, setConvert] = createSignal(false);
  if (props.section === "rated") return <RatedPage query={props.query} />;
  return (
    <Show
      when={props.section === "radio"}
      fallback={
        <Show
          when={props.section === "doctor"}
          fallback={
            <Show
              when={props.section === "statistics"}
              fallback={
                <Show
                  when={props.section === "relations"}
                  fallback={
                    <Show
                      when={[
                        "favourites",
                        "collections",
                        "history",
                        "playlists",
                        "analysis",
                      ].includes(props.section)}
                      fallback={
                        <section class="page workspace-page">
                          <p class="intro">{t(descriptions[props.section] ?? "")}</p>
                          <Show
                            when={props.section === "players"}
                            fallback={
                              <div class="service-placeholder">
                                <h2>{t("Service à raccorder")}</h2>
                                <p>
                                  {t(
                                    "Cette rubrique est prévue dans le parcours. Ce service n’est pas encore exposé dans cette interface.",
                                  )}{" "}
                                </p>
                                <Show when={props.section === "relations"}>
                                  <p>
                                    {t(
                                      "Le futur graphe distinguera les membres d’un groupe des collaborations et conservera la source de chaque lien.",
                                    )}{" "}
                                  </p>
                                </Show>
                                <Show when={props.section === "collections"}>
                                  <button disabled>
                                    {t("Créer une collection — connexion requise")}
                                  </button>
                                </Show>
                                <Show when={props.section === "playlists"}>
                                  <button disabled>
                                    {t("Enregistrer / télécharger — connexion requise")}{" "}
                                  </button>
                                </Show>
                              </div>
                            }
                          >
                            <div class="transfer-plan">
                              <h2>{t("Préparer un transfert")}</h2>
                              <p class="notice">
                                {t(
                                  "La détection des lecteurs n’est pas encore connectée. Les choix ci-dessous illustrent le formulaire ; aucune copie n’est lancée.",
                                )}{" "}
                              </p>
                              <label>
                                {t("Destination")}{" "}
                                <select disabled>
                                  <option>{t("Service des lecteurs non connecté")}</option>
                                </select>
                              </label>
                              <label>
                                {t("Musique")}{" "}
                                <select disabled>
                                  <option>{t("Sélection ou collection à choisir")}</option>
                                </select>
                              </label>
                              <fieldset>
                                <legend>{t("Vérification et conversion")}</legend>
                                <label>
                                  <input type="checkbox" checked />
                                  {t("Vérifier les fichiers après la copie")}{" "}
                                </label>
                                <label>
                                  <input type="checkbox" />
                                  {t("Vérifier aussi les fichiers déjà présents")}{" "}
                                </label>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={convert()}
                                    onChange={(event) => setConvert(event.currentTarget.checked)}
                                  />
                                  {t("Convertir pour le lecteur")}{" "}
                                </label>
                                <Show when={convert()}>
                                  <label>
                                    {t("Format")}{" "}
                                    <select disabled>
                                      <option>{t("Formats compatibles à déterminer")}</option>
                                    </select>
                                  </label>
                                </Show>
                                <label>
                                  <input type="checkbox" checked />
                                  {t("Inclure les pochettes disponibles")}{" "}
                                </label>
                                <label>
                                  <input type="checkbox" />
                                  {t("Inclure une liste M3U")}{" "}
                                </label>
                              </fieldset>
                              <button class="primary" disabled>
                                {t("Prévisualiser le transfert — service requis")}{" "}
                              </button>
                              <p class="muted">
                                {t(
                                  "Les fichiers sources seront conservés. La prévisualisation présentera les conversions, les conflits et les vérifications avant tout transfert.",
                                )}{" "}
                              </p>
                            </div>
                          </Show>
                        </section>
                      }
                    >
                      <PersonalPage section={props.section} query={props.query} />
                    </Show>
                  }
                >
                  {" "}
                  <RelationsPage query={props.query} />{" "}
                </Show>
              }
            >
              <StatisticsPage />
            </Show>
          }
        >
          <DoctorPage />
        </Show>
      }
    >
      <RadioPage query={props.query} />
    </Show>
  );
}
