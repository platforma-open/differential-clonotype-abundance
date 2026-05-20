import { platforma } from '@platforma-open/milaboratories.differential-clonotype-abundance.model';
import { defineAppV3 } from '@platforma-sdk/ui-vue';
import MainPage from './pages/MainPage.vue';
import GraphPage from './pages/GraphPage.vue';

export const sdkPlugin = defineAppV3(platforma, () => {
  return {
    routes: {
      '/': () => MainPage,
      '/graph': () => GraphPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
