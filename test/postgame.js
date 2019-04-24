module.exports = function() {
	// player 1 is the host and does not participate;
	// player 2 answers questions 1 and 2 correctly, answers question 3
	// incorectly
	// player 3 answers question 1 correctly, does not answer questions 2 and 3

	beforeEach(function(done) {
		var createWebsockets = function(cb) {
			createWebsocket(function(ws) {
				this.ws1 = ws;
				createWebsocket(function(ws) {
					this.ws2 = ws;
					createWebsocket(function(ws) {
						this.ws3 = ws;

						this.clock = sinon.useFakeTimers({
							now: Date.parse("2100/05/05 15:00:00"),
							toFake: ['Date', 'setTimeout', 'clearTimeout'],
						});

						cb();
					}.bind(this));
				}.bind(this));
			}.bind(this));
		}.bind(this);

		var prepareGame = function() {
			var kMessages = 0;
			var gameStartListener = function(msg) {
				msg = JSON.parse(msg);
				kMessages++;

				switch (kMessages) {
					case 1:
						expect(msg.type).to.equal('code');
						this.code = msg.code;
						this.qinst = wss.qinsts[this.code];
						// quiz settings
						expect(this.qinst.quiz.settings.doesHostPlay)
							.to.be.false;
						expect(this.qinst.quiz.settings.doesAdvanceTogether)
							.to.be.true;
						expect(this.qinst.quiz.settings.time)
							.to.equal(15.0);
						expect(this.qinst.quiz.questions[0].time)
							.to.be.null;
						expect(this.qinst.quiz.questions[1].time)
							.to.be.null;
						expect(this.qinst.quiz.questions[2].time)
							.to.be.null;

						this.ws1.send(JSON.stringify({
							type: 'join',
							code: this.code,
							username: 'user1',
							password: 'pass1',
							nickname: 'nick1',
						}));
						break;
					case 2:
						expect(msg.type).to.equal('welcome');
						this.ws2.send(JSON.stringify({
							type: 'join',
							code: this.code,
							username: 'user2',
							password: 'pass2',
							nickname: 'nick2',
						}));
						this.ws3.send(JSON.stringify({
							type: 'join',
							code: this.code,
							username: 'user3',
							password: 'pass3',
							nickname: 'nick3',
						}));
						break;
					case 4:
						expect(msg.type).to.equal('playerJoined');
						this.ws1.send(JSON.stringify({type: 'ready'}));
						this.ws2.send(JSON.stringify({type: 'ready'}));
						this.ws3.send(JSON.stringify({type: 'ready'}));
						break;
					case 7:
						expect(msg.type).to.equal('playerReady');
						this.ws1.send(JSON.stringify({
							type: 'start',
						}));
						break;
					case 8:
						expect(msg.type).to.equal('qinstStartCountdown');
						this.clock.tick(5000);
						break;
					case 9:
						expect(msg.type).to.equal('qinstActive');
						this.ws2.send(JSON.stringify({
							type: 'answer',
							questionIndex: 1,
							answer: [1],
						}));
						this.ws3.send(JSON.stringify({
							type: 'answer',
							questionIndex: 1,
							answer: [1],
						}));
						break;
					case 10: 
						expect(msg.type).to.equal('answerNotice');
						break;
					case 11:
						expect(msg.type).to.equal('answerNotice');
						this.ws1.send(JSON.stringify({
							type: 'nextQuestion',
							questionIndex: 1,
						}));
						break;
					case 12:
						expect(msg.type).to.equal('question');
						expect(msg.question.index).to.equal(2);
						this.ws2.send(JSON.stringify({
							type: 'answer',
							questionIndex: 2,
							answer: [2],
						}));
						break;
					case 13:
						expect(msg.type).to.equal('answerNotice');
						this.clock.tick(this.qinst.quiz.settings.time * 1000);
						break;
					case 14:
						expect(msg.type).to.equal('question');
						expect(msg.question.index).to.equal(3);
						this.ws2.send(JSON.stringify({
							type: 'answer',
							questionIndex: 3,
							answer: [1],
						}));
						break;
					case 15:
						expect(msg.type).to.equal('answerNotice');
						done();
						break;
				}
			}.bind(this);

			this.ws1.on('message', gameStartListener);

			this.ws1.send(JSON.stringify({
				type: 'create',
				identifier: this.quizId,
				nickname: 'nick1',
			}));
		}.bind(this);

		wss.doesThrottle = false;
		createWebsockets(prepareGame);
	});

	afterEach(function() {
		if (this.ws1.readyState === this.ws1.OPEN) {
			this.ws1.close(1000);
		}
		if (this.ws2.readyState === this.ws2.OPEN) {
			this.ws2.close(1000);
		}
		if (this.ws3.readyState === this.ws3.OPEN) {
			this.ws3.close(1000);
		}

		this.ws1.player = null;
		this.ws2.player = null;
		this.ws3.player = null;
		wss.qinsts = {};

		wss.doesThrottle = true;
	});

	var finishGame = function(cb, receiver = this.ws1) {
		receiver.once('message', function(msg) {
			msg = JSON.parse(msg);
			expect(msg.type).to.equal('qinstEnd');
			cb(msg);
		}.bind(this));

		this.clock.tick(this.qinst.quiz.settings.time * 1000);
	}

	function expectForQinstEnd(msg) {
		expect(msg.questions).to.have.lengthOf(3);

		var questions = msg.questions.sort(
			(x, y) => (x.index - y.index));
		expect(questions[0].index).to.equal(1);
		expect(questions[0].text).to.equal('question1');
		expect(questions[0].choices).to.have.lengthOf(3);
		expect(questions[0].correctAnswer).to.deep.equal([1]);
		expect(questions[0].commentary).to.be.a.string;
		expect(questions[0].points).to.equal(1);

		expect(questions[1].index).to.equal(2);
		expect(questions[1].text).to.equal('question2');
		expect(questions[1].choices).to.have.lengthOf(3);
		expect(questions[1].correctAnswer).to.deep.equal([2]);
		expect(questions[1].commentary).to.be.a.string;
		expect(questions[1].points).to.equal(2);

		expect(questions[2].index).to.equal(3);
		expect(questions[2].text).to.equal('question3');
		expect(questions[2].choices).to.have.lengthOf(3);
		expect(questions[2].correctAnswer).to.deep.equal([3]);
		expect(questions[2].commentary).to.be.a.string;
		expect(questions[2].points).to.equal(3);

		var results = msg.results.sort(
			(x, y) => (parseInt(x.nickname[4])
				- parseInt(y.nickname[4])));
		expect(results).to.have.lengthOf(2);
		expect(results[0].nickname).to.equal('nick2');
		expect(results[1].nickname).to.equal('nick3');

		var answers = results[0].answers.sort(
			(x, y) => (x.questionIndex - y.questionIndex));
		expect(answers).to.have.lengthOf(3);
		expect(answers[0].questionIndex).to.equal(1);
		expect(answers[0].answer).to.deep.equal([1]);
		expect(answers[1].questionIndex).to.equal(2);
		expect(answers[1].answer).to.deep.equal([2]);
		expect(answers[2].questionIndex).to.equal(3);
		expect(answers[2].answer).to.deep.equal([1]);

		expect(results[1].answers).to.have.lengthOf(3);
		answers = results[1].answers.sort(
			(x, y) => (x.questionIndex - y.questionIndex));
		expect(answers[0].questionIndex).to.equal(1);
		expect(answers[0].answer).to.deep.equal([1]);
		expect(answers[1].questionIndex).to.equal(2);
		expect(answers[1].answer).to.deep.equal([]);
		expect(answers[2].questionIndex).to.equal(3);
		expect(answers[2].answer).to.deep.equal([]);
	}

	describe("players reconnecting in the finished phase", function() {
		it.only("sends the welcome message for the finished phase to a "
				+ "reconnecting player", function(done) {
			var cb = function() {
				wss.once('connClosed', function() {
					createWebsocket(function(ws) {
						ws.once('message', function(msg) {
							msg = JSON.parse(msg);
							expect(msg.type).to.equal('welcome');
							expect(msg.phase).to.equal(
								wss.QINST_PHASE_FINISHED);
							expect(msg.players).to.have.lengthOf(3);

							expect(msg.settings).to.have.property(
								'doesHostPlay');
							expect(msg.settings).to.have.property(
								'doesAdvanceTogether');
							expect(msg.settings).to.have.property(
								'isTimePerQuestion');
							expect(msg.settings).to.have.property('time');

							expectForQinstEnd(msg);
							done();
						}.bind(this));

						ws.send(JSON.stringify({
							type: 'join',
							code: this.code,
							username: 'user1',
							password: 'pass1',
							nickname: 'nick1',
						}));
					}.bind(this));
				}.bind(this));

				this.ws1.close(1001);
			}.bind(this);

			finishGame.bind(this)(cb);
		});

		//it("does not permit non-logged-in players to reconnect");

	});


	describe("quiz results", function() {
		
		it("sends the quiz results to the host", function(done) {
			var cb = function(msg) {
				expectForQinstEnd(msg);
				done();
			}.bind(this);
			
			finishGame.bind(this)(cb);
		});
	
		it("sends the quiz results to a player", function(done) {
			var cb = function(msg) {
				expectForQinstEnd(msg);
				done();
			}.bind(this);
			
			finishGame.bind(this)(cb, this.ws2);
		});
	
	});

	describe('ratings and statistics', function() {
		it("adds a quiz rating if the hasQuizRatings setting "
			+ "is enabled");

		it("does not add a quiz rating if the hasQuizRatings "
			+ "setting is disabled");

		it("adds a question rating if the hasQuestionRatings "
			+ "setting is enabled");

		it("does not add a question rating if the hasQuestionRatings "
			+ "setting is disabled");

		it("alters a quiz rating, rather than adding it, if the player "
			+ "sends the quiz rating twice");

		it("alters a question rating, rather than adding it, if the "
			+ "player sends the question rating twice");

		it("processes the ratings once the game has closed");

		it("increments the number of plays of the quiz once the game "
			+ "has closed");	
	});
}
