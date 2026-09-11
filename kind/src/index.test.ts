import { describe, expect, it } from "vitest";
import { kind } from "./index";

const parse = (params: unknown) => kind.parseInitializationParams(params);

const REF = { __isRef: true as const, blockId: "b1", name: "pf/abundance" };
const OTHER_REF = { __isRef: true as const, blockId: "b1", name: "pf/metadata/tissue" };

describe.each(["countsRef", "contrastFactor"] as const)("%s", (field) => {
  it("accepts a PlRef", () => {
    expect(parse({ [field]: REF })).toEqual({ [field]: REF });
  });

  it.each([
    ["an object missing the marker", { blockId: "b1", name: "pf/abundance" }],
    ["a serialized ref rather than the object", JSON.stringify(REF)],
    ["a number", 42],
    ["null", null],
  ])("rejects %s", (_label, bad) => {
    expect(() => parse({ [field]: bad })).toThrow(`'${field}' must be`);
  });
});

describe("covariateRefs", () => {
  it.each([
    ["an empty array, as an unconfigured block has", []],
    ["several refs", [REF, OTHER_REF]],
  ])("accepts %s", (_label, covariateRefs) => {
    expect(parse({ covariateRefs })).toEqual({ covariateRefs });
  });

  it.each([
    ["a bare ref", REF],
    ["an array holding a non-ref", [REF, "pf/metadata/tissue"]],
  ])("rejects %s", (_label, covariateRefs) => {
    expect(() => parse({ covariateRefs })).toThrow("'covariateRefs' must be an array");
  });
});

describe("the compared groups", () => {
  it("accepts the contrast factor's own values", () => {
    const params = { numerators: ["treated", "relapsed"], denominator: "control" };
    expect(parse(params)).toEqual(params);
  });

  it("accepts an empty numerators array -- picking a contrast factor clears them", () => {
    expect(parse({ numerators: [] })).toEqual({ numerators: [] });
  });

  it.each([
    ["a bare string", "treated"],
    ["an array of numbers", [1, 2]],
  ])("rejects numerators as %s", (_label, numerators) => {
    expect(() => parse({ numerators })).toThrow("'numerators' must be an array");
  });

  it("rejects a non-string denominator", () => {
    expect(() => parse({ denominator: 0 })).toThrow("'denominator' must be");
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
      countsRef: REF,
      covariateRefs: [OTHER_REF],
      contrastFactor: OTHER_REF,
      numerators: ["treated"],
      denominator: "control",
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
