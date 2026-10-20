import type {
  ColumnUniversalId,
  InferOutputsType,
  PColumnIdAndSpec,
  PlRef,
  StringMatcher,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  blockDependencies,
  columnValueLabel,
  createGlobalPObjectId,
  createPFrameForGraphs,
  createPlDataTableSheet,
  createPlDataTableStateV2,
  createPlDataTableV3,
  DataModelBuilder,
  getUniquePartitionKeys,
  hasReachableData,
  isColumnValueId,
  isDataColumn,
  TreeNodeAccessor,
} from "@platforma-sdk/model";
import { kind } from "@platforma-open/milaboratories.differential-clonotype-abundance.kind";
import {
  findColumn,
  getCountsOptions,
  getFeatureColumns,
  getMetadataOptions,
  getOutputColumns,
  toPColumns,
} from "./columns";
import { getContrastValueOptions } from "./contrast_values";
import type {
  BlockArgs,
  BlockData,
  BlockDataV20260520,
  BlockDataV20260929,
  LegacyBlockArgs,
  LegacyBlockUiState,
} from "./types";

export * from "./types";
export type { ColumnPickerOption } from "./columns";
export type { ContrastValueOptions } from "./contrast_values";
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

/**
 * Moves stored data to column ids. A ref to an upstream output becomes the result-pool id of that
 * output, which names the same block and column. The compared groups were plain values of the
 * contrast factor column; a plain value names no block that produced it, so it cannot become a
 * column value id and is dropped, to be picked again.
 */
function toColumnIds(data: BlockDataV20260929): BlockData {
  const { countsRef, contrastFactor, denominator } = data;
  return {
    ...data,
    countsRef: countsRef === undefined ? undefined : plRefToColumnId(countsRef),
    covariateRefs: data.covariateRefs.map(plRefToColumnId),
    contrastFactor: contrastFactor === undefined ? undefined : plRefToColumnId(contrastFactor),
    denominator:
      denominator !== undefined && isColumnValueId(denominator) ? denominator : undefined,
    numerators: data.numerators.filter((numerator) => isColumnValueId(numerator)),
  };
}

function plRefToColumnId(ref: PlRef): ColumnUniversalId {
  return createGlobalPObjectId(ref.blockId, ref.name);
}

