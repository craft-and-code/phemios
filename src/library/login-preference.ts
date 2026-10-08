interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
interface LoginPreference {
  server: string;
  username: string;
}
const key = "phemios.login.v1";
function validate(value: unknown): LoginPreference {
  const row = value as Record<string, unknown>;
  if (
    !row ||
    typeof row !== "object" ||
    Array.isArray(row) ||
    row.version !== 1 ||
    Object.keys(row).some((key) => !["version", "server", "username"].includes(key)) ||
    typeof row.server !== "string" ||
    row.server.length > 1024 ||
    typeof row.username !== "string" ||
    !row.username.trim() ||
    row.username.length > 128
  )
    throw new Error("Préférence de connexion illisible.");
  const url = new URL(row.server);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Adresse mémorisée invalide.");
  return { server: row.server, username: row.username };
}
/** Remember only public login metadata; malformed stored data is preserved and reported. */
export function readLoginPreference(storage: Storage): LoginPreference | undefined {
  const value = storage.getItem(key);
  if (value === null) return undefined;
  if (value.length > 4096) throw new Error("Préférence de connexion trop volumineuse.");
  return validate(JSON.parse(value));
}
/** Store a successful login name, never the password, bearer token or private annotations. */
export function saveLoginPreference(storage: Storage, server: string, username: string): void {
  readLoginPreference(storage);
  const value = { version: 1, server, username };
  validate(value);
  storage.setItem(key, JSON.stringify(value));
}
