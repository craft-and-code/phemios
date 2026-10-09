export interface RadioCriteria {
  name: string;
  country: string;
  tag: string;
  secureOnly: boolean;
}
/** WebKit gets explicit Enter submission on text fields, preserving IME and checkbox/button keys. */
export function radioEnterSearch(key: string, composing: boolean, type: string): boolean {
  return key === "Enter" && !composing && ["text", "search"].includes(type);
}
