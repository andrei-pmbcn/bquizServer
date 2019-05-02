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
			:quiz="quiz"
			@visit-list="visitList"
		></quiz-screen>
		<game-screen
			v-if="screen === SCREEN_GAME"
			:qinstCode="qinstCode"
			:game="game"
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
import { mapState, mapMutations } from 'vuex';

import MenuScreen from './components/MenuScreen.vue'
import ListScreen from './components/ListScreen.vue'
import QuizScreen from './components/QuizScreen.vue'
import GameScreen from './components/GameScreen.vue'
import AdminScreen from './components/AdminScreen.vue'

import config from './config.js';

function visitMenu(evt) {
	console.log(evt);
	console.log("visitMenu");
	this.game = null;
	this.screen = this.SCREEN_MENU;
}

function visitCreation(evt) {
	console.log(evt);
	this.qinstCode = null;
	this.game = null;
	this.screen = this.SCREEN_QUIZ;
}

function visitGame(evt) {
	console.log(evt);
	this.qinstCode = evt;
	
	this.screen = this.SCREEN_GAME;
}

function handleWelcome(msg) {
	this.setGame({
		phase: msg.phase,
		players: msg.players,
		settings: msg.settings,
		currentQuestion: msg.question ? msg.question : null,
		finishTime: msg.finishTime ? msg.finishTime : null,
		correctAnswer: msg.correctAnswer ? msg.correctAnswer : null,
		commentary: msg.commentary ? msg.commentary : null,
		questions: msg.questions ? msg.questions : null,
		results: msg.results ? msg.results : null,
	});
	this.$emit('visit-game', msg);
}

function handleError(msg) {
	this.wsErrorMessages.push(msg);
	if (this.wsErrorMessages.length > 0) {
		$('#modal-error').modal('show');
	}
}

function clearError() {
	this.wsErrorMessages.shift();
	if (this.wsErrorMessages.length === 0) {
		$('#modal-error').modal('hide');
	}
}

function loadWebSocket() {
	this.setFlag({key: 'isWebSocketOpen', value: false});

	var serverStr;
	if (window.location.protocol === 'https:') {
		serverStr = 'wss://' + config.webSocketHost
			+ ':' + config.webSocketPort + '/';
	} else {
		serverStr = 'ws://' + config.webSocketHost
			+ ':' + config.webSocketPort + '/';
	}

	this.setWebSocket(new WebSocket(serverStr));
	function onmessage(evt) {
		const msg = JSON.parse(evt.data);
		switch (msg.type) {
			case 'welcome':
				this.handleWelcome(msg);
				break;
			case 'error':
				this.handleError(msg);
				break;
		}
	}

	function onopen() {
		this.setFlag({key: 'isWebSocketOpen', value: true});
	}

	function onerror() {
		this.handleError({
			error: new Date().toTimeString().substring(0,8) + ": "
				+ "A apărut o eroare în conexiunea websocket. Nu puteți "
				+ "porni sau continua jocuri."
		});

		//[TODO] Do all websocket errors close the websocket connection?
		this.setFlag({key: 'isWebSocketOpen', value: false});
	}

	function onclose() {
		this.setFlag('isWebSocketOpen', false);
	}

	this.webSocket.onopen = onopen.bind(this);
	this.webSocket.onmessage = onmessage.bind(this);
	this.webSocket.onerror = onerror.bind(this);
	this.webSocket.onclose = onclose.bind(this);
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
		...mapState(['webSocket', 'flags']),
		hasErrors: function() {
			return this.wsErrorMessages.length > 0;
		}
	},
	methods: {
		...mapMutations(['setWebSocket', 'setGame', 'setFlag']),
		visitCreation,
		visitGame,
		visitMenu,
		loadWebSocket,

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
	mounted: function() {
		this.loadWebSocket();
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
