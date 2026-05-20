import type { GraphMakerState } from '@milaboratories/graph-maker';
import type {
  PlDataTableStateV2,
  PlMultiSequenceAlignmentModel,
  PlRef,
} from '@platforma-sdk/model';

/** Unified V3 data: persisted state shaped on the UI's terms. */
export type BlockData = {
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

/** Projected args consumed by the workflow. */
export type BlockArgs = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  countsRef: PlRef;
  covariateRefs: PlRef[];
  contrastFactor: PlRef;
  denominator: string;
  numerators: string[];
  log2FcThreshold: number;
  pAdjThreshold: number;
};

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
