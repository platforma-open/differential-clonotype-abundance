<script setup lang="ts">
import { PlMultiSequenceAlignment } from '@milaboratories/multi-sequence-alignment';
import type { PlRef, PlSelectionModel } from '@platforma-sdk/model';
import { createPlDataTableStateV2, PFrameImpl, plRefsEqual } from '@platforma-sdk/model';
import {
  PlAccordionSection,
  PlAgDataTableV2,
  PlAlert,
  PlBlockPage,
  PlBtnGhost,
  PlDropdown,
  PlDropdownMulti,
  PlDropdownRef,
  PlMaskIcon24,
  PlNumberField,
  PlRow,
  PlSlideModal,
  usePlDataTableSettingsV2,
  useWatchFetch,
} from '@platforma-sdk/ui-vue';
import { computed, ref, watch, watchEffect } from 'vue';
import { useApp } from '../app';
import ErrorBoundary from '../components/ErrorBoundary.vue';
import {
  isSequenceColumn,
} from '../util';

const app = useApp();

// updating defaultBlockLabel
watchEffect(() => {
  // Derive label from contrast + comparison (numerators vs denominator) + thresholds
  if (app.model.args.denominator && app.model.args.numerators.length > 0) {
    const numeratorsPart = app.model.args.numerators.join(', ');
    const log2FC = app.model.args.log2FcThreshold;
    const pAdj = app.model.args.pAdjThreshold;
    app.model.args.defaultBlockLabel = `${numeratorsPart} vs ${app.model.args.denominator} (log2FC: ${log2FC}, pAdj: ${pAdj})`;
  } else {
    app.model.args.defaultBlockLabel = 'Configure comparison';
  }
});

const multipleSequenceAlignmentOpen = ref(false);

// With selection we will get the axis of cluster id
const selection = ref<PlSelectionModel>({
  axesSpec: [],
  selectedKeys: [],
});

const tableSettings = usePlDataTableSettingsV2({
  model: () => app.model.outputs.pt ?? undefined,
  sheets: () => app.model.outputs.sheets,
  // @TODO: uncomment with new absolute or min & max filter for log2FC
  // filtersConfig: ({ column }) => {
  //   // Apply default filters based on column names
  //   const columnName = column.spec.name;

  //   // Filter for log2foldchange columns (>= log2FcThreshold)
  //   if (columnName.endsWith('/log2foldchange')) {
  //     return {
  //       default: {
  //         type: 'number_greaterThanOrEqualTo',
  //         reference: app.model.args.log2FcThreshold,
  //       },
  //     };
  //   }

  //   // Filter for padj columns (<= pAdjThreshold)
  //   if (columnName.endsWith('/padj')) {
  //     return {
  //       default: {
  //         type: 'number_lessThanOrEqualTo',
  //         reference: app.model.args.pAdjThreshold,
  //       },
  //     };
  //   }

  //   return {};
  // },
});

// Update page title by dataset
function setInput(inputRef?: PlRef) {
  app.model.args.countsRef = inputRef;
  if (inputRef) {
    const mainLabel = app.model.outputs.countsOptions?.find((o) => plRefsEqual(o.ref, inputRef))?.label;
    if (mainLabel)
      app.model.ui.title = 'Differential abundance - ' + mainLabel;
  }
}

const settingsAreShown = ref(app.model.outputs.datasetSpec === undefined);
const showSettings = () => {
  settingsAreShown.value = true;
};

const dataType = computed<'rna-seq' | 'differentialAbundance' | undefined>(() => {
  const pcols = app.model.outputs.topTablePcols;
  if (!pcols) {
    return undefined;
  }
  if (pcols.some((p) => p.spec.name === 'pl7.app/rna-seq/log2foldchange')) {
    return 'rna-seq';
  }
  if (pcols.some((p) => p.spec.name === 'pl7.app/differentialAbundance/log2foldchange')) {
    return 'differentialAbundance';
  }
  return undefined;
});

const covariateOptions = computed(() => {
  return app.model.outputs.metadataOptions?.map((v) => ({
    value: v.ref,
    label: v.label,
  })) ?? [];
});

const contrastFactorOptions = computed(() => {
  return app.model.args.covariateRefs.map((ref) => ({
    value: ref,
    label: covariateOptions.value.find((m) => m.value.name === ref.name)?.label ?? '',
  }));
});

// Get all possible numerator/denominator values
const numeratorOptions = useWatchFetch(() => app.model.outputs.denominatorOptions, async (pframeHandle) => {
  if (!pframeHandle) {
    return undefined;
  }
  // Get ID of first pcolumn in the pframe (the only one we will access)
  const pFrame = new PFrameImpl(pframeHandle);
  const list = await pFrame.listColumns();
  const id = list?.[0].columnId;
  if (!id) {
    return undefined;
  }
  // Get unique values of that first pcolumn
  const response = await pFrame.getUniqueValues({ columnId: id, filters: [], limit: 1000000 });
  if (!response) {
    return undefined;
  }
  return [...response.values.data].map((v) => ({ value: String(v), label: String(v) }));
});

