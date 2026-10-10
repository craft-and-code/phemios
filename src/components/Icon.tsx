const paths: Record<string, string> = {
  crossfade: "M3 5h4c4 0 6 14 10 14h4M3 19h4c4 0 6-14 10-14h4",
  book: "M12 5c-3-3-7-3-10-2v16c3-1 7-1 10 2m0-16c3-3 7-3 10-2v16c-3-1-7-1-10 2V5Z",
  trophy:
    "M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 14v6M7 21h10",
  lock: "M5 10h14v11H5V10ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3",
  "cover-flow": "M7 5h10v14H7V5ZM3 7l-2 1v8l2 1V7ZM21 7l2 1v8l-2 1V7Z",
  keyboard:
    "M2 5h20v14H2V5ZM5 9h.01M9 9h.01M13 9h.01M17 9h.01M5 13h.01M9 13h.01M13 13h.01M17 13h.01M7 16h10",
  grip: "M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01",
  reverse: "M7 3v18m-4-4 4 4 4-4M17 21V3m-4 4 4-4 4 4",
  playlist: "M3 3h11v18H3V3ZM6 7h5M6 11h5M18 8v9M18 10l4-1M18 17a3 2 0 1 1-6 0 3 2 0 0 1 6 0Z",
  help: "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  moods: "M3 15c4-10 5 10 9 0s5 10 9 0M3 9c4-10 5 10 9 0s5 10 9 0",
  visualizer: "M3 4h18v14H3V4ZM8 22h8M12 18v4M6 11l3-3 3 6 3-5 3 2",
  "lyrics-download": "M3 4h10M3 8h10M3 12h7M3 16h7M18 3v14m-4-4 4 4 4-4M14 21h8",
  disconnect: "m7 3 4 4m3-4 4 4M4 8l5-5 6 6-5 5-6-6Zm-1 5 8 8m-5-5-4 4M15 15l6 6",
  landscape: "M2 20 9 7l4 7 3-5 6 11H2Z",
  lyrics: "M5 4h14v16H5V4ZM8 8h8M8 12h8M8 16h5",
  plus: "M5 12h14M12 5v14",
  minus: "M5 12h14",
  "chevron-up": "m6 15 6-6 6 6",
  "chevron-down": "m6 9 6 6 6-6",
  check: "M5 12l4 4L19 6",
  podcast: "M5 14a8 8 0 1 1 14 0M8 12a4 4 0 1 1 8 0M9 16a3 3 0 0 1 6 0l-1 6h-4l-1-6ZM12 8h.01",
  gear: "m9.5 2-.5 3a7 7 0 0 0-2 1.2L4.2 5.1 1.7 9.4 4 11.3a8 8 0 0 0 0 2.4l-2.3 1.9 2.5 4.3L7 18.8A7 7 0 0 0 9 20l.5 3h5l.5-3a7 7 0 0 0 2-1.2l2.8 1.1 2.5-4.3-2.3-1.9a8 8 0 0 0 0-2.4l2.3-1.9-2.5-4.3L17 6.2A7 7 0 0 0 15 5l-.5-3h-5ZM16 12.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  sparkles:
    "m9 3 2.5 6.5L18 12l-6.5 2.5L9 21l-2.5-6.5L0 12l6.5-2.5L9 3ZM19 2v6M16 5h6M21 16v6M18 19h6",
  palette:
    "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.7-3l-.8-1.3a1.5 1.5 0 0 1 1.3-2.2H18a3 3 0 0 0 3-3 9 9 0 0 0-9-8ZM7 9h.01M11 6h.01M16 8h.01M6 14h.01",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  edit: "m15 4 5 5M3 21l1-6L16 3l5 5L9 20l-6 1Z",
  doctor: "M6 3v7a6 6 0 0 0 12 0V3M4 3h4M16 3h4M12 16v2a4 4 0 0 0 8 0v-3",
  radio: "M4 8h16v13H4V8ZM7 8 18 3M7 12h6M16 12h1M7 17h3M14 17h3",
  muted: "M3 9h4l5-4v14l-5-4H3V9ZM17 9l5 6M22 9l-5 6",
  refresh: "M3 12a9 9 0 1 0 3-6.7M3 3v6h6",
  settings: "M4 6h16M4 12h16M4 18h16M9 3v6M16 9v6M7 15v6",
  stop: "M6 6h12v12H6V6Z",
  close: "M6 6l12 12M6 18 18 6",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  spectrum: "M3 20h18M5 16v-4M9 16V5M13 16V9M17 16V3M21 16v-6",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z",
  bold: "M7 4h6a4 4 0 0 1 0 8H7V4ZM7 12h7a4 4 0 0 1 0 8H7v-8Z",
  italic: "M10 4h8M6 20h8M14 4 10 20",
  heading: "M4 4v16M14 4v16M4 12h10M18 14c4-3 6 1 2 4l-2 2h5",
  paragraph: "M12 4v16M17 4v16M17 4H9a4 4 0 0 0 0 8h3",
  ordered: "M9 6h12M9 12h12M9 18h12M3 4v4M2 11h3l-3 3h3M2 17h3v3H2",
  quote: "M4 5h6v6H4V5ZM4 11c0 5 6 6 6 0M14 5h6v6h-6V5ZM14 11c0 5 6 6 6 0",
  undo: "M9 5 3 11l6 6M3 11h10a7 7 0 0 1 7 7",
  redo: "m15 5 6 6-6 6M21 11h-10a7 7 0 0 0-7 7",
  stats: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  calendar: "M3 5h18v16H3V5ZM7 2v6M17 2v6M3 10h18M7 14h3M14 14h3M7 18h3",
  alphabet: "m2 18 5-13 5 13M4 14h6M16 5h6l-6 13h6",
  previous: "M5 5v14M19 5 8 12l11 7V5Z",
  next: "M19 5v14M5 5l11 7-11 7V5Z",
  pause: "M8 5v14M16 5v14",
  repeat: "m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3",
  "repeat-one":
    "m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3M11 10l2-1v6m-2 0h4",
  shuffle: "M3 5c10 0 6 14 16 14m-3-3 3 3-3 3M3 19c10 0 6-14 16-14m-3-3 3 3-3 3",
  volume: "M3 9h4l5-4v14l-5-4H3V9ZM16 8a6 6 0 0 1 0 8M19 4a11 11 0 0 1 0 16",
  menu: "M3 6h18M3 12h18M3 18h18",
  sort: "M4 6h16M4 12h10M4 18h4m10-4 3 4 3-4M21 3v15",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87",
  disc: "M9 9a4.2 4.2 0 0 0-3 3M15 15a4.2 4.2 0 0 0 3-3",
  layers: "m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5",
  globe: "M2 12h20M12 2c-6 6-6 14 0 20M12 2c6 6 6 14 0 20",
  missing: "M12 3 2 21h20ZM12 9v5M12 17h.01",
  "eye-off":
    "m3 3 18 18M9.5 9.5a3.5 3.5 0 0 0 5 5M6 6C4 8 2 12 2 12s4 7 10 7c2 0 4-1 6-3M10 5h2c6 0 10 7 10 7s-1 2-3 4",
  label: "M4 3h16v18l-8-4-8 4zM8 7h8M8 11h8",
  genres:
    "M9 18V5l12-2v13M9 8l12-2M9 18a3 2 0 1 1-6 0 3 2 0 0 1 6 0ZM21 16a3 2 0 1 1-6 0 3 2 0 0 1 6 0Z",
  tags: "M20 13 13 20l-11-11V2h7l11 11ZM7 7h.01",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  library: "M4 3v18M9 3v18M14 3v18m4-17 3 16",
  history: "M3 12a9 9 0 1 0 3-6.7M3 3v6h6M12 7v5l3 2",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  wave: "M3 10v4M7 5v14M11 8v8M15 3v18M19 7v10M23 10v4",
  graph: "M7 7l10 10M7 17 17 7",
  drive: "M3 6h18l2 10H1L3 6ZM1 16v4h22v-4M17 18h.01M20 18h.01",
  search: "m21 21-5-5",
  sidebar: "M9 3v18M3 3h18v18H3V3Z",
  play: "m8 5 11 7-11 7V5Z",
  forward: "M5 12h14m-7-7 7 7-7 7",
  back: "M19 12H5m7-7-7 7 7 7",
};

/** Small local icon vocabulary; no runtime icon-library or network request. */
export function Icon(props: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width={props.name === "grip" ? 3 : 1.6}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={paths[props.name] ?? paths.list} />
      {props.name === "users" && <circle cx="9" cy="7" r="4" />}
      {(props.name === "disc" || props.name === "globe") && <circle cx="12" cy="12" r="10" />}
      {props.name === "disc" && <circle cx="12" cy="12" r="2" />}
      {props.name === "search" && <circle cx="10.5" cy="10.5" r="7.5" />}
      {props.name === "graph" && (
        <>
          <circle cx="5" cy="5" r="2" />
          <circle cx="19" cy="19" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="5" r="2" />
        </>
      )}
    </svg>
  );
}
