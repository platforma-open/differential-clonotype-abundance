# Overview

This block calculates differential abundances (DA) between conditions using [DESeq2](https://bioconductor.org/packages/release/bioc/html/DESeq2.html) v1.46.0 with default fit for RNA-seq data and local fit for clonotype data. The block takes the outputs of RNA and VDJ processing blocks as input. It then generates DA lists as outputs that can be used by other downstream blocks. 

Please cite:
- *doi: [10.1186/s13059-014-0550-8](https://doi.org/10.1186/s13059-014-0550-8)*


