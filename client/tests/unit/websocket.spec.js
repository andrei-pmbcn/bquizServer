import { expect } from 'chai';
//import sinon from 'sinon';
import Vuex from 'vuex';
import Bus from 'vue-bus';
import { Server } from 'mock-socket';
import { mount, createLocalVue } from '@vue/test-utils';

import App from '@/App.vue';
import store from '@/store.js';
import config from '@/config.js';
import loadWebSocket from '@/websocket.js';

describe("websocket messages", function() {
	var msgWelcomeCommon = {
		type: 'welcome',
		players: [
			{
				nickname: 'nick1',
				isPlaying: false,
				isReady: false,
				hasAnswered: false,
				hasFinished: false,
				isConnected: true,
				answers: [],
			},
			{
				nickname: 'nick2',
				isPlaying: true,
				isReady: false,
				hasAnswered: false,
				hasFinished: false,
				isConnected: true,
				answers: [],
			},
		],
		host: 'nick1',
		settings: {
			time: 15,
			isTimePerQuestion: true,
			doesAdvanceTogether: true,
			doesHostPlay: false,
		},
	};
	
	var msgWelcomeQuestions = [
		{
			identifier: 1,
			index: 1,
			text: 'question1',
			correctAnswer: [1],
			commentary: 'commentary1',
			isMultipleResponse: false,
			time: null,
			points: 1,
			choices: [
				{
					identifier: 1,
					index: 1,
					text: 'question1.choice1',
				},
				{
					identifier: 2,
					index: 2,
					text: 'question1.choice2',
				},
			],
		},
		{
			identifier: 2,
			index: 2,
			text: 'question2',
			correctAnswer: [2],
			commentary: 'commentary2',
			isMultipleResponse: false,
			time: null,
			points: 2,
			choices: [
				{
					identifier: 1,
					index: 1,
					text: 'question2.choice1',
				},
				{
					identifier: 2,
					index: 2,
					text: 'question2.choice2',
				},
			],
		}
	]
	var msgWelcomeCurrentQuestion = JSON.parse(JSON.stringify(
		msgWelcomeQuestions[0]));
	delete msgWelcomeCurrentQuestion.correctAnswer;
	delete msgWelcomeCurrentQuestion.commentary;

	var msgWelcomePrep = {
		...msgWelcomeCommon,
		phase: 'prep',
	};

	var msgWelcomeActive = {
		...msgWelcomeCommon,
		phase: 'active',
		question: msgWelcomeCurrentQuestion,
		finishTime: new Date(),
		correctAnswer: [1],
		commentary: 'commentary1',
	};

	var msgWelcomeCommonFinished = JSON.parse(JSON.stringify(msgWelcomeCommon));
	msgWelcomeCommonFinished.players[0].hasFinished = true;
	msgWelcomeCommonFinished.players[1].hasFinished = true;

	var msgWelcomeFinished = {
		...msgWelcomeCommonFinished,
		phase: 'finished',
		questions: msgWelcomeQuestions,
		results: [
			{
				nickname: 'nick1',
				answers: [],
			},
			{
				nickname: 'nick2',
				answers: [
					{
						questionIndex: 1,
						answer: [1],
					},
					{
						questionIndex: 2,
						answer: [2],
					},
				],
			}
		],
	}

	beforeEach(function() {
		var localVue = createLocalVue();
		localVue.use(Vuex);
		localVue.use(Bus);

		this.wrapper = mount(App, {
			store,
			localVue, 
		});
		this.vm = this.wrapper.vm;

		this.wss = new Server('ws://' + config.webSocketHost
			+ ':' + config.webSocketPort);
	});

	afterEach(function() {
		if (this.vm.$webSocket) {
			this.vm.$webSocket.close();
		}
		this.wss.close();
	});

	it("responds correctly to a 'welcome' message in the prep phase",
			function(done) {

		this.vm.$bus.on('bus-welcome', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));

			expect(game.phase).to.equal(msgWelcomePrep.phase);
			expect(game.players).to.deep.equal(msgWelcomePrep.players);
			expect(game.host).to.equal(msgWelcomePrep.host)
			expect(game.settings).to.deep.equal(msgWelcomePrep.settings);
			expect(game.currentQuestion).to.be.null;
			expect(game.finishTime).to.be.null;
			expect(game.correctAnswer).to.be.null;
			expect(game.commentary).to.be.null;
			expect(game.questions).to.be.null;
			expect(game.results).to.be.null;

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomePrep));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a 'welcome' message in the active phase",
			function(done) {
		this.vm.$bus.on('bus-welcome', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));

			expect(game.phase).to.equal(msgWelcomeActive.phase);
			expect(game.players).to.deep.equal(msgWelcomeActive.players);
			expect(game.host).to.equal(msgWelcomeActive.host)
			expect(game.settings).to.deep.equal(msgWelcomeActive.settings);
			expect(game.currentQuestion).to.deep.equal(
				msgWelcomeActive.question);
			expect(game.finishTime.toString()).to.equal(
				JSON.parse(JSON.stringify(
					msgWelcomeActive.finishTime)).toString());
			expect(game.correctAnswer).to.deep.equal(
				msgWelcomeActive.correctAnswer);
			expect(game.commentary).to.equal(msgWelcomeActive.commentary);
			expect(game.questions).to.be.null;
			expect(game.results).to.be.null;

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomeActive));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a 'welcome' message in the finished phase",
			function(done) {
		this.vm.$bus.on('bus-welcome', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));

			expect(game.phase).to.equal(msgWelcomeFinished.phase);
			expect(game.players).to.deep.equal(msgWelcomeFinished.players);
			expect(game.host).to.equal(msgWelcomeFinished.host)
			expect(game.settings).to.deep.equal(msgWelcomeFinished.settings);
			expect(game.finishTime).to.be.null;
			expect(game.correctAnswer).to.be.null;
			expect(game.commentary).to.be.null;
			expect(game.questions).to.deep.equal(msgWelcomeFinished.questions);
			expect(game.results).to.deep.equal(msgWelcomeFinished.results);

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomeFinished));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a 'code' message", function(done) {
		this.vm.$bus.on('bus-code', function() {
			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify({type: 'code', code: 123456789}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a 'playerJoined' message when not "
			+ "reconnecting", function(done) {
		this.vm.$bus.on('bus-player-joined', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));

			var player = game.players.find(x => x.nickname === 'nick3');
			expect(player).to.exist;
			expect(player.isPlaying).to.be.true;
			expect(player.isReady).to.be.false;
			expect(player.hasAnswered).to.be.false;
			expect(player.hasFinished).to.be.false;
			expect(player.isConnected).to.be.true;

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomePrep));
			
			socket.send(JSON.stringify({
				type: 'playerJoined',
				nickname: 'nick3', 
				description: 'nick3 has joined',
				isReconnect: false,
			}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a 'playerJoined' message when reconnecting",
			function(done) {
		this.vm.$bus.on('bus-player-joined', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));

			var player = game.players.find(x => x.nickname === 'nick1');
			expect(player).to.exist;
			expect(player.isConnected).to.be.true;

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			var msgWelcomePrepWDisc = JSON.parse(JSON.stringify(
				msgWelcomePrep));
			var player = msgWelcomePrepWDisc.players.find(
				x => x.nickname === 'nick1');
			player.isConnected = false;
			socket.send(JSON.stringify(msgWelcomePrepWDisc));
			
			socket.send(JSON.stringify({
				type: 'playerJoined',
				nickname: 'nick1', 
				description: 'nick1 has reconnected',
				isReconnect: true,
			}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a 'playerLeft' message when not "
			+ "reconnecting", function(done) {
		this.vm.$bus.on('bus-player-left', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));

			var player = game.players.find(x => x.nickname === 'nick1');
			expect(player).to.be.undefined;

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomePrep));
			
			socket.send(JSON.stringify({
				type: 'playerLeft',
				nickname: 'nick1', 
				description: 'nick1 has left',
				isDisconnect: false,
			}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a 'playerLeft' message when reconnecting",
			function(done) {
		this.vm.$bus.on('bus-player-left', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));

			var player = game.players.find(x => x.nickname === 'nick1');
			expect(player).to.exist;
			expect(player.isConnected).to.be.false;

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomePrep));
			
			socket.send(JSON.stringify({
				type: 'playerLeft',
				nickname: 'nick1', 
				description: 'nick1 has disconnected',
				isDisconnect: true,
			}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a 'playerReady' message", function(done) {
		this.vm.$bus.on('bus-player-ready', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));

			var player = game.players.find(x => x.nickname === 'nick1');
			expect(player.isReady).to.be.true;

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomePrep));
			
			socket.send(JSON.stringify({
				type: 'playerReady',
				nickname: 'nick1', 
			}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a 'playerNotReady' message",
			function(done) {
		this.vm.$bus.on('bus-player-not-ready', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));

			var player = game.players.find(x => x.nickname === 'nick1');
			expect(player.isReady).to.be.false;

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			var msgWelcomePrepReady = JSON.parse(JSON.stringify(
				msgWelcomePrep));
			var player = msgWelcomePrepReady.players.find(
				x => x.nickname === 'nick1');
			player.isReady = true;
			socket.send(JSON.stringify(msgWelcomePrep));
			
			socket.send(JSON.stringify({
				type: 'playerNotReady',
				nickname: 'nick1', 
			}));
		});
		loadWebSocket(this.vm);
	
	});

	it("responds correctly to a 'qinstStartCountdown' message",
			function(done) {
		this.vm.$bus.on('bus-qinst-start-countdown', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));
		
			expect(game.phase).to.equal('ready');

			done();
		}.bind(this))

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomePrep));

			socket.send(JSON.stringify({
				type: 'qinstStartCountdown',
			}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a qinstCancelCountdown message",
			function(done) {
		console.log('test');
		this.vm.$bus.on('bus-qinst-cancel-countdown', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));
		
			expect(game.phase).to.equal('prep');

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomePrep));

			socket.send(JSON.stringify({
				type: 'qinstStartCountdown',
			}));

			socket.send(JSON.stringify({
				type: 'qinstCancelCountdown',
			}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a qinstActive message", function(done) {
		var question = JSON.parse(JSON.stringify(msgWelcomeQuestions[0]));
		delete question.correctAnswer;
		delete question.commentary;
		var finishTime = new Date((new Date()).getTime() + 15000);

		this.vm.$bus.on("bus-qinst-active", function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));
			expect(game.currentQuestion).to.deep.equal(question);
			expect(game.finishTime.toString()).to.equal(
				JSON.parse(JSON.stringify(finishTime)));
			expect(game.correctAnswer).to.deep.equal(
				msgWelcomeQuestions[0].correctAnswer);
			expect(game.commentary).to.deep.equal(
				msgWelcomeQuestions[0].commentary);

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomePrep));

			socket.send(JSON.stringify({
				type: 'qinstActive',
				question: question,
				finishTime: finishTime,
				correctAnswer: msgWelcomeQuestions[0].correctAnswer,
				commentary: msgWelcomeQuestions[0].commentary,
			}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to an answerFeedback message", function(done) {
		this.vm.$bus.on('bus-answer-feedback', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));
			expect(game.correctAnswer).to.deep.equal(
				msgWelcomeQuestions[0].correctAnswer);
			expect(game.commentary).to.deep.equal(
				msgWelcomeQuestions[0].commentary);

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomeActive));

			socket.send(JSON.stringify({
				type: 'answerFeedback',
				questionIndex: 1,
				correctAnswer: msgWelcomeQuestions[0].correctAnswer,
				commentary: msgWelcomeQuestions[0].commentary,
			}));
		});
		this.vm.$store.commit('setNickname', 'nick2');
		loadWebSocket(this.vm);
	});

	it("responds correctly to an answerNotice message", function(done) {
		this.vm.$bus.on('bus-answer-notice', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));
			var player = game.players.find(x => x.nickname === 'nick2');
			var answer = player.answers.find(x => x.questionIndex === 1);
			expect(answer.answer).to.deep.equal([1]);

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomeActive));

			socket.send(JSON.stringify({
				type: 'answerNotice',
				nickname: 'nick2',
				questionIndex: 1,
				answer: [1],
			}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a question message", function(done) {
		var question = JSON.parse(JSON.stringify(msgWelcomeQuestions[1]));
		delete question.correctAnswer;
		delete question.commentary;
		var finishTime = new Date((new Date()).getTime() + 15000);

		this.vm.$bus.on('bus-question', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));

			expect(game.currentQuestion).to.deep.equal(question);
			expect(game.correctAnswer).to.deep.equal(
				msgWelcomeQuestions[1].correctAnswer);
			expect(game.commentary).to.deep.equal(
				msgWelcomeQuestions[1].commentary);
			expect(game.finishTime.toString()).to.equal(
				JSON.parse(JSON.stringify(finishTime)));
			done();
		}.bind(this));
	
		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomeActive));

			socket.send(JSON.stringify({
				type: 'question',
				question: question,
				finishTime: finishTime,
				correctAnswer: msgWelcomeQuestions[1].correctAnswer,
				commentary: msgWelcomeQuestions[1].commentary,
			}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a playerResults message", function(done) {
		var answers = [
			{questionIndex: 1, answer: [1]},
			{questionIndex: 2, answer: [2]},
		];
		
		this.vm.$bus.on('bus-player-results', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));
		
			expect(game.questions).to.deep.equal(msgWelcomeQuestions);
			expect(game.results).to.have.lengthOf(1);
			expect(game.results[0].nickname).to.equal('nick2');
			expect(game.results[0].answers).to.deep.equal(answers);

			done();
		}.bind(this));

		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomeActive));

			socket.send(JSON.stringify({
				type: 'playerResults',
				questions: msgWelcomeQuestions,
				answers: answers,
			}));
		});
		this.vm.$store.commit('setNickname', 'nick2');
		loadWebSocket(this.vm);
	});

	it("responds correctly to a qinstEnd message", function(done) {
		var results = [
			{
				nickname: 'nick2',
				answers: [
					{questionIndex: 1, answer: [1]},
					{questionIndex: 2, answer: [2]},
				]
			}
		];

		this.vm.$bus.on('bus-qinst-end', function() {
			var game = JSON.parse(JSON.stringify(this.vm.$store.state.game));
		
			expect(game.questions).to.deep.equal(msgWelcomeQuestions);
			expect(game.results).to.deep.equal(results);

			done();
		}.bind(this));
		
		this.wss.on('connection', socket => {
			socket.send(JSON.stringify(msgWelcomeActive));

			socket.send(JSON.stringify({
				type: 'qinstEnd',
				questions: msgWelcomeQuestions,
				results: results,
			}));
		});
		loadWebSocket(this.vm);
	});

	it("responds correctly to a connectionClosed message");

	//[TODO] account for games with different settings, e.g. where
	// doesAdvanceTogether is set to false
});
