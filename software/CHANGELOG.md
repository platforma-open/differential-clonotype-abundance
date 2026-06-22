# @platforma-open/milaboratories.run-deseq2-r.software

## 1.16.3

### Patch Changes

- ecdbbfc: Migrate onto the block-tools structurer (tool-managed layout: oxlint/oxfmt,
  ts-builder, regenerated configs) and bump the SDK to latest (model/ui-vue
  1.79.15, workflow-tengo 6.6.3, tengo-builder 4.0.9, block-tools 2.11.1). No block
  behavior change — the model was already on BlockModelV3.

## 1.16.2

### Patch Changes

- 72a30e0: Make sure covariates file only contains samples from the selected input dataset

## 1.16.1

### Patch Changes

- cb53823: Align Dockerfile with the other R-using block softwares (MILAB-6263). Adds `curl`, `ca-certificates`, and `libuv1-dev` to the apt deps so the same image template builds regardless of which R packages the block needs; no behavior change for this block specifically.

## 1.16.0

### Minor Changes

- 06295e6: renv.lock was copied from the binary installation version; Dockerfile was fixed to override default R library

## 1.15.1

### Patch Changes

- 5b12de6: Fix R script execution issues

## 1.15.0

### Minor Changes

- d9759cf: Convert block into general differential analysis block for all data
- 3516cc5: Merge gene and clonotype differential analyses

## 1.14.1

### Patch Changes

- eab9b23: technical release
- 203e1c6: technical release
- 0aca834: technical release
- 7f65a36: technical release
- 4d6b04b: technical release

## 1.14.0

### Minor Changes

- adfb002: Fix code to correctly handle numeric numerators/denominators

## 1.13.0

### Minor Changes

- 7a46bd0: Be more restrictive while replicate check

## 1.12.0

### Minor Changes

- b10a8ea: Fix user error and refactor error logs

## 1.11.1

### Patch Changes

- 1ddf4e9: Update python and R

## 1.11.0

### Minor Changes

- d7c02ed: Full SDK update

## 1.10.0

### Minor Changes

- 4407657: Docker integration

## 1.9.0

### Minor Changes

- 349f6fb: Updated block to capture correctly specs in latest MiXCR clonotyping exports.

## 1.8.0

### Minor Changes

- 8aa6e8f: zero counts to one after clonotype filtering

## 1.7.0

### Minor Changes

- 2086193: Fix software naming

## 1.6.0

### Minor Changes

- 83b4ffc: Package updates
- e2f5931: First MVB
