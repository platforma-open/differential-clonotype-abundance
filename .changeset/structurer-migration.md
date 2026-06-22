---
"@platforma-open/milaboratories.differential-clonotype-abundance.model": patch
"@platforma-open/milaboratories.differential-clonotype-abundance.ui": patch
"@platforma-open/milaboratories.differential-clonotype-abundance.workflow": patch
"@platforma-open/milaboratories.run-diff-clonotype-abundance-deseq2-r.software": patch
---

Migrate onto the block-tools structurer (tool-managed layout: oxlint/oxfmt,
ts-builder, regenerated configs) and bump the SDK to latest (model/ui-vue
1.79.15, workflow-tengo 6.6.3, tengo-builder 4.0.9, block-tools 2.11.1). No block
behavior change — the model was already on BlockModelV3.
