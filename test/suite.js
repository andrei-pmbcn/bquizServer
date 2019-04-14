global.yaml = require('js-yaml');
global.fs = require('fs');
global.crypto = require('crypto');
global.WebSocket = require('ws');
global.sinon = require('sinon');
global.expect = require('chai').expect;

global.dateformat = require('dateformat');

global.wss = require('../wsserver.js');
global.wss = wss;


try {
	var wsconfig = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));
} catch (ex) {
	console.log(ex);
}

try {
	var dbconfig = yaml.safeLoad(fs.readFileSync('biblequiz.yml', 'utf8'));
} catch (ex) {
	console.log(ex);
}

global.knex = require('knex')({
	client: 'mysql',
	connection: {
		host: dbconfig.dbhost,
		user: dbconfig.dbuser,
		password: dbconfig.dbpassword,
		database: dbconfig.database,
	}
});

const pregame = require('./pregame.js');
const ingame = require('./ingame.js');

global.createWebsocket = function(callback) {
	var ws = new WebSocket("ws://" + wsconfig.wsshost + ":" + wsconfig.wssport);

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

global.sendJoin1 = function() {
	this.ws1.send(JSON.stringify({
		type:'join',
		code: this.code,
		username: 'user1',
		password: 'pass1',
		nickname: 'nick1',
	}));
};

global.sendJoin2 = function() {
	this.ws2.send(JSON.stringify({
		type:'join',
		code: this.code,
		username: 'user2',
		password: 'pass2',
		nickname: 'nick2',
	}));
}

global.sendJoin3 = function() {
	this.ws3.send(JSON.stringify({
		type:'join',
		code: this.code,
		username: 'user3',
		password: 'pass3',
		nickname: 'nick3',
	}));
}

global.deleteQinst = function(code) {
	var qinst = wss.qinsts[code];
	for (conn of qinst.conns) {
		conn.qinst = null;
	}
	delete wss.qinsts[code];
}

global.useFakeTimeouts = function() {
	this.clock.restore();
	this.clock = sinon.useFakeTimers({
		now: Date.parse("2100/05/05 15:00:00"),
		toFake: ['Date', 'setTimeout', 'clearTimeout'],
	});
}

before(async function() {
	// create the quiz in the database
	var quizQuery = knex('bible_quiz')
		.insert({
			name:'testquiz',
			description: 'testquiz description',
			time: '15.0',
			is_time_per_question: true,
			does_advance_together: true,
			does_host_play: false,
			})
		.returning('id');

	var user1Query = knex('user')
		.insert({username:'user1', password: 'pass1'})
			.returning('id');

	var user2Query = knex('user')
		.insert({username:'user2', password: 'pass2'})
			.returning('id');

	var user3Query = knex('user')
		.insert({username:'user3', password: 'pass3'})
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

	// the correct answers to the questions are 1, 2, 3 and 1 respectively
	// question 4 is cancelled and does not show up in the quiz

	var question1Query = knex('bible_quiz_question')
		.insert({
			question: 'question1',
			a: 'answer1.1',
			b: 'answer1.2',
			c: 'answer1.3',
			date: '2007-05-18',
			answer: 1,
			note: '',
			cancelled: 0,
		})
		.returning('id');

	var question2Query = knex('bible_quiz_question')
		.insert({
			question: 'question2',
			a: 'answer2.1',
			b: 'answer2.2',
			c: 'answer2.3',
			date: '2007-05-18',
			answer: 2,
			note: '',
			cancelled: 0,
		})
		.returning('id');

	var question3Query = knex('bible_quiz_question')
		.insert({
			question: 'question3',
			a: 'answer3.1',
			b: 'answer3.2',
			c: 'answer3.3',
			date: '2007-05-18',
			answer: 3,
			note: '',
			cancelled: 0,
		})
		.returning('id');

	var question4Query = knex('bible_quiz_question')
		.insert({
			question: 'question4',
			a: 'answer4.1',
			b: 'answer4.2',
			c: 'answer4.3',
			date: '2007-05-18',
			answer: 1,
			note: '',
			cancelled: 1,
		})
		.returning('id');

	ids = await Promise.all([
		question1Query,
		question2Query,
		question3Query,
		question4Query,
	])

	this.question1Id = ids[0][0];
	this.question2Id = ids[1][0];
	this.question3Id = ids[2][0];
	this.question4Id = ids[3][0];

	var questionLink1Query = knex('bible_quiz_question_link')
		.insert({
			bible_quiz_id: this.quizId,
			bible_quiz_question_id: this.question1Id,
			idx: 1,
			points: 1,
			time: 10.0,
		})
		.returning('id');

	var questionLink2Query = knex('bible_quiz_question_link')
		.insert({
			bible_quiz_id: this.quizId,
			bible_quiz_question_id: this.question2Id,
			idx: 2,
			points: 2,
			time: null,
		})
		.returning('id');

	var questionLink3Query = knex('bible_quiz_question_link')
		.insert({
			bible_quiz_id: this.quizId,
			bible_quiz_question_id: this.question3Id,
			idx: 3,
			points: 3,
			time: null,
		})
		.returning('id');


	var questionLink4Query = knex('bible_quiz_question_link')
		.insert({
			bible_quiz_id: this.quizId,
			bible_quiz_question_id: this.question4Id,
			idx: 4,
			points: 4,
		})
		.returning('id');

	ids = await Promise.all([
		questionLink1Query,
		questionLink2Query,
		questionLink3Query,
		questionLink4Query,
	])

	this.questionLink1Id = ids[0][0];
	this.questionLink2Id = ids[1][0];
	this.questionLink3Id = ids[2][0];
	this.questionLink4Id = ids[3][0];

	var questionReference1Query = knex('bible_quiz_question_references')
		.insert({bible_quiz_question_id: this.question1Id,
			carte_from: 'Geneza', capitol_from: 1, verset_from: 1,
			carte_to: 'Geneza', capitol_to: 1, verset_to: 1})
		.returning('id');

	var questionReference2Query = knex('bible_quiz_question_references')
		.insert({bible_quiz_question_id: this.question2Id,
			carte_from: 'Geneza', capitol_from: 1, verset_from: 1,
			carte_to: 'Geneza', capitol_to: 1, verset_to: 2})
		.returning('id');

	var questionReference3Query = knex('bible_quiz_question_references')
		.insert({bible_quiz_question_id: this.question3Id,
			carte_from: 'Geneza', capitol_from: 1, verset_from: 1,
			carte_to: 'Geneza', capitol_to: 2, verset_to: 1})
		.returning('id');

	var questionReference4Query = knex('bible_quiz_question_references')
		.insert({bible_quiz_question_id: this.question3Id,
			carte_from: 'Geneza', capitol_from: 1, verset_from: 1,
			carte_to: 'Exodul', capitol_to: 1, verset_to: 1})
		.returning('id');

	ids = await Promise.all([
		questionReference1Query,
		questionReference2Query,
		questionReference3Query,
		questionReference4Query,
	]);

	this.questionReference1Id = ids[0][0];
	this.questionReference2Id = ids[1][0];
	this.questionReference3Id = ids[2][0];
	this.questionReference4Id = ids[3][0];
});

after(function() {
	knex('bible_quiz_question_link')
		.delete()
		.where({id: this.questionLink1Id})
		.then(function() {});

	knex('bible_quiz_question_link')
		.delete()
		.where({id: this.questionLink2Id})
		.then(function() {});

	knex('bible_quiz_question_link')
		.delete()
		.where({id: this.questionLink3Id})
		.then(function() {});

	knex('bible_quiz_question_link')
		.delete()
		.where({id: this.questionLink4Id})
		.then(function() {});

	knex('bible_quiz_question_references')
		.delete()
		.where({id: this.questionReference1Id})
		.then(function() {});

	knex('bible_quiz_question_references')
		.delete()
		.where({id: this.questionReference2Id})
		.then(function() {});

	knex('bible_quiz_question_references')
		.delete()
		.where({id: this.questionReference3Id})
		.then(function() {});

	knex('bible_quiz_question_references')
		.delete()
		.where({id: this.questionReference4Id})
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

	knex('bible_quiz_question')
		.delete()
		.where({id: this.question1Id})
		.then(function() {});
	
	knex('bible_quiz_question')
		.delete()
		.where({id: this.question2Id})
		.then(function() {});

	knex('bible_quiz_question')
		.delete()
		.where({id: this.question3Id})
		.then(function() {});
	
	knex('bible_quiz_question')
		.delete()
		.where({id: this.question4Id})
		.then(function() {});

	knex('bible_quiz')
		.delete()
		.where({id: this.quizId})
		.then(function() {});
});

beforeEach(function() {
	//set the date far ahead so that no extant error logs are overwritten
	this.clock = sinon.useFakeTimers({
		now: Date.parse("2100/05/05 15:00:00"),
		toFake: ['Date'],
	});
});

afterEach(function() {
	//delete the error file, if any
	if (fs.existsSync(logfileName)) {
		fs.unlinkSync(logfileName);
	}

	//restore timers and everything else affected by sinon
	sinon.restore();
});


describe ("non-game", function() {
	beforeEach(function(done) {
		createWebsocket(function(ws) { 
			this.ws1 = ws;

			wss.doesThrottle = false;
			done();
		}.bind(this));
	});

	afterEach(function() {
		this.ws1.close(1000);
		wss.doesThrottle = true;
	});

	it("logs errors", function(done) {
		expect(fs.existsSync(logfileName)).to.equal(false);

		this.ws1.send(JSON.stringify({type: "debugError"}));
					
		this.ws1.on('message', function(msg) {
			msg = JSON.parse(msg);
			expect(msg.type).to.equal('error');

			expect(fs.existsSync(logfileName)).to.equal(true);
			done();
		});
	});

	it("creates the full quiz", function(done) {
		this.ws1.once('message', function(msg) {
			msg = JSON.parse(msg);

			var quiz = wss.qinsts[msg.code].quiz;
			expect(quiz.name).to.equal('testquiz');
			expect(quiz.description).to.equal('testquiz description');
			expect(quiz.questions).to.have.lengthOf(3);

			var question1 = quiz.questions[0];
			expect(question1.points).to.equal(1);
			expect(question1.text).to.equal('question1');
			expect(question1.answers[0].text).to.equal('answer1.1');
			expect(question1.answers[1].text).to.equal('answer1.2');
			expect(question1.answers[2].text).to.equal('answer1.3');
			expect(question1.answers).to.have.lengthOf(3);
			expect(question1.correctAnswer).to.deep.equal([1]);

			var question2 = quiz.questions[1];
			expect(question2.points).to.equal(2);
			expect(question2.text).to.equal('question2');
			expect(question2.answers[0].text).to.equal('answer2.1');
			expect(question2.answers[1].text).to.equal('answer2.2');
			expect(question2.answers[2].text).to.equal('answer2.3');
			expect(question2.answers).to.have.lengthOf(3);
			expect(question2.correctAnswer).to.deep.equal([2]);

			var question3 = quiz.questions[2];
			expect(question3.points).to.equal(3);
			expect(question3.text).to.equal('question3');
			expect(question3.answers[0].text).to.equal('answer3.1');
			expect(question3.answers[1].text).to.equal('answer3.2');
			expect(question3.answers[2].text).to.equal('answer3.3');
			expect(question3.answers).to.have.lengthOf(3);
			expect(question3.correctAnswer).to.deep.equal([3]);
			
			done();
		}.bind(this));

		this.ws1.send(JSON.stringify({
			type: 'create',
			quizId: this.quizId,
			nickname: 'nick1',
		}));
	});
});

describe("pre-game", pregame.bind(this));
describe("in-game", ingame.bind(this));


describe("post-game", function() {
	beforeEach(function() {


	});
	
	describe("player reconnecting", function() {
		it("sends the game_finished message");

		it("does not permit non-logged-in players to reconnect")
	});

	describe("end acknowledgement", function() {
		it("removes a player after the timer if no end_acknowledged message "
			+ "is sent");

		it("does not remove a player after the timer if the end_acknowledged "
			+ "message is sent");

		it("triggers game deletion if the last player has left for not having "
			+ "sent the end_acknowledged message");

		it("does not throttle endAcknowledged messages");
	});


	describe("player leaving", function() {
		it("removes the player from the database");

		it("triggers game deletion if the last player has left");

	});


});
