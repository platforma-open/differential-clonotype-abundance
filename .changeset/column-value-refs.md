---
"@platforma-open/milaboratories.differential-clonotype-abundance": major
"@platforma-open/milaboratories.differential-clonotype-abundance.kind": major
"@platforma-open/milaboratories.differential-clonotype-abundance.model": major
"@platforma-open/milaboratories.differential-clonotype-abundance.ui": major
"@platforma-open/milaboratories.differential-clonotype-abundance.workflow": major
---

The abundance, design covariate and contrast factor columns are stored as column ids of the result pool instead of references to upstream outputs, and the numerator and denominator groups as column value references to the contrast factor column, so the block that produced the metadata knows which of its values this block uses. The options of every column picker are built by the model; the numerator and denominator pickers read the values of the contrast factor column through a frame, so a column of any storage format can be picked from, and show why when the values cannot be read. Opening a project created before this change keeps the picked columns, converted to the new ids, and keeps the numerators and the denominator, converted to column value references of the same contrast factor column. Picked values are always text, so a group picked from a numeric column still matches its value. Picks that cannot be converted are reset and must be picked again: the numerators and the denominator of a block that had no contrast factor column picked. The initialization params of the kind carry the same column ids and references, so templates made for an earlier version of the kind cannot be applied.
Numerators and a denominator that are no longer among the values of the contrast factor column stay selected and are marked as not available instead of being removed silently, with a tooltip naming the block that was to provide them, as a link to it, and what went wrong. Changing the contrast factor still clears them.
