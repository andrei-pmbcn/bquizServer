/**
 * 
 * all functions with the name handle* contain the app-wide response to a
 * particular message and a global bus event issued to the app, to be handled
 * by individual components.
 */
import config from './config.js';

function handleWelcome(msg, vm) {
	vm.$store.commit('setGame', {
		phase: msg.phase,
		players: msg.players,
		settings: msg.settings,
		host: msg.host,
		currentQuestion: msg.question ? msg.question : null,
		finishTime: msg.finishTime ? msg.finishTime : null,
		correctAnswer: msg.correctAnswer ? msg.correctAnswer : null,
		commentary: msg.commentary ? msg.commentary : null,
		questions: msg.questions ? msg.questions : null,
		results: msg.results ? msg.results : null,
	});
	vm.$bus.emit('bus-welcome', msg);
}

function handleCode(msg, vm) {
	vm.$bus.emit('bus-code', msg);
}

function handlePlayerJoined(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));

	if (!msg.isReconnect) {
		// add the player to the player list
		game.players.push({
			nickname: msg.nickname,
			isPlaying: true,
			isReady: false,
			hasAnswered: false,
			hasFinished: false,
			isConnected: true,
		});
	} else {
		// mark the player as connected
		var player = game.players.find(x => x.nickname === msg.nickname);
		player.isConnected = true;
	}
	vm.$store.commit('setGame', game);

	vm.$bus.emit('bus-player-joined', msg);
}

function handlePlayerLeft(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));
	var player = game.players.find(x => x.nickname === msg.nickname);
	if (!msg.isDisconnect) {
		// remove the player from the player list
		game.players.splice(game.players.indexOf(player), 1);
	} else {
		player.isConnected = false;
	}
	vm.$store.commit('setGame', game);
	
	vm.$bus.emit('bus-player-left', msg);
}

function handlePlayerReady(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));
	var player = game.players.find(x => x.nickname === msg.nickname);
	player.isReady = true;
	vm.$store.commit('setGame', game);
	
	vm.$bus.emit('bus-player-ready', msg);
}

function handlePlayerNotReady(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));
	var player = game.players.find(x => x.nickname === msg.nickname);
	player.isReady = false;
	vm.$store.commit('setGame', game);

	vm.$bus.emit('bus-player-not-ready', msg);
}

function handleQinstStartCountdown(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));
	game.phase = 'ready';
	vm.$store.commit('setGame', game);

	vm.$bus.emit('bus-qinst-start-countdown', msg);
}

function handleQinstCancelCountdown(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));
	game.phase = 'prep';
	vm.$store.commit('setGame', game);

	vm.$bus.emit('bus-qinst-cancel-countdown', msg);
}

function handleQinstActive(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));
	game.currentQuestion = msg.question;
	game.finishTime = msg.finishTime;
	game.correctAnswer = msg.correctAnswer;
	game.commentary = msg.commentary;
	vm.$store.commit('setGame', game);
	
	vm.$bus.emit('bus-qinst-active', msg);
}

function handleAnswerFeedback(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));
	if (msg.questionIndex === game.currentQuestion.index) {	
		game.correctAnswer = msg.correctAnswer;
		game.commentary = msg.commentary;
		var player = game.players.find(
			x => x.nickname === vm.$store.state.nickname);
		player.hasAnswered = true;
		vm.$store.commit('setGame', game);

		vm.$bus.emit('bus-answer-feedback', msg);
	}
}

function handleAnswerNotice(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));
	if (msg.questionIndex === game.currentQuestion.index) {
		var player = game.players.find(x => x.nickname === msg.nickname);
		player.answers.push({
			questionIndex: msg.questionIndex,
			answer: msg.answer,
		});
		vm.$store.commit('setGame', game);

		vm.$bus.emit('bus-answer-notice', msg);
	}
}

