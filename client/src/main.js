import Vue from 'vue';
import Bus from 'vue-bus';
import App from './App.vue';
import store from './store.js';
import axios from 'axios';
import VueAxios from 'vue-axios';
import loadWebsocket from './websocket.js';
import { genRestUrlFromUri } from './util.js';

Vue.use(Bus);
Vue.use(VueAxios, axios);

export const vm = new Vue({
  store,
  render: h => h(App)
}).$mount('#bquiz');

loadWebsocket(vm);

/*** API functions ***/
//[TODO]
// eslint-disable-next-line
const setupUser = function(username, password, locale = 'ro') {
	vm.$store.commit('setupUser', {username, password, locale});
};

if (process.env.VUE_APP_DEFAULT_USERNAME) {
	setupUser(
		process.env.VUE_APP_DEFAULT_USERNAME,
		process.env.VUE_APP_DEFAULT_PASSWORD);
}

const logoff = function() {
	vm.axios.post(genRestUrlFromUri('/logoff'),
		

	)
}

export default {
	setupUser,
	logoff,
}

//export { setupUser } from './api.js';
