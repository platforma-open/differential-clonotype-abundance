import type {
  ColumnUniversalId,
  DatasetOption,
  DatasetSelection,
  PColumnSpec,
  PlRef,
  PObjectSpec,
  RenderCtxBase,
} from "@platforma-sdk/model";
import {
  buildDatasetOptions,
  createDatasetSelection,
  createGlobalPObjectId,
  createPrimaryRef,
  isPColumnSpec,
  isPlRef,
  parseColumnIdSafely,
} from "@platforma-sdk/model";
import { getCountsOptions } from "./columns";

/** The counts and the subset they are narrowed to, as the block stores them. */
export type CountsPick = {
  countsRef?: ColumnUniversalId;
  filterRef?: ColumnUniversalId;
};

/**
 * The dataset picker's options: the abundance columns the analysis can take, each with its
 * subset columns (`pl7.app/isSubset`, e.g. Repertoire Labeling labels) as filters.
 */
export function getCountsDatasetOptions(ctx: RenderCtxBase): DatasetOption[] {
  // Only the filters are taken from here: the counts below are matched to them by column id.
  const withFilters =
    buildDatasetOptions(ctx, {
      primary: isCounts,
      // Only subsets keyed by the clonotype or variant axis alone.
      filter: (spec) =>
        isPColumnSpec(spec) &&
        spec.axesSpec.length === 1 &&
        DATASET_KEY_AXES.has(spec.axesSpec[0].name),
      requireEnrichments: false,
    }) ?? [];

  return getCountsOptions(ctx).flatMap(({ value, label }): DatasetOption[] => {
    const ref = toPlRef(value);
    if (ref === undefined) return [];
    const primary = { ref, label };
    const filters = withFilters.find((o) => toColumnId(o.primary.ref) === value)?.filters;
    return [filters === undefined ? { primary } : { primary, filters }];
  });
}

/** The dataset picker's selection of the stored counts and subset. */
export function toCountsSelection(pick: CountsPick): DatasetSelection | undefined {
  const column = pick.countsRef === undefined ? undefined : toPlRef(pick.countsRef);
  if (column === undefined) return undefined;
  const filter = pick.filterRef === undefined ? undefined : toPlRef(pick.filterRef);
  return createDatasetSelection(createPrimaryRef(column, filter));
}

/** The counts and subset a dataset picker selection stores. */
export function fromCountsSelection(selection: DatasetSelection | undefined): CountsPick {
  const primary = selection?.primary;
  return {
    countsRef: primary === undefined ? undefined : toColumnId(primary.column),
    filterRef: primary?.filter === undefined ? undefined : toColumnId(primary.filter),
  };
}

// Internals

/** Key axes of the datasets whose subsets this block accepts: bulk and single-cell clonotypes, and variants. */
const DATASET_KEY_AXES: ReadonlySet<string> = new Set([
  "pl7.app/vdj/clonotypeKey",
  "pl7.app/vdj/scClonotypeKey",
  "pl7.app/variantKey",
]);

/** Raw clonotype abundances and raw RNA-seq counts, keyed by sample and one feature axis. */
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

/** The result-pool id of the upstream output a ref points to: it names the same block and column. */
function toColumnId(ref: PlRef): ColumnUniversalId {
  return createGlobalPObjectId(ref.blockId, ref.name);
}

/** The upstream output a result-pool id names, as the ref the dataset picker works with. */
function toPlRef(id: ColumnUniversalId): PlRef | undefined {
  const key = parseColumnIdSafely(id);
  return isPlRef(key) ? key : undefined;
}
