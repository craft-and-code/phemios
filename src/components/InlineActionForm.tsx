import { splitProps, type JSX } from "solid-js";
/** Labelled single-line fields and trailing actions share height and alignment; validation stays native. */
export function InlineActionForm(props: JSX.FormHTMLAttributes<HTMLFormElement>) {
  const [own, rest] = splitProps(props, ["class", "children"]);
  return (
    <form {...rest} class={`inline-action-form ${own.class ?? ""}`}>
      {own.children}
    </form>
  );
}
