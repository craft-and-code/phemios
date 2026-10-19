/** Explicit partial coverage overrides placeholder defaults retained by FlacCompagnon. */
export function selectedMeasurements(input: Record<string, unknown>): Record<string, unknown> {
  const names = input.analyses_run;
  if (names === null || names === undefined) return input;
  if (
    !Array.isArray(names) ||
    names.length > 64 ||
    names.some((name) => typeof name !== "string" || name.length > 64)
  )
    throw new Error("Couverture FlacCompagnon invalide.");
  const data = { ...input };
  const groups: Record<string, string[]> = {
    authenticity: ["detections", "lattice_score"],
    "bit-depth": ["real_bit_depth", "bit_depth_evidence"],
    spectrum: ["cutoff_hz", "cutoff_ratio"],
    stereo: ["fake_stereo", "stereo_balance"],
    phase: ["phase_correlation", "phase_inverted", "local_phase"],
    "hf-stereo": ["high_frequency_stereo"],
    "dc-offset": ["dc_offset"],
    clipping: ["clipping"],
    dynamics: ["dr_db"],
    loudness: ["integrated_lufs", "loudness_peaks", "loudness_range_lu"],
    "flac-md5": ["flac_md5"],
    fingerprints: ["file_md5", "file_crc32"],
  };
  for (const [group, fields] of Object.entries(groups))
    if (!names.includes(group)) for (const field of fields) data[field] = null;
  if (
    data.discontinuities &&
    typeof data.discontinuities === "object" &&
    !Array.isArray(data.discontinuities)
  ) {
    const discontinuities = { ...data.discontinuities };
    for (const group of ["clicks", "dropouts"])
      if (!names.includes(group)) Object.assign(discontinuities, { [group]: null });
    data.discontinuities = discontinuities;
  }
  return data;
}