// Only options not selected as numerators[] are accepted as denominator
const denominatorOptions = computed(() => {
  return numeratorOptions.value?.filter((op) =>
    !app.model.args.numerators.includes(op.value));
});

// Make sure numerator and denominator are reset when contrast factor is changed
watch(() => [app.model.args.contrastFactor], (_) => {
  app.model.args.numerators = [];
  app.model.args.denominator = undefined;
});

// Reset table state when thresholds change to re-apply default filters
watch(() => [app.model.outputs.pt], () => {
  app.model.ui.tableState = createPlDataTableStateV2();
});

// Get error logs
const errorLogs = useWatchFetch(() => app.model.outputs.errorLogs, async (pframeHandle) => {
  if (!pframeHandle) {
    return undefined;
  }
  // Get ID of first pcolumn in the pframe (the only one we will access)
  const pFrame = new PFrameImpl(pframeHandle);
  const list = await pFrame.listColumns();
  const id = list?.[0].columnId;
  if (!id) {
    return undefined;
  }
  // Get unique values of that first pcolumn
  const response = await pFrame.getUniqueValues({ columnId: id, filters: [], limit: 1000000 });
  if (!response) {
    return undefined;
  }
  if (response.values.data.length === 0) {
    return undefined;
  }
  return response.values.data.join('\n');
});

</script>

<template>
  <PlBlockPage
    v-model:subtitle="app.model.args.customBlockLabel"
    :subtitle-placeholder="app.model.args.defaultBlockLabel"
    title="Differential Abundance"
  >
    <template #append>
      <PlBtnGhost @click.stop="showSettings">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
      <PlBtnGhost
        v-if="dataType === 'differentialAbundance'"
        icon="dna"
        @click.stop="() => (multipleSequenceAlignmentOpen = true)"
      >
        Multiple Sequence Alignment
      </PlBtnGhost>
    </template>
    <PlAlert v-if="errorLogs.value !== undefined" type="warn" icon>
      {{ errorLogs.value }}
    </PlAlert>
    <ErrorBoundary>
      <PlAgDataTableV2
        v-model="app.model.ui.tableState"
        v-model:selection="selection"
        :settings="tableSettings"
        not-ready-text="Data is not computed"
        show-columns-panel
        show-export-button
        no-rows-text="All results were filtered out by the defined threshold parameters"
      />
    </ErrorBoundary>
    <PlSlideModal v-model="settingsAreShown">
      <template #title>Settings</template>
      <PlDropdownRef
        v-model="app.model.args.countsRef" :options="app.model.outputs.countsOptions"
        label="Select dataset" @update:model-value="setInput"
      />
      <PlDropdownMulti v-model="app.model.args.covariateRefs" :options="covariateOptions" label="Design" />
      <PlDropdown v-model="app.model.args.contrastFactor" :options="contrastFactorOptions" label="Contrast factor" />
      <PlDropdownMulti v-model="app.model.args.numerators" :options="numeratorOptions.value" label="Numerator" >
        <template #tooltip>
          Calculate a contrast per each one of the selected Numerators versus the selected control/baseline
        </template>
      </PlDropdownMulti>
      <PlDropdown v-model="app.model.args.denominator" :options="denominatorOptions" label="Denominator" />
      <!-- Content hidden until you click THRESHOLD PARAMETERS -->
      <PlAccordionSection label="THRESHOLD PARAMETERS">
        <PlRow>
          <PlNumberField
            v-model="app.model.args.log2FcThreshold"
            label="Log2(FC)" :minValue="0" :step="0.1"
          >
            <template #tooltip>
              Select a valid absolute log2(FC) threshold for identifying
              significant DEGs. Genes meeting this criterion will be used as
              input for downstream analyses.
            </template>
          </PlNumberField>
          <PlNumberField
            v-model="app.model.args.pAdjThreshold"
            label="Adjusted p-value" :minValue="0" :maxValue="1" :step="0.01"
          />
        </PlRow>
        <!-- Add warnings if selected threshold are out of most commonly used bounds -->
        <PlAlert v-if="app.model.args.pAdjThreshold > 0.05" type="warn">
          {{ "Warning: The selected adjusted p-value threshold is higher than the most commonly used 0.05" }}
        </PlAlert>
        <PlAlert v-if="app.model.args.log2FcThreshold < 0.6" type="warn">
          {{ "Warning: The selected Log2(FC) threshold may be too low for most use cases" }}
        </PlAlert>
      </PlAccordionSection>
    </PlSlideModal>
  </PlBlockPage>
  <!-- Slide window with MSA -->
  <PlSlideModal
    v-model="multipleSequenceAlignmentOpen"
    width="100%"
    :close-on-outside-click="false"
  >
    <template #title>Multiple Sequence Alignment</template>
    <PlMultiSequenceAlignment
      v-if="dataType === 'differentialAbundance'"
      v-model="app.model.ui.alignmentModel"
      :sequence-column-predicate="isSequenceColumn"
      :p-frame="app.model.outputs.msaPf"
      :selection="selection"
    />
  </PlSlideModal>
</template>
