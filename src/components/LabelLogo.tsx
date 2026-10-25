import { useLibrary } from "../library/context";
import { LabelLogoView } from "./LabelLogoView";

/** Only a positively advertised logo uses the source-qualified shared resident/disk cache. */
export function LabelLogo(props: {
  reference: string;
  name: string;
  available?: boolean | undefined;
  large?: boolean;
}) {
  const library = useLibrary();
  return (
    <LabelLogoView
      name={props.name}
      large={props.large ?? false}
      url={props.available === true ? library.image(props.reference, "logo") : undefined}
    />
  );
}
