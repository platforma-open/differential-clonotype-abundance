# @platforma-open/milaboratories.differential-clonotype-abundance.kind

## 2.0.1

### Patch Changes

- 9f4e9dd: Update the SDK to 1.90.2. The alignment no longer fails with `Duplicate column id … in provider ResultPool` when the abundance column has sequence or label columns upstream.

## 2.0.0

### Major Changes

- 6bf89fa: The abundance column, the subset column picked with it, and the design covariate and contrast factor columns are stored as column ids of the result pool instead of references to upstream outputs, and the numerator and denominator groups as column value references to the contrast factor column, so the block that produced the metadata knows which of its values this block uses. The options of every column picker are built by the model; the numerator and denominator pickers read the values of the contrast factor column through a frame, so a column of any storage format can be picked from, and show why when the values cannot be read. Opening a project created before this change keeps the picked columns, converted to the new ids, and keeps the numerators and the denominator, converted to column value references of the same contrast factor column. Picked values are always text, so a group picked from a numeric column still matches its value. Picks that cannot be converted are reset and must be picked again: the numerators and the denominator of a block that had no contrast factor column picked, and the sequence, label and color columns of the alignment that were picked from upstream blocks. The initialization params of the kind carry the same column ids and references, so templates made for an earlier version of the kind cannot be applied.
  Numerators and a denominator that are no longer among the values of the contrast factor column stay selected and are marked as not available instead of being removed silently, with a tooltip naming the block that was to provide them, as a link to it, and what went wrong. Changing the contrast factor still clears them.

## 1.1.0

### Minor Changes

- 628e4ed: Update the SDK and accept a subset filter (e.g. a Repertoire Labeling label or Lead Selection picks) with clonotype and variant abundances. The dataset list is built with buildDatasetOptions (requireEnrichments: false). The subset restricts the input counts before the analysis, so DESeq2 normalization and testing use only the subset's features (and samples that have any), and results differ from a full-data run. Outputs of a subset run carry pl7.app/inputSubset in their domain and a trace rooted in the subset, so their labels name it. Unfiltered runs are unchanged. If a comparison group is left with no samples, the block now shows a warning instead of failing. Samples with a missing value in any design variable are left out of the comparison and listed in a warning, instead of failing the run.
