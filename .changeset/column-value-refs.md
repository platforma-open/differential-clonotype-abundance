---
"@platforma-open/milaboratories.differential-clonotype-abundance": major
"@platforma-open/milaboratories.differential-clonotype-abundance.kind": major
"@platforma-open/milaboratories.differential-clonotype-abundance.model": major
"@platforma-open/milaboratories.differential-clonotype-abundance.ui": major
"@platforma-open/milaboratories.differential-clonotype-abundance.workflow": major
---

The abundance, design covariate and contrast factor columns are stored as column ids of the result pool instead of references to upstream outputs, and the numerator and denominator groups as column value references to the contrast factor column, so the block that produced the metadata knows which of its values this block uses. The options of every column and value picker are built by the model. Opening a project created before this change keeps the picked columns, converted to the new ids, but clears the numerators and the denominator, since they were stored as plain values, which name no producing block; they have to be picked again before the block runs. The initialization params of the kind carry the same column ids and references, so templates made for an earlier version of the kind cannot be applied.
Numerators and a denominator that are no longer among the values of the contrast factor column stay selected and are marked as not available instead of being removed silently, with a tooltip naming the block that was to provide them, as a link to it, and what went wrong. Changing the contrast factor still clears them.
