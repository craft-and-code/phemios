import { defaultParentalPolicy } from "./parental-controls";
import type { ParentalAdminScope } from "./parental-admin";
export const parentalScope = (): ParentalAdminScope => ({
  source: "server",
  session: {
    server: "http://fixture.invalid",
    nativeSession: "test-session",
    account: { id: "parent", username: "parent", role: "admin" },
  },
  target: { id: "child", username: "child", role: "user", enabled: true },
});
export const parentalSnapshot = (owner = "child", revision = 0) => ({
  owner,
  revision,
  policy: defaultParentalPolicy("Europe/Paris"),
});
export const parentalStatus = () => ({
  ...parentalSnapshot(),
  day_used_seconds: 0,
  week_used_seconds: 0,
  remaining_seconds: null,
  allowed: true,
  reason: null,
  next_change_at: null,
});
export const settleParental = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};
