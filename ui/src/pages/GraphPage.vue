<script setup lang="ts">
import type { PredefinedGraphOption } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';
import '@milaboratories/graph-maker/styles';
import type { PColumnIdAndSpec } from '@platforma-sdk/model';
import { listToOptions, PlDropdown } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';

const app = useApp();

function getDefaultOptions(topTablePcols?: PColumnIdAndSpec[]) {
  if (!topTablePcols) {
    return undefined;
  }

  function getIndex(name: string, pcols: PColumnIdAndSpec[]): number {
    return pcols.findIndex((p) => p.spec.name === name);
  }

  const defaults: PredefinedGraphOption<'scatterplot-umap'>[] = [
    {
      inputName: 'x',
      selectedSource: topTablePcols[getIndex('pl7.app/differentialAbundance/log2foldchange',
        topTablePcols)].spec,
    },
    {
      inputName: 'y',
      selectedSource: topTablePcols[getIndex('pl7.app/differentialAbundance/minlog10padj',
        topTablePcols)].spec,
    },
    {
      inputName: 'grouping',
      selectedSource: topTablePcols[getIndex('pl7.app/differentialAbundance/regulationDirection',
        topTablePcols)].spec,
    },
    // {
    //   inputName: 'label',
    //   selectedSource: topTablePcols[getIndex('pl7.app/differentialAbundance/log2foldchange',
    //     topTablePcols)].spec.axesSpec[0],
    // },
    {
      inputName: 'tooltipContent',
      selectedSource: topTablePcols[getIndex('pl7.app/differentialAbundance/log2foldchange',
        topTablePcols)].spec.axesSpec[0],
    },
  ];

  return defaults;
}

const defaults = computed(() => getDefaultOptions(app.model.outputs.topTablePcols));

// Generate list of comparisons with all possible numerator x denominator combinations
const comparisonOptions = computed(() => {
  const options: string[] = [];
  if (app.model.args.numerators.length !== 0
    && app.model.args.denominator !== undefined) {
    for (const num of app.model.args.numerators) {
      options.push(num + ' - vs - ' + app.model.args.denominator);
    }
  }
  return listToOptions(options);
});

</script>

<template>
  <GraphMaker
    v-model="app.model.ui.graphState"
    :data-state-key="app.model.args.countsRef"
    chartType="scatterplot-umap"
    :p-frame="app.model.outputs.topTablePf"
    :default-options="defaults"
  >
    <template #titleLineSlot>
      <PlDropdown
        v-model="app.model.ui.comparison" :options="comparisonOptions"
        label="Comparison" :style="{ width: '300px' }"
      />
    </template>
  </GraphMaker>
</template>
