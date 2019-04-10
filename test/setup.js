const fs = require('fs');
const crypto = require('crypto');
const { wss, config, knex } = require('../server.js');
const WebSocket = require('ws');
const sinon = require('sinon');
const expect = require('chai').expect;

const dateformat = require('dateformat');

function createWebsocket(callback) {
	var ws = new WebSocket("ws://" + config.wsshost + ":" + config.wssport);

	var elapsedTime = 0;
	function timeout() {
		elapsedTime += 5;
		if (elapsedTime < 2000) {
			if (ws.readyState === 1) {
				callback(ws);
			} else {
				setTimeout(timeout, 5);
			}
		} else {
			throw "websocket connection not opened after 2 seconds";
		}
	}
	setTimeout(timeout, 5);
}

const logfileName = "logs/error_"
		+ dateformat(new Date(Date.parse("2100/05/05 15:00:00")),
			"yyyy_mm_dd") + ".txt";

function checkErrorFileExists() {
	return fs.existsSync(logfileName);
}


function sendJoin1() {
	this.ws1.send(JSON.stringify({
		type:'join',
		code: this.code,
		username: 'user1',
		password: 'pass1',
		nickname: 'nick1',
	}));
};

function sendJoin2() {
	this.ws2.send(JSON.stringify({
		type:'join',
		code: this.code,
		username: 'user2',
		password: 'pass2',
		nickname: 'nick2',
	}));
}

function sendJoin3() {
	this.ws3.send(JSON.stringify({
		type:'join',
		code: this.code,
		username: 'user3',
		password: 'pass3',
		nickname: 'nick3',
	}));
}

function deleteQinst(code) {
	var qinst = wss.qinsts[code];
	for (conn of qinst.conns) {
		conn.qinst = null;
	}
	delete wss.qinsts[code];
}


before(async function() {
	// create the quiz in the database
	var quizQuery = knex('quiz')
		.insert({name:'testquiz'})
		.returning('id');

	var user1Query = knex('user')
		.insert({judet_id: 1, country_id: 1, cult_id: 1, emails_id: 1,
			username:'user1', password: 'pass1',
			firstname: 'FirstName1', lastname: 'LastName1'})
			.returning('id');

	var user2Query = knex('user')
		.insert({judet_id: 1, country_id: 1, cult_id: 1, emails_id: 1,
			username:'user2', password: 'pass2',
			firstname: 'FirstName2', lastname: 'LastName2'})
			.returning('id');

	var user3Query = knex('user')
		.insert({judet_id: 1, country_id: 1, cult_id: 1, emails_id: 1,
			username:'user3', password: 'pass3',
			firstname: 'FirstName3', lastname: 'LastName3'})
			.returning('id');

	var ids = await Promise.all([
		quizQuery,
		user1Query,
		user2Query,
		user3Query
	]);

	this.quizId = ids[0][0];
	this.user1Id = ids[1][0];
	this.user2Id = ids[2][0];
	this.user3Id = ids[3][0];
});

after(function() {
	// clear the quiz from the database
	knex('quiz')
		.delete()
		.where({id: this.quizId})
		.then(function() {});

	knex('user')
		.delete()
		.where({id: this.user1Id})
		.then(function() {});

	knex('user')
		.delete()
		.where({id: this.user2Id})
		.then(function() {});

	knex('user')
		.delete()
		.where({id: this.user3Id})
		.then(function() {});
});

