import type {
  InferOutputsType,
  PColumnIdAndSpec,
  ArgsIssue,
  StringMatcher,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  columnValueLabel,
  createColumnValueOptions,
  createPFrameForGraphs,
  createPlDataTableSheet,
  createPlDataTableV3,
  getUniquePartitionKeys,
  hasReachableData,
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
import { blockDataModel } from "./data_model";
import type { BlockArgs, BlockData } from "./types";

export * from "./types";
export type { ColumnPickerOption } from "./columns";
export type * from "@platforma-open/milaboratories.differential-clonotype-abundance.kind";

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

  .args<BlockArgs>((data) => ({
    defaultBlockLabel: deriveDefaultLabel(data),
    customBlockLabel: data.customBlockLabel,
    countsRef: data.countsRef,
    covariateRefs: data.covariateRefs,
    contrastFactor: data.contrastFactor,
    denominator: data.denominator,
    numerators: data.numerators,
    log2FcThreshold: data.log2FcThreshold,
    pAdjThreshold: data.pAdjThreshold,
  }))

  .argsIssues(({ args }) => {
    const issues: ArgsIssue[] = [];
    const error = (message: string) => issues.push({ severity: "error", message });
    if (args.countsRef === undefined) error("Dataset is required");
    if (args.contrastFactor === undefined) error("Contrast factor is required");
    if (args.numerators.length === 0) error("At least one numerator is required");
    if (args.denominator === undefined) error("Denominator is required");
    if (args.log2FcThreshold === undefined) error("Log2(FC) threshold is required");
    if (args.pAdjThreshold === undefined) error("Adjusted p-value threshold is required");
    return issues;
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

  // The values of the contrast factor column, for the numerator and denominator pickers.
  // `undefined` until a contrast factor is picked.
  .output("contrastValues", (ctx) =>
    ctx.data.contrastFactor === undefined
      ? undefined
      : createColumnValueOptions({ valueColumn: ctx.data.contrastFactor }),
  )

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

  .title(() => "Differential abundance")

  .subtitle((ctx) => ctx.data.customBlockLabel || deriveDefaultLabel(ctx.data))

  .sections((_ctx) => [
    { type: "link" as const, href: "/" as const, label: "Main" },
    { type: "link" as const, href: "/graph" as const, label: "Volcano plot" },
  ])

  .done();

export type Platforma = typeof platforma;
export type BlockOutputs = InferOutputsType<typeof platforma>;
