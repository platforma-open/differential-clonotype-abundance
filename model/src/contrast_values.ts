import type { ColumnUniversalId, ColumnValueOption, RenderCtxBase } from "@platforma-sdk/model";
import { deriveColumnValueOptions, readColumnValues } from "@platforma-sdk/model";
import { findColumn } from "./columns";

/** Options of the numerator and denominator pickers: the values of the contrast factor column. */
export type ContrastValueOptions = {
  /**
   * The contrast factor the options were built for: they describe the picks only while it stays
   * picked.
   */
  computedFor: ColumnUniversalId;
  options: ColumnValueOption[];
};

/**
 * Values of the contrast factor column as options of the numerator and denominator pickers, each
 * a column value id naming the contrast factor column, and through it the block that produced
 * the value. `undefined` until a contrast factor is picked. A column whose values cannot be read
 * now — still resolving, not computed, gone, or not stored inline — offers no values, so its
 * picks show as not available.
 */
export function getContrastValueOptions(
  ctx: RenderCtxBase,
  contrastFactor: ColumnUniversalId | undefined,
): ContrastValueOptions | undefined {
  if (contrastFactor === undefined) return undefined;
  const column = findColumn(ctx, contrastFactor);
  const entries = column === undefined ? undefined : readColumnValues(column);
  return { computedFor: contrastFactor, options: deriveColumnValueOptions(entries ?? []) };
}
