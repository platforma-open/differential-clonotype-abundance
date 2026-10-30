# @platforma-open/milaboratories.differential-clonotype-abundance.kind

## 1.1.0

### Minor Changes

- 628e4ed: Update the SDK and accept a subset filter (e.g. a Repertoire Labeling label or Lead Selection picks) with clonotype and variant abundances. The dataset list is built with buildDatasetOptions (requireEnrichments: false). The subset restricts the input counts before the analysis, so DESeq2 normalization and testing use only the subset's features (and samples that have any), and results differ from a full-data run. Outputs of a subset run carry pl7.app/inputSubset in their domain and a trace rooted in the subset, so their labels name it. Unfiltered runs are unchanged. If a comparison group is left with no samples, the block now shows a warning instead of failing. Samples with a missing value in any design variable are left out of the comparison and listed in a warning, instead of failing the run.
