/** Shared native keys are device-wide; their completion must not change another profile's enrichment choices. */
export async function completeServiceKeySave(options: {
  current: () => boolean;
  save: () => Promise<unknown>;
  refresh: () => Promise<unknown>;
  commit: () => void;
}): Promise<void> {
  if (!options.current()) return;
  await options.save();
  if (!options.current()) return;
  await options.refresh();
  if (options.current()) options.commit();
}
