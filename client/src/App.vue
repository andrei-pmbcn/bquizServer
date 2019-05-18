<template>
	<div id="bquiz" class="container">
		<!-- error modal -->
		<div id="modal-error" class="modal" tabindex="-1" role="dialog">
			<div class="modal-dialog modal-dialog-centered" role="document">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">
							Eroare
						</h5>
						<button
							type="button"
							class="close"
							aria-label="Close"
							@click="clearError"
						><span aria-hidden="true">&times;</span>
						</button>
					</div>
					<div class="modal-body">
						{{ wsErrorMessages.length ?
							wsErrorMessages[0].error : "" }}
					</div>
				</div>
			</div>
		</div>
		<menu-screen
			v-if="screen === SCREEN_MENU"
			@visit-creation="visitCreation"
			@visit-game="visitGame"
		></menu-screen>
		<list-screen
			v-if="screen === SCREEN_LIST"
			@visit-menu="visitMenu"
		></list-screen>
		<quiz-screen
			v-if="screen === SCREEN_QUIZ"
			@visit-list="visitList"
		></quiz-screen>
		<game-screen
			v-if="screen === SCREEN_GAME"
			:qinstCode="qinstCode"
			@visit-menu="visitMenu"
		></game-screen>
		<admin-screen
			v-if="screen === SCREEN_ADMIN"
			@visit-menu="visitMenu"
		></admin-screen>
	</div>
</template>

<script>
//create quiz
//play quiz
//browse & edit own quizzes

//axios

import 'bootstrap/dist/css/bootstrap.min.css';
import $ from 'jquery/dist/jquery.slim.min.js';
//import 'bootstrap/dist/js/bootstrap.min.js';

import { mapState, mapMutations } from 'vuex';

import MenuScreen from './components/MenuScreen.vue'
import ListScreen from './components/ListScreen.vue'
import QuizScreen from './components/QuizScreen.vue'
import GameScreen from './components/GameScreen.vue'
import AdminScreen from './components/AdminScreen.vue'

function visitMenu() {
	this.screen = this.SCREEN_MENU;
}

function visitCreation() {
	this.qinstCode = null;
	this.screen = this.SCREEN_QUIZ;
}

function visitList() {
	this.qinstCode = null;
	this.screen = this.SCREEN_LIST;
}

function visitGame(evt) {
	console.log(evt);
	this.qinstCode = evt;
	
	this.screen = this.SCREEN_GAME;
}

function handleWelcome(msg) {
	this.$emit('visit-game', msg);
}

// when a message arrives from the server, the app as a whole should respond
// to it, and it should emit events for the various components to respond to

function handleError(msg) {
	this.wsErrorMessages.push(msg);
	if (this.wsErrorMessages.length > 0) {
		//$('#modal-error').modal('show'); //[TODO]
	}
}

function clearError() {
	this.wsErrorMessages.shift();
	if (this.wsErrorMessages.length === 0) {
		//$('#modal-error').modal('hide'); //[TODO]
	}
}

export default {
	name: 'bquiz',
	props: {
	},
	data: function() {
		return {
			screen: 1,

			wsErrorMessages: [],

			SCREEN_MENU: 1,
			SCREEN_LIST: 2,
			SCREEN_QUIZ: 3,
			SCREEN_GAME: 4,
			SCREEN_ADMIN: 5,
		}
	},
	computed: {
		//...mapState(['webSocket', 'flags']),
		hasErrors: function() {
			return this.wsErrorMessages.length > 0;
		}
	},
	methods: {
		...mapMutations([
			'setWebSocket',
			'configureWebSocket',
			'setGame',
			'setFlag',
		]),
		visitCreation,
		visitGame,
		visitMenu,
		visitList,

		handleWelcome,
		handleError,
		clearError,
	},
	components: {
		'menu-screen': MenuScreen,
		'list-screen': ListScreen,
		'quiz-screen': QuizScreen,
		'game-screen': GameScreen,
		'admin-screen': AdminScreen,
	},
	created() {
		this.$bus.on('bus-ws-error', handleError);
		this.$bus.on('bus-error', handleError);
		this.$bus.on('bus-welcome', handleWelcome);
	},

	beforeDestroy() {
		this.$bus.off('bus-ws-error', handleError);
		this.$bus.off('bus-error', handleError);
		this.$bus.off('bus-welcome', handleWelcome);
	},
}



</script>

<style>
#app {
	font-family: 'Avenir', Helvetica, Arial, sans-serif;
	text-align: center;
	color: #2c3e50;
	margin-top: 60px;
}

#input-quiz-id {
	width: 120px;
	text-align: center;
}
</style>
