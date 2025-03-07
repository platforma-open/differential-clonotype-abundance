import { model } from '@platforma-open/milaboratories.differential-clonotype-abundance.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import MainPage from './pages/MainPage.vue';
import GraphPage from './pages/GraphPage.vue';

export const sdkPlugin = defineApp(model, () => {
  return {
    // defaultRoute: ,
    routes: {
      '/': () => MainPage,
      // '/graph': () => GraphPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
