import { expect } from 'chai';
import sinon from 'sinon';
import Vuex from 'vuex';
import Bus from 'vue-bus';
import { Server } from 'mock-socket';
import { mount, createLocalVue } from '@vue/test-utils';

import MenuScreen from '@/components/MenuScreen.vue';
import store from '@/store.js';
import { setupUser } from '@/api.js';
import config from '@/config.js';
import loadWebSocket from '@/websocket.js';

before(function() {
	this.defaultQuizSettings = {
		time: 15.0,
		isTimePerQuestion: true,
		doesAdvanceTogether: true,
		doesHostPlay: false,
	}
});

describe("MenuScreen.vue", function() {
	beforeEach(function() {
		var localVue = createLocalVue();
		localVue.use(Vuex);
		localVue.use(Bus);

		this.wrapper = mount(MenuScreen, {
			store,
			localVue, 
		});
		this.vm = this.wrapper.vm;

		this.wss = new Server('ws://' + config.webSocketHost
			+ ':' + config.webSocketPort);
	});

	afterEach(function() {
		this.wss.stop();
	});

	function testVisitGame(done, isError = false, errorType = null) {
		this.wss.on('connection', function(socket) {
			socket.on('message', function(msg) {
				socket.send(JSON.stringify({
					type: 'welcome',
				}));
			});

			this.wrapper.find('#btn-visit-game').trigger('click');
		}.bind(this));

		if (!isError) {
			this.vm.$on('visit-game', function() {
				done();
			});
		} else {
			this.vm.$on('error-visit-game', function() {
				if (errorType === 'code') {
					expect(this.vm.$data.errorQinstCode).to.not.be.null;
				} else if (errorType === 'nickname') {
					expect(this.vm.$data.errorQinstNickname)
						.to.not.be.null;
				} else {
					throw 'invalid errorType in testVisitGame';
				}
				done();
			}.bind(this));
		}

		loadWebSocket(this.vm);
	}

	it("loads the creation screen when clicking the create button",
			function(done) {
		this.vm.$on('visit-creation', function() {
			done();
		});

		this.wrapper.find('#btn-visit-creation').trigger('click');
	});

	/*
	it.only("does not load the creation screen repeatedly if the create "
			+ "button is clicked repeatedly", function(done) {
		var spy = sinon.spy();
		this.vm.$on('visit-creation', spy);

		this.wrapper.find('#btn-visit-creation').trigger('click');
		this.wrapper.find('#btn-visit-creation').trigger('click');
		setTimeout(function() {
			expect(spy.calledOnce).to.be.true;
			done();
		}.bind(this), 100);
	});
	*/

	it("loads the game screen after clicking the play button if all "
			+ "requisites are met", function(done) {
		this.wrapper.setData({
			qinstCode: 1234567890,
			qinstNickname: "nick1",
		});

		testVisitGame.bind(this)(done);
	});

	it("does not load the game screen repeatedly if the play "
			+ "button is clicked repeatedly", function(done) {
		this.wrapper.setData({
			qinstCode: 1234567890,
			qinstNickname: "nick1",
		});
		var spy = sinon.spy();
		this.vm.$on('visit-game', spy);

		this.wss.on('connection', function(socket) {
			socket.on('message', function(msg) {
				socket.send(JSON.stringify({
					type: 'welcome',
				}));
			});

			this.wrapper.find('#btn-visit-game').trigger('click');
			this.wrapper.find('#btn-visit-game').trigger('click');
			setTimeout(function() {
				expect(spy.calledOnce).to.be.true;
				done();
			}.bind(this), 100);
		}.bind(this));

		loadWebSocket(this.vm);
	});

	it("does not load the game screen when the code has < 9 digits",
			function(done) {
		this.wrapper.setData({
			qinstCode: 12345,
			qinstNickname: "nick1",
		});
		
		testVisitGame.bind(this)(done, true, 'code');
	});

	it("does not load the game screen when the code has > 10 digits",
			function(done) {
		this.wrapper.setData({
			qinstCode: 1234567890123,
			qinstNickname: "nick1",
		});
		
		testVisitGame.bind(this)(done, true, 'code');
	});

	it("does not load the game screen when no code is specified",
			function(done) {
		this.wrapper.setData({
			qinstCode: null,
			qinstNickname: "nick1",
		});

		testVisitGame.bind(this)(done, true, 'code');
	});

	it("does not load the game screen when the nickname is invalid",
			function(done) {
		this.wrapper.setData({
			qinstCode: 1234567890,
			qinstNickname: "",
		});
		
		testVisitGame.bind(this)(done, true, 'nickname');
	});



});

