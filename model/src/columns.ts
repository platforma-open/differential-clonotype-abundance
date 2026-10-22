import type {
  ColumnUniversalId,
  PColumn,
  PColumnDataUniversal,
  RelaxedColumnSelector,
  StringMatcher,
  TreeNodeAccessor,
} from "@platforma-sdk/model";
import {
  Column,
  ColumnRecipe,
  ColumnsCollection,
  deriveColumnOptions,
  isDataColumn,
} from "@platforma-sdk/model";

/** A column offered in a column picker, by its result-pool id. */
export type ColumnPickerOption = {
  value: ColumnUniversalId;
  label: string;
};

/**
 * Abundance columns of upstream blocks the analysis can take: per sample (the first of exactly
 * two axes), raw rather than normalized, and keyed by clonotypes, clusters, peptides, variants
 * or genes — not by single-cell clonotypes or their clusters.
 */
export function getCountsOptions(): ColumnPickerOption[] {
  const columns = resultPool().filter({
    include: [CLONOTYPE_ABUNDANCE, RNA_SEQ_COUNTS],
    exclude: SINGLE_CELL_KEYED,
  });
  return toPickerOptions(
    deriveColumnOptions(columns, { includeNativeLabel: true, addLabelAsSuffix: true }),
  );
}

/** Sample metadata columns of upstream blocks, offered as the design covariates. */
export function getMetadataOptions(): ColumnPickerOption[] {
  const columns = resultPool().filter({ include: { name: [exact(METADATA_COLUMN_NAME)] } });
  return toPickerOptions(deriveColumnOptions(columns));
}

/**
 * The column with this id, found by id alone. `undefined` while it is still resolving and once
 * it is gone: a stored id may name a column its upstream block no longer produces.
 */
export function findColumn(id: ColumnUniversalId): ColumnRecipe | undefined {
  if (ColumnRecipe.getStatus(id) !== "present") return undefined;
  return Column(id);
}

/**
 * Columns of one of this block's outputs. `undefined` until the output is there and every column
 * of it has arrived.
 */
export function getOutputColumns(
  accessor: TreeNodeAccessor | undefined,
): ColumnsCollection | undefined {
  if (accessor === undefined) return undefined;
  const collection = ColumnsCollection([accessor]);
  return collection.isFinal() ? collection : undefined;
}

/**
 * Upstream columns keyed by the abundance column's feature axis (axis 1) alone — the sequences
 * and other per-feature columns shown next to the results.
 */
export function getFeatureColumns(countsRef: ColumnUniversalId): ColumnRecipe[] | undefined {
  const featureAxis = findColumn(countsRef)?.getSpec().axesSpec[1];
  if (featureAxis === undefined) return undefined;
  const domain = Object.fromEntries(
    Object.entries(featureAxis.domain ?? {}).map(([key, value]) => [key, [exact(value)]]),
  );
  return resultPool()
    .filter({
      include: {
        axes: [{ name: [exact(featureAxis.name)], domain }],
        partialAxesMatch: false,
      },
    })
    .getColumns();
}

/**
 * Columns as the `PColumn`s graph and alignment frames are built from. Only plain stored
 * columns have that form; data still on its way stays `undefined`.
 */
export function toPColumns(columns: ColumnRecipe[]): PColumn<undefined | PColumnDataUniversal>[] {
  return columns
    .filter(isDataColumn)
    .map((column) => ({ id: column.id, spec: column.getSpec(), data: column.getData() }));
}

// Internals

const METADATA_COLUMN_NAME = "pl7.app/metadata";

const SAMPLE_AXIS: RelaxedColumnSelector["axes"] = [{ name: [exact("pl7.app/sampleId")] }, {}];

const CLONOTYPE_ABUNDANCE: RelaxedColumnSelector = {
  axes: SAMPLE_AXIS,
  partialAxesMatch: false,
  annotations: {
    "pl7.app/isAbundance": [exact("true")],
    "pl7.app/abundance/normalized": [exact("false")],
    "pl7.app/abundance/isPrimary": [exact("true")],
  },
};

const RNA_SEQ_COUNTS: RelaxedColumnSelector = {
  axes: SAMPLE_AXIS,
  partialAxesMatch: false,
  annotations: { "pl7.app/isAbundance": [exact("true")] },
  domain: { "pl7.app/rna-seq/normalized": [exact("false")] },
};

const SINGLE_CELL_KEYED: RelaxedColumnSelector = {
  axes: [{ name: [exact("pl7.app/vdj/scClonotypeKeyRR"), exact("pl7.app/vdj/clusterIdRR")] }],
  partialAxesMatch: true,
};

function resultPool(): ColumnsCollection {
  return ColumnsCollection(["result_pool"]);
}

function exact(value: string): StringMatcher {
  return { type: "exact", value };
}

function toPickerOptions(
  options: { id: ColumnUniversalId; label: string }[],
): ColumnPickerOption[] {
  return options.map(({ id, label }) => ({ value: id, label }));
}
