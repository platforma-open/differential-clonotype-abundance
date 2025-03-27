import type { GraphMakerState } from '@milaboratories/graph-maker';
import type {
  InferOutputsType,
  PColumn,
  PColumnIdAndSpec,
  PFrameHandle,
  PlDataTableState,
  PlRef,
  TreeNodeAccessor } from '@platforma-sdk/model';
import {
  BlockModel,
  createPlDataTable,
  isPColumn,
  isPColumnSpec,
} from '@platforma-sdk/model';

export type UiState = {
  tableState: PlDataTableState;
  graphState: GraphMakerState;
  selectedChain?: string;
  comparison?: string;
};

export type BlockArgs = {
  countsRef?: PlRef;
  covariateRefs: PlRef[];
  contrastFactor?: PlRef;
  denominator?: string;
  numerators: string[];
  log2FcThreshold: number;
  pAdjThreshold: number;
};

// get main Pcols for plot and tables
function filterPcols(pCols: PColumn<TreeNodeAccessor>[],
  comparison: string | undefined):
  PColumn<TreeNodeAccessor>[] {
  // Allow only log2 FC and -log10 Padjust as options for volcano axis
  pCols = pCols.filter(
    (col) => (col.spec.name === 'pl7.app/differentialAbundance/log2foldchange'
      || col.spec.name === 'pl7.app/differentialAbundance/minlog10padj'
      || col.spec.name === 'pl7.app/differentialAbundance/regulationDirection')
    // Only values associated to selected comparison
    && col.spec.axesSpec[0]?.domain?.['pl7.app/differentialAbundance/comparison'] === comparison,
  );
  return pCols;
}

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    // IGChain: [],
    numerators: [],
    covariateRefs: [],
    log2FcThreshold: 1,
    pAdjThreshold: 0.05,
  })

  .withUiState<UiState>({
    tableState: {
      gridState: {},
      pTableParams: {
        sorting: [],
        filters: [],
      },
    },
    graphState: {
      title: 'Differential gene expression',
      template: 'dots',
      currentTab: null,
    },
  })

  // Activate "Run" button only after these conditions are satisfied
  .argsValid((ctx) => (
    (ctx.args.log2FcThreshold !== undefined)
    && (ctx.args.pAdjThreshold !== undefined)
  ))

  // User can only select as input UMI count matrices or read count matrices
  // for cases where we don't have UMI counts
  // includeNativeLabel and addLabelAsSuffix makes visible the data source dataset
  // Result: [dataID] / input
  .output('countsOptions', (ctx) => {
    // First get all UMI count dataset and their block IDs
    const validUmiOptions = ctx.resultPool.getOptions((spec) => isPColumnSpec(spec)
      && (spec.name === 'pl7.app/vdj/uniqueMoleculeCount')
      && (spec.annotations?.['pl7.app/abundance/normalized'] === 'false')
    , { includeNativeLabel: true, addLabelAsSuffix: true });
    const umiBlockIds: string[] = validUmiOptions.map((item) => item.ref.blockId);

    // Then get all read count datasets that don't match blockIDs from UMI counts
    let validCountOptions = ctx.resultPool.getOptions((spec) => isPColumnSpec(spec)
      && (spec.name === 'pl7.app/vdj/readCount')
      && (spec.annotations?.['pl7.app/abundance/normalized'] === 'false')
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

  .output('denominatorOptions', (ctx) => {
    if (!ctx.args.contrastFactor) return undefined;

    const data = ctx.resultPool.getDataByRef(ctx.args.contrastFactor)?.data;

    // @TODO need a convenient method in API
    const values = data?.getDataAsJson<Record<string, string>>()?.['data'];
    if (!values) return undefined;

    return [...new Set(Object.values(values))];
  })

  // Returns a map of results
  .output('pt', (ctx) => {
    let pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }

    // Filter by selected comparison
    pCols = pCols.filter(
      (col) => col.spec.axesSpec[0]?.domain?.['pl7.app/differentialAbundance/comparison'] === ctx.uiState.comparison,
    );

    return createPlDataTable(ctx, pCols, ctx.uiState?.tableState);
  })

  .output('topTablePcols', (ctx) => {
    let pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    pCols = filterPcols(pCols, ctx.uiState.comparison);

    return pCols.map(
      (c) =>
        ({
          columnId: c.id,
          spec: c.spec,
        } satisfies PColumnIdAndSpec),
    );
  })

  .output('topTablePf', (ctx): PFrameHandle | undefined => {
    let pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    pCols = filterPcols(pCols, ctx.uiState.comparison);

    // enriching with upstream data
    const upstream = ctx.resultPool
      .getData()
      .entries.map((v) => v.obj)
      .filter(isPColumn)
      .filter((column) => column.spec.name === 'pl7.app/metadata');

    return ctx.createPFrame([...pCols, ...upstream]);
  })

  .sections((_ctx) => ([
    { type: 'link', href: '/', label: 'Contrast' },
    { type: 'link', href: '/graph', label: 'Volcano plot' },
  ]))

  .done();

export type BlockOutputs = InferOutputsType<typeof model>;
