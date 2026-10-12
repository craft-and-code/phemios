import { For } from "solid-js";
import { t } from "../i18n";
import { importStatusLabel, type RoonRow } from "../imports/roon-plan";
/** Preview never writes; bounded visible rows retain an explicit total and skipped reasons. */
export function RoonImportPreview(props: { rows: readonly RoonRow[] }) {
  const ready = () => props.rows.filter((row) => row.status === "ready").length;
  return (
    <div class="roon-import-preview">
      <p>
        {t("{0} albums à importer · {1} lignes ignorées", ready(), props.rows.length - ready())}
      </p>
      <div class="roon-import-table">
        <table>
          <thead>
            <tr>
              <th>{t("Ligne")}</th>
              <th>{t("Album")}</th>
              <th>{t("Artiste")}</th>
              <th>{t("Données personnelles")}</th>
              <th>{t("Résultat")}</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.rows.slice(0, 100)}>
              {(row) => (
                <tr>
                  <td>{row.line}</td>
                  <td>{row.title}</td>
                  <td>{row.artist}</td>
                  <td title={row.desired?.note ?? ""}>
                    {[
                      row.desired?.rating ? `${row.desired.rating} ★` : "",
                      row.desired?.loved ? t("Favori") : "",
                      row.desired?.tags?.join(" ; ") ?? "",
                      row.desired?.note
                        ? t(
                            "Note : {0}",
                            row.desired.note.length > 120
                              ? `${row.desired.note.slice(0, 120)}…`
                              : row.desired.note,
                          )
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td classList={{ "import-ready": row.status === "ready" }}>
                    {importStatusLabel(row.status)}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      {props.rows.length > 100 ? (
        <p class="muted">
          {t("Aperçu limité à 100 lignes ; toutes les lignes valides seront traitées.")}
        </p>
      ) : null}
    </div>
  );
}
