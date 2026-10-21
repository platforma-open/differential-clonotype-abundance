import { kind } from "@platforma-open/milaboratories.differential-clonotype-abundance.kind";
import {
  createColumnValueId,
  createGlobalPObjectId,
  createPlDataTableStateV2,
} from "@platforma-sdk/model";
import { describe, expect, test } from "vitest";
import { blockDataModel } from "./data_model";

const ref = (blockId: string, name: string) => ({ __isRef: true, blockId, name });

const tissue = createGlobalPObjectId("samples", "metadata.tissue");

const storedAtV20260929 = {
  customBlockLabel: "",
  countsRef: ref("mixcr", "abundance"),
  covariateRefs: [ref("samples", "metadata.donor")],
  contrastFactor: ref("samples", "metadata.tissue"),
  denominator: "control",
  numerators: ["treated", "relapsed"],
  log2FcThreshold: 1,
  pAdjThreshold: 0.05,
  tableState: createPlDataTableStateV2(),
  graphState: { title: "Differential abundance", template: "dots", currentTab: null },
  alignmentModel: {},
};

function migrate(stored: Record<string, unknown>) {
  return blockDataModel.migrate({ version: "V20260929", data: stored }).data;
}

describe("V20261020 migration", () => {
  const data = migrate(storedAtV20260929);

  test("refs to upstream outputs become their result-pool ids", () => {
    expect(data.countsRef).toBe(createGlobalPObjectId("mixcr", "abundance"));
    expect(data.covariateRefs).toEqual([createGlobalPObjectId("samples", "metadata.donor")]);
    expect(data.contrastFactor).toBe(tissue);
  });

  test("plain compared groups become value ids of the converted contrast factor column", () => {
    expect(data.denominator).toBe(createColumnValueId({ column: tissue, value: "control" }));
    expect(data.numerators).toEqual([
      createColumnValueId({ column: tissue, value: "treated" }),
      createColumnValueId({ column: tissue, value: "relapsed" }),
    ]);
  });

  test("a group of a numeric column keeps its stored text", () => {
    const { numerators } = migrate({ ...storedAtV20260929, numerators: ["2"] });
    expect(numerators).toEqual([createColumnValueId({ column: tissue, value: "2" })]);
  });

  test("groups already stored as column value ids are kept", () => {
    const other = createGlobalPObjectId("samples", "metadata.timepoint");
    const kept = createColumnValueId({ column: other, value: "day 7" });
    const { denominator, numerators } = migrate({
      ...storedAtV20260929,
      denominator: kept,
      numerators: [kept, "treated"],
    });
    expect(denominator).toBe(kept);
    expect(numerators).toEqual([kept, createColumnValueId({ column: tissue, value: "treated" })]);
  });

  test("without a contrast factor column the plain groups are dropped", () => {
    const { contrastFactor, denominator, numerators } = migrate({
      ...storedAtV20260929,
      contrastFactor: undefined,
    });
    expect(contrastFactor).toBeUndefined();
    expect(denominator).toBeUndefined();
    expect(numerators).toEqual([]);
  });

  test("groups that are neither text nor a finite number are dropped", () => {
    const { denominator, numerators } = migrate({
      ...storedAtV20260929,
      denominator: null,
      numerators: [Number.NaN, { value: "treated" }, "treated"],
    });
    expect(denominator).toBeUndefined();
    expect(numerators).toEqual([createColumnValueId({ column: tissue, value: "treated" })]);
  });

  test("the migrated picks are what the kind accepts", () => {
    const { countsRef, covariateRefs, contrastFactor, denominator, numerators } = data;
    expect(() =>
      kind.parseInitializationParams({
        countsRef,
        covariateRefs,
        contrastFactor,
        denominator,
        numerators,
      }),
    ).not.toThrow();
  });
});
