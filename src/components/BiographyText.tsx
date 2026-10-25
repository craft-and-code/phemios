import { createMemo } from "solid-js";
import { createBiographyLinker } from "../library/biography-catalog";
import type { BiographyPart } from "../library/biography-links";
import { BiographyTextView } from "./BiographyTextView";
/** Stored prose remains unchanged; navigation resolves only the current source's resident catalogue. */
export function BiographyText(props: {
  text: string;
  reference: string;
  onGenre: (genre: string) => void;
  onYear: (year: number) => void;
  linker?: (text: string) => BiographyPart[];
}) {
  const linker = createBiographyLinker(
    () => props.reference,
    () => props.linker,
  );
  const parts = createMemo(() => linker()(props.text));
  return <BiographyTextView parts={parts()} onGenre={props.onGenre} onYear={props.onYear} />;
}
