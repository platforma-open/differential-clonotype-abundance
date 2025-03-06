//import type { GraphMakerState } from '@milaboratories/graph-maker';
import type {
  InferOutputsType,
  PColumnIdAndSpec,
  PFrameHandle,
  PlDataTableState,
  PlRef } from '@platforma-sdk/model';
import {
  BlockModel,
  createPlDataTable,
  isPColumn,
  isPColumnSpec,
} from '@platforma-sdk/model';

export type UiState = {
  tableState: PlDataTableState;
 // graphState: GraphMakerState;
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
  covariateRefs: PlRef[];
  contrastFactor?: PlRef;
  denominator?: string;
  numerators: string[];
};

// function filterTopTablePCols(pCols: PColumn) {
//   if ((pCols === undefined) || !(isPColumn(pCols))) {
//     return undefined;
//   }
//   // Allow only log2 FC and -log10 Padjust as options for volcano axis
//   // Include gene symbol for future filters
//   pCols = pCols.filter(
//     (col) => (col.spec.name === 'pl7.app/rna-seq/log2foldchange'
//       || col.spec.name === 'pl7.app/rna-seq/minlog10padj'
//       || col.spec.name === 'pl7.app/rna-seq/regulationDirection'
//       || col.spec.name === 'pl7.app/rna-seq/genesymbol')
//     && col.spec.axesSpec[0]?.domain?.['pl7.app/comparison'] === ctx.args.comparison,
//   );

//   return pCols;
// }

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    // formulas: [
    //   {
    //     label: 'Formula',
    //     covariateRefs: []
    //   }
    // ]
    covariateRefs: [],
    numerators: [],
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

  // User can only select as input raw gene count matrices
  // includeNativeLabel ensures raw counts pl7.app/label (native label, 'Raw gene expression')
  // is visible in selection (by default we see Samples & data ID)
  // addLabelAsSuffix moves the native label to the end
  // Result: [dataID] / Raw gene expression
  .output('countsOptions', (ctx) =>
    // I've added these "||" for backward compatibility (As I see, the shape of PColum was changed)
    ctx.resultPool.getOptions((spec) => isPColumnSpec(spec)
      && (spec.name === 'pl7.app/rna-seq/countMatrix' || spec.name === 'countMatrix')
      && (spec.annotations?.['pl7.app/rna-seq/normalized'] === 'false' || spec.domain?.['pl7.app/rna-seq/normalized'] === 'false')
    , { includeNativeLabel: true, addLabelAsSuffix: true }),
  )

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
      (col) => col.spec.axesSpec[0]?.domain?.['pl7.app/comparison'] === ctx.uiState.comparison,
    );

    return createPlDataTable(ctx, pCols, ctx.uiState?.tableState);
  })

  .output('topTablePcols', (ctx) => {
    let pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    // Allow only log2 FC and -log10 Padjust as options for volcano axis
    // Include gene symbol for future filters
    pCols = pCols.filter(
      (col) => (col.spec.name === 'pl7.app/rna-seq/log2foldchange'
        || col.spec.name === 'pl7.app/rna-seq/minlog10padj'
        || col.spec.name === 'pl7.app/rna-seq/regulationDirection'
        || col.spec.name === 'pl7.app/rna-seq/genesymbol')
      // Only values associated to selected comparison
      && col.spec.axesSpec[0]?.domain?.['pl7.app/comparison'] === ctx.uiState.comparison,
    );

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
    // Allow only log2 FC and -log10 Padjust as options for volcano axis
    // Include gene symbol for future filters
    pCols = pCols.filter(
      (col) => (col.spec.name === 'pl7.app/rna-seq/log2foldchange'
        || col.spec.name === 'pl7.app/rna-seq/minlog10padj'
        || col.spec.name === 'pl7.app/rna-seq/regulationDirection'
        || col.spec.name === 'pl7.app/rna-seq/genesymbol')
      && col.spec.axesSpec[0]?.domain?.['pl7.app/comparison'] === ctx.uiState.comparison,
    );

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


