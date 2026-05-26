# @platforma-open/milaboratories.differential-clonotype-abundance.model

## 2.8.0

### Minor Changes

- 797d040: Migrate block to BlockModelV3. Unified `BlockData` (UI-shaped persistence); `.args` lambda derives the workflow-visible shape and validates by throw. Persisted V1 state preserved via `DataModelBuilder.upgradeLegacy`. UI bindings move to `app.model.data`; `defineApp` → `defineAppV3`.

  `defaultBlockLabel` is no longer stored: the args lambda derives it inline from `data.numerators`, `data.denominator`, and the threshold fields, matching the V1 `watchEffect` logic. The label-syncing watcher and the `customBlockLabel ??= ''` init guard are removed.

  Drop unused `ui.title` and `ui.selectedChain` fields (defined but never read in the model). The `setInput` handler that synthesized `ui.title` from the chosen dataset's label is removed too — the dataset dropdown writes `countsRef` directly via v-model.

## 2.7.0

### Minor Changes

- abf9b94: Support custom block title and running status

## 2.6.1

### Patch Changes

- 1e65d5c: important improvements

## 2.6.0

### Minor Changes

- d9759cf: Convert block into general differential analysis block for all data
- 3516cc5: Merge gene and clonotype differential analyses

## 2.5.1

### Patch Changes

- eab9b23: technical release
- 203e1c6: technical release
- 0aca834: technical release
- 7f65a36: technical release
- 4d6b04b: technical release

## 2.5.0

### Minor Changes

- b10a8ea: Fix user error and refactor error logs

## 2.4.1

### Patch Changes

- 1ddf4e9: Update python and R

## 2.4.0

### Minor Changes

- d7c02ed: Full SDK update

## 2.3.0

### Minor Changes

- b181695: Various fixes

## 2.2.1

### Patch Changes

- 453b2ac: Fix page header name

## 2.2.0

### Minor Changes

- e2f5931: First MVB
