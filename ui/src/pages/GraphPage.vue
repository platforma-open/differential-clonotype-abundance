<script setup lang="ts">
import type { PredefinedGraphOption } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';
import '@milaboratories/graph-maker/styles';
import type { PColumnIdAndSpec, PlSelectionModel } from '@platforma-sdk/model';
import { listToOptions, PlBtnGhost, PlDropdown, PlMultiSequenceAlignment, PlSlideModal } from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';
import { useApp } from '../app';
import {
  isSequenceColumn,
} from '../util';

const app = useApp();

const multipleSequenceAlignmentOpen = ref(false);

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

const selection = ref<PlSelectionModel>({
  axesSpec: [],
  selectedKeys: [],
});

// remove comparison from domain to send proper selection to msa component
const msaSelection = computed<PlSelectionModel>(() => {
  const newSelection: PlSelectionModel = JSON.parse(JSON.stringify(selection.value));
  if (newSelection.axesSpec?.[0]?.domain)
    delete newSelection.axesSpec[0].domain['pl7.app/differentialAbundance/comparison'];

  return newSelection;
});
</script>

<template>
  <GraphMaker
    v-model="app.model.ui.graphState"
    v-model:selection="selection"
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
      <PlBtnGhost
        icon="dna"
        @click.stop="() => (multipleSequenceAlignmentOpen = true)"
      >
        Multiple Sequence Alignment
      </PlBtnGhost>
    </template>
  </GraphMaker>
  <PlSlideModal
    v-model="multipleSequenceAlignmentOpen"
    width="100%"
    :close-on-outside-click="false"
  >
    <template #title>Multiple Sequence Alignment</template>
    <PlMultiSequenceAlignment
      v-model="app.model.ui.alignmentModel"
      :sequence-column-predicate="isSequenceColumn"
      :p-frame="app.model.outputs.msaPf"
      :selection="msaSelection"
    />
  </PlSlideModal>
</template>
