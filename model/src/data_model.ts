import type { ColumnUniversalId, ColumnValueId, PlRef } from "@platforma-sdk/model";
import {
  createColumnValueId,
  createGlobalPObjectId,
  createPlDataTableStateV2,
  DataModelBuilder,
  isColumnValueId,
  isPlRef,
} from "@platforma-sdk/model";
import { kind } from "@platforma-open/milaboratories.differential-clonotype-abundance.kind";
import type {
  BlockData,
  BlockDataV20260520,
  BlockDataV20260929,
  LegacyBlockArgs,
  LegacyBlockUiState,
} from "./types";

export const blockDataModel = new DataModelBuilder({ kind })
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

// Internals

function defaultGraphState(): BlockData["graphState"] {
  return {
    title: "Differential abundance",
    template: "dots",
    currentTab: null,
  };
}

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
 * contrast factor column; each becomes the column value id of that value in the converted contrast
 * factor column, in the same order. Without a contrast factor column the plain values belong to
 * no column and are dropped, to be picked again.
 */
function toColumnIds(data: BlockDataV20260929): BlockData {
  const { countsRef, contrastFactor, denominator } = data;
  const valueColumn = isPlRef(contrastFactor) ? plRefToColumnId(contrastFactor) : undefined;
  return {
    ...data,
    countsRef: countsRef === undefined ? undefined : plRefToColumnId(countsRef),
    covariateRefs: data.covariateRefs.map(plRefToColumnId),
    contrastFactor: contrastFactor === undefined ? undefined : plRefToColumnId(contrastFactor),
    denominator: toContrastValueId(valueColumn, denominator),
    numerators: data.numerators.flatMap((numerator) => {
      const id = toContrastValueId(valueColumn, numerator);
      return id === undefined ? [] : [id];
    }),
  };
}

function plRefToColumnId(ref: PlRef): ColumnUniversalId {
  return createGlobalPObjectId(ref.blockId, ref.name);
}

/**
 * A compared group as the column value id of the contrast factor column. A group already stored
 * as a column value id is kept. A plain value becomes the id of its text, the form every column
 * value id carries: text stays as stored, a number becomes its decimal text.
 */
function toContrastValueId(
  column: ColumnUniversalId | undefined,
  picked: unknown,
): ColumnValueId | undefined {
  if (isColumnValueId(picked)) return picked;
  if (column === undefined || !isPlainValue(picked)) return undefined;
  return createColumnValueId({ column, value: String(picked) });
}

function isPlainValue(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}
