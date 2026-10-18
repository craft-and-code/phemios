export interface DependencyCredit {
  name: string;
  version: string;
  ecosystem: "npm" | "cargo";
  url: string;
}
export function dependencyCredits(root?: string): DependencyCredit[];
export function lockedCredits(
  npm: { packages?: Record<string, { name?: string; version?: string; dev?: boolean }> },
  cargo: string,
): DependencyCredit[];
