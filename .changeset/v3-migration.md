---
"@platforma-open/milaboratories.differential-clonotype-abundance.model": minor
"@platforma-open/milaboratories.differential-clonotype-abundance.ui": minor
"@platforma-open/milaboratories.differential-clonotype-abundance": minor
---

Migrate block to BlockModelV3. Unified `BlockData` (UI-shaped persistence); `.args` lambda derives the workflow-visible shape and validates by throw. Persisted V1 state preserved via `DataModelBuilder.upgradeLegacy`. UI bindings move to `app.model.data`; `defineApp` → `defineAppV3`.

`defaultBlockLabel` is no longer stored: the args lambda derives it inline from `data.numerators`, `data.denominator`, and the threshold fields, matching the V1 `watchEffect` logic. The label-syncing watcher and the `customBlockLabel ??= ''` init guard are removed.

Drop unused `ui.title` and `ui.selectedChain` fields (defined but never read in the model). The `setInput` handler that synthesized `ui.title` from the chosen dataset's label is removed too — the dataset dropdown writes `countsRef` directly via v-model.
