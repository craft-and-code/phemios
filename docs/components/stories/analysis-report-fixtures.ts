/** Fictional current-schema measurements, with no provider, account or audio access. */
export const reportFile = (name = "01 - Les heures bleues.flac") => ({
  file_name: name,
  path: `/fictional/Nacre/${name}`,
  format: "FLAC",
  codec: null,
  ext_mismatch: false,
  sample_rate: 96000,
  channels: 2,
  declared_bits: 24,
  real_bit_depth: 24,
  bit_depth_evidence: { stored_bits: 24, method: "Stored" },
  duration_secs: 220,
  size_bytes: 112000000,
  bitrate_kbps: 4073,
  flac_md5: { state: "Match" },
  detections: {
    summary: "Clean",
    detail: "No finding in performed checks.",
    upscaling: false,
    upsampling: false,
    transcoding: false,
  },
  integrated_lufs: -13.8,
  dr_db: 9.6,
  loudness_range_lu: 6.1,
  cutoff_hz: 29800,
  fake_stereo: false,
  phase_correlation: 0.74,
  phase_inverted: false,
  stereo_balance: { right_minus_left_db: -0.2 },
  clipping: {
    clipped: false,
    peak_dbfs: -0.5,
    true_peak_dbtp: 0.7,
    clipped_samples: 0,
    clip_events: 0,
  },
  loudness_peaks: {
    momentary: { lufs: -8.1, start_secs: 130.2 },
    short_term: { lufs: -10.4, start_secs: 128.6 },
  },
  dc_offset: { max_abs: 0.0002, channel_means: [0.0002, 0.0001] },
  discontinuities: {
    clicks: {
      count: 2,
      events: [
        { start_secs: 42.3, duration_secs: 0.001, channel: 1 },
        { start_secs: 166.8, duration_secs: 0.001, channel: 2 },
      ],
    },
    dropouts: { count: 0, events: [] },
  },
  file_md5: "5b3a29d07c168e4f0a192d6a18a423f9",
  file_crc32: "8d4a23b1",
});
export const albumReport = () =>
  JSON.stringify({
    format: "flaccompagnon-report",
    version: 1,
    report: {
      root: "/fictional/Nacre",
      has_flac: true,
      files: [
        reportFile(),
        {
          ...reportFile("02 - Éclats.wav"),
          ext_mismatch: true,
          detections: {
            summary: "Flagged",
            detail: "A quantization signature was found.",
            upscaling: false,
            upsampling: false,
            transcoding: true,
          },
          flac_md5: { state: "Mismatch" },
        },
      ],
    },
  });
