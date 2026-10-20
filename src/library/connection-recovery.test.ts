import { expect, it } from "vitest";
import { activeNativeSessionConflict } from "./connection-recovery";
it("offers disconnect for the precise native-session conflict, including an additional revocation diagnostic", () => {
  expect(
    activeNativeSessionConflict("Déconnectez la session active avant de changer de compte."),
  ).toBe(true);
  expect(
    activeNativeSessionConflict(
      "Error: Déconnectez la session active avant de changer de compte.\nImpossible de joindre Aède.",
    ),
  ).toBe(true);
  expect(
    activeNativeSessionConflict("Disconnect the active session before switching accounts."),
  ).toBe(true);
  for (const error of ["", "Impossible de joindre Aède.", "Mot de passe invalide."])
    expect(activeNativeSessionConflict(error)).toBe(false);
});
