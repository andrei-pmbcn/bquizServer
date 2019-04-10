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

	//restore the date
	this.clock.restore();
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

	describe ("exception handling", function() {
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
	});

});

describe ("pre-game", function() {
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
							expect(msg.state).to.equal('prep');
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
							expect(msg.state).to.equal('prep');
							expect(msg.players).to.have.lengthOf(2);
							ws.close();

							done();
						});

						console.log("ws created");

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
				expect(wss.qinsts[msg.code].state).to.equal('prep');
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
			this.clock.restore();
			this.clock = sinon.useFakeTimers({
				now: Date.parse("2100/05/05 15:00:00"),
				toFake: ['Date', 'setTimeout'],
			});

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
			this.clock.restore();
			this.clock = sinon.useFakeTimers({
				now: Date.parse("2100/05/05 15:00:00"),
				toFake: ['Date', 'setTimeout'],
			});

			this.ws1.once('message', (function(msg) {
				msg = JSON.parse(msg);
				this.ws1.once('message', function(msg) {
					msg = JSON.parse(msg);

					expect(msg.type).to.equal('error');
					expect(msg.errtype).to.equal('WsError');

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
				expect(msg.errtype).to.equal('InvalidNickname');

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

		it("updates the qinst array and closes the game when the only player "
				+ "leaves", function(done) {
			this.ws1.once('message', (function() {
				
				this.ws1.send(JSON.stringify({
					type: 'leave',
				}))
			}).bind(this));

			wss.once('qinstDeletion', function() {
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

		it("does not turn off the player's ready state under any "
				+ "circumstances when the game is in the ready state, instead "
				+ "sending an error message", function (done) {
			wss.qinsts[this.code].state = 'ready';

			var callback = function() {
				var players = wss.qinsts[this.code].players;
				var player = players.find((x) => (x.nickname == 'nick2'));
				player.isReady = true;

				this.ws2.once('message', function (msg) {
					msg = JSON.parse(msg);

					expect(msg.type).to.equal('error');
					expect(msg.errtype).to.equal('FailedReadyToggleAttempt');
					done();
				}.bind(this));

				this.ws2.send(JSON.stringify({type: 'notReady'}))

			}.bind(this);

			addAllPlayers.bind(this)(callback);
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

	describe ("players attempting to start the game", function() {
		it("sends an error message if anyone other than the game host attempts"
			+ "to start the game")

		it("sends the host an error message if the host attempts to start "
			+ "the game without all players being ready")

		it("starts the game if the game host requests this when all players "
			+ "are ready");
		//(use time faking to bypass timer delay

		it("sends the gameActive message when the game starts");

		it("does not start the game twice if the game_host sends the start "
			+ "message twice");

		it("cancels starting if all players have left");
	});

});

describe("in-game", function() {
	beforeEach(function() {
		// player 1 has answered 3/4 questions, player 2 has answered 2/4
		// and player 3 has answered 0/4

	});

	describe("players joining and leaving the game", function() {
		it("sends the welcome message upon reconnecting");

		it("enters hostless mode when the host leaves the game");


	});

	describe("answering questions", function() {
		beforeEach(function() {
			//player 1 answers a question
			//player 3 answers a question
			//player 1 answers the same question
		});

		it("updates the answers in the database");

		it("sends the next question to each player, repeating the question "
			+ "if the player has submitted the answer twice");

		it("does not update the answer or send the question to a player "
			+ "that has not answered");

		it("marks the player who has completed all questions as inactive");

		it("does not mark the players who have not completed all questions as "
			+ "inactive");

		it("sends a no_more_questions message to the player who has completed "
			+ "all questions");

		it("does not send a no_more_questions message to the players who have "
			+ "not completed all questions");
	});

	describe("game completion", function() {
		beforeEach(function() {

		});

		it("sends the game_finished message to all players when the game "
			+ "timer runs out");

		it("sends the game_finished message to all players when all players "
			+ "have answered all questions");

		it("does not send the game_finished message again if a player "
			+ "resends their answer after the first game_finished message "
			+ "was sent");
	});

});

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
	});

	describe("player ready state", function() {
		it.skip("does not turn off the player's ready state under any "
				+ "circumstanceswhen the game is in the finished state, "
				+ "sending an error message", function (done) {
			wss.qinsts[this.code].state = 'ready';


		});
	});

	describe("player leaving", function() {
		it("removes the player from the database");

		it("triggers game deletion if the last player has left");

	});


});
