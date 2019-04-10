
//[TODO] User could login in the middle of a game, account for this
//[TODO] Likewise, user could login, logout then log back in under a different
//  name at any point in the game

const WebSocket = require('ws');
const yaml = require('js-yaml');
const fs = require('fs');
const bcrypt = require('bcrypt-nodejs');

const dateformat = require('dateformat');

const ERRTYPE_DBERROR = 'DbError';
const ERRTYPE_WSERROR = 'WsError';

try {
	var config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));
} catch (ex) {
	console.log(ex);
}

const knex = require('knex')({
	client: 'mysql',
	connection: {
		host: config.dbhost,
		user: config.dbuser,
		password: config.dbpassword,
		database: config.database,
	}
});

const wss = new WebSocket.Server({
	host: config.wsshost,
	port: config.wssport,
	

});

wss.doesThrottle = true;
wss.qinsts = {};
wss.conns = [];

class WebsocketConnection {
	constructor(ws) {
		this.ws = ws;
		this.throttleExpiry = new Date();
		this.qinst = null;
		this.player = null;
	}

	/*** game events ***/



	async endQinst() {
		//call deleteQinst if all players have left after 30-second period
	}

	deleteQinst(code) {
		//[TODO] Ensure that this never runs concurrently with a respondToJoin

		// account for the situation wherein the quiz instance was created
		// but not joined
		if (!this.qinst) {
			this.qinst = wss.qinsts[code];
		}

		if (code === null) {
			code = this.qinst.code;
		}

		// ensure that no one else joins the quiz
		if (this.qinst.isJoinable) {
			this.qinst.isJoinable = false;
		}

		// prevent circular reference to qinst through conn objects
		this.qinst.conns = [];
		this.qinst.players = [];
		this.qinst.hostConn = null;

		delete wss.qinsts[code];
		this.qinst = null;

		wss.emit('qinstDeletion', code);
	}

	/*** server messages ***/

	sendCode(code) {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		this.ws.send(JSON.stringify({type:'code', code: code}));
	}

	sendWelcome() {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		var response = {
			type: "welcome",
			state: this.qinst.state,
		};

		if (this.qinst.state == "prep") {
			response.players = this.qinst.players;
		} else if (this.qinst.state == "active") {
			//[TODO]
		} else if (this.qinst.state == "finished") {
			//[TODO]
		}

		this.ws.send(JSON.stringify(response));	
	}

	sendPlayerJoined(nickname, description) {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		this.ws.send(JSON.stringify({
			type: "playerJoined", 
			nickname: nickname,
			description: description,
		}));	
	}

	sendPlayerLeft(nickname, description, isDisconnect = false) {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		this.ws.send(JSON.stringify({
			type: "playerLeft", 
			nickname: nickname,
			description: description,
			isDisconnect: isDisconnect,
		}));	
	}

	sendConnectionClosed(description) {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		this.ws.send(JSON.stringify({
			type: "connectionClosed",
			description: description,
		}));
	}

	sendReady(nickname) {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		this.ws.send(JSON.stringify({
			type: "playerReady",
			nickname: nickname,
		}));
	}

	sendNotReady(nickname) {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		this.ws.send(JSON.stringify({
			type: "playerNotReady",
			nickname: nickname,
		}));
	}

	sendError(errtype, errmsg, isLogged = true) {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}
		
