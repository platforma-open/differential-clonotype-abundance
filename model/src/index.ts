import type {
  DatasetOption,
  InferOutputsType,
  PColumn,
  PColumnIdAndSpec,
  PColumnSpec,
  PObjectSpec,
  TreeNodeAccessor,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  buildDatasetOptions,
  createGlobalPObjectId,
  createPFrameForGraphs,
  createPlDataTableSheet,
  createPlDataTableStateV2,
  createPlDataTableV2,
  DataModelBuilder,
  getUniquePartitionKeys,
  isPColumnSpec,
  plRefsEqual,
} from "@platforma-sdk/model";
import { kind } from "@platforma-open/milaboratories.differential-clonotype-abundance.kind";
import type { BlockArgs, BlockData, LegacyBlockArgs, LegacyBlockUiState } from "./types";

export * from "./types";
export type * from "@platforma-open/milaboratories.differential-clonotype-abundance.kind";

const defaultGraphState = (): BlockData["graphState"] => ({
  title: "Differential abundance",
  template: "dots",
  currentTab: null,
});

/**
 * Drops a chart's saved color mappings for the sources bound to its Grouping input, so they
 * are seeded afresh.
 *
 * graph-maker (>= 1.9) reads the `pl7.app/graph/palette` annotation only when it creates a
 * mapping; a mapping already saved in `dataBindAes` wins. A volcano saved before that keeps
 * its own colors for the regulation direction and never picks up the Up/Down/NS palette the
 * column declares. `dataBindAes` is keyed by the ids graph-maker gives the selected sources,
 * so the entries are found through the Grouping selection rather than by column name.
 */
function withGroupingColorsReseeded(state: BlockData["graphState"]): BlockData["graphState"] {
  const aes = state.dataBindAes;
  if (aes === undefined) return state;
  const components = state.optionsState?.components as
    | Record<string, { selectorStates?: { selectedSource: string }[] } | undefined>
    | undefined;
  const grouping = new Set(
    (components?.grouping?.selectorStates ?? []).map((s) => s.selectedSource),
  );
  if (grouping.size === 0) return state;
  const kept = Object.fromEntries(Object.entries(aes).filter(([source]) => !grouping.has(source)));
  return { ...state, dataBindAes: kept };
}

const blockDataModel = new DataModelBuilder({ kind })
  .from<BlockData>("V20260520")
  .upgradeLegacy<LegacyBlockArgs, LegacyBlockUiState>(({ args, uiState }) => ({
    customBlockLabel: args?.customBlockLabel ?? "",
    countsRef: args?.countsRef,
    covariateRefs: args?.covariateRefs ?? [],
    contrastFactor: args?.contrastFactor,
    denominator: args?.denominator,
    numerators: args?.numerators ?? [],
    log2FcThreshold: args?.log2FcThreshold ?? 1,
    pAdjThreshold: args?.pAdjThreshold ?? 0.05,
    tableState: uiState?.tableState ?? createPlDataTableStateV2(),
    graphState: uiState?.graphState ?? defaultGraphState(),
    alignmentModel: uiState?.alignmentModel ?? {},
  }))
  // graph-maker 1.9: let the regulation-direction palette seed the volcano's grouping colors
  .migrate<BlockData>("V20260929", (prev) => ({
    ...prev,
    graphState: withGroupingColorsReseeded(prev.graphState),
  }))
  .init(({ params }) => ({
    customBlockLabel: params?.customBlockLabel ?? "",
    countsRef: params?.countsRef,
    filterRef: params?.filterRef,
    covariateRefs: params?.covariateRefs ?? [],
    contrastFactor: params?.contrastFactor,
    denominator: params?.denominator,
    numerators: params?.numerators ?? [],
    log2FcThreshold: params?.log2FcThreshold ?? 1,
    pAdjThreshold: params?.pAdjThreshold ?? 0.05,
    tableState: createPlDataTableStateV2(),
    graphState: defaultGraphState(),
    alignmentModel: {},
  }));

export function deriveDefaultLabel(data: BlockData): string {
  if (data.denominator && data.numerators.length > 0) {
    const numeratorsPart = data.numerators.join(", ");
    return `${numeratorsPart} vs ${data.denominator} (log2FC: ${data.log2FcThreshold}, pAdj: ${data.pAdjThreshold})`;
  }
  return "Configure comparison";
}

