/**
 * The Vuex store of the application; contains the following variables:
 *
 * quiz: the current quiz being created or edited
 * game: the quiz being selected for play
 * username: the user's username
 * password: the user's password
 * locale: the user's locale, which comprises their language and other details
 * flags: a set of boolean flags used throughout the application
 *   isWebSocketOpen: whether the websocket connection is open
 */

import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex);

export default new Vuex.Store({
	strict: process.env.NODE_ENV !== 'production',
	state: {
		quiz: null,
		game: null,
		nickname: null,
		username: null,
		password: null,
		locale: 'ro', //[TODO]
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
		setNickname(state, nickname) {
			state.nickname = nickname;
		},
		setupUser(state, settings) {
			state.username = settings.username;
			state.password = settings.password;
			state.locale = settings.locale;
		},
		setFlag: (state, payload) => {
			if (state.flags.hasOwnProperty(payload.key)) {
				state.flags[payload.key] = payload.value;
			} else {
				throw 'invalid flag in store.mutations.setFlag';
			}
		},
	},
	actions: {

	}
})

