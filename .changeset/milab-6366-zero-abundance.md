---
"@platforma-open/milaboratories.differential-clonotype-abundance.workflow": patch
"@platforma-open/milaboratories.run-diff-clonotype-abundance-deseq2-r.software": patch
"@platforma-open/milaboratories.differential-clonotype-abundance.model": patch
"@platforma-open/milaboratories.differential-clonotype-abundance.ui": patch
"@platforma-open/milaboratories.differential-clonotype-abundance": patch
---

MILAB-6366: Gracefully handle samples with zero abundance counts. Previously, selecting a sample that produced no counts upstream caused DESeq2 to crash with `ncol(countData) == nrow(colData) is not TRUE`. Now: empty samples are detected during pre-checks and dropped from the analysis, a per-sample warning is added to the existing errorLogs surface, and the Settings modal shows a dedicated alert listing the samples that will be excluded. If dropping leaves either contrast group with fewer than two replicates, the block stops cleanly with an actionable message instead of letting DESeq2 fail. Applies to both the clonotype and gene/RNA-seq paths.
