import store from './store.js';

export const setupUser = function(username, password, locale = 'ro') {
	store.setupUser({username, password, locale});
}
