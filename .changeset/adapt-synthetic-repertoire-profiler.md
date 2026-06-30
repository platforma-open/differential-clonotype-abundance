---
"@platforma-open/milaboratories.differential-clonotype-abundance.workflow": patch
"@platforma-open/milaboratories.differential-clonotype-abundance": patch
"@platforma-open/milaboratories.differential-clonotype-abundance.model": patch
"@platforma-open/milaboratories.differential-clonotype-abundance.ui": patch
---

Support `synthetic-repertoire-profiler` (amplicon) variant datasets:

- The run-id scoping logic (`general_da_pfconv.lib.tengo` and `diffAnalysis.tpl.tengo`) now recognizes the profiler's `pl7.app/repertoire/extractionRunId` axis-domain key alongside `pl7.app/peptide/extractionRunId` and `pl7.app/vdj/clonotypingRunId`, instead of panicking with "no recognized scoping domain key". Output Log2FC / regulation columns stay scoped to the run as before.
- Amplicon input (variantKey axis with `pl7.app/repertoire/extractionRunId`) is labeled `"Variant"` instead of `"Peptide"`, and takes the same per-variant differential-abundance export path.
