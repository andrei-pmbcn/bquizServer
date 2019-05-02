import { expect } from 'chai';
import sinon from 'sinon';
import Vuex from 'vuex';
import { mount, createLocalVue } from '@vue/test-utils';
import App from '@/App.vue';
import store from '@/store.js';
import { setupUser } from '@/main.js';
import ws from 'ws';
import config from '@/config.js';
import phantomjs from 'phantomjs-prebuilt';
//import jsdomGlobal from 'jsdom-global';

//jsdomGlobal();

before(function() {
	this.defaultQuizSettings = {
		time: 15.0,
		isTimePerQuestion: true,
		doesAdvanceTogether: true,
		doesHostPlay: false,
	}
});

describe("MenuScreen.vue", function() {
	beforeEach(function(done) {
		var localVue = createLocalVue();
		localVue.use(Vuex);

		this.wrapper = mount(App, {
			store,
			localVue, 
		});
		this.vm = this.wrapper.vm;
		console.log("use: ", localVue);

		this.wss = new ws.Server({
			host: config.websocketHost,
			port: config.websocketPort,
		});

		

		console.log("wsload");
	});
	
	it.skip("calls sinon spies via events", function() {
		var spy = sinon.spy(wrapper.vm, 'testfn');
		this.vm.$emit('testevt');

		expect(spy.called).to.be.true;

		//wrapper.find('#btn-visit-creation').
		//expect(wrapper.text()).to.include('Joacă');
	  })

	it("issues an event when clicking the create button", function(done) {
		this.vm.$on('visit-creation', function() {
			done();
		});

		this.wrapper.find('#btn-visit-creation').trigger('click');
	});

	it.only("issues an event when clicking the submit button if a correct "
			+ "username and code have been specified", function(done) {
		this.wss.once('message', function(msg) {
			this.wss.send(JSON.stringify({
				type: 'welcome',
				phase: 'prep',
				players: ['nick1', 'nick2', 'nick3'],
				host: 'nick1',
				settings: this.defaultQuizSettings,
			}));
		}.bind(this));

		this.vm.$on('visit-game', function() {
			done();
		});
		
	});
});
