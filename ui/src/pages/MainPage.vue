<script setup lang="ts">
import type {
  PlDataTableSettings } from '@platforma-sdk/ui-vue';
import {
  listToOptions,
  PlAgDataTable,
  PlAgDataTableToolsPanel,
  PlBlockPage,
  PlBtnGhost,
  PlDropdown,
  PlDropdownMulti,
  PlDropdownRef,
  PlMaskIcon24,
  PlSlideModal,
  PlAccordionSection,
  PlNumberField,
  PlRow,
  PlAlert,
} from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
import { useApp } from '../app';
import ErrorBoundary from '../components/ErrorBoundary.vue';

const app = useApp();

const tableSettings = computed<PlDataTableSettings>(() => ({
  sourceType: 'ptable',
  pTable: app.model.outputs.pt,
}));

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

const numeratorOptions = computed(() => {
  return app.model.outputs.denominatorOptions?.map((v) => ({
    value: v,
    label: v,
  }));
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
      <!-- PlAgDataTableToolsPanel controls showing  Export column and filter-->
      <PlAgDataTableToolsPanel/>
      <PlBtnGhost @click.stop="showSettings">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>
    <ErrorBoundary>
      <PlAgDataTable
        v-model="app.model.ui.tableState"
        :settings="tableSettings"
        show-columns-panel
        show-export-button
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
      <PlDropdownMulti v-model="app.model.args.numerators" :options="numeratorOptions" label="Numerator" >
        <template #tooltip>
          Calculate a contrast per each one of the selected Numerators versus the selected control/baseline
        </template>
      </PlDropdownMulti>
      <PlDropdown v-model="app.model.args.denominator" :options="denominatorOptions" label="Denominator" />
      <!-- Content hidden until you click THRESHOLD PARAMETERS -->
      <PlAccordionSection label="THRESHOLD PARAMETERS">
        <PlRow>
          <PlNumberField
            v-model="app.model.args.log2FCThreshold"
            label="Log2(FC)" :minValue="0" :step="0.1"
          >
            <template #tooltip>
              Select a valid absolute log2(FC) threshold for identifying
              significant DEGs. Genes meeting this criterion will be used as
              input for downstream analyses.
            </template>
          </PlNumberField>
          <PlNumberField
            v-model="app.model.args.pAdjFCThreshold"
            label="Adjusted p-value" :minValue="0" :maxValue="1" :step="0.01"
          />
        </PlRow>
        <!-- Add warnings if selected threshold are out of most commonly used bounds -->
        <PlAlert v-if="app.model.args.pAdjFCThreshold > 0.05" type="warn">
          {{ "Warning: The selected adjusted p-value threshold is higher than the most commonly used 0.05" }}
        </PlAlert>
        <PlAlert v-if="app.model.args.log2FCThreshold < 0.6" type="warn">
          {{ "Warning: The selected Log2(FC) threshold may be too low for most use cases" }}
        </PlAlert>
      </PlAccordionSection>
    </PlSlideModal>
  </PlBlockPage>
</template>
