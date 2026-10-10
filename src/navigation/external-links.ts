interface ExternalActivation {
  href: string;
  button: number;
  preventDefault: () => void;
}
/** Native source links leave the WebView only through the validated system-browser IPC; preview uses ordinary links. */
export function activateExternalLink(
  action: ExternalActivation,
  native: boolean,
  open: (url: string) => Promise<void>,
  failure: (message: string) => void,
): boolean {
  if (!native || ![0, 1].includes(action.button) || !/^https:\/\//i.test(action.href)) return false;
  action.preventDefault();
  void Promise.resolve()
    .then(() => open(action.href))
    .catch((error: unknown) => failure(String(error)));
  return true;
}
