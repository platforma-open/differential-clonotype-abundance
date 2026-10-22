import { assertParamsObject, defineBlockKind } from "@platforma-sdk/block-kind";
import type { ColumnUniversalId, ColumnValueId } from "@platforma-sdk/model";
import { isColumnUniversalId, isColumnValueId } from "@platforma-sdk/model";
import { name, version } from "../package.json" with { type: "json" };

/**
 * This block's init-params contract — everything a user sets by hand: the
 * abundance dataset, the covariates to model, which of them is the contrast
 * factor, the groups being compared, the two significance thresholds, and the
 * subtitle they type.
 *
 * `defaultBlockLabel` is absent because it is not stored: the model derives it
 * from the comparison inside `.args`, so it can never disagree with the data
 * it describes.
 *
 * The columns (`countsRef`, `covariateRefs`, `contrastFactor`) are result-pool
 * column ids, each naming the block that produced the column. The compared
 * groups (`numerators`, `denominator`) are column value ids of the contrast
 * factor column: each names the column it was picked from, and through it the
 * block that produced the value.
 *
 * Every field is optional. A half-configured block is ordinary state the UI
 * reaches -- picking the dataset leaves the contrast unset, and choosing a
 * contrast factor deliberately clears the groups -- and the projection hands
 * that state back untouched, so a required field would break the export/apply
 * round trip.
 */
export type BlockParams = {
  countsRef?: ColumnUniversalId;
  covariateRefs?: ColumnUniversalId[];
  contrastFactor?: ColumnUniversalId;
  numerators?: ColumnValueId[];
  denominator?: ColumnValueId;
  log2FcThreshold?: number;
  pAdjThreshold?: number;
  customBlockLabel?: string;
};

// Identity (`name`/`version`) comes from this package's own `package.json`, so
// the on-wire `{name}@{version}` reference can never drift from what npm
// publishes; the bundler inlines the JSON import.
export const kind = defineBlockKind<BlockParams>({
  name,
  version,
  parseInitializationParams,
});

// Internals

/** The same contract at runtime, for params arriving from a template file rather than typed code. */
function parseInitializationParams(value: unknown): BlockParams {
  assertParamsObject(value);

  const {
    countsRef,
    covariateRefs,
    contrastFactor,
    numerators,
    denominator,
    log2FcThreshold,
    pAdjThreshold,
    customBlockLabel,
  } = value;

  if (countsRef !== undefined && !isColumnUniversalId(countsRef)) {
    throw new Error("'countsRef' must be an upstream column, written as a column id.");
  }
  if (covariateRefs !== undefined) {
    if (!Array.isArray(covariateRefs) || !covariateRefs.every(isColumnUniversalId)) {
      throw new Error(
        "'covariateRefs' must be an array of upstream columns, written as column ids.",
      );
    }
  }
  if (contrastFactor !== undefined && !isColumnUniversalId(contrastFactor)) {
    throw new Error("'contrastFactor' must be one of the covariates, written as a column id.");
  }
  // The groups being compared are values of the contrast factor column, so
  // any value the user's metadata holds is legal -- only the column value id
  // form is checked. A value the column no longer holds stays picked and is
  // shown as not available.
  if (numerators !== undefined) {
    if (!Array.isArray(numerators) || !numerators.every(isColumnValueId)) {
      throw new Error(
        "'numerators' must be an array of contrast factor values, written as column value ids.",
      );
    }
  }
  if (denominator !== undefined && !isColumnValueId(denominator)) {
    throw new Error("'denominator' must be a contrast factor value, written as a column value id.");
  }
  // A threshold on the *absolute* log2 fold change, so it has no upper bound
  // and cannot be negative.
  if (log2FcThreshold !== undefined && !isNonNegativeNumber(log2FcThreshold)) {
    throw new Error("'log2FcThreshold' must be a number greater than or equal to 0.");
  }
  // An adjusted p-value, so a probability.
  if (pAdjThreshold !== undefined && !isFraction(pAdjThreshold)) {
    throw new Error("'pAdjThreshold' must be a number between 0 and 1.");
  }
  if (customBlockLabel !== undefined && typeof customBlockLabel !== "string") {
    throw new Error("'customBlockLabel' must be a string.");
  }

  return {
    countsRef,
    covariateRefs,
    contrastFactor,
    numerators,
    denominator,
    log2FcThreshold,
    pAdjThreshold,
    customBlockLabel,
  };
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isFraction(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
