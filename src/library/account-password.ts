import type { AccountSession } from "./server";
/** A password change and its follow-up logout belong to the exact captured server login. */
export async function changePasswordForSession(options: {
  session: () => AccountSession | undefined;
  change: (owner: AccountSession) => Promise<unknown>;
  disconnect: () => Promise<void>;
}): Promise<boolean> {
  const owner = options.session();
  if (!owner) return false;
  await options.change(owner);
  if (options.session() !== owner) return false;
  await options.disconnect();
  return true;
}
