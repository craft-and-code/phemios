/** A child reader temporarily replaces the shell return action without changing catalogue history. */
export interface BiographyReturn {
  label: string;
  back: () => void;
}
export type BiographyNavigation = (value: BiographyReturn | undefined) => void;