		var date = new Date();
		errmsg = dateformat(date, "hh:MM:ss") + ": " + errmsg.toString();
		this.ws.send(JSON.stringify({
			type: 'error',
			errtype: errtype,
			error: errmsg,
		}));
		if (isLogged) {
			fs.writeFile(
				"logs/error_" + dateformat(date, "yyyy_mm_dd") + ".txt",
				errmsg,
				function(err) {
					if (err) {
						console.log("cannot log error "
							+ errmsg + "; reason: " + ex);
					}
				}
			);
		}
	}

	/*** server responses ***/

	// create: {type, quizId}
	async respondToCreate(msg) {
		const code = 10 ** 9 + parseInt((10 ** 10 - 10 ** 9) * Math.random());

		var quiz = await knex('quiz')
			.first('id', 'name')
			.where({id: msg.quizId});

		var questions = await knex('quiz_question')
			.select('id', 'idx', 'text')
			.where({quiz_id: msg.quizId});

		var questionIds = questions.map((x)=>(x.id));
		var answers = await knex('quiz_answer')
			.select('id', 'quiz_question_id', 'idx', 'text', 'is_correct')
			.whereIn('quiz_question_id', questionIds);

		quiz.questions = [];
		for (let question of questions) {
			var kAnswers = answers.filter(
				(x) => (x.quiz_question_id == question.id))

			var processedAnswers = [];
			for (let kAnswer of kAnswers) {
				processedAnswers.push({
					index: kAnswer.idx,
					text: kAnswer.text,
					isCorrect: kAnswer.is_correct,
				})
			}

			quiz.questions.push({
				index: question.idx,
				text: question.text,
				answers: processedAnswers
			});
		}

		wss.qinsts[code] = {
			quiz: quiz,
			conns: [],
			players: [],
			hostNickname: msg.nickname,
			hostConn: this,
			code: code,
			isJoinable: true,
			state: 'prep',
		};

		this.sendCode(code);
		wss.emit('qinstCreation', wss.qinsts[code]);

		//after 30 seconds, if no player has joined, close the connection
		//and delete the quiz instance

		function attemptDeleteQinst() {
			if (wss.qinsts[code] && wss.qinsts[code].players.length === 0) {
				if (this.ws.readyState === this.ws.OPEN) {
					this.ws.close(1001);
				}
				this.deleteQinst(code);
			}
		}
		setTimeout(attemptDeleteQinst.bind(this), 30000);
		
	}

	// join: {type, code, username, password, nickname} 
	async respondToJoin(msg) {
		// check that the player with this connection has not already joined 
		if (this.qinst) {
			this.sendError(
				'AlreadyJoined',
				'Sunteți deja în joc. Nu vă puteți adăuga la joc de mai '
				+ 'multe ori.'
			);
			return;
		}

		// get the quiz instance from the message's code
		this.qinst = wss.qinsts[msg.code];

		this.player = {
			username: null,
			nickname: null,
			isReady: false,
		}

		// authenticate the user
		if (msg.username && msg.password) {
			try {
				 var result = await knex('user')
				   .first('username')
				   .where({
						username: msg.username,
						password: msg.password,
				  	});

				if (result) {
					this.player.username = result.username;
				}
			} catch (ex) {
				this.sendError(ERRTYPE_DBERROR, ex);
				return;
			}
		}

		// if a quiz_instance_player matching the username exists, assign the
		// sender to this player
		var isReconnect = false;
		if (this.player.username !== null) {
			var playersWithUsername = this.qinst.players.filter(
				(x)=>(x.username == this.player.username));
			if (playersWithUsername.length) {
				this.player = playersWithUsername[0];
				isReconnect = true;
			}
		}

		if (isReconnect) {
			for (let conn of this.qinst.conns) {
				conn.sendPlayerJoined(this.player.nickname,
					this.player.nickname + " s-a reconectat");
			}
			this.qinst.conns.push(this);

			// send the appropriate reconnection message
			this.sendWelcome();
			return;
		} else if (this.qinst.isJoinable) {
			// create a new player entity

			// ensure that the player entity has a nickname
			if (!msg.nickname) {
				this.sendError(
					'InvalidNickname',
					'Ați încercat să intrați în joc fără să aveți un nume de '
					+ 'jucător. Vă rugăm să alegeți un nume.'
				);
				return;
			}
			
			// check that the nickname has not already been picked
			for (let player of this.qinst.players) {
				if (player.nickname === msg.nickname) {
					this.sendError(
						'InvalidNickname',
						'Ați selectat un nume de jucător care este deja '
						+ 'în folosință în joc. Vă rugăm să folosiți un alt '
						+ 'nume pentru dumneavoastră.'
					);
					return;
				}
			}

			this.player.nickname = msg.nickname;

			// if this player's nickname matches the nickname of the creator,
			// set them as the host
			if (this.player.nickname == this.qinst.hostNickname) {
				this.qinst.hostConn = this;
			}

			// create the player entity
			this.qinst.players.push(this.player);
			for (let conn of this.qinst.conns) {
				conn.sendPlayerJoined(this.player.nickname,
					this.player.nickname + " a venit în joc");
			}
			this.qinst.conns.push(this);

			this.sendWelcome();
			return;
		} else {
			// return an error message saying the user may not rejoin
			this.sendError(
				'InvalidJoin',
				'Jocul a început deja sau semnalul de începere a jocului a '
				+ 'fost trimis. Deoarece nu păreți a fi autentificat cu un '
				+ 'cont ce a participat la începerea jocului, nu puteți intra.'
			);
			return;
		}
	}

	respondToBoot(msg) {
		

		// check if all players have left (e.g. the host disconnected between
		// the booting and the response to it) and, if so, delete the game
	}

	respondToReady(msg) {
		if (this.player.isReady) {
			return;
		}

		// only allow players to set their ready status during the prep
		// and active stages of the game
		if (['prep', 'active'].indexOf(this.qinst.state) !== -1) {
			this.player.isReady = true;
			for (let conn of this.qinst.conns) {
				conn.sendReady(this.player.nickname);
			}
		} else {
			this.sendError('FailedReadyToggleAttempt',
				'Ați încercat să anunțați că sunteți pregătit într-o fază a '
				+ 'jocului în care acest lucru nu e posibil'
			)
		}
	}

	respondToNotReady(msg) {
		if (!this.player.isReady) {
			return;
		}

		// only allow players to unset their ready status during the prep
		// and active stages of the game
		if (['prep', 'active'].indexOf(this.qinst.state) !== -1) {
			this.player.isReady = false;
			for (let conn of this.qinst.conns) {
				conn.sendNotReady(this.player.nickname);
			}
		} else {
			this.sendError('FailedReadyToggleAttempt',
				'Ați încercat să anunțați că nu mai sunteți pregătit într-o '
				+ 'fază a jocului în care acest lucru nu e posibil'
			)
		}
	}

	respondToStart(msg) {

	}

	respondToAnswer(msg) {

	}

	respondToEndAcknowledged(msg) {

	}

	async respondToLeave(msg) {
		//close the connection
		if (this.ws.readyState === this.ws.OPEN) {
			this.ws.close(1000);
		}
	}
}

