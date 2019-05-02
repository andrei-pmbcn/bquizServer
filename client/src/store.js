import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex);

export default new Vuex.Store({
	strict: process.env.NODE_ENV !== 'production',
	state: {
		quiz: null,
		game: null,
		username: null,
		password: null,
		locale: 'ro', //[TODO]
		webSocket: null,
		flags: {
			isWebSocketOpen: false,
		},
	},
	getters: {
		getFlag: (state) => (key) => {
			return state.flags[key];
		}
	},
	mutations: {
		setQuiz(state, quiz) {
			state.quiz = quiz;
		},
		setGame(state, game) {
			state.game = game;
		},
		setupUser(state, settings) {
			state.username = settings.username;
			state.password = settings.password;
			state.locale = settings.locale;
		},
		setWebSocket(state, webSocket) {
			state.webSocket = webSocket;
		},
		setFlag: (state, {key, value}) => {
			if (state.flags.hasOwnProperty(key)) {
				state.flags[key] = value;
			} else {
				throw 'invalid flag in store.mutations.setFlag';
			}
		},
	},
	actions: {

	}
})
