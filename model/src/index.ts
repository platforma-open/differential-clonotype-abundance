import type { GraphMakerState } from '@milaboratories/graph-maker';
import type {
  InferOutputsType,
  PColumnIdAndSpec,
  PFrameHandle,
  PlDataTableState,
  PlRef } from '@platforma-sdk/model';
import {
  BlockModel,
  createPlDataTable,
  createPlDataTableSheet,
  getUniquePartitionKeys,
  isPColumn,
  isPColumnSpec,
} from '@platforma-sdk/model';

export type UiState = {
  tableState: PlDataTableState;
  // graphState: GraphMakerState;
  selectedChain?: string;
  comparison?: string;
};

// export type Formula = {
//   // we put formula label in the arg as it will be used
//   // in the annotations to re-use in the downstream blocks
//   label: string;
//   covariateRefs: PlRef[];
//   contrastFactor?: PlRef;
//   denominator?: String;
//   numerator?: String;
// };

export type BlockArgs = {
  countsRef?: PlRef;
  // formulas: Formula[];
  IGChain: string[];
  covariateRefs: PlRef[];
  contrastFactor?: PlRef;
  denominator?: string;
  numerators: string[];
  log2FCThreshold: number;
  pAdjFCThreshold: number;
};

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    IGChain: [],
    numerators: [],
    covariateRefs: [],
    log2FCThreshold: 1,
    pAdjFCThreshold: 0.05,
  })

  .withUiState<UiState>({
    tableState: {
      gridState: {},
      pTableParams: {
        sorting: [],
        filters: [],
      },
    },
    // graphState: {
    //   title: 'Differential gene expression',
    //   template: 'dots',
    //   currentTab: null,
    // },
  })

  // Activate "Run" button only after these conditions are satisfied
  .argsValid((ctx) => (
    (ctx.args.log2FCThreshold !== undefined)
    && (ctx.args.pAdjFCThreshold !== undefined)
  ))

  // User can only select as input UMI count matrices or read count matrices
  // for cases where we don't have UMI counts
  // includeNativeLabel and addLabelAsSuffix makes visible the data source dataset
  // Result: [dataID] / input
  .output('countsOptions', (ctx) => {
    // First get all UMI count dataset and their block IDs
    const validUmiOptions = ctx.resultPool.getOptions((spec) => isPColumnSpec(spec)
      && (spec.name === 'pl7.app/vdj/uniqueMoleculeCount')
    , { includeNativeLabel: true, addLabelAsSuffix: true });
    const umiBlockIds: string[] = validUmiOptions.map((item) => item.ref.blockId);

    // Then get all read count datasets that don't match blockIDs from UMI counts
    let validCountOptions = ctx.resultPool.getOptions((spec) => isPColumnSpec(spec)
      && (spec.name === 'pl7.app/vdj/readCount')
    , { includeNativeLabel: true, addLabelAsSuffix: true });
    validCountOptions = validCountOptions.filter((item) =>
      !umiBlockIds.includes(item.ref.blockId));

    // Combine all valid options
    const validOptions = [...validUmiOptions, ...validCountOptions];
    return validOptions;
  })

  .output('metadataOptions', (ctx) =>
    ctx.resultPool.getOptions((spec) => isPColumnSpec(spec) && spec.name === 'pl7.app/metadata'),
  )

  .output('datasetSpec', (ctx) => {
    if (ctx.args.countsRef) return ctx.resultPool.getSpecByRef(ctx.args.countsRef);
    else return undefined;
  })

  // Get axis options associated to selected input data
  // Only works with bulk for now
  .output('chainOptions', (ctx) => {
    if (!ctx.args.countsRef) return undefined;
    const inputPcol = ctx.resultPool.getPColumnByRef(ctx.args.countsRef);
    if (!inputPcol) return undefined;

    const column = ctx.resultPool.getData().entries
      .map(({ obj }) => obj)
      .filter(isPColumn)
      .find((it) => it.id === inputPcol.id);
    if (!column) return undefined;

    const r = getUniquePartitionKeys(column.data);
    if (!r) return undefined;

    const dataTable = r.map((values, i) => createPlDataTableSheet(ctx,
      column.spec.axesSpec[i],
      values));

    const chainsSheet = dataTable.find((it) => it.axis.name === 'pl7.app/vdj/chain');
    if (!chainsSheet) return undefined;
    const chains = chainsSheet.options;
    return chains;
  })

  .output('denominatorOptions', (ctx) => {
    if (!ctx.args.contrastFactor) return undefined;

    const data = ctx.resultPool.getDataByRef(ctx.args.contrastFactor)?.data;

    // @TODO need a convenient method in API
    const values = data?.getDataAsJson<Record<string, string>>()?.['data'];
    if (!values) return undefined;

    return [...new Set(Object.values(values))];
  })

  .sections((_ctx) => ([
    { type: 'link', href: '/', label: 'Contrast' },
    // { type: 'link', href: '/graph', label: 'Volcano plot' },
  ]))

  .done();

export type BlockOutputs = InferOutputsType<typeof model>;