wss.on('connection', function (ws) {
	var conn = new WebsocketConnection(ws);
	wss.conns.push(conn);

	ws.on('message', function (msg) {
		var ktime = new Date(); //current time
		if (conn.throttleExpiry > ktime) {
			conn.sendError(ERRTYPE_WSERROR,
				'Eroare websocket: prea multe mesaje într-un interval '
				+ 'prea scurt de timp');
			return;
		}
		msg = JSON.parse(msg);

		if (msg.type !== "create" && wss.doesThrottle) {
			conn.throttleExpiry = ktime.setSeconds(ktime.getSeconds() + 1);
		}

		switch (msg.type) {
			case "create":
				conn.respondToCreate(msg);
				break;
			case "join":
				conn.respondToJoin(msg);
				break;
			case "boot":
				conn.respondToBoot(msg);
				break;
			case "ready":
				conn.respondToReady(msg);
				break;
			case "notReady":
				conn.respondToNotReady(msg);
				break;
			case "start":
				conn.respondToStart(msg);
				break;
			case "answer":
				conn.respondToAnswer(msg);
				break;
			case "nextQuestion":
				conn.respondToNextQuestion(msg);
				break;
			case "endAcknowledged":
				conn.respondToEndAcknowledged(msg);
				break;
			case "leave":
				conn.respondToLeave(msg);
				break;
			case "debugError":
				conn.sendError('DebugError', 'sample error');
				break;
			default:
				conn.sendError('InvalidMessage',
					'tip de mesaj invalid: ' + msg.type 
					+ '; mesajul întreg: ' + JSON.stringify(msg));
				break;
		}
	});

	ws.on('close', function (code) {
		if (conn.qinst) {
			// remove the connection from the quiz's connection roster
			conn.qinst.conns.splice(conn.qinst.conns.indexOf(conn), 1);

			if (code === 1000) {
				// the leave was under normal conditions

				if (conn.qinst.hostNickname === conn.player.nickname) {
					conn.qinst.hostConn = null;
					// enabled hostless mode, used in the active state,
					// by setting hostNickname to null
					conn.qinst.hostNickname = null;

					// if the game is in the prep state, notify all players that
					// the host has left and close all their connections
					if (conn.qinst.state === 'prep') {
						for (let otherConn of conn.qinst.conns) {
							conn.qinst.conns.splice(
								conn.qinst.conns.indexOf(otherConn), 1);
							otherConn.sendConnectionClosed(conn.player.nickname
								+ " a plecat din joc; jocul nu poate "
								+ "continua.");
							if (otherConn.ws.readyState === otherConn.ws.OPEN) {
								otherConn.ws.close(1000);
							}
						}
					}
				} else {
					// if the player is not the host, simply notify the
					// remaining players that the player has left
					for (let otherConn of conn.qinst.conns) {
						otherConn.sendPlayerLeft(conn.player.nickname,
							conn.player.nickname + " a plecat din joc",
							false);
					}

					conn.qinst.players.splice(
						conn.qinst.players.indexOf(conn.player), 1);
				}
			} else {
				for (let otherConn of conn.qinst.conns) {
					otherConn.sendPlayerLeft(conn.player.nickname,
						conn.player.nickname + " s-a deconectat",
						true);
				}

				// if the connection has a player that is only identified via
				// its nickname, remove the player
				if (!conn.player.username) {
					conn.qinst.players.splice(
						conn.qinst.players.indexOf(conn.player), 1);
				} else {
					// turn off the player's ready status if possible
					if (['prep', 'active'].indexOf(conn.qinst.state) !== -1) {
						conn.player.isReady = false;

						// notify the other players that the player is no longer
						// ready
						for (let otherConn of conn.qinst.conns) {
							otherConn.sendNotReady(conn.player.nickname);
						}
					}
				}
			}

			// if this is the last player, delete the quiz instance
			if (!conn.qinst.conns.length) {
				conn.deleteQinst(null);
			}
		}

		conn.player = null;

		// remove the websocket connection from the global connection roster
		wss.conns.splice(wss.conns.indexOf(conn), 1);

		wss.emit('connClosed', conn);	
	}.bind(this));

});

wss.on('listening', function() {
	console.log('server started');
});

module.exports = { wss, config, knex };
