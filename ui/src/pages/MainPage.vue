<script setup lang="ts">
import { PFrameImpl } from '@platforma-sdk/model';
import {
  listToOptions,
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
import { computed, ref, watch } from 'vue';
import { useApp } from '../app';
import ErrorBoundary from '../components/ErrorBoundary.vue';

const app = useApp();

const tableSettings = usePlDataTableSettingsV2({
  model: () => app.model.outputs.pt,
});

const settingsAreShown = ref(app.model.outputs.datasetSpec === undefined);
const showSettings = () => {
  settingsAreShown.value = true;
};

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

watch(() => [app.model.args.numerators, app.model.args.denominator], (_) => {
  if (!app.model.ui.comparison && (comparisonOptions.value.length !== 0)) {
    app.model.ui.comparison = comparisonOptions.value[0].value;
  }
});

// Make sure numerator and denominator are reset when contrast factor is changed
watch(() => [app.model.args.contrastFactor], (_) => {
  app.model.args.numerators = [];
  app.model.args.denominator = undefined;
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
  <PlBlockPage>
    <template #title>Differential Clonotype Abundance</template>
    <template #append>
      <PlDropdown
        v-model="app.model.ui.comparison"
        :options="comparisonOptions"
        label="Comparison" :style="{ width: '150' }"
      >
        <template #tooltip>
          Select the specific Numerator - vs - Denominator comparison to be shown in table and plots
        </template>
      </PlDropdown>
      <PlBtnGhost @click.stop="showSettings">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>
    <PlAlert v-if="errorLogs.value !== undefined" type="warn" icon>
      {{ errorLogs.value }}
    </PlAlert>
    <ErrorBoundary>
      <PlAgDataTableV2
        v-model="app.model.ui.tableState"
        :settings="tableSettings"
        show-columns-panel
        show-export-button
        disable-filters-panel
      />
    </ErrorBoundary>
    <PlSlideModal v-model="settingsAreShown">
      <template #title>Settings</template>
      <PlDropdownRef
        v-model="app.model.args.countsRef" :options="app.model.outputs.countsOptions"
        label="Select dataset"
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
</template>