// get main Pcols for plot and tables
function filterPCols(pCols: PColumn<TreeNodeAccessor>[]): PColumn<TreeNodeAccessor>[] {
  // Allow only log2 FC and -log10 Padjust as options for volcano axis
  return pCols.filter(
    (col) =>
      col.spec.name === "pl7.app/differentialAbundance/log2foldchange" ||
      col.spec.name === "pl7.app/differentialAbundance/minlog10padj" ||
      col.spec.name === "pl7.app/differentialAbundance/regulationDirection" ||
      col.spec.name === "pl7.app/differentialAbundance/contrastGroup" ||
      col.spec.name === "pl7.app/rna-seq/log2foldchange" ||
      col.spec.name === "pl7.app/rna-seq/minlog10padj" ||
      col.spec.name === "pl7.app/rna-seq/regulationDirection" ||
      col.spec.name === "pl7.app/rna-seq/genesymbol" ||
      col.spec.name === "pl7.app/rna-seq/contrastGroup",
  );
}

// Key axes of the datasets whose subsets this block accepts: bulk and single-cell clonotypes, and variants.
const DATASET_KEY_AXES: ReadonlySet<string> = new Set([
  "pl7.app/vdj/clonotypeKey",
  "pl7.app/vdj/scClonotypeKey",
  "pl7.app/variantKey",
]);

// Raw clonotype abundances and raw RNA-seq counts, keyed by sample and one feature axis.
function isCounts(spec: PObjectSpec): spec is PColumnSpec {
  if (!isPColumnSpec(spec)) return false;
  if (spec.axesSpec.length !== 2 || spec.axesSpec[0].name !== "pl7.app/sampleId") return false;
  const a = spec.annotations ?? {};
  if (a["pl7.app/isAbundance"] !== "true") return false;
  const isClonotypeInput =
    a["pl7.app/abundance/normalized"] === "false" && a["pl7.app/abundance/isPrimary"] === "true";
  const isRnaInput = spec.domain?.["pl7.app/rna-seq/normalized"] === "false";
  return isClonotypeInput || isRnaInput;
}

