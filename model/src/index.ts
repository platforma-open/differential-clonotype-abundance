import type { GraphMakerState } from '@milaboratories/graph-maker';
import type {
  InferOutputsType,
  PColumn,
  PColumnIdAndSpec,
  PlDataTableStateV2,
  PlMultiSequenceAlignmentModel,
  PlRef,
  TreeNodeAccessor,
} from '@platforma-sdk/model';
import {
  BlockModel,
  createPFrameForGraphs,
  createPlDataTableSheet,
  createPlDataTableStateV2,
  createPlDataTableV2,
  getUniquePartitionKeys,
  isPColumnSpec,
} from '@platforma-sdk/model';

export type UiState = {
  tableState: PlDataTableStateV2;
  graphState: GraphMakerState;
  title?: string;
  selectedChain?: string;
  alignmentModel: PlMultiSequenceAlignmentModel;
};

export type BlockArgs = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  countsRef?: PlRef;
  covariateRefs: PlRef[];
  contrastFactor?: PlRef;
  denominator?: string;
  numerators: string[];
  log2FcThreshold: number;
  pAdjThreshold: number;
};

// get main Pcols for plot and tables
function filterPCols(
  pCols: PColumn<TreeNodeAccessor>[]):
  PColumn<TreeNodeAccessor>[] {
  // Allow only log2 FC and -log10 Padjust as options for volcano axis
  pCols = pCols.filter(
    (col) => (col.spec.name === 'pl7.app/differentialAbundance/log2foldchange'
      || col.spec.name === 'pl7.app/differentialAbundance/minlog10padj'
      || col.spec.name === 'pl7.app/differentialAbundance/regulationDirection'
      || col.spec.name === 'pl7.app/differentialAbundance/contrastGroup')
    || (col.spec.name === 'pl7.app/rna-seq/log2foldchange'
      || col.spec.name === 'pl7.app/rna-seq/minlog10padj'
      || col.spec.name === 'pl7.app/rna-seq/regulationDirection'
      || col.spec.name === 'pl7.app/rna-seq/genesymbol'
      || col.spec.name === 'pl7.app/rna-seq/contrastGroup'),
  );
  return pCols;
}

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    defaultBlockLabel: 'Configure comparison',
    customBlockLabel: '',
    // IGChain: [],
    numerators: [],
    covariateRefs: [],
    log2FcThreshold: 1,
    pAdjThreshold: 0.05,
  })

  .withUiState<UiState>({
    tableState: createPlDataTableStateV2(),
    graphState: {
      title: 'Differential abundance',
      template: 'dots',
      currentTab: null,
    },
    alignmentModel: {},
  })

  // Activate "Run" button only after these conditions are satisfied
  .argsValid((ctx) => (
    ((ctx.args.countsRef !== undefined)
      && (ctx.args.covariateRefs !== undefined)
      && (ctx.args.contrastFactor !== undefined)
      && (ctx.args.numerators.length > 0)
      && (ctx.args.denominator !== undefined)
      && (ctx.args.log2FcThreshold !== undefined)
      && (ctx.args.pAdjThreshold !== undefined))
  ))

  .output('countsOptions', (ctx) => {
    const allOptions = ctx.resultPool.getOptions([
      // Clonotyoe input
      {
        axes: [
          { name: 'pl7.app/sampleId' },
          { },
        ],
        annotations: { 'pl7.app/isAbundance': 'true',
          'pl7.app/abundance/normalized': 'false',
          'pl7.app/abundance/isPrimary': 'true' },
      },
      // RNA input
      {
        axes: [
          { name: 'pl7.app/sampleId' },
          { },
        ],
        annotations: { 'pl7.app/isAbundance': 'true' },
        domain: { 'pl7.app/rna-seq/normalized': 'false' },
      }], { label: { includeNativeLabel: true, addLabelAsSuffix: true }, refsWithEnrichments: false });

    // Filter out single-cell and clustered data for now
    return allOptions.filter((option) => {
      const pColumnSpec = ctx.resultPool.getSpecByRef(option.ref);
      if (!pColumnSpec || !isPColumnSpec(pColumnSpec)) {
        return true; // Keep non-p-column options
      }

      const hasScClonotypeKey = pColumnSpec.axesSpec?.length >= 2
        && (pColumnSpec.axesSpec[1]?.name === 'pl7.app/vdj/scClonotypeKeyRR'
          || pColumnSpec.axesSpec[1]?.name === 'pl7.app/vdj/clusterIdRR'
        );

      return !hasScClonotypeKey;
    });
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

    const pColumn = ctx.resultPool.getPColumnByRef(ctx.args.contrastFactor);
    if (!pColumn) return undefined;

    return ctx.createPFrame([pColumn]);
  })

  .output('errorLogs', (ctx) => {
    const pCols = ctx.outputs?.resolve('errorLogs')?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }

    return ctx.createPFrame(pCols);
  })

  // Returns a map of results
  .retentiveOutputWithStatus('pt', (ctx) => {
    const pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }

    return createPlDataTableV2(ctx, pCols, ctx.uiState?.tableState);
  })

  .output('sheets', (ctx) => {
    const pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined || pCols.length === 0) {
      return undefined;
    }

    // Get unique contrast values
    const contrasts = getUniquePartitionKeys(pCols[0].data)?.[0];
    if (!contrasts) return undefined;

    return [createPlDataTableSheet(ctx, pCols[0].spec.axesSpec[0], contrasts)];
  })

  .output('test', (ctx) => {
    const pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined || pCols.length === 0) {
      return undefined;
    }

    // Get unique contrast values
    const contrasts = getUniquePartitionKeys(pCols[0].data)?.[0];
    if (!contrasts) return undefined;

    return getUniquePartitionKeys(pCols[0].data);
  })

  .retentiveOutputWithStatus('topTablePf', (ctx) => {
    let pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }

    pCols = filterPCols(pCols);

    return createPFrameForGraphs(ctx, pCols);
  })

  .output('topTablePcols', (ctx) => {
    let pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    pCols = filterPCols(pCols);

    return pCols.map(
      (c) =>
        ({
          columnId: c.id,
          spec: c.spec,
        } satisfies PColumnIdAndSpec),
    );
  })

  .output('msaPf', (ctx) => {
    const msaCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (!msaCols) return undefined;

    const datasetRef = ctx.args.countsRef;
    if (datasetRef === undefined)
      return undefined;

    const seqCols = ctx.resultPool.getAnchoredPColumns(
      { main: datasetRef },
      [{ axes: [{ anchor: 'main', idx: 1 }] }],
    );
    if (seqCols === undefined)
      return undefined;

    return createPFrameForGraphs(ctx, [...msaCols, ...seqCols]);
  })

  .title(() => 'Differential abundance')

  .subtitle((ctx) => ctx.args.customBlockLabel || ctx.args.defaultBlockLabel || '')

  .sections((_ctx) => ([
    { type: 'link', href: '/', label: 'Main' },
    { type: 'link', href: '/graph', label: 'Volcano plot' },
  ]))

  .done(2);

export type BlockOutputs = InferOutputsType<typeof model>;
