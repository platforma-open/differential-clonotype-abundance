# Overview

Identifies differentially abundant features (clonotypes, peptides, or genes) between experimental conditions using DESeq2. The block accepts count data from upstream blocks and performs statistical testing to determine which features show significant changes in abundance between conditions, accounting for biological variability and library size differences.

For clonotype and peptide inputs, DESeq2 uses a local regression fit (instead of the default parametric fit) to estimate dispersion parameters, which is optimized for sparse count distributions where many sequences have zero or very low counts across samples. This local fit adapts to the actual relationship between mean counts and variability in the data, rather than assuming a fixed parametric form. For bulk RNA-seq inputs, DESeq2's standard parametric fit is used.

The block uses DESeq2 v1.46.0 for differential abundance analysis. When using this block in your research, cite the DESeq2 publication (Love et al. 2014) listed below.
> Love, M. I., Huber, W., & Anders, S. (2014). Moderated estimation of fold change and dispersion for RNA-seq data with DESeq2. _Genome Biology_ **15**, 550 (2014). [https://doi.org/10.1186/s13059-014-0550-8](https://doi.org/10.1186/s13059-014-0550-8)
