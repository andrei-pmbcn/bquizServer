import Vue from 'vue';
import Bus from 'vue-bus';
import App from './App.vue';
import store from './store.js';
import loadWebsocket from './websocket.js';

Vue.use(Bus);

export const vm = new Vue({
  store,
  render: h => h(App)
}).$mount('#bquiz');

loadWebsocket(vm);

/*** API functions ***/
//[TODO]
// eslint-disable-next-line
export { setupUser } from './api.js';
