---
'@platforma-open/milaboratories.differential-clonotype-abundance': patch
'@platforma-open/milaboratories.differential-clonotype-abundance.workflow': patch
---

The input checks before the analysis are cached for 24 hours, as intended; the cache time was set in milliseconds where nanoseconds are expected, so it lasted about 86 ms.
