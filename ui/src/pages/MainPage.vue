<script setup lang="ts">
import { PlMultiSequenceAlignment } from "@milaboratories/multi-sequence-alignment";
import { deriveDefaultLabel } from "@platforma-open/milaboratories.differential-clonotype-abundance.model";
import type { PlSelectionModel } from "@platforma-sdk/model";
import { PFrameImpl, plRefsEqual } from "@platforma-sdk/model";
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
} from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { useApp } from "../app";
import ErrorBoundary from "../components/ErrorBoundary.vue";
import { isSequenceColumn } from "../util";

const app = useApp();

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
  //         reference: app.model.data.log2FcThreshold,
  //       },
  //     };
  //   }

  //   // Filter for padj columns (<= pAdjThreshold)
  //   if (columnName.endsWith('/padj')) {
  //     return {
  //       default: {
  //         type: 'number_lessThanOrEqualTo',
  //         reference: app.model.data.pAdjThreshold,
  //       },
  //     };
  //   }

  //   return {};
  // },
});

const settingsAreShown = ref(app.model.outputs.datasetSpec === undefined);
const showSettings = () => {
  settingsAreShown.value = true;
};

const dataType = computed<"rna-seq" | "differentialAbundance" | undefined>(() => {
  const pcols = app.model.outputs.topTablePcols;
  if (!pcols) {
    return undefined;
  }
  if (pcols.some((p) => p.spec.name === "pl7.app/rna-seq/log2foldchange")) {
    return "rna-seq";
  }
  if (pcols.some((p) => p.spec.name === "pl7.app/differentialAbundance/log2foldchange")) {
    return "differentialAbundance";
  }
  return undefined;
});

const covariateOptions = computed(() => {
  return (
    app.model.outputs.metadataOptions?.map((v) => ({
      value: v.ref,
      label: v.label,
    })) ?? []
  );
});

const contrastFactorOptions = computed(() => {
  return app.model.data.covariateRefs.map((ref) => ({
    value: ref,
    label: covariateOptions.value.find((m) => m.value.name === ref.name)?.label ?? "",
  }));
});

// Get all possible numerator/denominator values
const numeratorOptions = useWatchFetch(
  () => app.model.outputs.denominatorOptions,
  async (pframeHandle) => {
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
  },
);

// Only options not selected as numerators[] are accepted as denominator
const denominatorOptions = computed(() => {
  return numeratorOptions.value?.filter((op) => !app.model.data.numerators.includes(op.value));
});

// Reset numerator + denominator when the user changes the contrast factor.
// Skip the initial `undefined -> value` transition that fires when
// `upgradeLegacy` hydrates persisted state, otherwise the watcher would wipe
// the legacy numerators/denominator right after they were restored.
watch(
  () => app.model.data.contrastFactor,
  (newRef, oldRef) => {
    if (oldRef === undefined) return;
    if (newRef !== undefined && plRefsEqual(oldRef, newRef)) return;
    app.model.data.numerators = [];
    app.model.data.denominator = undefined;
  },
);

// If the user removes the covariate that was selected as contrast factor,
// the current selection is no longer a valid option — clear it. The watcher
// above then clears numerators/denominator as a side-effect.
watch(contrastFactorOptions, (options) => {
  const current = app.model.data.contrastFactor;
  if (current === undefined) return;
  if (!options.some((o) => plRefsEqual(o.value, current))) {
    app.model.data.contrastFactor = undefined;
  }
});

// Backstop: drop any numerator/denominator values that aren't in the current
// options list. Defends against race conditions when the user changes the
// contrast factor and picks new values before the async option fetch settles —
// stale entries from the previous contrast factor get pruned here.
watch(
  () => numeratorOptions.value,
  (options) => {
    if (options === undefined) return; // not yet loaded
    const valid = new Set(options.map((o) => o.value));
    const pruned = app.model.data.numerators.filter((n) => valid.has(n));
    if (pruned.length !== app.model.data.numerators.length) {
      app.model.data.numerators = pruned;
    }
    if (app.model.data.denominator !== undefined && !valid.has(app.model.data.denominator)) {
      app.model.data.denominator = undefined;
    }
  },
);

// @TODO: re-enable together with the `filtersConfig` block above. The reset
// only makes sense when changing thresholds also changes the default filters
// applied to the table; with `filtersConfig` commented out it has no net
// benefit and only wipes the user's sort / column widths.
// watch(
//   () => [app.model.data.log2FcThreshold, app.model.data.pAdjThreshold],
//   () => {
//     app.model.data.tableState = createPlDataTableStateV2();
//   },
// );

// Get error logs
const errorLogs = useWatchFetch(
  () => app.model.outputs.errorLogs,
  async (pframeHandle) => {
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
    return response.values.data.join("\n");
  },
);

const defaultLabel = computed(() => deriveDefaultLabel(app.model.data));
</script>

<template>
  <PlBlockPage
    v-model:subtitle="app.model.data.customBlockLabel"
    :subtitle-placeholder="defaultLabel"
    title="Differential Abundance"
  >
    <template #append>
      <PlBtnGhost
        v-if="dataType === 'differentialAbundance'"
        icon="dna"
        @click.stop="() => (multipleSequenceAlignmentOpen = true)"
      >
        Multiple Sequence Alignment
      </PlBtnGhost>
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
        v-model="app.model.data.tableState"
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
        v-model="app.model.data.countsRef"
        :options="app.model.outputs.countsOptions"
        label="Select abundance"
        :required="true"
      />
      <PlDropdownMulti
        v-model="app.model.data.covariateRefs"
        :options="covariateOptions"
        label="Design"
        :required="true"
      />
      <PlDropdown
        v-model="app.model.data.contrastFactor"
        :options="contrastFactorOptions"
        label="Contrast factor"
        :required="true"
      />
      <PlDropdownMulti
        v-model="app.model.data.numerators"
        :options="numeratorOptions.value"
        label="Numerator"
        :required="true"
      >
        <template #tooltip>
          Calculate a contrast per each one of the selected Numerators versus the selected
          control/baseline
        </template>
      </PlDropdownMulti>
      <PlDropdown
        v-model="app.model.data.denominator"
        :options="denominatorOptions"
        label="Denominator"
        :required="true"
      />
      <!-- Content hidden until you click THRESHOLD PARAMETERS -->
      <PlAccordionSection label="THRESHOLD PARAMETERS">
        <PlRow>
          <PlNumberField
            v-model="app.model.data.log2FcThreshold"
            label="Log2(FC)"
            :minValue="0"
            :step="0.1"
          >
            <template #tooltip>
              Select a valid absolute log2(FC) threshold for identifying significant DEGs. Genes
              meeting this criterion will be used as input for downstream analyses.
            </template>
          </PlNumberField>
          <PlNumberField
            v-model="app.model.data.pAdjThreshold"
            label="Adjusted p-value"
            :minValue="0"
            :maxValue="1"
            :step="0.01"
          />
        </PlRow>
        <!-- Add warnings if selected threshold are out of most commonly used bounds -->
        <PlAlert v-if="app.model.data.pAdjThreshold > 0.05" type="warn">
          {{
            "Warning: The selected adjusted p-value threshold is higher than the most commonly used 0.05"
          }}
        </PlAlert>
        <PlAlert v-if="app.model.data.log2FcThreshold < 0.6" type="warn">
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
      v-model="app.model.data.alignmentModel"
      :sequence-column-predicate="isSequenceColumn"
      :p-frame="app.model.outputs.msaPf"
      :selection="selection"
    />
  </PlSlideModal>
</template>
