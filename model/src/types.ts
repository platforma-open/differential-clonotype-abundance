import type { GraphMakerState } from "@milaboratories/graph-maker";
import type {
  ColumnUniversalId,
  ColumnValueId,
  PlDataTableStateV2,
  PlMultiSequenceAlignmentModel,
  PlRef,
} from "@platforma-sdk/model";

/**
 * Unified V3 data: persisted state shaped on the UI's terms. The abundance, covariate and
 * contrast factor columns are result-pool column ids; the compared groups (`denominator`,
 * `numerators`) are column value ids of the contrast factor column.
 */
export type BlockData = {
  customBlockLabel: string;
  countsRef?: ColumnUniversalId;
  covariateRefs: ColumnUniversalId[];
  contrastFactor?: ColumnUniversalId;
  denominator?: ColumnValueId;
  numerators: ColumnValueId[];
  log2FcThreshold: number;
  pAdjThreshold: number;
  tableState: PlDataTableStateV2;
  graphState: GraphMakerState;
  alignmentModel: PlMultiSequenceAlignmentModel;
};

/** Projected args consumed by the workflow. */
export type BlockArgs = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  countsRef: ColumnUniversalId;
  covariateRefs: ColumnUniversalId[];
  contrastFactor: ColumnUniversalId;
  denominator: ColumnValueId;
  numerators: ColumnValueId[];
  log2FcThreshold: number;
  pAdjThreshold: number;
};

/**
 * Data as stored at version `V20260520`, frozen snapshot: columns as refs to upstream outputs,
 * compared groups as plain values of the contrast factor column.
 */
export type BlockDataV20260520 = {
  customBlockLabel: string;
  countsRef?: PlRef;
  covariateRefs: PlRef[];
  contrastFactor?: PlRef;
  denominator?: string;
  numerators: string[];
  log2FcThreshold: number;
  pAdjThreshold: number;
  tableState: PlDataTableStateV2;
  graphState: GraphMakerState;
  alignmentModel: PlMultiSequenceAlignmentModel;
};

/** Data as stored at version `V20260929`: the same shape, with the volcano colors reseeded. */
export type BlockDataV20260929 = BlockDataV20260520;

/** Pre-V3 args shape, frozen snapshot for `upgradeLegacy`. */
export type LegacyBlockArgs = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  countsRef?: PlRef;
  covariateRefs: PlRef[];
  contrastFactor?: PlRef;
  denominator?: string;
  numerators: string[];
  log2FcThreshold: number;
  pAdjThreshold: number;
};

/** Pre-V3 UI state shape, frozen snapshot for `upgradeLegacy`. */
export type LegacyBlockUiState = {
  tableState: PlDataTableStateV2;
  graphState: GraphMakerState;
  title?: string;
  selectedChain?: string;
  alignmentModel: PlMultiSequenceAlignmentModel;
};
