import { createMemo, createSignal, For, Show, createUniqueId, onCleanup } from "solid-js";
export interface RelationNode {
  reference: string;
  name: string;
  weight: number;
  source: string;
  kind: "artist" | "album";
  href?: string;
}
import { relationSpace, relationLabels, relationTone } from "../library/relation-space";
/** Rotatable 3D geometry with SVG perspective, accessible neighbours and no idle animation. */
export function RelationGraph(props: {
  name: string;
  edges: readonly RelationNode[];
  onSelect: (reference: string) => void;
}) {
  const [yaw, setYaw] = createSignal(-0.35),
    [pitch, setPitch] = createSignal(0.2),
    [zoom, setZoom] = createSignal(1),
    [focused, setFocused] = createSignal<number | null>(null);
  const gradient = createUniqueId(),
    nodes = createMemo(() =>
      relationSpace(props.edges.length, yaw(), pitch(), zoom()).map((p) => ({
        ...p,
        edge: props.edges[p.index]!,
      })),
    );
  const labels = createMemo(() => relationLabels(nodes()));
  let drag: { id: number; x: number; y: number; moved: boolean } | undefined,
    suppressClick = false;
  const scale = (delta: number) => setZoom((z) => Math.max(0.6, Math.min(1.6, z + delta)));
  const reset = () => {
    setYaw(-0.35);
    setPitch(0.2);
    setZoom(1);
  };
  const links = new Map<string, HTMLAnchorElement>();
  function activate(node: RelationNode) {
    if (node.href) links.get(node.reference)?.click();
    else props.onSelect(node.reference);
  }
  function layer(front: boolean) {
    return (
      <For each={nodes().filter((n) => n.depth >= 0 === front)}>
        {(node) => (
          <g classList={{ highlighted: focused() === node.index }}>
            <line
              x1="450"
              y1="255"
              x2={node.x}
              y2={node.y}
              stroke-width={Math.min(3, 1 + Math.log2(node.edge.weight + 1) / 2)}
            />
            <Show when={node.edge.kind === "artist"}>
              <text class="edge-weight" x={(450 + node.x) / 2} y={(255 + node.y) / 2}>
                {node.edge.weight}
              </text>
            </Show>
            <g
              class="relation-node"
              onMouseEnter={() => setFocused(node.index)}
              onMouseLeave={() => setFocused(null)}
              onFocus={() => setFocused(node.index)}
              onBlur={() => setFocused(null)}
              transform={`translate(${node.x} ${node.y})`}
              tabindex="0"
              role="button"
              aria-label={
                node.edge.kind === "album"
                  ? `Ouvrir l’album ${node.edge.name}`
                  : `Explorer ${node.edge.name}, ${node.edge.weight} pistes communes`
              }
              onClick={() => {
                if (!suppressClick) activate(node.edge);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  activate(node.edge);
                }
              }}
            >
              <title>
                {node.edge.name} ·{" "}
                {node.edge.kind === "album"
                  ? "album associé"
                  : `${node.edge.weight} pistes communes`}{" "}
                · {node.edge.source}
              </title>
              <circle
                r={19 * node.scale}
                style={{
                  "--node-fill": `url(#${gradient}-${node.index})`,
                  "--node-stroke": relationTone(node.depth, node.x, node.y).highlight,
                }}
              />
            </g>
          </g>
        )}
      </For>
    );
  }
  return (
    <div class="relation-space">
      <For each={props.edges.filter((n) => n.href)}>
        {(node) => (
          <a
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            href={node.href}
            ref={(el) => {
              links.set(node.reference, el);
              onCleanup(() => {
                if (links.get(node.reference) === el) links.delete(node.reference);
              });
            }}
          >
            Ouvrir {node.name}
          </a>
        )}
      </For>
      <svg
        class="relation-graph"
        classList={{ dense: props.edges.length > 6 }}
        viewBox="0 0 900 510"
        role="group"
        tabindex="0"
        aria-label={`Espace 3D des collaborations de ${props.name}. Glisser pour tourner, molette pour zoomer ; flèches et plus ou moins au clavier.`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
          suppressClick = false;
        }}
        onPointerMove={(e) => {
          if (!drag || e.pointerId !== drag.id) return;
          const dx = e.clientX - drag.x,
            dy = e.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 2 || drag.moved) {
            drag.moved = true;
            if (!e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.setPointerCapture(e.pointerId);
            setYaw((y) => y + dx * 0.009);
            setPitch((p) => Math.max(-1.4, Math.min(1.4, p + dy * 0.009)));
            drag.x = e.clientX;
            drag.y = e.clientY;
          }
        }}
        onPointerUp={(e) => {
          suppressClick = drag?.moved ?? false;
          drag = undefined;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag = undefined;
          suppressClick = true;
        }}
        onWheel={(e) => {
          e.preventDefault();
          scale(e.deltaY < 0 ? 0.08 : -0.08);
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          const key = e.key;
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "Home"].includes(key)) {
            e.preventDefault();
            if (key === "ArrowLeft") setYaw((y) => y - 0.15);
            if (key === "ArrowRight") setYaw((y) => y + 0.15);
            if (key === "ArrowUp") setPitch((p) => Math.max(-1.4, p - 0.15));
            if (key === "ArrowDown") setPitch((p) => Math.min(1.4, p + 0.15));
            if (key === "+") scale(0.1);
            if (key === "-") scale(-0.1);
            if (key === "Home") reset();
          }
        }}
      >
        <defs>
          <For each={nodes()}>
            {(node) => {
              const tone = () => relationTone(node.depth, node.x, node.y);
              return (
                <radialGradient id={`${gradient}-${node.index}`} cx="30%" cy="20%">
                  <stop offset="0" stop-color={tone().highlight} />
                  <stop offset="0.5" stop-color={tone().middle} />
                  <stop offset="1" stop-color={tone().edge} />
                </radialGradient>
              );
            }}
          </For>
          <radialGradient id={gradient} cx="35%" cy="25%">
            <stop offset="0" stop-color="#ecffad" />
            <stop offset="0.5" stop-color="#64843b" />
            <stop offset="1" stop-color="#182b24" />
          </radialGradient>
        </defs>
        <ellipse
          class="relation-orbit"
          cx="450"
          cy="255"
          rx="310"
          ry="165"
          transform="rotate(-18 450 255)"
        />
        <ellipse
          class="relation-orbit"
          cx="450"
          cy="255"
          rx="300"
          ry="70"
          transform="rotate(40 450 255)"
        />
        {layer(false)}
        <circle class="relation-core-glow" cx="450" cy="255" r="60" />
        <circle
          class="relation-center"
          cx="450"
          cy="255"
          r="40"
          style={{ "--node-fill": `url(#${gradient})` }}
        />
        {layer(true)}
        <For each={labels()}>
          {(label) => {
            const node = () => nodes().find((n) => n.index === label.index)!;
            return (
              <g
                class="relation-label"
                classList={{ highlighted: focused() === label.index }}
                onMouseEnter={() => setFocused(label.index)}
                onMouseLeave={() => setFocused(null)}
                aria-hidden="true"
                onClick={() => {
                  if (!suppressClick) activate(node().edge);
                }}
              >
                <Show when={props.edges.length > 6}>
                  <path
                    class="relation-label-leader"
                    fill="none"
                    d={`M ${node().x} ${node().y} L ${label.anchor === "start" ? 230 : 670} ${label.y - 4} L ${label.anchor === "start" ? 205 : 695} ${label.y - 4}`}
                  />
                  <circle
                    class="relation-label-end"
                    cx={label.anchor === "start" ? 205 : 695}
                    cy={label.y - 4}
                    r="2"
                  />
                </Show>
                <text x={label.x} y={label.y} text-anchor={label.anchor}>
                  {node().edge.name.length > 26
                    ? `${node().edge.name.slice(0, 25)}…`
                    : node().edge.name}
                </text>
                <title>{node().edge.name}</title>
              </g>
            );
          }}
        </For>
        <text class="relation-core-label" x="450" y="319" text-anchor="middle">
          {props.name}
        </text>
      </svg>
      <div class="relation-space-tools">
        <span>Glisser pour tourner · molette pour zoomer</span>
        <button aria-label="Zoom arrière" onClick={() => scale(-0.1)}>
          −
        </button>
        <button aria-label="Zoom avant" onClick={() => scale(0.1)}>
          +
        </button>
        <button onClick={reset}>Recentrer</button>
      </div>
      <Show when={props.edges.length}>
        <small>
          La couleur s’assombrit avec la profondeur et l’éloignement du centre ; la disposition ne
          mesure pas la proximité artistique.
        </small>
      </Show>
    </div>
  );
}
