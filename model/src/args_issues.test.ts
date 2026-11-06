import {
  BlockStorageFacadeCallbacks,
  createBlockStorage,
  createColumnValueId,
  createGlobalPObjectId,
  createPlDataTableStateV2,
  stringifyJson,
} from "@platforma-sdk/model";
import { beforeAll, describe, expect, test } from "vitest";

const callbackRegistry: Record<string, (storageJson: string) => unknown> = {};

beforeAll(async () => {
  Object.assign(globalThis, { cfgRenderCtx: { callbackRegistry } });
  await import("./index");
});

const abundance = createGlobalPObjectId("mixcr", "abundance");
const tissue = createGlobalPObjectId("samples", "metadata.tissue");
const treated = createColumnValueId({ column: tissue, value: "treated" });
const control = createColumnValueId({ column: tissue, value: "control" });

const configured = {
  customBlockLabel: "",
  countsRef: abundance,
  covariateRefs: [tissue],
  contrastFactor: tissue,
  denominator: control,
  numerators: [treated],
  log2FcThreshold: 1,
  pAdjThreshold: 0.05,
  tableState: createPlDataTableStateV2(),
  graphState: { title: "Differential abundance", template: "dots", currentTab: null },
  alignmentModel: {},
};

describe("args issues", () => {
  test("a configured comparison derives runnable args", () => {
    expect(deriveArgs(configured)).toMatchObject({
      value: {
        countsRef: abundance,
        contrastFactor: tissue,
        denominator: control,
        numerators: [treated],
        defaultBlockLabel: "treated vs control (log2FC: 1, pAdj: 0.05)",
      },
      issues: [],
    });
  });

  test.for([
    {
      why: "no dataset",
      data: { ...configured, countsRef: undefined },
      message: "Dataset is required",
    },
    {
      why: "no contrast factor",
      data: { ...configured, contrastFactor: undefined },
      message: "Contrast factor is required",
    },
    {
      why: "no numerator",
      data: { ...configured, numerators: [] },
      message: "At least one numerator is required",
    },
    {
      why: "no denominator",
      data: { ...configured, denominator: undefined },
      message: "Denominator is required",
    },
    {
      why: "no log2(FC) threshold",
      data: { ...configured, log2FcThreshold: undefined },
      message: "Log2(FC) threshold is required",
    },
    {
      why: "no adjusted p-value threshold",
      data: { ...configured, pAdjThreshold: undefined },
      message: "Adjusted p-value threshold is required",
    },
  ])("$why: the args still derive, and Run is blocked with its message", ({ data, message }) => {
    expect(deriveArgs(data)).toMatchObject({
      error: message,
      args: { customBlockLabel: "" },
      issues: [{ severity: "error", message }],
    });
  });

  test("an unconfigured block reports every missing setting", () => {
    const { countsRef: _, contrastFactor: __, denominator: ___, ...data } = configured;
    expect(deriveArgs({ ...data, numerators: [] })).toMatchObject({
      issues: [
        { severity: "error", message: "Dataset is required" },
        { severity: "error", message: "Contrast factor is required" },
        { severity: "error", message: "At least one numerator is required" },
        { severity: "error", message: "Denominator is required" },
      ],
    });
  });
});

// Internals

function deriveArgs(data: unknown): unknown {
  const derive = callbackRegistry[BlockStorageFacadeCallbacks.ArgsDerive];
  if (derive === undefined) throw new Error("The args derive callback is not registered");
  return derive(stringifyJson(createBlockStorage(data)));
}
