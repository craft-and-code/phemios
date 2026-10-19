import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { createSignal, Show } from "solid-js";
import { AnalysisReport } from "../../../src/analysis-report/AnalysisReport";
import { AnalysisDocument } from "../../../src/analysis-report/AnalysisDocument";
import { AnalysisImportView } from "../../../src/components/AnalysisImportView";
import { parseAnalysisDocument } from "../../../src/analysis-report/model";
import { reportFile, albumReport } from "./analysis-report-fixtures";
const meta = {
  title: "Data/AnalysisReport",
  component: AnalysisReport,
  args: { analysis: { source: "flaccompagnon", stale: false, source_data: reportFile() } },
  parameters: {
    docs: {
      description: {
        component:
          "Reusable guided report: identical imported/retained rendering, explicit validity, optional details and literal provider text. Fictional measurements only.",
      },
    },
  },
} satisfies Meta<typeof AnalysisReport>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Guided: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("MD5 audio FLAC conforme")).toBeVisible();
    const shield = canvasElement.querySelector(".far-shield svg")!;
    expect(shield.getBoundingClientRect().width).toBe(18);
    expect(
      canvasElement.querySelector(".far-integrity")!.getBoundingClientRect().height,
    ).toBeLessThan(180);
    expect(canvasElement.querySelectorAll(".far-expansion").length).toBe(1);
    expect(canvas.getByRole("button", { name: "Tout déplier" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Tout déplier" }));
    expect(canvas.getByRole("button", { name: "Tout replier" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(canvas.getByText("Profondeur de bits")).toBeDefined();
    const summary = canvasElement.querySelector(".far-detection summary")!;
    expect(canvas.getByText("No finding in performed checks.")).toBeVisible();
    const glyph = summary.querySelector("svg")!.getBoundingClientRect(),
      bounds = summary.getBoundingClientRect();
    expect(Math.abs(glyph.y + glyph.height / 2 - bounds.y - bounds.height / 2)).toBeLessThan(1);
    await userEvent.click(canvas.getByRole("button", { name: "Tout replier" }));
    expect(canvasElement.querySelectorAll("details[open]").length).toBe(0);
  },
};
export const ImportedAlbum: Story = {
  render: () => <AnalysisDocument files={parseAnalysisDocument(albumReport())} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('.far-files-heading [aria-label="Intégrité audio"] svg'),
    ).not.toBeNull();
    expect(canvasElement.querySelector(".far-files button .far-good")).not.toBeNull();
    expect(
      canvas.getByText(
        "Conforme dans le rapport ; le fichier actuel n’a pas été vérifié par Phémios.",
      ),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /02 - Éclats/ }));
    expect(canvas.getByText("Transcoded")).toBeVisible();
    expect(canvas.getByText("MD5 audio FLAC différent")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Tout déplier" }));
    expect(canvas.getByText("Extension incohérente")).toBeVisible();
  },
};
export const ImportSelection: Story = {
  render: () => {
    const [files, setFiles] = createSignal<unknown[]>(),
      [error, setError] = createSignal("");
    return (
      <>
        <AnalysisImportView
          select={async () => albumReport()}
          onImport={setFiles}
          onError={setError}
        />
        <Show when={error()}>
          <p role="alert">{error()}</p>
        </Show>
        <Show when={files()}>{(value) => <AnalysisDocument files={value()} />}</Show>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Importer une analyse" }));
    expect(await canvas.findByText("2 pistes dans le rapport")).toBeVisible();
    expect(canvas.queryByRole("alert")).toBeNull();
  },
};
export const LiteralDiagnostics: Story = {
  args: {
    analysis: {
      source: "flaccompagnon",
      stale: false,
      source_data: {
        ...reportFile("<img src=x onerror=alert(1)>.flac"),
        error: "<script>alert('not executable')</script>",
        flac_md5: { state: "Error", detail: "Unexpected EOF" },
      },
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector("img,script")).toBeNull();
    expect(
      within(canvasElement).getByText("<script>alert('not executable')</script>"),
    ).toBeVisible();
  },
};

export const MarkerHints: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      marker = canvas.getByRole("button", { name: /Niveau intégré :/ });
    await userEvent.hover(marker);
    expect(canvas.getByRole("tooltip")).toHaveTextContent("LUFS");
    await userEvent.unhover(marker);
    expect(canvas.queryByRole("tooltip")).toBeNull();
    await userEvent.click(marker);
    await userEvent.unhover(marker);
    expect(canvas.getByRole("tooltip")).toBeVisible();
    await userEvent.click(marker);
    expect(canvas.queryByRole("tooltip")).toBeNull();
    await userEvent.click(marker);
    await userEvent.keyboard("{Escape}");
    expect(canvas.queryByRole("tooltip")).toBeNull();
  },
};
export const RememberedDisclosures: Story = {
  render: () => {
    const [sections, setSections] = createSignal<
        import("../../../src/analysis-report/disclosure").AnalysisSection[]
      >([]),
      [mounted, setMounted] = createSignal(true);
    return (
      <>
        <button onClick={() => setMounted(!mounted())}>Mount report</button>
        <Show when={mounted()}>
          <AnalysisReport
            analysis={{ source: "flaccompagnon", stale: false, source_data: reportFile() }}
            sections={sections()}
            onSectionsChange={setSections}
          />
        </Show>
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Le fichier et le signal"));
    expect(await canvas.findByText("Profondeur de bits")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Mount report" }));
    await userEvent.click(canvas.getByRole("button", { name: "Mount report" }));
    expect(canvas.getByText("Profondeur de bits")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Tout replier" }));
    expect(canvasElement.querySelectorAll("details[open]").length).toBe(0);
  },
};

export const RejectedExpansion: Story = {
  args: { sections: [], onSectionsChange: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Le fichier et le signal"));
    expect(canvasElement.querySelectorAll("details[open]").length).toBe(0);
    await userEvent.click(canvas.getByRole("button", { name: "Tout déplier" }));
    expect(canvasElement.querySelectorAll("details[open]").length).toBe(0);
    expect(canvas.getByRole("button", { name: "Tout déplier" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  },
};

export const EventDetails: Story = {
  args: {
    analysis: {
      source: "flaccompagnon",
      stale: false,
      source_data: { ...reportFile(), duration_secs: 187.733333333 },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const timeline = canvasElement.querySelector(".far-events svg")! as SVGSVGElement;
    const bounds = timeline.getBoundingClientRect(),
      matrix = timeline.getScreenCTM()!;
    expect(Math.abs(matrix.e - bounds.left)).toBeLessThan(3);
    expect(Math.abs(matrix.a * 600 - bounds.width)).toBeLessThan(3);
    const first = canvas.getByRole("button", { name: /Clic.*42,3/ });
    await userEvent.hover(first);
    expect(canvas.getByRole("status")).toHaveTextContent("42,3");
    await userEvent.unhover(first);
    expect(canvas.getByRole("status")).toBeEmptyDOMElement();
    await userEvent.click(first);
    expect(canvas.getByRole("status")).toHaveTextContent("42,3");
    expect(canvas.getByRole("status")).toHaveTextContent("Canal 1");
    expect(canvas.getByRole("status")).toHaveTextContent("0,001");
    await userEvent.keyboard("{Escape}");
    expect(canvas.getByRole("status")).not.toHaveTextContent("42,3");
  },
};

export const AggregateShield: Story = {
  render: () => {
    const [mixed, setMixed] = createSignal(false);
    return (
      <>
        <button onClick={() => setMixed(!mixed())}>Mix evidence</button>
        <AnalysisDocument
          files={[
            { source: "flaccompagnon", stale: false, source_data: reportFile() },
            {
              source: "flaccompagnon",
              stale: false,
              source_data: {
                ...reportFile("02.flac"),
                flac_md5: { state: mixed() ? "Present" : "Match" },
              },
            },
          ]}
        />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const shield = canvas.getByRole("img", { name: "Intégrité audio" });
    expect(shield).toHaveClass("far-good");
    await userEvent.click(canvas.getByRole("button", { name: "Mix evidence" }));
    expect(shield).not.toHaveClass("far-good");
  },
};
export const MarkerDismissal: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      marker = canvas.getByRole("button", { name: /Niveau intégré :/ });
    await userEvent.click(marker);
    expect(canvas.getByRole("tooltip")).toBeVisible();
    await userEvent.click(canvas.getByRole("heading", { name: "Détection" }));
    expect(canvas.queryByRole("tooltip")).toBeNull();
    await userEvent.click(marker);
    await userEvent.tab();
    expect(marker).toHaveAttribute("aria-pressed", "false");
    expect(marker).not.toHaveAttribute("aria-describedby");
    expect(canvas.getAllByRole("tooltip")).toHaveLength(1);
    expect(canvas.getByRole("tooltip")).toHaveTextContent("Dynamique");
  },
};

export const TouchHints: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      marker = canvas.getByRole("button", { name: /Niveau intégré :/ });
    const tap = async () =>
      userEvent.pointer([{ keys: "[TouchA>]", target: marker }, { keys: "[/TouchA]" }]);
    await tap();
    expect(marker).toHaveAttribute("aria-pressed", "true");
    expect(canvas.getByRole("tooltip")).toBeVisible();
    await tap();
    expect(marker).toHaveAttribute("aria-pressed", "false");
    expect(canvas.queryByRole("tooltip")).toBeNull();
  },
};
