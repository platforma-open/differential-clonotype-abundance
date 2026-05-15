---
"@platforma-open/milaboratories.run-diff-clonotype-abundance-deseq2-r.software": patch
---

Align Dockerfile with the other R-using block softwares (MILAB-6263). Adds `curl`, `ca-certificates`, and `libuv1-dev` to the apt deps so the same image template builds regardless of which R packages the block needs; no behavior change for this block specifically.
