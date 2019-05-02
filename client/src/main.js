import Vue from 'vue';
import App from './App.vue';
import store from './store';

export const vm = new Vue({
  store,
  render: h => h(App)
}).$mount('#bquiz');

/*** API functions ***/
//[TODO]
// eslint-disable-next-line
export const setupUser = function(username, password, locale = 'ro',
		store = store) {
	store.setupUser({username, password, locale});
}
