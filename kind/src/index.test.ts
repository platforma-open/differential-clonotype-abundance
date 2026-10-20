import { createColumnValueId, createGlobalPObjectId } from "@platforma-sdk/model";
import { describe, expect, it } from "vitest";
import { kind } from "./index";

const parse = (params: unknown) => kind.parseInitializationParams(params);

const REF = { __isRef: true as const, blockId: "b1", name: "pf/abundance" };

const ABUNDANCE = createGlobalPObjectId("b1", "pf/abundance");
const TISSUE = createGlobalPObjectId("b1", "pf/metadata/tissue");
const TREATED = createColumnValueId({ column: TISSUE, value: "treated" });
const RELAPSED = createColumnValueId({ column: TISSUE, value: "relapsed" });
const CONTROL = createColumnValueId({ column: TISSUE, value: "control" });

describe.each(["countsRef", "contrastFactor"] as const)("%s", (field) => {
  it("accepts a result-pool column id", () => {
    expect(parse({ [field]: ABUNDANCE })).toEqual({ [field]: ABUNDANCE });
  });

  it.each([
    ["a ref object, which earlier versions of the kind took", REF],
    ["a string that is not a column id", "pf/abundance"],
    ["a column value id rather than a column", createColumnValueId({ column: TISSUE, value: "x" })],
    ["a number", 42],
    ["null", null],
  ])("rejects %s", (_label, bad) => {
    expect(() => parse({ [field]: bad })).toThrow(`'${field}' must be`);
  });
});

describe("covariateRefs", () => {
  it.each([
    ["an empty array, as an unconfigured block has", []],
    ["several column ids", [ABUNDANCE, TISSUE]],
  ])("accepts %s", (_label, covariateRefs) => {
    expect(parse({ covariateRefs })).toEqual({ covariateRefs });
  });

  it.each([
    ["a bare column id", TISSUE],
    ["ref objects, which earlier versions of the kind took", [REF]],
    ["an array holding a string that is not a column id", [TISSUE, "pf/metadata/tissue"]],
  ])("rejects %s", (_label, covariateRefs) => {
    expect(() => parse({ covariateRefs })).toThrow("'covariateRefs' must be an array");
  });
});

describe("the compared groups", () => {
  it("accepts values of the contrast factor column", () => {
    const params = { numerators: [TREATED, RELAPSED], denominator: CONTROL };
    expect(parse(params)).toEqual(params);
  });

  it("accepts a numeric value of the contrast factor column", () => {
    const params = { denominator: createColumnValueId({ column: TISSUE, value: 2 }) };
    expect(parse(params)).toEqual(params);
  });

  it("accepts an empty numerators array -- picking a contrast factor clears them", () => {
    expect(parse({ numerators: [] })).toEqual({ numerators: [] });
  });

  it.each([
    ["a bare column value id", TREATED],
    ["an array of numbers", [1, 2]],
    ["plain values, which name no producing block", ["treated", "relapsed"]],
    ["a mix of column value ids and plain values", [TREATED, "relapsed"]],
  ])("rejects numerators as %s", (_label, numerators) => {
    expect(() => parse({ numerators })).toThrow("'numerators' must be an array");
  });

  it.each([
    ["a number", 0],
    ["a plain value, which names no producing block", "control"],
    ["a column id rather than a value of it", TISSUE],
  ])("rejects a denominator as %s", (_label, denominator) => {
    expect(() => parse({ denominator })).toThrow("'denominator' must be");
  });
});

describe("the significance thresholds", () => {
  it.each([0, 0.6, 1, 12.5])(
    "accepts log2FcThreshold %s -- the threshold is on the absolute fold change",
    (log2FcThreshold) => {
      expect(parse({ log2FcThreshold })).toEqual({ log2FcThreshold });
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, "1"])(
    "rejects log2FcThreshold %s",
    (log2FcThreshold) => {
      expect(() => parse({ log2FcThreshold })).toThrow("'log2FcThreshold' must be");
    },
  );

  it.each([0, 0.05, 0.5, 1])("accepts pAdjThreshold %s", (pAdjThreshold) => {
    expect(parse({ pAdjThreshold })).toEqual({ pAdjThreshold });
  });

  it.each([-0.1, 1.1, Number.NaN, "0.05"])("rejects pAdjThreshold %s", (pAdjThreshold) => {
    expect(() => parse({ pAdjThreshold })).toThrow("'pAdjThreshold' must be a number between");
  });
});

describe("the params envelope", () => {
  it("accepts an empty object -- every field is optional", () => {
    expect(parse({})).toEqual({});
  });

  it("accepts a fully configured comparison", () => {
    const params = {
      countsRef: ABUNDANCE,
      covariateRefs: [TISSUE],
      contrastFactor: TISSUE,
      numerators: [TREATED],
      denominator: CONTROL,
      log2FcThreshold: 1,
      pAdjThreshold: 0.05,
      customBlockLabel: "treated vs control",
    };
    expect(parse(params)).toEqual(params);
  });

  it("drops keys the contract does not name", () => {
    expect(parse({ pAdjThreshold: 0.05, notAParam: "x" })).toEqual({ pAdjThreshold: 0.05 });
  });

  it("rejects params that are not an object", () => {
    expect(() => parse(null)).toThrow();
    expect(() => parse([REF])).toThrow();
    expect(() => parse(5)).toThrow();
  });

  it("rejects a customBlockLabel that is not a string", () => {
    expect(() => parse({ customBlockLabel: 42 })).toThrow("'customBlockLabel' must be a string.");
  });
});
