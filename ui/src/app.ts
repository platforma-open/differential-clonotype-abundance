import { model } from '@platforma-open/milaboratories.differential-clonotype-abundance.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import MainPage from './pages/MainPage.vue';
import GraphPage from './pages/GraphPage.vue';
import { watch } from 'vue';

export const sdkPlugin = defineApp(model, () => {
  return {
    // defaultRoute: ,
    routes: {
      '/': () => MainPage,
      '/graph': () => GraphPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;

// Make sure labels are initialized
const unwatch = watch(sdkPlugin, ({ loaded }) => {
  if (!loaded) return;
  const app = useApp();
  app.model.args.customBlockLabel ??= '';
  app.model.args.defaultBlockLabel ??= 'Configure comparison';
  unwatch();
});
