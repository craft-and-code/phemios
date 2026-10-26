import type { JSX } from "solid-js";
import { t } from "../i18n";
import { ChoiceSelect } from "./ChoiceSelect";
import { RefreshButton } from "./RefreshButton";
import { StickyHeader } from "./StickyHeader";
/** Page size and read admission stay above the independent track scroller. */
export function TracksHeader(props: {
  identity?: unknown;
  total: number;
  children?: JSX.Element;
  filters?: JSX.Element;
  offset: number;
  size: number;
  sizes: readonly number[];
  busy: boolean;
  pending: boolean;
  onRefresh: () => void;
  onCancel: () => void;
  onSize: (size: number) => void;
}) {
  return (
    <StickyHeader>
      <div class="section-heading tracks-heading">
        <div class="tracks-header-controls">
          <div class="track-page-size">
            <span>{t("Pistes par page")}</span>
            <ChoiceSelect
              label={t("Pistes par page")}
              value={props.size}
              onChange={(value) => props.onSize(Number(value))}
              options={props.sizes.map((size) => ({ value: String(size), label: String(size) }))}
            />
          </div>
          <RefreshButton
            identity={props.identity}
            busy={props.busy}
            disabled={props.pending && !props.busy}
            onCancel={props.onCancel}
            onRefresh={props.onRefresh}
          />
        </div>
        <span>
          {props.total} {t("piste")} · {props.total ? props.offset + 1 : 0}–
          {Math.min(props.offset + props.size, props.total)}
        </span>
        {props.children}
      </div>
      {props.filters}
    </StickyHeader>
  );
}
