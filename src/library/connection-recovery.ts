import { errorMessage } from "./aede-availability";
/** An older native host may still own a login after the interface reloads. Keep an explicit exit. */
export function activeNativeSessionConflict(value: unknown): boolean {
  const message = errorMessage(value).split("\n")[0];
  return (
    message === "Déconnectez la session active avant de changer de compte." ||
    message === "Disconnect the active session before switching accounts."
  );
}
