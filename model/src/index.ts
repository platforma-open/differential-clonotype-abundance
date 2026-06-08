import type {
  InferOutputsType,
  PColumn,
  PColumnIdAndSpec,
  TreeNodeAccessor,
} from '@platforma-sdk/model';
import {
  BlockModelV3,
  createPFrameForGraphs,
  createPlDataTableSheet,
  createPlDataTableStateV2,
  createPlDataTableV2,
  DataModelBuilder,
  getUniquePartitionKeys,
  isPColumnSpec,
} from '@platforma-sdk/model';
import type {
  BlockArgs,
  BlockData,
  LegacyBlockArgs,
  LegacyBlockUiState,
} from './types';

export * from './types';

const defaultGraphState = (): BlockData['graphState'] => ({
  title: 'Differential abundance',
  template: 'dots',
  currentTab: null,
});

const blockDataModel = new DataModelBuilder()
  .from<BlockData>('V20260520')
  .upgradeLegacy<LegacyBlockArgs, LegacyBlockUiState>(({ args, uiState }) => ({
    customBlockLabel: args?.customBlockLabel ?? '',
    countsRef: args?.countsRef,
    covariateRefs: args?.covariateRefs ?? [],
    contrastFactor: args?.contrastFactor,
    denominator: args?.denominator,
    numerators: args?.numerators ?? [],
    log2FcThreshold: args?.log2FcThreshold ?? 1,
    pAdjThreshold: args?.pAdjThreshold ?? 0.05,
    minCounts: args?.minCounts ?? 1,
    minSamples: args?.minSamples ?? 1,
    tableState: uiState?.tableState ?? createPlDataTableStateV2(),
    graphState: uiState?.graphState ?? defaultGraphState(),
    alignmentModel: uiState?.alignmentModel ?? {},
  }))
  .init(() => ({
    customBlockLabel: '',
    countsRef: undefined,
    covariateRefs: [],
    contrastFactor: undefined,
    denominator: undefined,
    numerators: [],
    log2FcThreshold: 1,
    pAdjThreshold: 0.05,
    minCounts: 1,
    minSamples: 1,
    tableState: createPlDataTableStateV2(),
    graphState: defaultGraphState(),
    alignmentModel: {},
  }));

export function deriveDefaultLabel(data: BlockData): string {
  if (data.denominator && data.numerators.length > 0) {
    const numeratorsPart = data.numerators.join(', ');
    return `${numeratorsPart} vs ${data.denominator} (log2FC: ${data.log2FcThreshold}, pAdj: ${data.pAdjThreshold})`;
  }
  return 'Configure comparison';
}

// get main Pcols for plot and tables
function filterPCols(
  pCols: PColumn<TreeNodeAccessor>[],
): PColumn<TreeNodeAccessor>[] {
  // Allow only log2 FC and -log10 Padjust as options for volcano axis
  return pCols.filter(
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
}

export const platforma = BlockModelV3.create(blockDataModel)

  .args<BlockArgs>((data) => {
    if (data.countsRef === undefined) throw new Error('Dataset is required');
    if (data.contrastFactor === undefined) throw new Error('Contrast factor is required');
    if (data.numerators.length === 0) throw new Error('At least one numerator is required');
    if (data.denominator === undefined) throw new Error('Denominator is required');
    if (data.log2FcThreshold === undefined) throw new Error('Log2(FC) threshold is required');
    if (data.pAdjThreshold === undefined) throw new Error('Adjusted p-value threshold is required');
    if (data.minCounts === undefined) throw new Error('Min counts is required');
    if (data.minSamples === undefined) throw new Error('Min samples is required');

    return {
      defaultBlockLabel: deriveDefaultLabel(data),
      customBlockLabel: data.customBlockLabel,
      countsRef: data.countsRef,
      covariateRefs: data.covariateRefs,
      contrastFactor: data.contrastFactor,
      denominator: data.denominator,
      numerators: data.numerators,
      log2FcThreshold: data.log2FcThreshold,
      pAdjThreshold: data.pAdjThreshold,
      minCounts: data.minCounts,
      minSamples: data.minSamples,
    };
  })

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
    if (ctx.data.countsRef) return ctx.resultPool.getSpecByRef(ctx.data.countsRef);
    else return undefined;
  })

  .output('denominatorOptions', (ctx) => {
    if (!ctx.data.contrastFactor) return undefined;

    const pColumn = ctx.resultPool.getPColumnByRef(ctx.data.contrastFactor);
    if (!pColumn) return undefined;

    return ctx.createPFrame([pColumn]);
  })

  .output('errorLogs', (ctx) => {
    const pCols = ctx.outputs?.resolve('errorLogs')?.getPColumns();
    if (pCols === undefined) return undefined;
    return ctx.createPFrame(pCols);
  })

  // Returns a map of results
  .outputWithStatus('pt', (ctx) => {
    const pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined) return undefined;
    return createPlDataTableV2(ctx, pCols, ctx.data.tableState);
  })

  .output('sheets', (ctx) => {
    const pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined || pCols.length === 0) return undefined;

    // Get unique contrast values
    const contrasts = getUniquePartitionKeys(pCols[0].data)?.[0];
    if (!contrasts) return undefined;

    return [createPlDataTableSheet(ctx, pCols[0].spec.axesSpec[0], contrasts)];
  })

  .output('test', (ctx) => {
    const pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined || pCols.length === 0) return undefined;

    // Get unique contrast values
    const contrasts = getUniquePartitionKeys(pCols[0].data)?.[0];
    if (!contrasts) return undefined;

    return getUniquePartitionKeys(pCols[0].data);
  })

  .outputWithStatus('topTablePf', (ctx) => {
    let pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined) return undefined;

    pCols = filterPCols(pCols);

    return createPFrameForGraphs(ctx, pCols);
  })

  .output('topTablePcols', (ctx) => {
    let pCols = ctx.outputs?.resolve('topTablePf')?.getPColumns();
    if (pCols === undefined) return undefined;
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

    const datasetRef = ctx.data.countsRef;
    if (datasetRef === undefined) return undefined;

    const seqCols = ctx.resultPool.getAnchoredPColumns(
      { main: datasetRef },
      [{ axes: [{ anchor: 'main', idx: 1 }] }],
    );
    if (seqCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, [...msaCols, ...seqCols]);
  })

  .title(() => 'Differential abundance')

  .subtitle((ctx) => ctx.data.customBlockLabel || deriveDefaultLabel(ctx.data))

  .sections((_ctx) => ([
    { type: 'link' as const, href: '/' as const, label: 'Main' },
    { type: 'link' as const, href: '/graph' as const, label: 'Volcano plot' },
  ]))

  .done();

export type Platforma = typeof platforma;
export type BlockOutputs = InferOutputsType<typeof platforma>;
