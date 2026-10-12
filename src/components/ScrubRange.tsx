import { splitProps, type JSX } from "solid-js";
/** Thin native keyboard/pointer range shared by Cover Flow and artwork sizing. */
export function ScrubRange(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return <input {...rest} type="range" class={`subtle-range ${local.class ?? ""}`} />;
}