function handleQuestion(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));
	game.currentQuestion = msg.question;
	game.finishTime = msg.finishTime;
	game.correctAnswer = msg.correctAnswer;
	game.commentary = msg.commentary;
	vm.$store.commit('setGame', game);

	vm.$bus.emit('bus-question', msg);
}

function handlePlayerResults(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));
	game.questions = msg.questions;
	game.results = [{
		nickname: vm.$store.state.nickname,
		answers: msg.answers,	
	}];
	vm.$store.commit('setGame', game);

	vm.$bus.emit('bus-player-results', msg);
}

function handleQinstEnd(msg, vm) {
	var game = JSON.parse(JSON.stringify(vm.$store.state.game));
	game.questions = msg.questions;
	game.results = msg.results;
	vm.$store.commit('setGame', game);

	vm.$bus.emit('bus-qinst-end', msg);
}

function handleConnectionClosed(msg, vm) {
	vm.$bus.emit('bus-ws-connection-closed', msg);
}

function handleError(msg, vm) {
	vm.$bus.emit('bus-error', msg);
}

export default function(vm) {
	vm.$store.commit('setFlag', {key: 'isWebSocketOpen', value: false});

	var serverStr;
	if (window.location.protocol === 'https:') {
		serverStr = 'wss://' + config.webSocketHost
			+ ':' + config.webSocketPort + '/';
	} else {
		serverStr = 'ws://' + config.webSocketHost
			+ ':' + config.webSocketPort + '/';
	}

	vm.$webSocket = new window.WebSocket(serverStr);

	function onopen() {
		vm.$store.commit('setFlag', {key: 'isWebSocketOpen', value: true});
	}

	function onmessage(evt) {
		const msg = JSON.parse(evt.data);
		switch (msg.type) {
			case 'welcome':
				handleWelcome(msg, vm);
				break;
			case 'code':
				handleCode(msg, vm);
				break;
			case 'playerJoined':
				handlePlayerJoined(msg, vm);
				break;
			case 'playerLeft':
				handlePlayerLeft(msg, vm);
				break;
			case 'playerReady':
				handlePlayerReady(msg, vm);
				break;
			case 'playerNotReady':
				handlePlayerNotReady(msg, vm);
				break;
			case 'qinstStartCountdown':
				handleQinstStartCountdown(msg, vm);
				break;
			case 'qinstCancelCountdown':
				handleQinstCancelCountdown(msg, vm);
				break;
			case 'qinstActive':
				handleQinstActive(msg, vm);
				break;
			case 'answerFeedback':
				handleAnswerFeedback(msg, vm);
				break;
			case 'answerNotice':
				handleAnswerNotice(msg, vm);
				break;
			case 'question':
				handleQuestion(msg, vm);
				break;
			case 'playerResults':
				handlePlayerResults(msg, vm);
				break;
			case 'qinstEnd':
				handleQinstEnd(msg, vm);
				break;
			case 'error':
				handleError(msg, vm);
				break;
			default:
				handleError({
					type: 'error',
					errtype: 'InvalidMessage',
					responseTo: msg.type,
					error: "Tipul '" + msg.type + "' al mesajului trimis de "
						+ "către server este invalid",
						//[I18N]
					doesDisplay: true,
				}, vm);
				break;
		}
	}

	function onerror() {
		var msg = {
			error: new Date().toTimeString().substring(0,8) + ": "
				+ "A apărut o eroare în conexiunea websocket. Nu puteți "
				+ "porni sau continua jocuri."
		};

		vm.$bus.emit('bus-ws-error', msg);
		//[TODO] Do all websocket errors close the websocket connection?
		vm.$store.commit('setFlag', {key: 'isWebSocketOpen', value: false});
	}

	function onclose() {
		//vm.$bus.emit('bus-ws-close');
		vm.$store.commit('setFlag', {key: 'isWebSocketOpen', value: false});
	}

	vm.$webSocket.onopen = onopen;
	vm.$webSocket.onmessage = onmessage;
	vm.$webSocket.onclose = onclose;
	vm.$webSocket.onerror = onerror;
}
