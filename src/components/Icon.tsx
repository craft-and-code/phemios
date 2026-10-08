const paths: Record<string, string> = {
  menu: "M3 6h18M3 12h18M3 18h18",
  sort: "M4 6h16M4 12h10M4 18h4m10-4 3 4 3-4M21 3v15",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87",
  disc: "M9 9a4.2 4.2 0 0 0-3 3M15 15a4.2 4.2 0 0 0 3-3",
  layers: "m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5",
  globe: "M2 12h20M12 2c-6 6-6 14 0 20M12 2c6 6 6 14 0 20",
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
      stroke-width="1.6"
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