export const platforma = BlockModelV3.create({ dataModel: blockDataModel, kind })

  .args<BlockArgs>((data) => {
    if (data.countsRef === undefined) throw new Error("Dataset is required");
    if (data.contrastFactor === undefined) throw new Error("Contrast factor is required");
    if (data.numerators.length === 0) throw new Error("At least one numerator is required");
    if (data.denominator === undefined) throw new Error("Denominator is required");
    if (data.log2FcThreshold === undefined) throw new Error("Log2(FC) threshold is required");
    if (data.pAdjThreshold === undefined) throw new Error("Adjusted p-value threshold is required");

    return {
      defaultBlockLabel: deriveDefaultLabel(data),
      customBlockLabel: data.customBlockLabel,
      countsRef: data.countsRef,
      covariateRefs: data.covariateRefs,
      contrastFactor: data.contrastFactor,
      denominator: data.denominator,
      numerators: data.numerators,
      log2FcThreshold: data.log2FcThreshold,
      pAdjThreshold: data.pAdjThreshold,
      ...(data.filterRef !== undefined && {
        inputFilter: createGlobalPObjectId(data.filterRef.blockId, data.filterRef.name),
      }),
    };
  })

  // Inverse of the kind's init-params contract: every field a user sets by
  // hand. `defaultBlockLabel` is not among them -- it is derived above from
  // the comparison itself, never stored.
  .templateParams((data) => ({
    countsRef: data.countsRef,
    filterRef: data.filterRef,
    covariateRefs: data.covariateRefs,
    contrastFactor: data.contrastFactor,
    numerators: data.numerators,
    denominator: data.denominator,
    log2FcThreshold: data.log2FcThreshold,
    pAdjThreshold: data.pAdjThreshold,
    customBlockLabel: data.customBlockLabel,
  }))

  .output("countsOptions", (ctx): DatasetOption[] => {
    // Labels as before, with the column's own label: buildDatasetOptions takes no label options.
    const labeled = ctx.resultPool.getOptions(isCounts, {
      label: { includeNativeLabel: true, addLabelAsSuffix: true },
      refsWithEnrichments: false,
    });

    const options =
      buildDatasetOptions(ctx, {
        // Filter out single-cell and clustered data for now
        primary: (spec) =>
          isCounts(spec) &&
          spec.axesSpec[1].name !== "pl7.app/vdj/scClonotypeKeyRR" &&
          spec.axesSpec[1].name !== "pl7.app/vdj/clusterIdRR",
        // Only subsets keyed by the clonotype or variant axis alone
        filter: (spec) =>
          isPColumnSpec(spec) &&
          spec.axesSpec.length === 1 &&
          DATASET_KEY_AXES.has(spec.axesSpec[0].name),
        requireEnrichments: false,
      }) ?? [];

    return options.map((option) => {
      const label = labeled.find((o) => plRefsEqual(o.ref, option.primary.ref, true))?.label;
      return label === undefined ? option : { ...option, primary: { ...option.primary, label } };
    });
  })

  .output("metadataOptions", (ctx) =>
    ctx.resultPool.getOptions((spec) => isPColumnSpec(spec) && spec.name === "pl7.app/metadata"),
  )

  .output("isPeptide", (ctx): boolean => {
    const ref = ctx.data.countsRef;
    if (ref === undefined) return false;
    const keyAxis = ctx.resultPool.getPColumnSpecByRef(ref)?.axesSpec[1];
    if (keyAxis?.name !== "pl7.app/variantKey") return false;
    const domain = keyAxis.domain ?? {};
    const declared = domain["pl7.app/modality"];
    if (declared === "vdj" || declared === "amplicon") return false;
    if (domain["pl7.app/peptide/extractionRunId"] !== undefined) return true;
    if (domain["pl7.app/repertoire/extractionRunId"] !== undefined) return false;
    if (domain["pl7.app/vdj/clonotypingRunId"] !== undefined) return false;
    return true;
  })

  .output("datasetSpec", (ctx) => {
    if (ctx.data.countsRef) return ctx.resultPool.getSpecByRef(ctx.data.countsRef);
    else return undefined;
  })

  .output("denominatorOptions", (ctx) => {
    if (!ctx.data.contrastFactor) return undefined;

    const pColumn = ctx.resultPool.getPColumnByRef(ctx.data.contrastFactor);
    if (!pColumn) return undefined;

    return ctx.createPFrame([pColumn]);
  })

  .output("errorLogs", (ctx) => {
    const pCols = ctx.outputs?.resolve("errorLogs")?.getPColumns();
    if (pCols === undefined) return undefined;
    return ctx.createPFrame(pCols);
  })

  // Returns a map of results
  .outputWithStatus("pt", (ctx) => {
    const pCols = ctx.outputs?.resolve("topTablePf")?.getPColumns();
    if (pCols === undefined) return undefined;
    return createPlDataTableV2(ctx, pCols, ctx.data.tableState);
  })

  .output("sheets", (ctx) => {
    const pCols = ctx.outputs?.resolve("topTablePf")?.getPColumns();
    if (pCols === undefined || pCols.length === 0) return undefined;

    // Get unique contrast values
    const contrasts = getUniquePartitionKeys(pCols[0].data)?.[0];
    if (!contrasts) return undefined;

    return [createPlDataTableSheet(ctx, pCols[0].spec.axesSpec[0], contrasts)];
  })

  .output("test", (ctx) => {
    const pCols = ctx.outputs?.resolve("topTablePf")?.getPColumns();
    if (pCols === undefined || pCols.length === 0) return undefined;

    // Get unique contrast values
    const contrasts = getUniquePartitionKeys(pCols[0].data)?.[0];
    if (!contrasts) return undefined;

    return getUniquePartitionKeys(pCols[0].data);
  })

  .outputWithStatus("topTablePf", (ctx) => {
    let pCols = ctx.outputs?.resolve("topTablePf")?.getPColumns();
    if (pCols === undefined) return undefined;

    pCols = filterPCols(pCols);

    return createPFrameForGraphs(ctx, pCols);
  })

  .output("topTablePcols", (ctx) => {
    let pCols = ctx.outputs?.resolve("topTablePf")?.getPColumns();
    if (pCols === undefined) return undefined;
    pCols = filterPCols(pCols);

    return pCols.map(
      (c) =>
        ({
          columnId: c.id,
          spec: c.spec,
        }) satisfies PColumnIdAndSpec,
    );
  })

  .output("msaPf", (ctx) => {
    const msaCols = ctx.outputs?.resolve("topTablePf")?.getPColumns();
    if (!msaCols) return undefined;

    const datasetRef = ctx.data.countsRef;
    if (datasetRef === undefined) return undefined;

    const seqCols = ctx.resultPool.getAnchoredPColumns({ main: datasetRef }, [
      { axes: [{ anchor: "main", idx: 1 }] },
    ]);
    if (seqCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, [...msaCols, ...seqCols]);
  })

  .title(() => "Differential abundance")

  .subtitle((ctx) => ctx.data.customBlockLabel || deriveDefaultLabel(ctx.data))

  .sections((_ctx) => [
    { type: "link" as const, href: "/" as const, label: "Main" },
    { type: "link" as const, href: "/graph" as const, label: "Volcano plot" },
  ])

  .done();

export type Platforma = typeof platforma;
export type BlockOutputs = InferOutputsType<typeof platforma>;
