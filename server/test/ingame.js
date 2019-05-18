module.exports = function() {
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
						cb.bind(this)();
					}.bind(this));
				}.bind(this));
			}.bind(this));
		}.bind(this);

		var prepareGame = function() {
			var kMessages = 0;
			this.ws1.on('message', function(msg) {
				msg = JSON.parse(msg);
				kMessages++;
				if (kMessages === 1) {
					//game created
					this.code = msg.code;
					this.qinst = wss.qinsts[this.code];

					this.ws1.send(JSON.stringify({
						type: 'join', 
						code: this.code,
						locale: 'ro',
						username: 'user1',
						password: 'pass1',
						nickname: 'nick1',
					}));
				} else if (kMessages === 2) {
					var player = this.qinst.players.find(
						x => x.nickname === 'nick1');
					expect(player.isPlaying).to.be.false;

					this.ws2.send(JSON.stringify({
						type: 'join', 
						code: this.code,
						locale: 'ro',
						username: 'user2',
						password: 'pass2',
						nickname: 'nick2',
					}));
					this.ws3.send(JSON.stringify({
						type: 'join', 
						code: this.code,
						locale: 'ro',
						rname: 'user3',
						password: 'pass3',
						nickname: 'nick3',
					}));
				} else if (kMessages === 4) {
					//players joined
					var player2 = this.qinst.players.find(
						x => x.nickname === 'nick2');
					expect(player2.isPlaying).to.be.true;
					var player3 = this.qinst.players.find(
						x => x.nickname === 'nick3');
					expect(player3.isPlaying).to.be.true;
					
					this.conn1 = wss.conns.find(
						(x) => (x.player.nickname === 'nick1'));
					this.conn2 = wss.conns.find(
						(x) => (x.player.nickname === 'nick2'));
					this.conn3 = wss.conns.find(
						(x) => (x.player.nickname === 'nick3'));

					this.ws1.send(JSON.stringify({
						type: 'ready',
					}));
					this.ws2.send(JSON.stringify({
						type: 'ready',
					}));
					this.ws3.send(JSON.stringify({
						type: 'ready',
					}));
				} else if (kMessages === 7) {
					//players ready
					this.ws1.send(JSON.stringify({
						type: 'start',
					}));
				} else if (kMessages === 8) {
					//qinstStartCountdown sent
					done();
				}
			}.bind(this));

			this.ws1.send(JSON.stringify({
				type: 'create', 
				identifier: this.quizId, 
				locale: 'ro',
				nickname: 'nick1',
			}));
		}

		wss.doesThrottle = false;
		createWebsockets(prepareGame);
	});

	afterEach(function() {
		for (conn of wss.conns) {
			conn.ws.close(1000);
		}

		this.ws1.player = null;
		this.ws2.player = null;
		this.ws3.player = null;
		wss.qinsts = {};

		wss.doesThrottle = true;
	});

	var startGame = function(cb, receiver = this.ws1) {
		receiver.once('message', function(msg) {
			msg = JSON.parse(msg);
			expect(msg.type).to.equal('qinstActive');
			cb(msg);
		}.bind(this));
		
		this.clock.tick(5000);
	};

	var sendAnswer = function(ws, questionIndex, answer) {
		ws.send(JSON.stringify({
			type: 'answer',
			questionIndex: questionIndex,
			answer: answer,
		}));
	};

	var requestNextQuestionHNP = function(
			cb, sender = this.ws1, receiver = this.ws1,
			answerIndex = null, nextQuestionIndex = null) {
		// the sender requests the next question and the receiver receives
		// the question message; the host is not playing

		var nextQuestionListener =  function(msg) {
			msg = JSON.parse(msg);
			if (msg.type === 'question' || msg.type === 'error') {
				receiver.removeListener('message', nextQuestionListener);
				cb(msg);
			}
		}
		
		var kMessages = 0;
		var answerListener = function(msg) {
			msg = JSON.parse(msg);
			if (msg.type === 'answerFeedback') {
				kMessages++;
			}
			if (kMessages === 2) {
				this.ws2.removeListener('message', answerListener);
				this.ws3.removeListener('message', answerListener);

				if (nextQuestionIndex === null) {
					nextQuestionIndex = this.qinst.questionIndex;
				}

				receiver.on('message', nextQuestionListener);
				sender.send(JSON.stringify({
					type: 'nextQuestion',
					questionIndex: nextQuestionIndex
				}));
			}
		}.bind(this);
		this.ws2.on('message', answerListener);
		this.ws3.on('message', answerListener);

		if (answerIndex === null) {
			answerIndex = this.qinst.questionIndex;
		}
			
		sendAnswer(this.ws2, answerIndex, [2]);
		sendAnswer(this.ws3, answerIndex, [3]);
	};

	var requestNextQuestionHP = function(
			cb, sender = this.ws1, receiver = this.ws1) {
		// the sender requests the next question and the receiver receives
		// the question message; the host is playing

		var nextQuestionListener = function(msg) {
			msg = JSON.parse(msg);
			if (msg.type === 'question') {
				receiver.removeListener('message', nextQuestionListener);
				cb(msg);
			}
		}
		
		var kMessages = 0;
		var answerListener = function(msg) {
			msg = JSON.parse(msg);
			if (msg.type === 'answerFeedback') {
				kMessages++;
			}

			if (kMessages === 3) {
				this.ws1.removeListener('message', answerListener);
				this.ws2.removeListener('message', answerListener);
				this.ws3.removeListener('message', answerListener);
				receiver.on('message', nextQuestionListener);
				sender.send(JSON.stringify({
					type: 'nextQuestion',
					questionIndex: this.qinst.questionIndex
				}));
			}
		}.bind(this);
		this.ws1.on('message', answerListener);
		this.ws2.on('message', answerListener);
		this.ws3.on('message', answerListener);

		sendAnswer(this.ws1, 1, [1]);
		sendAnswer(this.ws2, 1, [2]);
		sendAnswer(this.ws3, 1, [3]);
	};

	describe("functionality common to all games", function() {
		describe("players reconnecting in the active phase", function() {
			function reconnect(done, ws, username, password, hasExtra) {
				var cb = function(msg) {
					ws.close(1001);

					createWebsocket(function(ws) {
						ws.once('message', function(msg) {
							msg = JSON.parse(msg);
							expect(msg.type).to.equal('welcome');
							expect(msg.phase).to.equal(wss.QINST_PHASE_ACTIVE);
							expect(msg.players).to.have.lengthOf(3);
							var player1 = msg.players.find(
								x => x.nickname === 'nick1');
							expect(player1).to.exist;
							var player2 = msg.players.find(
								x => x.nickname === 'nick2');
							expect(player2).to.exist;
							var player3 = msg.players.find(
								x => x.nickname === 'nick3');
							expect(player3).to.exist;
							expect(msg.host).to.equal('nick1');

							expect(msg.settings).to.deep.equal(
								this.qinst.quiz.settings);
							expect(msg.question).to.exist;
							expect(msg.question.index).to.equal(1);

							if (hasExtra) {
								expect(msg.correctAnswer).to.deep.equal([1]);
								expect(msg.commentary).to.equal('Geneza 1:1');
							} else {
								expect(msg.correctAnswer).to.be.null;
								expect(msg.commentary).to.be.null;
							}
							done();
						}.bind(this));
						
						ws.send(JSON.stringify({
							type: 'join',
							code: this.code,
							locale: 'ro',
							username: username,
							password: password,
						}));
					}.bind(this));
					
				}.bind(this);

				startGame.bind(this)(cb);
			}
			
			it("sends a non-host player the correct welcome message for "
					+ "the active phase", function(done) {
				reconnect.bind(this)(done, this.ws2, 'user2', 'pass2', false);
			});

			it("sends a host player the correct welcome message for "
					+ "the active phase when the host is not playing",
					function(done) {
				reconnect.bind(this)(done, this.ws1, 'user1', 'pass1', true);
			});

			it("sends a host player the correct welcome message for "
					+ "the active phase when the host is playing",
					function(done) {
				this.qinst.quiz.settings.doesHostPlay = true;
				this.conn1.player.isPlaying = true;
				this.conn1.player.test = 'x';
				reconnect.bind(this)(done, this.ws1, 'user1', 'pass1', false);
			});
		});
		
		describe("sending questions", function() {
			it("sends the correct answer and commentary with the "
					+ "qinstActive message if the player is the host and "
					+ "the host is not playing", function(done) {
				var cb = function(msg) {
					expect(msg.type).to.equal('qinstActive');
					expect(msg.correctAnswer).to.deep.equal([1]);
					expect(msg.commentary).to.equal('Geneza 1:1');
					done();
				}.bind(this);
				
				startGame.bind(this)(cb);
			});

			it("does not send the correct answer and commentary with "
					+ "the qinstActive message if the player is not the host",
					function(done) {
				var cb = function(msg) {
					expect(msg.type).to.equal('qinstActive');
					expect(msg.correctAnswer).to.be.null;
					expect(msg.commentary).to.be.null;
					done();
				}

				startGame.bind(this)(cb, this.ws2);
			})

			it("does not send the correct answer and commentary with the "
				+ "qinstActive message if the player is the host and the "
				+ "host is playing", function(done) {
				var cb = function(msg) {
					expect(msg.type).to.equal('qinstActive');
					expect(msg.correctAnswer).to.be.null;
					expect(msg.commentary).to.be.null;
					done();
				}
				
				this.qinst.quiz.settings.doesHostPlay = true;
				this.conn1.player.isPlaying = true;
				startGame.bind(this)(cb);
			});

			it("sends the correct answer and commentary with a "
					+ "question message if the player is the host and "
					+ "the host is not playing", function(done) {
				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');
					expect(msg.correctAnswer).to.deep.equal([2]);
					expect(msg.commentary).to.equal('Geneza 1:1-2');
					done();
				}.bind(this);

				var cb1 = function(msg) {
					requestNextQuestionHNP.bind(this)(cb2);
				}.bind(this);

				startGame.bind(this)(cb1);
			});

			it("does not send the correct answer and commentary with "
					+ "a question message if the player is not the host",
					function(done) {
				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');
					expect(msg.correctAnswer).to.be.null;
					expect(msg.commentary).to.be.null;
					done();
				}.bind(this);

				var cb1 = function(msg) {
					requestNextQuestionHNP.bind(this)(cb2, this.ws1, this.ws2);
				}.bind(this);

				startGame.bind(this)(cb1);
			});

			it("does not send the correct answer and commentary with a "
					+ "question message if the player is the host and the "
					+ "host is playing", function(done) {
				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');
					expect(msg.correctAnswer).to.be.null;
					expect(msg.commentary).to.be.null;
					done();
				}.bind(this);

				var cb1 = function(msg) {
					requestNextQuestionHP.bind(this)(cb2);
				}.bind(this);

				this.qinst.quiz.settings.doesHostPlay = true;
				this.conn1.player.isPlaying = true;
				startGame.bind(this)(cb1);
			
			});

			it("sends the question in the qinstActive message to the "
					+ "host player", function(done) {
				var cb = function(msg) {
					expect(msg.type).to.equal('qinstActive');					
					expect(msg.question).to.exist;
					expect(msg.question.index).to.equal(1);
					expect(msg.question.text).to.equal('question1');
					expect(msg.question.points).to.equal(1);

					var choices = msg.question.choices;
					choices.sort((x, y) => (x.index - y.index));
					expect(choices[0].index).to.equal(1);
					expect(choices[0].text).to.equal('answer1.1');
					expect(choices[1].index).to.equal(2);
					expect(choices[1].text).to.equal('answer1.2');
					expect(choices[2].index).to.equal(3);
					expect(choices[2].text).to.equal('answer1.3');
					
					done();
				}.bind(this);

				startGame.bind(this)(cb);
			});

			it("sends the question in the qinstActive message to a "
					+ "non-host player", function(done) {
				var cb = function(msg) {
					expect(msg.type).to.equal('qinstActive');					
					expect(msg.question).to.exist;
					expect(msg.question.index).to.equal(1);
					expect(msg.question.text).to.equal('question1');
					expect(msg.question.points).to.equal(1);

					var choices = msg.question.choices;
					choices.sort((x, y) => (x.index - y.index));
					expect(choices[0].index).to.equal(1);
					expect(choices[0].text).to.equal('answer1.1');
					expect(choices[1].index).to.equal(2);
					expect(choices[1].text).to.equal('answer1.2');
					expect(choices[2].index).to.equal(3);
					expect(choices[2].text).to.equal('answer1.3');
					
					done();
				}.bind(this);

				startGame.bind(this)(cb, this.ws2);
			});

			it("sends the question in a question message to the host " 
					+ "player", function(done) {
				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');					
					expect(msg.question).to.exist;
					expect(msg.question.index).to.equal(2);
					expect(msg.question.text).to.equal('question2');
					expect(msg.question.points).to.equal(2);

					var choices = msg.question.choices;
					choices.sort((x, y) => (x.index - y.index));
					expect(choices[0].index).to.equal(1);
					expect(choices[0].text).to.equal('answer2.1');
					expect(choices[1].index).to.equal(2);
					expect(choices[1].text).to.equal('answer2.2');
					expect(choices[2].index).to.equal(3);
					expect(choices[2].text).to.equal('answer2.3');
					
					done();
				}.bind(this);
					
				var cb1 = function(msg) {
					requestNextQuestionHNP.bind(this)(cb2);
				}.bind(this);

				startGame.bind(this)(cb1);
			});

			it("sends the question in a question message to a "
					+ "non-host player", function(done) {
				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');					
					expect(msg.question).to.exist;
					expect(msg.question.index).to.equal(2);
					expect(msg.question.text).to.equal('question2');
					expect(msg.question.points).to.equal(2);

					var choices = msg.question.choices;
					choices.sort((x, y) => (x.index - y.index));
					expect(choices[0].index).to.equal(1);
					expect(choices[0].text).to.equal('answer2.1');
					expect(choices[1].index).to.equal(2);
					expect(choices[1].text).to.equal('answer2.2');
					expect(choices[2].index).to.equal(3);
					expect(choices[2].text).to.equal('answer2.3');
					
					done();
				}.bind(this);
					
				var cb1 = function(msg) {
					requestNextQuestionHNP.bind(this)(cb2, this.ws1, this.ws2);
				}.bind(this);

				startGame.bind(this)(cb1);
			});
		})

		describe("answering (common to all games)", function() {

			function runAnswerWrongPhaseTest(phase, done) {
				var cb = function(msg) {
					this.qinst.phase = phase;

					this.ws2.once('message', function(msg) {
						msg = JSON.parse(msg);

						expect(msg.type).to.equal('error');
						expect(msg.errtype).to.equal('AnswerWrongPhase');
						expect(msg.doesDisplay).to.be.false;

						done();
					}.bind(this));

					this.ws2.send(JSON.stringify({
						type: 'answer',
						questionIndex: 1,
						answer: [1],
					}));
				}.bind(this);

				startGame.bind(this)(cb, this.ws2);
			}
			
			it("does not process the answer if the game is in the prep "
					+ "phase", function(done) {
				runAnswerWrongPhaseTest.bind(this)(wss.QINST_PHASE_PREP, done);
			});

			it("does not process the answer if the game is in the ready "
					+ "phase", function(done) {
				runAnswerWrongPhaseTest.bind(this)(wss.QINST_PHASE_READY, done);
			});
			
			it("does not process the answer if the game is in the finished "
					+ "phase", function(done) {
				runAnswerWrongPhaseTest.bind(this)(wss.QINST_PHASE_FINISHED, done);
			});

			it("stores the answer in the player's answers array",
					function(done) {
				var player = this.qinst.players.find(
					(x) => (x.nickname === 'nick2'));

				var cb = function(msg) {
					this.ws2.once('message', function(msg) {
						msg = JSON.parse(msg);

						expect(msg.type).to.equal('answerFeedback');
						expect(player.answers).to.have.lengthOf(1);
						expect(player.answers[0]).to.deep.equal({
								answer: [1],
								questionIndex: 1,
							});
						done();
					}.bind(this));

					expect(player.answers).to.have.lengthOf(0);

					this.ws2.send(JSON.stringify({
						type: 'answer',
						questionIndex: 1,
						answer: [1],
					}));
				}.bind(this);
				
				startGame.bind(this)(cb, this.ws2);
			});

			it("handles two successive answers, storing the second answer "
				+ "in the player's answers array", function(done) {
				var player = this.qinst.players.find(
					(x) => (x.nickname === 'nick2'));
				expect(player.answers).to.have.lengthOf(0);

				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');
					expect(player.answers).to.have.lengthOf(1);

					this.ws2.once('message', function(msg) {
						expect(player.answers).to.have.lengthOf(2);
						expect(player.answers[1]).to.deep.equal({
							questionIndex: 2,
							answer: [2],
						});

						done();
					});
	
					this.ws2.send(JSON.stringify({
						type: 'answer',
						questionIndex: 2,
						answer: [2],
					}));
				}.bind(this);

				var cb1 = function(msg) {
					requestNextQuestionHNP.bind(this)(cb2, this.ws1, this.ws2);
				}.bind(this);

				startGame.bind(this)(cb1);
			});

			it("does not proceed to the next question if the index in the "
					+ "nextQuestion message does not match the current "
					+ "question's index", function(done) {

				var cb = function() {
					var kMessages = 0;
					var answerListener = function(msg) {
						msg = JSON.parse(msg);
						if (msg.type === "answerFeedback") {
							kMessages++;
						}

						if (kMessages === 2) {
							this.ws2.removeListener('message', answerListener);
							this.ws3.removeListener('message', answerListener);

							this.ws1.on('message', function(msg) {
								msg = JSON.parse(msg);
								expect(msg.type).to.equal('error');
								expect(msg.errtype).to.equal(
									'NextQuestionWrongQuestion');
								expect(msg.doesDisplay).to.be.false;
								done();
							}.bind(this));

							this.ws1.send(JSON.stringify({
								type: 'nextQuestion',
								questionIndex: this.qinst.questionIndex + 1
							}));
						}
					}.bind(this);
					this.ws2.on('message', answerListener);
					this.ws3.on('message', answerListener);

					sendAnswer(this.ws2, 1, [2]);
					sendAnswer(this.ws3, 1, [3]);
				}.bind(this);

				startGame.bind(this)(cb);
			});

			it("sends an error if multiple answers are included in a "
					+ "question where isMultipleResponse is set to false",
					function(done) {
				var question = this.qinst.quiz.questions.find(
					(x) => (x.index === 1));
				expect(question.isMultipleResponse).to.be.false;
				var cb = function(msg) {
					this.ws2.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('error');
						expect(msg.errtype).to.equal(
							'AnswerNonMultipleResponse');
						done();
					}.bind(this));

					this.ws2.send(JSON.stringify({
						type: 'answer',
						questionIndex: 1,
						answer: [1, 2],
					}));
				}.bind(this);

				startGame.bind(this)(cb, this.ws2);
			});

			it("accepts multiple answers to a multiple-response question "
				, function(done) {
				var question = this.qinst.quiz.questions.find(
					(x) => (x.index === 1));
				question.isMultipleResponse = true;
				
				var cb = function(msg) {
					this.ws2.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('answerFeedback');
						done();
					}.bind(this));

					this.ws2.send(JSON.stringify({
						type: 'answer',
						questionIndex: 1,
						answer: [1, 2],
					}));
				}.bind(this);

				startGame.bind(this)(cb, this.ws2);
			});
		});
	});

	describe("games where players advance together", function() {
		describe("answering and receiving feedback", function() {
			it("sets hasAnswered to true when the player answers",
					function(done) {
				var player = this.qinst.players.find(
					(x) => (x.nickname === 'nick2'));
				expect(player.hasAnswered).to.be.false;

				var cb = function(msg) {
					this.ws2.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('answerFeedback');
						expect(player.hasAnswered).to.be.true;
						done();
					});

					sendAnswer(this.ws2, 1, [1]);
				}.bind(this);

				startGame.bind(this)(cb, this.ws2);
			});

			it("sends the commentary and correct answer when the player "
					+ "answers", function(done) {
				var cb = function(msg) {
					this.ws2.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('answerFeedback');
						expect(msg.questionIndex).to.equal(1);
						expect(msg.correctAnswer).to.deep.equal([1]);
						expect(msg.commentary).to.equal('Geneza 1:1');

						done();
					}.bind(this));
				
					sendAnswer(this.ws2, 1, [1]);
				}.bind(this);
			
				startGame.bind(this)(cb, this.ws2);
			});
		});
	
		describe("proceeding to the next question", function() {
			function runNextQuestionWrongPhase(phase, done) {
				var cb = function() {
					var nextQuestionListener =  function(msg) {
						msg = JSON.parse(msg);
						if (msg.type === 'error') {
							expect(msg.type).to.equal('error');
							expect(msg.errtype).to.equal(
								'NextQuestionWrongPhase');
							done();
						
						}
					}
					
					var kMessages = 0;
					var answerListener = function(msg) {
						msg = JSON.parse(msg);
						if (msg.type === 'answerFeedback') {
							kMessages++;
						}
						if (kMessages === 2) {
							this.ws2.removeListener('message', answerListener);
							this.ws3.removeListener('message', answerListener);

							this.qinst.phase = phase;

							this.ws1.on('message', nextQuestionListener);
							this.ws1.send(JSON.stringify({
								type: 'nextQuestion',
								questionIndex: this.qinst.questionIndex
							}));
						}
					}.bind(this);
					this.ws2.on('message', answerListener);
					this.ws3.on('message', answerListener);

					sendAnswer(this.ws2, 1, [2]);
					sendAnswer(this.ws3, 1, [3]);
				}.bind(this);

				startGame.bind(this)(cb, this.ws2);
			}

			function requestNextQuestionNotAllReady(cb, answerers) {
				kMessages = 0;
				var answerListener = function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('answerFeedback');
					kMessages++;

					if (kMessages === answerers.length) {
						for (answerer of answerers) {
							answerer.removeListener('message', answerListener);
						}

						this.ws1.once('message', function(msg) {
							msg = JSON.parse(msg);
							expect(msg.type).to.equal('error');
							expect(msg.errtype).to.equal(
								'NextQuestionNotAllReady');
							cb();
						});

						this.ws1.send(JSON.stringify({
							type: 'nextQuestion',
							questionIndex: 1,
						}));
					}
				}.bind(this)

				for (answerer of answerers) {
					answerer.on('message', answerListener);
					sendAnswer(answerer, 1, [1]);
				}
			}



			
			it("does not process the nextQuestion request if the game is "
					+ "in the prep phase", function(done) {
				runNextQuestionWrongPhase.bind(this)(
					wss.QINST_PREP_PHASE, done);
			});

			it("does not process the nextQuestion request if the game is "
					+ "in the ready phase", function(done) {
				runNextQuestionWrongPhase.bind(this)(
					wss.QINST_READY_PHASE, done);
			});
			
			it("does not process the nextQuestion request if the game is "
					+ "in the finished phase", function(done) {
				runNextQuestionWrongPhase.bind(this)(
					wss.QINST_FINISHED_PHASE, done);
			});
			
			it("uses per-question timing even when isTimePerQuestion "
					+ "is set to false", function(done) {
				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');
					expect(msg.question.index).to.equal(2);
					done();
				}

				var cb1 = function(msg) {
					var kTime = new Date();
					var delta = this.qinst.finishTime.getTime()
						- kTime.getTime();

					var question = this.qinst.quiz.questions.find(
						(x) => (x.index === 1));
					expect(question.time).to.be.null;
					var quizTimeMs = parseInt(
						1000 * this.qinst.quiz.settings.time);
					expect(quizTimeMs).to.equal(delta);

					requestNextQuestionHNP.bind(this)(cb2, this.ws1, this.ws2);
				}.bind(this);
				this.qinst.quiz.settings.isTimePerQuestion = false;

				startGame.bind(this)(cb1, this.ws2);
			});

			it("proceeds to the next question on request when all players "
					+ "other than the host have answered, if the host is not "
					+ "playing", function(done) {
				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');
					expect(msg.question.index).to.equal(2);
					done();
				}.bind(this);

				var cb1 = function(msg) {
					requestNextQuestionHNP.bind(this)(cb2, this.ws1, this.ws2);
				}.bind(this);

				startGame.bind(this)(cb1, this.ws2);
			});

			it("proceeds to the next question on request when all players "
					+ "including the host have answered, if the host is "
					+ "playing", function(done) {
				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');
					expect(msg.question.index).to.equal(2);
					done();
				}.bind(this);

				var cb1 = function(msg) {
					requestNextQuestionHP.bind(this)(cb2, this.ws1, this.ws2);
				}.bind(this);

				this.qinst.quiz.settings.doesHostPlay = true;
				this.conn1.player.isPlaying = true;
				startGame.bind(this)(cb1, this.ws2);
			});

			it("does not proceed to the next question on request if not "
					+ "all players other than the host have answered, if the "
					+ "host is not playing", function(done) {
				var cb = function(msg) {
					requestNextQuestionNotAllReady.bind(this)(
						done, [this.ws2]);
				}.bind(this);

				startGame.bind(this)(cb, this.ws2);
			});

			it("does not proceed to the next question on request if not "
					+ "all players have answered, if the host is playing",
					function(done) {
				var cb = function(msg) {
					requestNextQuestionNotAllReady.bind(this)(
						done, [this.ws2, this.ws3]);
				}.bind(this);

				this.qinst.quiz.settings.doesHostPlay = true;
				this.conn1.player.isPlaying = true;
				startGame.bind(this)(cb, this.ws2);
			});

			it("does not proceed to the next question if the index in the "
					+ "nextQuestion message does not match the current "
					+ "question's index", function(done) {
				var cb2 = function(msg) {
					expect(msg.type).to.equal('error');
					expect(msg.errtype).to.equal('NextQuestionWrongQuestion');
					done();
				}.bind(this);
						
				var cb1 = function(msg) {
					requestNextQuestionHNP.bind(this)(
						cb2, this.ws1, this.ws1, null, 2);
				}.bind(this);

				startGame.bind(this)(cb1, this.ws2);
			})

			it("handles two successive questions where the host proceeds "
					+ "to the next question via a nextQuestion message",
					function(done) {
				var cb3 = function(msg) {
					expect(msg.type).to.equal('question');
					expect(msg.question.index).to.equal(3);
					done();
				}.bind(this);

				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');
					expect(msg.question.index).to.equal(2);
					requestNextQuestionHNP.bind(this)(cb3);
				}.bind(this);

				var cb1 = function(msg) {
					expect(msg.question.index).to.equal(1);
					requestNextQuestionHNP.bind(this)(cb2);
				}.bind(this);

				startGame.bind(this)(cb1, this.ws2);
			});

			it("proceeds to the next question when the time expires "
					+ "irrespective of whether anyone has answered the "
					+ "question", function(done) {
				var question = this.qinst.quiz.questions.find(
					(x) => (x.index === 1));
				expect(question.time).to.be.null;

				var cb = function(msg) {
					this.ws1.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('question');
						done();
					}.bind(this));

					this.clock.tick(this.qinst.quiz.settings.time * 1000);
				}.bind(this);
			
				startGame.bind(this)(cb, this.ws2);
			});

			it("enters hostless mode when the host leaves the game, "
					+ "clearing all host-related variables", function(done) {
				var cb = function(msg) {
					this.ws2.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('playerLeft');
						expect(this.qinst.hostConn).to.be.null;
						expect(this.qinst.hostNickname).to.be.null;
						done();
					}.bind(this));

					this.ws1.send(JSON.stringify({
						type: 'leave',
					}));
				}.bind(this);

				startGame.bind(this)(cb, this.ws2);
			});

			it("still proceeds to the next question when the question "
					+ "time expires while in hostless mode", function(done) {
				var cb = function(msg) {
					var question = this.qinst.quiz.questions.find(
						(x) => (x.index === 1));
					expect(question.time).to.be.null;

					this.ws2.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('playerLeft');
						expect(this.qinst.hostConn).to.be.null;
						expect(this.qinst.hostNickname).to.be.null;

						this.ws2.once('message', function(msg) {
							msg = JSON.parse(msg);
							expect(msg.type).to.equal('question');
							expect(msg.question).to.exist;
							expect(msg.question.index).to.equal(2);
							done();
						}.bind(this));

						this.clock.tick(this.qinst.quiz.settings.time * 1000);
					}.bind(this));

					this.ws1.send(JSON.stringify({ type: 'leave' }));
				}.bind(this);
			
				startGame.bind(this)(cb, this.ws2);
			});

			it("sets hasAnswered to false for non-host players when the "
					+ "game proceeds to the next question", function(done) {
				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');
					expect(this.conn2.player.hasAnswered).to.be.false;
					expect(this.conn3.player.hasAnswered).to.be.false;
					done();
				}.bind(this);
			
				var cb1 = function(msg) {
					requestNextQuestionHNP.bind(this)(cb2);
				}.bind(this);

				expect(this.conn1.player.hasAnswered).to.be.false;
				expect(this.conn2.player.hasAnswered).to.be.false;
				expect(this.conn3.player.hasAnswered).to.be.false;

				startGame.bind(this)(cb1, this.ws2);
			});

			it("sets hasAnswered to false for all players including the "
					+ "host player when the game proceeds to the next "
					+ "question if the host is playing", function(done) {
				var cb2 = function(msg) {
					expect(msg.type).to.equal('question');
					expect(this.conn1.player.hasAnswered).to.be.false;
					expect(this.conn2.player.hasAnswered).to.be.false;
					expect(this.conn3.player.hasAnswered).to.be.false;
					done();
				}.bind(this);
			
				var cb1 = function(msg) {
					requestNextQuestionHP.bind(this)(cb2);
				}.bind(this);

				expect(this.conn1.player.hasAnswered).to.be.false;
				expect(this.conn2.player.hasAnswered).to.be.false;
				expect(this.conn3.player.hasAnswered).to.be.false;

				this.qinst.quiz.settings.doesHostPlay = true;
				this.conn1.player.isPlaying = true;
				startGame.bind(this)(cb1, this.ws2);
			});
		});


		describe("game completion", function() {
			// have the two non-host players send the answers to all questions
			// apart from the final question, for which player 3 alone answers
			function advanceNearFinishHNP(cb) {
				var advance = function() {
					var kAnswerNoticeMessages = 0;
					var kQuestion = 1;

					var finalListener = function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('answerNotice');
						kAnswerNoticeMessages++;
						if (kAnswerNoticeMessages === 2) {
							this.ws1.removeListener('message',
								finalListener);
							cb(msg);
						}
					}.bind(this);

					var nextQuestionListener = function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('question');
						kQuestion++;

						this.ws1.removeListener('message',
							answerNoticeListener);
						if (kQuestion == 2) {
							this.ws1.on('message', answerNoticeListener);
						} else if (kQuestion == 3) {
							this.ws1.on('message', finalListener);
						}
						sendAnswer(this.ws2, kQuestion, [1]);
						sendAnswer(this.ws3, kQuestion, [1]);
					}.bind(this);

					var answerNoticeListener = function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('answerNotice');
						kAnswerNoticeMessages++;

						if (kAnswerNoticeMessages === 2) {
							kAnswerNoticeMessages = 0;
							this.ws1.removeListener(
								'message', answerNoticeListener);
							this.ws1.once('message', nextQuestionListener);
							this.ws1.send(JSON.stringify({
								type: 'nextQuestion',
								questionIndex: kQuestion,
							}));
						}
					}.bind(this);

					this.ws1.on('message', answerNoticeListener);
					sendAnswer(this.ws2, 1, [1]);
					sendAnswer(this.ws3, 1, [1]);
				}.bind(this);

				startGame.bind(this)(advance, this.ws2);
			};


			it("sends the qinstEnd message to the host when the time of "
					+ "the last question has expired", function(done) {
				var question = this.qinst.quiz.questions.find(
					(x) => (x.index === 3));
				expect(question.time).to.be.null;
						
				var cb = function() {
					this.ws1.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('qinstEnd');
						done();
					}.bind(this))

					this.clock.tick(this.qinst.quiz.settings.time * 1000);
				}.bind(this);

				advanceNearFinishHNP.bind(this)(cb);
			});

			it("sends the qinstEnd message to a player when the time of "
					+ "the last question has expired", function(done) {
				var question = this.qinst.quiz.questions.find(
					(x) => (x.index === 3));
				expect(question.time).to.be.null;

				var cb = function() {
					this.ws2.on('message', function(msg) {
						msg = JSON.parse(msg);
						if (msg.type === 'qinstEnd') {
							done();
						}
					}.bind(this))

					this.clock.tick(this.qinst.quiz.settings.time * 1000);
				}.bind(this);

				advanceNearFinishHNP.bind(this)(cb);
			});

			it("sends the qinstEnd message to the host when the host "
					+ "has sent nextQuestion after the final question"
					, function(done) {
				var question = this.qinst.quiz.questions.find(
					(x) => (x.index === 3));
				expect(question.time).to.be.null;

				var cb = function() {
					this.ws1.on('message', function(msg) {
						msg = JSON.parse(msg);
						if (msg.type === 'qinstEnd') {
							done();
						}
					}.bind(this))

					this.ws1.send(JSON.stringify({
						type: 'nextQuestion',
						questionIndex: 3,
					}));
				}.bind(this);

				advanceNearFinishHNP.bind(this)(cb);
			});

			it("sends the qinstEnd message to a player when the host "
					+ "has sent nextQuestion after the final question"
					, function(done) {
				var question = this.qinst.quiz.questions.find(
					(x) => (x.index === 3));
				expect(question.time).to.be.null;

				var cb = function() {
					this.ws2.on('message', function(msg) {
						msg = JSON.parse(msg);
						if (msg.type === 'qinstEnd') {
							done();
						}
					}.bind(this))

					this.ws1.send(JSON.stringify({
						type: 'nextQuestion',
						questionIndex: 3,
					}));
				}.bind(this);

				advanceNearFinishHNP.bind(this)(cb);
			});

			it("sends an error message if a player resends their "
					+ "answer after the qinstEnd message was sent",
					function (done) {
				var question = this.qinst.quiz.questions.find(
					(x) => (x.index === 3));
				expect(question.time).to.be.null;

				var cb = function() {
					var kMessages = 0;
					this.ws2.on('message', function(msg) {
						msg = JSON.parse(msg);
						kMessages++;

						if (kMessages === 2) {
							this.ws2.once('message', function(msg) {
								msg = JSON.parse(msg);
								expect(msg.type).to.equal('error');
								expect(msg.errtype).to.equal(
									'AnswerWrongPhase');
								done();
							}.bind(this));
														
							this.ws2.send(JSON.stringify({
								type: 'answer',
								questionIndex: 3,
								answer: [1],
							}));
						}
					}.bind(this))

					this.ws1.send(JSON.stringify({
						type: 'nextQuestion',
						questionIndex: 3,
					}));
				}.bind(this);

				advanceNearFinishHNP.bind(this)(cb);
			});

			it("sends an error message if the host resends their "
				 	+ "nextQuestion message after the game has entered "
					+ "the finished phase", function(done) {
				var question = this.qinst.quiz.questions.find(
					(x) => (x.index === 3));
				expect(question.time).to.be.null;

				var cb = function() {
					var kMessages = 0;
					this.ws2.on('message', function(msg) {
						msg = JSON.parse(msg);
						kMessages++;

						if (kMessages === 2) {
							this.ws1.once('message', function(msg) {
								msg = JSON.parse(msg);
								expect(msg.type).to.equal('error');
								expect(msg.errtype).to.equal(
									'NextQuestionWrongPhase');
								done();
							}.bind(this));
														
							this.ws1.send(JSON.stringify({
								type: 'nextQuestion',
								questionIndex: 3,
							}));
						}
					}.bind(this))

					this.ws1.send(JSON.stringify({
						type: 'nextQuestion',
						questionIndex: 3,
					}));
				}.bind(this);

				advanceNearFinishHNP.bind(this)(cb);
			
			});
		});
	});

	//[TODO]
	describe("games where players advance separately", function() {
		beforeEach(function() {
			// player 1 has answered 2/3 questions, player 2 has answered 1/3
			// and player 3 has answered 0/3

		});

		describe("reconnecting in games where players advance separately",
				function() {
			it("sends the player the correct question in the welcome "
				+ "message");
		});

		describe("quiz timing in games where players advance separately",
				function() {
			it("uses per-quiz timing when isTimePerQuestion is false");

			it("sends the qinstEnd message after the time expires "
				+ "when the game uses per-quiz timing");

			it("uses per-question timing when isTimePerQuestion is true");

			it("sends the new question after the time expires "
				+ "when the game uses per-question timing");

			it("accounts for the different question times of individual "
				+ "questions");

			it("sends the qinstEnd message after the final question's "
				+ "time expires when the game uses per-question timing");
		});


		describe("answering questions in games where players advance "
				+ "separately", function() {
			it("throws an error when the host attempts to send "
				+ "nextQuestion")

			it("sends a question message to a player who has answered the "
				+ "first question");

			it("does not send the other players any messages when a player "
				+ "has answered the first question")

			it("sends a playerResults message to a player who has "
				+ "completed all questions");

			it("does not send a playerResults message again to a player "
				+ "who resends their answer after the first playerResults "
				+ "message was sent");
		});

		describe("game completion in games where players advance separately "
				, function() {
			it("sends the qinstEnd message to all players when the "
				+ "time runs out for the last player remaining ");

			it("sends the qinstEnd message to all players when the "
				+ "last player remaining has answered the last question, ");

			//[TODO] Use the 'qinstEnd' wss message
			it("does not send the qinstEnd message again if a player "
				+ "resends their answer after the game has entered "
				+ "the finished phase, in games where the players advance "
				+ "separately");
		});
	});
}
