import { createMemo, createSignal, For, Show, createUniqueId } from "solid-js";
import type { Neighbour } from "../library/relations";
import { relationSpace } from "../library/relation-space";
/** Rotatable 3D geometry with SVG perspective, accessible neighbours and no idle animation. */
export function RelationGraph(props: {
  name: string;
  edges: readonly Neighbour[];
  onSelect: (reference: string) => void;
}) {
  const [yaw, setYaw] = createSignal(-0.35),
    [pitch, setPitch] = createSignal(0.2),
    [zoom, setZoom] = createSignal(1);
  const gradient = createUniqueId(),
    nodes = createMemo(() =>
      relationSpace(props.edges.length, yaw(), pitch(), zoom()).map((p) => ({
        ...p,
        edge: props.edges[p.index]!,
      })),
    );
  let drag: { id: number; x: number; y: number; moved: boolean } | undefined,
    suppressClick = false;
  const scale = (delta: number) => setZoom((z) => Math.max(0.6, Math.min(1.6, z + delta)));
  const reset = () => {
    setYaw(-0.35);
    setPitch(0.2);
    setZoom(1);
  };
  function layer(front: boolean) {
    return (
      <For each={nodes().filter((n) => n.depth >= 0 === front)}>
        {(node) => (
          <g opacity={0.65 + (0.35 * (node.depth + 1)) / 2}>
            <line
              x1="450"
              y1="255"
              x2={node.x}
              y2={node.y}
              stroke-width={Math.min(3, 1 + Math.log2(node.edge.weight + 1) / 2)}
            />
            <text class="edge-weight" x={(450 + node.x) / 2} y={(255 + node.y) / 2}>
              {node.edge.weight}
            </text>
            <g
              class="relation-node"
              transform={`translate(${node.x} ${node.y})`}
              tabindex="0"
              role="button"
              aria-label={`Explorer ${node.edge.artist.name}, ${node.edge.weight} pistes communes`}
              onClick={() => {
                if (!suppressClick) props.onSelect(node.edge.artist.reference);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  props.onSelect(node.edge.artist.reference);
                }
              }}
            >
              <title>
                {node.edge.artist.name} · {node.edge.weight} pistes · {node.edge.source}
              </title>
              <circle r={19 * node.scale} style={{ "--node-fill": `url(#${gradient})` }} />
              <text y={22 * node.scale + 20} text-anchor="middle">
                {node.edge.artist.name.length > 26
                  ? `${node.edge.artist.name.slice(0, 25)}…`
                  : node.edge.artist.name}
              </text>
            </g>
          </g>
        )}
      </For>
    );
  }
  return (
    <div class="relation-space">
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
        <text class="relation-core-label" x="450" y="319" text-anchor="middle">
          {props.name}
        </text>
      </svg>
      <div class="relation-space-tools">
        <span>
          Glisser pour tourner · molette pour zoomer · survoler un point pour l’identifier
        </span>
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
          La profondeur est une disposition visuelle ; elle ne mesure pas la proximité artistique.
        </small>
      </Show>
    </div>
  );
}