const blockDataModel = new DataModelBuilder({ kind })
  .from<BlockDataV20260520>("V20260520")
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
  .migrate<BlockDataV20260929>("V20260929", (prev) => ({
    ...prev,
    graphState: withGroupingColorsReseeded(prev.graphState),
  }))
  // Columns become result-pool ids and the compared groups column value ids
  .migrate<BlockData>("V20261020", toColumnIds)
  .init(({ params }) => ({
    customBlockLabel: params?.customBlockLabel ?? "",
    countsRef: params?.countsRef,
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
    const numeratorsPart = data.numerators.map(columnValueLabel).join(", ");
    const denominatorPart = columnValueLabel(data.denominator);
    return `${numeratorsPart} vs ${denominatorPart} (log2FC: ${data.log2FcThreshold}, pAdj: ${data.pAdjThreshold})`;
  }
  return "Configure comparison";
}

/**
 * Names of the result columns the volcano and its pickers work with: fold change, significance,
 * regulation direction, the contrast and, for genes, their symbols.
 */
const GRAPH_COLUMN_NAMES: StringMatcher[] = [
  "pl7.app/differentialAbundance/log2foldchange",
  "pl7.app/differentialAbundance/minlog10padj",
  "pl7.app/differentialAbundance/regulationDirection",
  "pl7.app/differentialAbundance/contrastGroup",
  "pl7.app/rna-seq/log2foldchange",
  "pl7.app/rna-seq/minlog10padj",
  "pl7.app/rna-seq/regulationDirection",
  "pl7.app/rna-seq/genesymbol",
  "pl7.app/rna-seq/contrastGroup",
].map((value): StringMatcher => ({ type: "exact", value }));

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
    };
  })

  // Inverse of the kind's init-params contract: every field a user sets by
  // hand. `defaultBlockLabel` is not among them -- it is derived above from
  // the comparison itself, never stored.
  .templateParams((data) => ({
    countsRef: data.countsRef,
    covariateRefs: data.covariateRefs,
    contrastFactor: data.contrastFactor,
    numerators: data.numerators,
    denominator: data.denominator,
    log2FcThreshold: data.log2FcThreshold,
    pAdjThreshold: data.pAdjThreshold,
    customBlockLabel: data.customBlockLabel,
  }))

  .output("countsOptions", (ctx) => getCountsOptions(ctx))

  .output("metadataOptions", (ctx) => getMetadataOptions(ctx))

  .output("isPeptide", (ctx): boolean => {
    const ref = ctx.data.countsRef;
    if (ref === undefined) return false;
    const keyAxis = findColumn(ctx, ref)?.getSpec().axesSpec[1];
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
    const ref = ctx.data.countsRef;
    return ref === undefined ? undefined : findColumn(ctx, ref)?.getSpec();
  })

  // Options of the numerator and denominator pickers: the values of the contrast factor column.
  .output("contrastValueOptions", (ctx) => getContrastValueOptions(ctx, ctx.data.contrastFactor))

  .output("errorLogs", (ctx) => {
    const errorLogs = getOutputColumns(ctx, ctx.outputs?.resolve("errorLogs"));
    if (errorLogs === undefined) return undefined;
    return ctx.createPFrame(errorLogs.getColumnIds());
  })

  // Returns a map of results
  .outputWithStatus("pt", (ctx) => {
    const topTable = getOutputColumns(ctx, ctx.outputs?.resolve("topTablePf"));
    if (topTable === undefined) return undefined;
    return createPlDataTableV3(ctx, {
      // The block's own result columns, all stored as they are, joined on contrast and feature.
      primaryColumns: topTable.getColumns(),
      columns: [],
      tableState: ctx.data.tableState,
    });
  })

  // One sheet per contrast: every result column is partitioned by it.
  .output("sheets", (ctx) => {
    const column = getOutputColumns(ctx, ctx.outputs?.resolve("topTablePf"))?.getColumns()[0];
    if (column === undefined || !hasReachableData(column)) return undefined;
    const data = column.getData();
    if (!(data instanceof TreeNodeAccessor)) return undefined;

    const contrasts = getUniquePartitionKeys(data)?.[0];
    if (!contrasts) return undefined;

    return [createPlDataTableSheet(ctx, column.getSpec().axesSpec[0], contrasts)];
  })

  .outputWithStatus("topTablePf", (ctx) => {
    const graphColumns = getOutputColumns(ctx, ctx.outputs?.resolve("topTablePf"))
      ?.filter({ include: { name: GRAPH_COLUMN_NAMES } })
      .getColumns();
    if (graphColumns === undefined) return undefined;
    return createPFrameForGraphs(ctx, toPColumns(graphColumns));
  })

  .output("topTablePcols", (ctx) => {
    const graphColumns = getOutputColumns(ctx, ctx.outputs?.resolve("topTablePf"))
      ?.filter({ include: { name: GRAPH_COLUMN_NAMES } })
      .getColumns();
    if (graphColumns === undefined) return undefined;
    return graphColumns
      .filter(isDataColumn)
      .map<PColumnIdAndSpec>((column) => ({ columnId: column.id, spec: column.getSpec() }));
  })

  .output("msaPf", (ctx) => {
    const topTable = getOutputColumns(ctx, ctx.outputs?.resolve("topTablePf"));
    if (topTable === undefined) return undefined;

    const datasetRef = ctx.data.countsRef;
    if (datasetRef === undefined) return undefined;

    const featureColumns = getFeatureColumns(ctx, datasetRef);
    if (featureColumns === undefined) return undefined;

    return createPFrameForGraphs(ctx, toPColumns([...topTable.getColumns(), ...featureColumns]));
  })

  .plugin(blockDependencies)

  .title(() => "Differential abundance")

  .subtitle((ctx) => ctx.data.customBlockLabel || deriveDefaultLabel(ctx.data))

  .sections((_ctx) => [
    { type: "link" as const, href: "/" as const, label: "Main" },
    { type: "link" as const, href: "/graph" as const, label: "Volcano plot" },
  ])

  .done();

export type Platforma = typeof platforma;
export type BlockOutputs = InferOutputsType<typeof platforma>;
