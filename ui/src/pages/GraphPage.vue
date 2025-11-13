<script setup lang="ts">
import type { PredefinedGraphOption } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';
import '@milaboratories/graph-maker/styles';
import type { PColumnIdAndSpec, PlSelectionModel } from '@platforma-sdk/model';
import { PlBtnGhost, PlSlideModal } from '@platforma-sdk/ui-vue';
import { PlMultiSequenceAlignment } from '@milaboratories/multi-sequence-alignment';
import { computed, ref } from 'vue';
import { useApp } from '../app';
import {
  isSequenceColumn,
} from '../util';

const app = useApp();

const multipleSequenceAlignmentOpen = ref(false);

function getIndex(name: string, pcols: PColumnIdAndSpec[]): number {
  return pcols.findIndex((p) => p.spec.name === name);
}

// Find out data type of the first column
let dataType: 'rna-seq' | 'differentialAbundance' | undefined;
if (app.model.outputs.topTablePcols !== undefined) {
  if (getIndex('pl7.app/rna-seq/log2foldchange', app.model.outputs.topTablePcols) !== -1) {
    dataType = 'rna-seq';
  } else if (getIndex('pl7.app/differentialAbundance/log2foldchange', app.model.outputs.topTablePcols) !== -1) {
    dataType = 'differentialAbundance';
  }
}

function getDefaultOptions(dataType: 'rna-seq' | 'differentialAbundance' | undefined, topTablePcols?: PColumnIdAndSpec[]) {
  if (!topTablePcols || dataType === undefined) {
    return undefined;
  }

  const defaults: PredefinedGraphOption<'scatterplot-umap'>[] = [
    {
      inputName: 'x',
      selectedSource: topTablePcols[getIndex('pl7.app/' + dataType + '/log2foldchange',
        topTablePcols)].spec,
    },
    {
      inputName: 'y',
      selectedSource: topTablePcols[getIndex('pl7.app/' + dataType + '/minlog10padj',
        topTablePcols)].spec,
    },
    {
      inputName: 'grouping',
      selectedSource: topTablePcols[getIndex('pl7.app/' + dataType + '/regulationDirection',
        topTablePcols)].spec,
    },
    // Contrast
    {
      inputName: 'tabBy',
      selectedSource: topTablePcols[getIndex('pl7.app/' + dataType + '/log2foldchange',
        topTablePcols)].spec.axesSpec[0],
    },
  ];

  if (dataType == 'rna-seq') {
    defaults.push({
      inputName: 'label',
      selectedSource: topTablePcols[getIndex('pl7.app/rna-seq/genesymbol',
        topTablePcols)].spec,
    });
    defaults.push({
      inputName: 'tooltipContent',
      selectedSource: topTablePcols[getIndex('pl7.app/rna-seq/genesymbol',
        topTablePcols)].spec,
    });
  } else {
    // Clonotype ID
    defaults.push({
      inputName: 'tooltipContent',
      selectedSource: topTablePcols[getIndex('pl7.app/' + dataType + '/log2foldchange',
        topTablePcols)].spec.axesSpec[1],
    });
  }

  return defaults;
}

const defaults = computed(() => getDefaultOptions(dataType, app.model.outputs.topTablePcols));

const selection = ref<PlSelectionModel>({
  axesSpec: [],
  selectedKeys: [],
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
      <PlBtnGhost
        v-if="dataType === 'differentialAbundance'"
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
      :selection="selection"
    />
  </PlSlideModal>
</template>
