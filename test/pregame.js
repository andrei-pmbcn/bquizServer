// the prep and ready phases of the game, when players join the game and prepare
// to start it

//[TODO] Fix the 1000-ms tests

module.exports = function() {
	beforeEach(function(done) {
		createWebsocket(function(ws) {
			this.ws1 = ws;
			createWebsocket(function(ws) {
				this.ws2 = ws;

				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);
					this.code = msg.code;
					done();
				}.bind(this));

				wss.doesThrottle = false;
				this.ws1.send(JSON.stringify({
					type: 'create',
					quizId: this.quizId,
					nickname: 'nick1',
				}));
			}.bind(this));
		}.bind(this));
	});

	afterEach(function() {
		if (this.ws1.readyState === this.ws1.OPEN) {
			this.ws1.close(1000);
		}
		if (this.ws2.readyState === this.ws2.OPEN) {
			this.ws2.close(1000);
		}

		this.ws1.player = null;
		this.ws2.player = null;
		wss.qinsts = {};

		wss.doesThrottle = true;
	});

	function addAllPlayers(callback) {
		this.ws1.once('message', function (msg) {
			msg = JSON.parse(msg);
			expect(msg.type).to.equal('welcome');

			this.ws2.once('message', function (msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('welcome');

				callback();
			}.bind(this));

			sendJoin2.bind(this)();
		}.bind(this));

		sendJoin1.bind(this)();
	}

	function addAllPlayersAndMessage(sender, callback, message, receiver) {
		if (!receiver) {
			receiver = sender;
		}
		var sendMessageAndRespond = function() {
			receiver.once('message', function(msg) {
				msg = JSON.parse(msg);
				callback.bind(this)(msg);
			}.bind(this));

			sender.send(JSON.stringify(message));
		}.bind(this);

		addAllPlayers.bind(this)(sendMessageAndRespond);
	}



	describe("players reconnecting", function() {
		it("sends the welcome message if the player is logged in "
				+ "and does not specify a nickname when reconnecting",
				function(done) {
			this.ws1.once('message', function(msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('welcome');

				this.ws2.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('welcome');

					this.ws2.close(1001);

					createWebsocket(function(ws) {
						ws.once('message', function(msg) {
							msg = JSON.parse(msg);
							expect(msg.type).to.equal('welcome');
							expect(msg.phase).to.equal(wss.QINST_PHASE_PREP);
							expect(msg.players).to.have.lengthOf(2);
							ws.close(1000);

							done();
						});

						ws.send(JSON.stringify({
							type:'join',
							code: this.code,
							username:'user2',
							password:'pass2',
						}));
					}.bind(this));
				}.bind(this));

				sendJoin2.bind(this)();
			}.bind(this));

			sendJoin1.bind(this)();
		});

		it("sends the welcome message if the player is logged in "
				+ "and specifies a nickname when reconnecting",
				function(done) {
			this.ws1.once('message', function(msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('welcome');

				this.ws2.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('welcome');

					this.ws2.close(1001);

					createWebsocket(function(ws) {
						ws.once('message', function(msg) {
							msg = JSON.parse(msg);
							expect(msg.type).to.equal('welcome');
							expect(msg.phase).to.equal(wss.QINST_PHASE_PREP);
							expect(msg.players).to.have.lengthOf(2);
							ws.close();

							done();
						});

						ws.send(JSON.stringify({
							type: 'join',
							code: this.code,
							username: 'user2',
							password: 'pass2',
							nickname: 'nick2',
						}));
					}.bind(this));
				}.bind(this));
				
				sendJoin2.bind(this)();
			}.bind(this));

			sendJoin1.bind(this)();
		});

		it("does not allow reconnection without being logged in ",
				function(done) {
			this.ws1.once('message', function(msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('welcome');

				this.ws2.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('welcome');
					
					this.ws2.close(1001);

					createWebsocket(function(ws) {
						ws.once('message', function(msg) {
							msg = JSON.parse(msg);
							expect(msg.type).to.equal('error');
							expect(msg.errtype).to.equal('InvalidNickname');
							ws.close(1000);

							done();
						});

						ws.send(JSON.stringify({
							type:'join',
							code: this.code,
							nickname: 'nick2'
						}));
					}.bind(this));
				}.bind(this));

				sendJoin2.bind(this)();
			}.bind(this));

			sendJoin1.bind(this)();
		});
	});

	describe("players entering and leaving lobby", function() {
		it("creates the quiz instance when the host "
				+ "issues the create message", function(done) {
			this.ws1.once('message', function(msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('code');
				expect(msg.code).to.be.above(10 ** 9);
				expect(msg.code).to.be.below(10 ** 10);

				expect(wss.qinsts).to.have.property(msg.code);
				expect(wss.qinsts[msg.code].conns).to.have.lengthOf(0);
				expect(wss.qinsts[msg.code].players).to.have.lengthOf(0);
				expect(wss.qinsts[msg.code].isJoinable).to.be.true;
				expect(wss.qinsts[msg.code].phase)
					.to.equal(wss.QINST_PHASE_PREP);
				expect(wss.qinsts[msg.code].code).to.equal(msg.code);

				deleteQinst(msg.code);

				done();
				}.bind(this));

			this.ws1.send(JSON.stringify({
				type: 'create',
				quizId: this.quizId,
			}));
		});

		it("deletes the quiz instance 30 seconds after creation if "
				+ "no player joins", function(done) {
			useFakeTimeouts.bind(this)();

			this.ws1.once('message', function(msg) {
				msg = JSON.parse(msg);
				var code = msg.code;
				
				expect(wss.qinsts).to.have.property(code);

				this.clock.tick(31000);

				expect(wss.qinsts).to.not.have.property(code);

				this.ws1.once('close', function() {
					expect(wss.conns).to.have.lengthOf(1);
					expect(wss.conns[0].qinst).to.be.null;
					this.clock.restore();
					done();
				}.bind(this));
			}.bind(this));

			this.ws1.send(JSON.stringify({
				type: 'create',
				quizId: this.quizId,
			}));
		}); 

		it("does not throttle a message sent immediately after "
				+ "a create message", function(done) {
			wss.doesThrottle = true;
			this.ws1.once('message', function(msg) {
				msg = JSON.parse(msg);
				var code = msg.code;

				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('welcome');

					deleteQinst(code);

					done();
				});

				this.ws1.send(JSON.stringify({
					type: 'join',
					code: msg.code,
					nickname: 'nick1',
				}));
			}.bind(this));

			this.ws1.send(JSON.stringify({
				type:'create',
				quizId: this.quizId,
			}));
		});

		it("throttles (join) messages to 1/sec", function(done) {
			wss.doesThrottle = true;
			useFakeTimeouts.bind(this)();

			this.ws1.once('message', (function(msg) {
				msg = JSON.parse(msg);
				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);

					expect(msg.type).to.equal('error');
					expect(msg.errtype).to.equal('WebsocketError');

					var finalSend = function() {
						this.ws1.send(JSON.stringify({
							type: 'join',
							code: this.code,
							nickname: 'nick2',
						}));
					}.bind(this);

					this.ws1.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('error');
						expect(msg.errtype).to.equal('AlreadyJoined');
						this.clock.restore();
						done();
					}.bind(this));

					setTimeout(finalSend, 1010);
					this.clock.tick(1020);
				}.bind(this));

				this.ws1.send(JSON.stringify({
					type: 'join',
					code: this.code,
					nickname: 'nick2',
				}));
			}).bind(this));		

			this.ws1.send(JSON.stringify({
				type:'join',
				code: this.code,
				nickname: 'nick1',
			}));
		});

		it("does not allow joining without a nickname", function(done) {
			var ws1 = this.ws1;

			this.ws1.once('message', function(msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('error');
				expect(msg.errtype).to.equal('NoNickname');

				done();
			});

			this.ws1.send(JSON.stringify({
				type:'join',
				code:this.code,
				username: 'user1',
				password: 'pass1',
			}));
		});

		it("adds the first player upon joining", function(done) {
			this.ws1.once('message', (function(msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('welcome');
				
				var player = wss.qinsts[this.code].players.find(
					(x)=>(x.username == 'user1'));
				
				expect(player.nickname).to.equal('nick1');
				expect(player.isReady).to.be.false;

				done();
			}.bind(this)));

			sendJoin1.bind(this)();
		});

		it("adds the second player upon joining",
				function (done) {
			this.ws1.once('message', function(msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('welcome');

				this.ws2.once('message', (function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('welcome');
					var player = wss.qinsts[this.code].players.find(
						(x)=>(x.username == 'user2'));
					
					expect(player.nickname).to.equal('nick2');
					expect(player.isReady).to.be.false;

					done();
				}.bind(this)));

				sendJoin2.bind(this)();
			}.bind(this));

			sendJoin1.bind(this)();
		});

		it("informs the other player when a player joins",
				function(done) {
			this.ws1.once('message', function(msg) {
				msg = JSON.parse(msg);
				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('playerJoined');
					expect(msg.nickname).to.equal('nick2');
					done();
				});
				sendJoin2.bind(this)()
			}.bind(this));
			
			sendJoin1.bind(this)();
		});

		it("does not permit a player to join using another player's "
			+ "nickname", function(done) {
			this.ws1.once('message', (function(msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('welcome');

				this.ws2.send(JSON.stringify({
					type:'join',
					code: this.code,
					username: 'user2',
					password: 'pass2',
					nickname: 'nick1',
				}));
			}).bind(this));

			this.ws2.once('message', (function(msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('error');
				expect(msg.errtype).to.equal('InvalidNickname');
				done();
			}));
	
			sendJoin1.bind(this)();
		});

		it("closes the websocket connection when a player leaves",
				function(done) {
			var qinst = wss.qinsts[this.code];
			this.ws1.once('message', function() {
				sendJoin2.bind(this)();
			}.bind(this));

			this.ws2.once('message', function(msg) {
				expect(wss.conns).to.have.lengthOf(2);
				expect(qinst.conns).to.have.lengthOf(2);
				this.ws2.send(JSON.stringify({
					type: 'leave',
				}))
			}.bind(this));

			wss.once('connClosed', function() {
				expect(wss.conns).to.have.lengthOf(1); // from this.ws2
				expect(qinst.conns).to.have.lengthOf(1);
				done();
			}.bind(this));

			sendJoin1.bind(this)();
		});

		it("updates the qinst array and closes the game when the sole player "
				+ "leaves", function(done) {
			this.ws1.once('message', (function() {
				
				this.ws1.send(JSON.stringify({
					type: 'leave',
				}))
			}).bind(this));

			wss.once('qinstDeleted', function() {
				expect(wss.qinsts.hasOwnProperty(this.code)).to.be.false;
				done();
			}.bind(this))

			sendJoin1.bind(this)();
		});

		it("closes the game, disconnecting all players, when the host "
				+ "leaves", function(done) {
			this.ws1.once('message', function(msg) {

				// welcome message for player 2
				this.ws2.once('message', function(msg) {
					this.ws1.send(JSON.stringify({
						type: 'leave'
					}));

					this.ws2.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('connectionClosed');
						expect(wss.qinsts).to.not.have.property(this.code);
						expect(this.ws1.readyState).to.be.oneOf([
							this.ws1.CLOSING, 
							this.ws1.CLOSED,
						]);
						done();
					}.bind(this));
				}.bind(this));

				sendJoin2.bind(this)();
			}.bind(this));

			sendJoin1.bind(this)();
		});

		it("does not close the game when the host simply disconnects",
				function(done) {
			this.ws1.once('message', function(msg) {

				// welcome message for player 2
				this.ws2.once('message', function(msg) {
					this.ws1.close(1001);
					var checkQinstNotDeleted = function() {
						msg = JSON.parse(msg);
						expect(wss.qinsts).to.have.property(this.code);
						expect(wss.qinsts[this.code].conns)
							.to.have.lengthOf(1);
						expect(wss.qinsts[this.code].players)
							.to.have.lengthOf(2);
						done();
					}.bind(this);
				
					setTimeout(checkQinstNotDeleted, 1000);
				}.bind(this));

				sendJoin2.bind(this)();
			}.bind(this));

			sendJoin1.bind(this)();
		});

		it("does not close the game when a non-host player leaves",
				function(done) {
			this.ws1.once('message', function(msg) {

				// welcome message for player 2
				this.ws2.once('message', function(msg) {
					this.ws2.send(JSON.stringify({
						type: 'leave'
					}));
				}.bind(this));
				
				this.ws2.on('close', function(msg) {
					var checkQinstNotDeleted = function() {
						expect(wss.qinsts).to.have.property(this.code);
						expect(wss.qinsts[this.code].conns)
							.to.have.lengthOf(1);
						expect(wss.qinsts[this.code].players)
							.to.have.lengthOf(1);
						done();
					}.bind(this);

					setTimeout(checkQinstNotDeleted, 1000);
				}.bind(this));

				sendJoin2.bind(this)();
			}.bind(this));

			sendJoin1.bind(this)();
		});

		it("updates the qinst array when a non-host player leaves",
				function(done) {
			this.ws1.once('message', function(msg) {
				this.ws2.once('message', function(msg) {
					this.ws2.send(JSON.stringify({
						type: 'leave'
					}));
				}.bind(this));

				this.ws2.once('close', function() {
					var qinst = wss.qinsts[this.code];
					expect(qinst.players).to.have.lengthOf(1);
					expect(qinst.conns).to.have.lengthOf(1);
					expect(qinst.players[0].nickname).to.equal('nick1');
					done();
				}.bind(this));

				sendJoin2.bind(this)();
			}.bind(this));

			sendJoin1.bind(this)();
		});

		it("removes a disconnected player from the qinst's player list if "
				+ "the player is not identified by username", function(done) {
			this.ws1.once('message', function(msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('welcome');
				this.ws2.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('welcome');

					this.ws1.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('playerLeft');
						var qinst = wss.qinsts[this.code];
						expect(qinst.players).to.have.lengthOf(1);
						expect(qinst.conns).to.have.lengthOf(1);
						expect(qinst.players[0].nickname).to.equal('nick1');
						done();
					}.bind(this));

					this.ws2.close();	
				}.bind(this))

				this.ws2.send(JSON.stringify({
					type: 'join',
					code: this.code,
					nickname: 'nick2',
				}));
			}.bind(this))

			sendJoin1.bind(this)();
		});

		it("keeps a disconnected player in the qinst's player list if "
				+ "the player is identified by username", function(done) {
			this.ws1.once('message', function(msg) {
				msg = JSON.parse(msg);
				expect(msg.type).to.equal('welcome');
				this.ws2.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('welcome');

					this.ws1.once('message', function(msg) {
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('playerLeft');
						var qinst = wss.qinsts[this.code];
						expect(qinst.players).to.have.lengthOf(2);
						expect(qinst.conns).to.have.lengthOf(1);

						done();
					}.bind(this));

					this.ws2.close();
				}.bind(this))

				this.ws2.send(JSON.stringify({
					type: 'join',
					code: this.code,
					username: 'user2',
					password: 'pass2',
					nickname: 'nick2',
				}));
			}.bind(this))

			sendJoin1.bind(this)();
		});

		it("informs the other player when a player leaves via a leave "
				+ "message", function(done) {
			var callback = function() {
				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('playerLeft');
					expect(msg.nickname).to.equal('nick2');
					expect(msg.isDisconnect).to.be.false;

					done();
				}.bind(this));

				this.ws2.send(JSON.stringify({type: 'leave'}));
			}.bind(this);

			addAllPlayers.bind(this)(callback);
		});

		it("informs the other player when a player disconnects",
				function(done) {
			var callback = function() {
				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('playerLeft');
					expect(msg.nickname).to.equal('nick2');
					expect(msg.isDisconnect).to.be.true;
				
					done();
				});

				this.ws2.close(1001);
			}.bind(this);

			addAllPlayers.bind(this)(callback);
		});
	});

	describe("players setting and unsetting their ready state", function() {
		it("turns on the player's ready state when requested",
				function (done) {
			var callback = function() {
				var players = wss.qinsts[this.code].players;
				var player = players.find((x) => (x.nickname == 'nick1'));

				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);
					
					expect(msg.type).to.equal('playerReady');
					expect(msg.nickname).to.equal('nick1');
					expect(player.isReady).to.be.true;

					done();
				}.bind(this));

				this.ws1.send(JSON.stringify({type: 'ready'}));
			}.bind(this);

			addAllPlayers.bind(this)(callback);
		});

		it("does not turn on the player's ready state if it is already "
				+ "turned on", function(done) {
			var callback = function() {
				var players = wss.qinsts[this.code].players;
				var player = players.find((x) => (x.nickname == 'nick1'));
				player.isReady = true;

				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('error');
					expect(msg.errtype).to.equal('AlreadyReady');
					expect(msg.doesDisplay).to.be.false;
					done();
				}.bind(this));

				this.ws1.send(JSON.stringify({type: 'ready'}));
			}.bind(this);
			
			addAllPlayers.bind(this)(callback);
		});

		it("turns off the player's ready state when requested",
				function(done) {
			var callback = function() {
				var players = wss.qinsts[this.code].players;
				var player = players.find((x) => (x.nickname == 'nick1'));
				player.isReady = true;

				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);
					
					expect(msg.type).to.equal('playerNotReady');
					expect(msg.nickname).to.equal('nick1');
					expect(player.isReady).to.be.false;

					done();
				}.bind(this));

				this.ws1.send(JSON.stringify({type: 'notReady'}));
			}.bind(this);

			addAllPlayers.bind(this)(callback);
		});

		it("turns off the player's ready state and notifies the other "
				+ "players when the player disconnects", function (done) {
			var callback = function() {
				var players = wss.qinsts[this.code].players;
				var player = players.find((x) => (x.nickname == 'nick2'));
				player.isReady = true;

				this.ws2.close(1001);

				this.ws1.on('message', function(msg) {
					msg = JSON.parse(msg);

					if (msg.type === 'playerNotReady') {
						expect(msg.nickname).to.equal('nick2');
						expect(player.isReady).to.be.false;
						done();
					}
				}.bind(this))
			}.bind(this);
			
			addAllPlayers.bind(this)(callback);
		});

		it("does not turn off the player's ready state if it is already "
				+ "turned off", function(done) {
			var callback = function() {
				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('error');
					expect(msg.errtype).to.equal('AlreadyNotReady');
					expect(msg.doesDisplay).to.be.false;
					done();
				}.bind(this));

				this.ws1.send(JSON.stringify({type: 'notReady'}));
			}.bind(this);
			
			addAllPlayers.bind(this)(callback);
		});

		var runReadyWrongPhaseTest = function(phase, isTestingReady, done) {
			var callback = function() {
				var players = wss.qinsts[this.code].players;
				var player = players.find((x) => (x.nickname == 'nick2'));
				player.isReady = isTestingReady ? false : true;
				wss.qinsts[this.code].phase = phase;

				this.ws2.once('message', function (msg) {
					msg = JSON.parse(msg);

					expect(msg.type).to.equal('error');
					expect(msg.errtype).to.equal(
						isTestingReady
							? 'ReadyWrongPhase'
							: 'NotReadyWrongPhase');
					done();
				}.bind(this));

				this.ws2.send(JSON.stringify({
					type: isTestingReady ? 'ready' : 'notReady'
				}));

			}.bind(this);

			addAllPlayers.bind(this)(callback);

		}

		it("does not turn off the player's ready state when the game is in "
				+ "the ready phase", function(done) {
			runReadyWrongPhaseTest.bind(this)(
				wss.QINST_READY_PHASE,
				true, done);
		});

		it("does not turn on the player's ready state when the game is in "
				+ "the active phase", function (done) {
			runReadyWrongPhaseTest.bind(this)(
				wss.QINST_ACTIVE_PHASE,
				true, done);
		});

		it("does not turn off the player's ready state when the game is in "
				+ "the finished phase", function(done) {
			runReadyWrongPhaseTest.bind(this)(
				wss.QINST_FINISHED_PHASE,
				true, done);
		});

		it("does not turn off the player's ready state when the game is in "
				+ "the ready phase", function(done) {
			runReadyWrongPhaseTest.bind(this)(
				wss.QINST_READY_PHASE,
				false, done);
		});

		it("does not turn off the player's ready state when the game is in "
				+ "the active phase", function(done) {
			runReadyWrongPhaseTest.bind(this)(
				wss.QINST_ACTIVE_PHASE,
				false, done);
		});

		it("does not turn off the player's ready state when the game is in "
				+ "the finished phase", function(done) {
			runReadyWrongPhaseTest.bind(this)(
				wss.QINST_FINISHED_PHASE,
				false, done);
		});

		it("notifies the other players when the player sends ready",
				function(done) {
			var callback = function() {
				this.ws2.once('message', function(msg) {
					msg = JSON.parse(msg);

					expect(msg.type).to.equal('playerReady');
					expect(msg.nickname).to.equal('nick1');

					done();
				});

				this.ws1.send(JSON.stringify({type: 'ready'}))
			}.bind(this);

			addAllPlayers.bind(this)(callback);
		});

		it("notifies the other players when the player sends notReady",
				function(done) {
			var callback = function() {
				var players = wss.qinsts[this.code].players;
				var player = players.find((x) => (x.nickname == 'nick1'));
				player.isReady = true;

				this.ws2.once('message', function(msg) {
					msg = JSON.parse(msg);
					
					expect(msg.type).to.equal('playerNotReady');
					expect(msg.nickname).to.equal('nick1');
					done();
				}.bind(this));

				this.ws1.send(JSON.stringify({type: 'notReady'}));
			}.bind(this);

			addAllPlayers.bind(this)(callback);
		});
	});

	describe("booting players", function() {
		it("does not boot the target player if the player requesting the "
				+ "boot is not the host", function(done) {
			var callback = function(msg) {
				expect(msg.type).to.equal('error');
				expect(msg.errtype).to.equal('UnauthorizedBoot');
				done();
			}.bind(this);

			addAllPlayersAndMessage.bind(this)(this.ws2, callback, {
				type: 'boot',
				nickname: 'nick1',
			});
		});

		it("boots the target player if the player requesting the "
				+ "boot is the host", function(done) {
			var callback = function(msg) {
				var conns = wss.qinsts[this.code].conns;
				expect(conns).to.have.lengthOf(1);
				expect(conns[0].player.nickname).to.equal('nick1');
				done();
			}.bind(this);

			addAllPlayersAndMessage.bind(this)(this.ws1, callback, {
				type: 'boot',
				nickname: 'nick2',
			});
		});

		it("sends an error message if the target player's nickname cannot "
			+ "be found", function (done) {
			var callback = function(msg) {
				expect(msg.type).to.equal('error');
				expect(msg.errtype).to.equal('CannotFindBootTarget');
				done();
			}.bind(this);

			addAllPlayersAndMessage.bind(this)(this.ws1, callback, {
				type: 'boot',
				nickname: 'nick0',
			});
		});

		it("does not allow the host to boot themselves", function(done) {
			var callback = function(msg) {
				expect(msg.type).to.equal('error');
				expect(msg.errtype).to.equal('SelfBoot');
				done();
			}.bind(this);

			addAllPlayersAndMessage.bind(this)(this.ws1, callback, {
				type: 'boot',
				nickname: 'nick1',
			});
		});

		it("sends a message to the booted player before disconnecting "
				+ "them", function (done) {
			var callback = function(msg) {
				expect(msg.type).to.equal('connectionClosed');
				done();
			}.bind(this);

			addAllPlayersAndMessage.bind(this)(this.ws1, callback, {
					type: 'boot',
					nickname: 'nick2',
				},
				this.ws2);
		});
	
		it("informs the other players if a player has been booted",
				function(done) {
			var callback = function(msg) {
				expect(msg.type).to.equal('playerLeft');
				expect(msg.nickname).to.equal('nick2');
				done();
			}.bind(this);

			addAllPlayersAndMessage.bind(this)(this.ws1, callback, {
				type: 'boot',
				nickname: 'nick2',
			});
		});
	});


	describe("players attempting to start the game", function() {
		function prep(sender, callback, message, receiver, allReady = true) {
			if (!receiver) {
				receiver = sender;
			}
			var sendMessageAndRespond = function() {
				receiver.once('message', function(msg) {
					msg = JSON.parse(msg);

					callback.bind(this)(msg);
				}.bind(this));

				for(var player of wss.qinsts[this.code].players) {
					player.isReady = true;
				}
				if (!allReady) {
					player.isReady = false;
				}

				sender.send(JSON.stringify(message));
			}.bind(this);

			addAllPlayers.bind(this)(sendMessageAndRespond);
		}

		it("sends an error message if anyone other than the game host attempts"
				+ "to start the game", function(done) {
			var callback = function(msg) {
				expect(msg.type).to.equal('error');
				expect(msg.errtype).to.equal('UnauthorizedStart');
				expect(wss.qinsts[this.code].phase)
					.to.equal(wss.QINST_PHASE_PREP);
				done();
			}.bind(this);

			prep.bind(this)(this.ws2, callback, {
				type: 'start',
			});
		});

		it("sends the host an error message if the host attempts to start "
				+ "the game without all players being ready", function(done) {
			var callback = function(msg) {
				expect(msg.type).to.equal('error');
				expect(msg.errtype).to.equal('StartNotAllReady');
				expect(wss.qinsts[this.code].phase)
					.to.equal(wss.QINST_PHASE_PREP);
				done();
			}.bind(this);

			prep.bind(this)(this.ws1, callback, {
				type: 'start',
			}, this.ws1, false);
		
		});

		it("starts the countdown if the game host requests this when all "
				+ "players are ready", function(done) {
			var callback = function(msg) {
				clearTimeout(wss.qinsts[this.code].timeout);
				expect(msg.type).to.equal('qinstStartCountdown');
				expect(wss.qinsts[this.code].phase)
					.to.equal(wss.QINST_PHASE_READY);
				expect(wss.qinsts[this.code].isJoinable).to.be.false;
				done();
			}.bind(this);

			prep.bind(this)(this.ws1, callback, {
				type: 'start',
			});
		});

		it("notifies the other players that the countdown has started",
			function(done) {
			var callback = function(msg) {
				clearTimeout(wss.qinsts[this.code].timeout);
				expect(msg.type).to.equal('qinstStartCountdown');
				done();
			}.bind(this);

			prep.bind(this)(this.ws1, callback, {
					type: 'start',
				},
				this.ws2
			);
		});

		it("does not start the countdown twice if the host sends the "
				+ "countdown message twice", function(done) {
			var callback = function(msg) {
				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);
					clearTimeout(wss.qinsts[this.code].timeout);
					expect(msg.type).to.equal('error');
					expect(msg.errtype).to.equal('StartWrongPhase');
					done();
				}.bind(this));

				this.ws1.send(JSON.stringify({type: 'start'}));
			}.bind(this);

			prep.bind(this)(this.ws1, callback, {
					type: 'start',
				},
			);
		});

		it("does not cancel the countdown if a player other than the host "
				+ "requests the cancellation", function(done) {
			useFakeTimeouts.bind(this)();

			var callback = function() {
				this.ws2.on('message', function(msg) {
					msg = JSON.parse(msg);
					if (msg.type === 'error') {
						expect(msg.errtype).to.equal('UnauthorizedCancelStart');
						expect(wss.qinsts[this.code].phase)
							.to.equal(wss.QINST_PHASE_READY);
				
						// check that the countdown was not cancelled, i.e.
						// the game starts after five seconds
						this.clock.tick(5010);
						expect(wss.qinsts[this.code].phase)
							.to.equal(wss.QINST_PHASE_ACTIVE);
						expect(wss.qinsts[this.code].isJoinable).to.be.false;
						this.clock.restore();
						done();
					}
			}.bind(this));

				this.ws2.send(JSON.stringify({type:'cancelStart'}));
			}.bind(this);
		
			prep.bind(this)(this.ws1, callback, {
					type: 'start',
				}
			);

		});

		it("cancels the countdown if the host requests the cancellation",
				function(done) {
			useFakeTimeouts.bind(this)();
					
			var callback = function() {
				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('qinstCancelCountdown');
					expect(wss.qinsts[this.code].phase)
						.to.equal(wss.QINST_PHASE_PREP);
			
					// check that the countdown was indeed cancelled, i.e.
					// the game does not start after five seconds
					this.clock.tick(5010);
					expect(wss.qinsts[this.code].timeout).to.be.null;
					expect(wss.qinsts[this.code].phase)
						.to.equal(wss.QINST_PHASE_PREP);
					expect(wss.qinsts[this.code].isJoinable).to.be.true;
					this.clock.restore();
					done();
			}.bind(this));

				this.ws1.send(JSON.stringify({type:'cancelStart'}));
			}.bind(this);
		
			prep.bind(this)(this.ws1, callback, {
					type: 'start',
				}
			);
		});

		it("notifies all players that the countdown has been canceled",
				function(done) {
			var callback = function(msg) {
				this.ws2.once('message', function(msg) {
					msg = JSON.parse(msg);
					expect(msg.type).to.equal('qinstCancelCountdown');
					done();
				}.bind(this));

				this.ws1.send(JSON.stringify({type:'cancelStart'}));
			}.bind(this);
		
			prep.bind(this)(this.ws1, callback, {
					type: 'start',
				},
				this.ws2
			);
		});

		it("does not cancel the countdown twice if the host sends the "
				+ "cancel message twice", function(done) {
			var callback = function(msg) {
				this.ws2.once('message', function(msg) {
					this.ws1.once('message', function(msg) {
						clearTimeout(wss.qinsts[this.code].timeout);
						msg = JSON.parse(msg);
						expect(msg.type).to.equal('error');
						expect(msg.errtype).to.equal(
							'CanceledStartWrongPhase');
						done();
					}.bind(this));

					this.ws1.send(JSON.stringify({type:'cancelStart'}));
				}.bind(this));

				this.ws1.send(JSON.stringify({type:'cancelStart'}));
			}.bind(this);
		
			prep.bind(this)(this.ws1, callback, {
					type: 'start',
				},
				this.ws2
			);
		});

		it("waits no less than five seconds for the game to start", 
				function(done) {
			useFakeTimeouts.bind(this)();
	
			var callback = function(msg) {
				expect(msg.type).to.equal('qinstStartCountdown');
		
				this.clock.tick(4990);
				expect(wss.qinsts[this.code].phase)
					.to.equal(wss.QINST_PHASE_READY);
				expect(wss.qinsts[this.code].isJoinable).to.be.false;
				this.clock.restore();
				done();
			}.bind(this);
		
			prep.bind(this)(this.ws1, callback, {
					type: 'start',
				}
			);
		});

		it("starts the game after five seconds", function(done) {
			useFakeTimeouts.bind(this)();
	
			var callback = function(msg) {
				expect(msg.type).to.equal('qinstStartCountdown');
		
				this.clock.tick(5010);
				expect(wss.qinsts[this.code].phase)
					.to.equal(wss.QINST_PHASE_ACTIVE);
				expect(wss.qinsts[this.code].isJoinable).to.be.false;
				this.clock.restore();
				done();
			}.bind(this);
		
			prep.bind(this)(this.ws1, callback, {
					type: 'start',
				}
			);
		});

		it("sends the qinstActive message when the game starts",
				function(done) {
			useFakeTimeouts.bind(this)();

			var callback = function(msg) {
				expect(msg.type).to.equal('qinstStartCountdown');
				
				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);

					expect(msg.type).to.equal('qinstActive');
					expect(msg.question.text).to.equal('question1');
					expect(msg.question.points).to.equal(1);
					expect(msg.question.answers[0]).to.have.property('text');

					this.clock.restore();
					done();
				}.bind(this));

				this.clock.tick(5010);
			}.bind(this);

			prep.bind(this)(this.ws1, callback, {
					type: 'start',
				}
			);
		});
	});
}
