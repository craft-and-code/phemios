import { type ParentProps } from "solid-js";
import { Icon } from "../components/Icon";
/** Native details retain keyboard/touch behavior; rejected preference writes restore the current state. */
export function ReportDisclosure(
  props: ParentProps<{
    label: string;
    open: boolean;
    onChange: (open: boolean) => void;
    section?: boolean;
  }>,
) {
  return (
    <details
      class={`far-disclosure ${props.section ? "far-section" : ""}`}
      open={props.open}
      onToggle={(event) => {
        const element = event.currentTarget;
        if (element.open !== props.open) {
          props.onChange(element.open);
          element.open = props.open;
        }
      }}
    >
      <summary
        onClick={(event) => {
          event.preventDefault();
          props.onChange(!props.open);
        }}
      >
        {props.label}
        <Icon name="chevron-down" />
      </summary>
      {props.children}
    </details>
  );
}
