const WebSocket = require('ws');
const yaml = require('js-yaml');
const fs = require('fs');
const bcrypt = require('bcrypt-nodejs');
const dateformat = require('dateformat');

try {
	var config = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));
} catch (ex) {
	console.log(ex);
}


var wss = new WebSocket.Server({
	host: config.wsshost,
	port: config.wssport,
});

wss.doesThrottle = true;
wss.qinsts = {};
wss.conns = [];

wss.QINST_PHASE_PREP = 0;
wss.QINST_PHASE_READY = 1;
wss.QINST_PHASE_ACTIVE = 2;
wss.QINST_PHASE_FINISHED = 3;


/*** custom methods ***/
const { fetchUser, fetchQuiz } = require(config.apimodule);

class WebsocketConnection {
	constructor(ws) {
		this.ws = ws;
		this.throttleExpiry = new Date();
		this.qinst = null;
		this.player = null;
	}

	/*** game events ***/

	startQinst() {
		this.qinst.phase = wss.QINST_PHASE_ACTIVE;	

		var question;
		var finishTime;
		if (this.qinst.quiz.settings.doesAdvanceTogether) {
			[ question, finishTime ] = this.startQuestion();
		} else {
			for (let player of this.qinst.players) {
				[ question, finishTime ] = this.startQuestion();
			}
		}

		for (let conn of this.qinst.conns) {
			conn.sendQinstActive(question, finishTime);
		}

		wss.emit('qinstStarted', this.qinst);
	}

	endQinst() {
		//call deleteQinst if all players have left after 30-second period
	}

	deleteQinst(code) {
		//[TODO] Ensure that this never runs "concurrently" with a respondToJoin
		//(check node.js event model to see if all events run to completion)

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

		wss.emit('qinstDeleted', code);
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
			phase: this.qinst.phase,
			players: this.qinst.players,
			settings: this.qinst.quiz.settings,
		};

		if (this.qinst.phase === wss.QINST_PHASE_ACTIVE) {
			if (this === this.qinst.hostConn
					&& !this.qinst.quiz.settings.doesHostPlay) {
				var question;
				if (this.qinst.quiz.settings.doesAdvanceTogether) {
					question = this.qinst.quiz.questions.find(
						(x) => (x.index === this.qinst.questionIndex));
				} else {
					question = this.qinst.quiz.questions.find(
						(x) => (x.index === this.player.questionIndex));
				}
				response.correctAnswer = question.correctAnswer;
				response.commentary = question.commentary;
			} else {
				response.correctAnswer = null;
				response.commentary = null;
			}

			var preparedQuestion;
			if (this.qinst.quiz.settings.doesAdvanceTogether) {
				preparedQuestion = this.qinst.preparedQuestions.find(
					(x) => (x.index === this.qinst.questionIndex));
			} else {
				preparedQuestion = this.qinst.preparedQuestions.find(
					(x) => (x.index === this.player.questionIndex));
			}
			response.question = preparedQuestion;

		} else if (this.qinst.phase === wss.QINST_PHASE_FINISHED) {
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

	sendQinstStartCountdown() {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		this.ws.send(JSON.stringify({
			type: "qinstStartCountdown",
		}));

	}

	sendQinstCancelCountdown() {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		this.ws.send(JSON.stringify({
			type: "qinstCancelCountdown",
		}));
	}

	sendQinstActive(question, finishTime) {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		var isPlaying;
		var correctAnswer;
		var commentary;
		if (this.qinst.hostConn === this
				&& !this.qinst.quiz.settings.doesHostPlay) {
			var fullQuestion = this.qinst.quiz.questions.find(
				(x) => (x.index === question.index));

			isPlaying = false;
			correctAnswer = fullQuestion.correctAnswer;
			commentary = fullQuestion.commentary;
		} else {
			isPlaying = true;
			correctAnswer = null;
			commentary = null;
		}

		this.ws.send(JSON.stringify({
			type: "qinstActive",
			question: question,
			finishTime: finishTime,
			isPlaying: isPlaying,
			correctAnswer: correctAnswer, 
			commentary: commentary,
		}));
	}

	sendAnswerFeedback() {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}
		
		// sendAnswerFeedback is only ever called if the doesAdvanceTogether
		// quiz setting is set to true

		var question = this.qinst.quiz.questions.find(
			(x) => (x.index === this.qinst.questionIndex));

		this.ws.send(JSON.stringify({
			type: "answerFeedback",
			questionIndex: this.qinst.questionIndex,
			correctAnswer: question.correctAnswer,
			commentary: question.commentary,
		}));
	}

	sendAnswerNotice(conn, msg) {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}
		
		//msg contains a message of type 'answer'
		this.ws.send(JSON.stringify({
			type: 'answerNotice',
			nickname: conn.player.nickname,
			questionIndex: msg.questionIndex,
			answer: msg.answer,
		}));
	}

	sendQuestion(question, finishTime) {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		var correctAnswer;
		var commentary;
		if (this.qinst.hostConn === this
				&& !this.qinst.quiz.settings.doesHostPlay) {
			var fullQuestion = this.qinst.quiz.questions.find(
				(x) => (x.index === question.index));

			correctAnswer = fullQuestion.correctAnswer;
			commentary = fullQuestion.commentary;
		} else {
			correctAnswer = null;
			commentary = null;
		}

		this.ws.send(JSON.stringify({
			type: "question",
			question: question,
			finishTime: finishTime,
			correctAnswer: correctAnswer,
			commentary: commentary,
		}));
	}

	sendPlayerResults() {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}

		this.ws.send(JSON.stringify({
			type: "playerResults",
			questions: this.qinst.quiz.questions,
			answers: this.player.answers,
		}));
	}

	sendQinstEnd() {
		if (this.ws.readyState !== this.ws.OPEN) {
			return;
		}
		var results = {
			nickname: this.player.nickname,
			answers: this.player.answers,
		}
		this.ws.send(JSON.stringify({
			type: "qinstEnd",
			questions: this.qinst.quiz.questions,
			results: results,
		}));
	}

	sendError(errtype, errmsg, isLogged = true, doesDisplay = true) {
		var date = new Date();
		errmsg = dateformat(date, "hh:MM:ss") + ": " + errtype + " - "
			+ errmsg.toString();

		if (this.ws.readyState === this.ws.OPEN) {
			this.ws.send(JSON.stringify({
				type: 'error',
				errtype: errtype,
				error: errmsg,
				doesDisplay: doesDisplay,
			}));
		}
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

		try {
			var quiz = await fetchQuiz(msg.quizId);

		} catch (ex) {
			this.sendError('UserModuleError', ex);
			return;
		}
		try {
			//validate the quiz obtained by fetchQuiz
			this.validateQuiz(quiz);
		} catch (ex) {
			this.sendError('UserQuizValidationError', ex);
		}

		// prepare the questions for sending them to the players
		// by stripping them of variables that would provide the answers or
		// hints to them
		var preparedQuestions = [];
		for (let question of quiz.questions) {
			let preparedQuestion = JSON.parse(JSON.stringify(
				question));
			
			delete preparedQuestion.commentary;
			delete preparedQuestion.correctAnswer;

			preparedQuestions.push(preparedQuestion);
		}

		wss.qinsts[code] = {
			quiz: quiz,
			preparedQuestions: preparedQuestions,
			conns: [],
			players: [],
			hostNickname: msg.nickname,
			hostConn: this,
			code: code,
			timeout: null,
			isJoinable: true,
			phase: wss.QINST_PHASE_PREP,
			questionIndex: quiz.settings.doesAdvanceTogether ? 1 : null,
			finishTime: null,
		};

		this.sendCode(code);
		wss.emit('qinstCreated', wss.qinsts[code]);

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

		if (this.qinst === undefined) {
			// the quiz instance does not exist
			this.sendError('QuizInstanceNotFound',
				'Nu am putut găsi jocul cu codul specificat de dumneavoastră.'
			)
			return;
		}

		var quiz = this.qinst.quiz;

		this.player = {
			username: null,
			nickname: null,
			isReady: false,
			hasAnswered: false,
			hasFinished: false,
			timeout: null,
			currentQuestion: quiz.settings.doesAdvanceTogether ? null : 1,
			finishTime: null,
			answers: [],
		}

		// authenticate the user
		if (msg.username && msg.password) {
			try {
				 var username = await fetchUser(msg.username, msg.password);
				if (username) {
					this.player.username = username;
				}
			} catch (ex) {
				this.sendError('UserModuleError', ex);
				return;
			}
		}

		// if a quiz_instance_player matching the username exists, assign the
		// sender to this player
		var isReconnect = false;
		if (this.player.username !== null) {
			var playersWithUsername = this.qinst.players.filter(
				(x) => (x.username == this.player.username));
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

			if (this.player.nickname === this.qinst.hostNickname) {
				this.qinst.hostConn = this;
			}

			// send the appropriate reconnection message
			this.sendWelcome();
			return;
		} else if (this.qinst.isJoinable) {
			// create a new player entity

			// ensure that the player entity has a nickname
			if (!msg.nickname) {
				this.sendError(
					'NoNickname',
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
			this.sendError(
				'GameAlreadyStarted',
				'Jocul a început deja sau semnalul de începere a jocului a '
				+ 'fost trimis. Deoarece nu păreți a fi autentificat cu un '
				+ 'cont ce a participat la începerea jocului, nu puteți intra.'
			);
			return;
		}
	}

	respondToBoot(msg) {
		if (this === this.qinst.hostConn) {
			var player = this.qinst.players.find(
				(x) => (x.nickname === msg.nickname));
			if (player) {
				if (player === this.player) {
					this.sendError('SelfBoot',
						'Ați încercat să vă scoateți singur din joc. '
						+ 'Aceasta pare a fi o eroare; vă rugăm să contactați '
						+ 'administratorul site-ului.');
					return;
				}

				var conn = this.qinst.conns.find(
					(x) => (x.player === player));

				conn.sendConnectionClosed(this.player.nickname
					+ 'v-a scos pe dumneavoastră din joc');
				conn.ws.close(1000, this.player.nickname
					+ ' a scos din joc pe ' + player.nickname);
			} else {
				this.sendError('CannotFindBootTarget',
					'Numele jucătorului pe care ați încercat să îl scoateți '
					+ 'din joc nu există. Aceasta pare a fi o eroare; vă '
					+ 'rugăm să contactați administratorul site-ului.');
				return;
			}
		} else {
			this.sendError('UnauthorizedBoot',
				'Ați încercat să scoateți un jucător din joc, '
				+ 'însă nu sunteți organizatorul jocului. Aceasta pare a fi '
				+ 'o eroare; vă rugăm să contactați administratorul site-ului.'
			);
			return;
		}
	}

	respondToReady(msg) {
		if (this.player.isReady) {
			this.sendError('AlreadyReady',
				'Ați încercat să declarați că sunteți pregătit deși ați '
				+ 'afirmat deja acest lucru.'
				, false, false);
			return;
		}

		// only allow players to set their ready status during the prep
		// and active stages of the game
		if ([wss.QINST_PHASE_PREP, wss.QINST_PHASE_ACTIVE]
				.indexOf(this.qinst.phase) !== -1) {
			this.player.isReady = true;
			for (let conn of this.qinst.conns) {
				conn.sendReady(this.player.nickname);
			}
		} else {
			this.sendError('ReadyWrongPhase',
				'Ați încercat să anunțați că sunteți pregătit într-o fază a '
				+ 'jocului în care acest lucru nu e posibil. '
				+ 'Aceasta pare a fi o eroare; vă rugăm să contactați '
				+ 'administratorul site-ului.'
			)
			return;
		}
	}

	respondToNotReady(msg) {
		if (!this.player.isReady) {
			this.sendError('AlreadyNotReady',
				'Ați încercat să declarați că nu mai sunteți pregătit deși ați '
				+ 'afirmat deja acest lucru.'
				, false, false);
			return;
		}

		// only allow players to unset their ready state during the prep
		// and active stages of the game
		if ([wss.QINST_PHASE_PREP, wss.QINST_PHASE_ACTIVE]
				.indexOf(this.qinst.phase) !== -1) {
			this.player.isReady = false;
			for (let conn of this.qinst.conns) {
				conn.sendNotReady(this.player.nickname);
			}
		} else {
			this.sendError('NotReadyWrongPhase',
				'Ați încercat să anunțați că nu mai sunteți pregătit într-o '
				+ 'fază a jocului în care acest lucru nu e posibil. '
				+ 'Aceasta pare a fi o eroare; vă rugăm să contactați '
				+ 'administratorul site-ului.'
			);
		}
	}

	//response to the request for starting the game
	respondToStart(msg) {
		if (this.qinst.phase !== wss.QINST_PHASE_PREP) {
			this.sendError('StartWrongPhase',
				'Ați încercat să începeți jocul după ce începerea jocului '
				+ 'a fost aprobată. Aceasta pare a fi o eroare; vă '
				+ 'rugăm să contactați administratorul site-ului.'
			);
			return;
		}

		if (this === this.qinst.hostConn) {
			//only allow the game to start if all players are ready
			var playersReady = this.qinst.players.every(
				(x)=>(x.isReady));
			if (playersReady) {
				this.qinst.phase = wss.QINST_PHASE_READY;
				this.qinst.isJoinable = false;

				for (let conn of this.qinst.conns) {
					conn.sendQinstStartCountdown();
				}
				
				// set the countdown to the start of the game,
				// during which the host can cancel the game start
				this.qinst.timeout = setTimeout(this.startQinst.bind(this)
					, 5000);

				wss.emit('qinstStartCountdown', this.qinst)
			} else {
				this.sendError('StartNotAllReady',
					'Ați încercat să începeți jocul deși nu toți jucătorii '
					+ 'sunt gata să înceapă. Aceasta pare a fi o eroare; vă '
					+ 'rugăm să contactați administratorul site-ului.'
				);
				return;
			}
		} else {
			this.sendError('UnauthorizedStart',
				'Ați încercat să începeți jocul deși nu sunteți organizatorul '
				+ 'jocului. Aceasta pare a fi o eroare; vă rugăm să '
				+ 'contactați administratorul site-ului.'
			);
			return;
		}
	}

	//response to the request for canceling the start of the game
	respondToCancelStart(msg) {
		if (this.qinst.phase !== wss.QINST_PHASE_READY) {
			this.sendError('CanceledStartWrongPhase',
				'Ați încercat să opriți începerea jocului după ce '
				+ 'a fost deja oprită. Aceasta pare a fi o eroare; vă '
				+ 'rugăm să contactați administratorul site-ului.'
			);
			return;
		}

		if (this === this.qinst.hostConn) {
			this.qinst.phase = wss.QINST_PHASE_PREP;
			this.qinst.isJoinable = true;

			for (let conn of this.qinst.conns) {
				conn.sendQinstCancelCountdown();
			}

			//cancel the game start countdown
			clearTimeout(this.qinst.timeout);
			this.qinst.timeout = null;

			wss.emit('qinstStartCountdownCancelled', this.qinst);
		} else {
			this.sendError('UnauthorizedCancelStart',
				'Ați încercat să opriți începerea jocul deși nu sunteți '
				+ 'organizatorul jocului. Aceasta pare a fi o eroare; vă '
				+ 'rugăm să contactați administratorul site-ului.'
			);
			return;
		}
	}

	respondToAnswer(msg) {
		var quiz = this.qinst.quiz;

		if (this.qinst.phase !== wss.QINST_PHASE_ACTIVE) {
			// does not display the error as the game may have shifted to the
			// finished phase, without having a chance to notify the player,
			// between the time when the answer was sent and the server
			// responded to it
			this.sendError('AnswerWrongPhase',
				'Ați încercat să trimiteți un răspuns deși nu sunteți '
				+ 'în faza activă a jocului.'
				,false, false
			);
			return;
		}

		if (this.qinst.hostConn === this && !quiz.settings.doesHostPlay) {
			this.sendError('UnauthorizedAnswer',
				'Ați încercat să trimiteți un răspuns deși sunteți un '
				+ 'observator. Aceasta pare a fi o eroare; vă rugăm '
				+ 'să contactați administratorul site-ului.'
			);
			return;
		}

		// ensure that the complete answer does not contain multiple answers
		// if the question is not a multiple response question
		var question = quiz.questions.find(
			(x) => (x.index === msg.questionIndex));
		if (msg.answer.length > 1 && !question.isMultipleResponse) {
			this.sendError('AnswerNonMultipleResponse',
				'Ați încercat să trimiteți un răspuns multiplu la o întrebare '
				+ 'cu un singur răspuns. Aceasta pare a fi o eroare; vă rugăm '
				+ 'să contactați administratorul site-ului.'
			);
			return;
		}

		//check whether the user has already answered
		if (quiz.settings.doesAdvanceTogether && this.player.hasAnswered) {
			this.sendError('AlreadyAnswered',
				'Ați încercat să trimiteți același răspuns pentru aceeași '
				+ 'întrebare din nou. Aceasta pare a fi o eroare; vă rugăm '
				+ 'să contactați administratorul site-ului.');
			return;
		}

		var isAnswerForCurrentQuestion = 
			(quiz.settings.doesAdvanceTogether
				&& this.qinst.questionIndex === msg.questionIndex)
			|| (!quiz.settings.doesAdvanceTogether
				&& this.player.questionIndex === msg.questionIndex);

		if (!isAnswerForCurrentQuestion) {
			this.sendError('AnswerWrongQuestion',
				'Ați încercat să trimiteți un răspuns pentru o altă '
				+ 'întrebare decât cea actuală. Aceasta pare a fi o eroare; '
				+ 'vă rugăm să contactați administratorul site-ului.');

			return;
		}

		//record the answer in the player's answers list
		this.player.answers.push({
			questionIndex: msg.questionIndex,
			answer: msg.answer,
		});

		if (!quiz.settings.doesHostPlay && this.qinst.hostConn !== null) {
			this.qinst.hostConn.sendAnswerNotice(this, msg);
		}

		if (quiz.settings.doesAdvanceTogether) {
			// if all players receive the next question together, the server
			// should not send the next question, but should instead give
			// feedback on the answer
			this.player.hasAnswered = true;
			this.sendAnswerFeedback();
		} else {
			if (this.player.questionIndex < this.qinst.quiz.questions.length) {
				this.nextQuestionForPlayer();
			} else {
				this.endQinstForPlayer();
			}
		}
	}

	respondToNextQuestion(msg) {
		if (!this.qinst.hostConn === this) {
			this.sendError('UnauthorizedNextQuestion',
				'Ați încercat să continuați cu următoarea întrebare '
				+ 'deși nu sunteți organizatorul jocului. Aceasta pare a fi '
				+ 'o eroare; vă rugăm să contactați administratorul site-ului.'
			);
			return;
		}
		
		if (this.qinst.phase !== wss.QINST_PHASE_ACTIVE) {
			// the error is not visible because the host could be sending the
			// request between the moment when the final question's time has
			// expired (and thus the quiz instance has entered the finished
			// phase) and the moment when the host has received the qinstEnd
			// message from the server
			this.sendError('NextQuestionWrongPhase',
				'Ați încercat să anunțați că sunteți pregătit într-o fază a '
				+ 'jocului în care acest lucru nu e posibil. ',
				false, false
			);
			return;
		}

		if (msg.questionIndex !== this.qinst.questionIndex) {
			// The request for a new question was sent at a time when a
			// previous question was active; what likely happened is that
			// the question expired before the server received the nextQuestion
			// message, and so it issued a new question in the interim.

			this.sendError('NextQuestionWrongQuestion',
				'Ați încercat să continuați cu următoarea întrebare deși '
				+ 'aparent s-a trecut deja la următoarea întrebare.'
				, false, false);
			return;
		}

		if (quiz.settings.doesAdvanceTogether) {
			// check that all players have submitted their answers
			for (let conn of this.qinst.conns) {
				if ((conn !== this.qinst.hostConn
					|| this.qinst.quiz.settings.doesHostPlay)
					&& !conn.player.hasAnswered) {
					this.sendError('NextQuestionNotAllReady',
						'Ați încercat să continuați cu următoarea întrebare '
						+ 'deși nu toți jucătorii au dat răspunsurile lor. '
						+ 'Aceasta pare a fi o eroare; vă rugăm să contactați '
						+ 'administratorul site-ului.'
					);
				}
			}

			if (this.qinst.questionIndex < this.qinst.quiz.questions.length) {
				this.nextQuestionForAll();
			} else {
				this.endQinstForAll();
			}

		} else {
			this.sendError('NextQuestionUnavailable',
				'Ați încercat să continuați cu următoarea întrebare '
				+ 'deși opțiunea nu este disponibilă. Aceasta pare a fi '
				+ 'o eroare; vă rugăm să contactați administratorul site-ului.'
			);
			return;
		}
	}

	respondToEndAcknowledged(msg) {

	}

	async respondToLeave(msg) {
		//close the connection
		if (this.ws.readyState === this.ws.OPEN) {
			this.ws.close(1000, this.player.nickname + " a plecat din joc");
		}
	}

	/*** auxiliary methods ***/

	startQuestion(questionIndex, player) {
		var quiz = this.qinst.quiz;
		var questionIndex;
		if (quiz.settings.doesAdvanceTogether) {
			questionIndex = this.qinst.questionIndex;
		} else {
			questionIndex = this.player.questionIndex;
		}
		var question = this.qinst.preparedQuestions.find(
			(x) => (x.index === questionIndex));

		var delta;
		if (!quiz.settings.doesAdvanceTogether || question.time === null) {
			delta = quiz.settings.time;
		} else {
			delta = parseInt(question.time);
		}

		var finishTime = new Date();
		finishTime.setSeconds(finishTime.getSeconds() + delta);

		if (quiz.settings.doesAdvanceTogether) {
			this.hasAnwered = false;
			clearTimeout(this.qinst.timeout);
			this.qinst.finishTime = finishTime;
			if (questionIndex < quiz.questions.length) {
				this.qinst.timeout = setTimeout(
					this.nextQuestionForAll.bind(this), delta * 1000);
			} else {
				this.qinst.timeout = setTimeout(
					this.endQinstForAll.bind(this), delta * 1000);
			}
		} else {
			clearTimeout(this.player.timeout);
			this.player.finishTime = finishTime;
			if (!quiz.settings.isTimePerQuestion
					|| questionIndex < quiz.questions.length) {
				this.player.timeout = setTimeout(
					this.nextQuestionForPlayer.bind(this), delta * 1000);
			} else {
				this.player.timeout = setTimeout(
					this.endQinstForPlayer.bind(this), delta * 1000);
			}
		}

		return [question, finishTime];
	}

	nextQuestionForAll() {
		this.qinst.questionIndex += 1;
		const [ question, finishTime ] = this.startQuestion();

		for (let conn of this.qinst.conns) {
			conn.sendQuestion(question, finishTime);

			if (this.qinst.quiz.settings.doesHostPlay ||
					!(this.qinst.hostConn === conn)) {
				conn.player.hasAnswered = false;
			}
		}
		wss.emit('nextQuestion', this.qinst);
	}

	nextQuestionForPlayer() {
		this.player.questionIndex += 1;
		const [ question, finishTime ] = this.startQuestion();

		this.sendQuestion(question, finishTime);
	}

	endQinstForAll() {
		if (this.qinst.phase === wss.QINST_PHASE_ACTIVE) {
			this.qinst.phase = wss.QINST_PHASE_FINISHED;

			for (let conn of this.qinst.conns) {
				conn.sendQinstEnd();
			}
		} else {
			this.sendError('QinstAlreadyEnded',
				'Ați încercat să încheiați jocul deși acesta era deja '
				+ 'finalizat.', false, false)
			return;
		}
	}

	endQinstForPlayer() {
		if (!this.player.hasFinished) {
			this.player.hasFinished = true;

			nPlayersFinished = this.qinst.players.filter(
				(x) => (x.hasFinished)).length;
			if (nPlayersFinished === this.qinst.players.length) {
				this.endQinstForAll();
			}
			
			this.sendPlayerResults();
		} else {
			this.sendError('PlayerAlreadyFinished',
				'Ați încercat să încheiați jocul deși acesta era deja '
				+ 'finalizat pentru dumneavoastră.', false, false)
			return;
		}
	}

	//TODO send this to the client
	calcTotal(player, doesCalcScore) {
		var questions = this.qinst.quiz.questions;

		questions = questions.sort((x,y) => (x.index - y.index));
		answers = player.answers.sort((x, y) => (x.index - y.index));

		var total = 0;
		for (let i = 0; i < questions.length; i++) {
			let correctAnswer = questions[i].correctAnswer;
			let nCorrectSubAnswers = 0;
			if (answers[i].length === correctAnswer.length) {
				for (subAnswer of answers[i]) {
					if (correctAnswer.indexOf(subAnswer) !== -1) {
						nCorrectSubAnswers++;
					}
				}
				if (nCorrectSubAnswers === correctAnswer.length) {
					if (doesCalcScore) {
						total += questions[i].score;
					} else {
						total++;
					}
				}
			}
		}

		return total;
	}

	/*** validation methods ***/
	expectIsDefined(variable, variableName, fnName) {
		if (variable === undefined) {
			throw "Validation error: " + variableName + " should be defined "
			+ "in the user-created " + fnName + " function";
		}
	}

	expectIsBoolean(variable, variableName, fnName) {
		if (variable !== true && variable !== false) {
			throw "Validation error: " + variableName + " should be set to "
				+ "true or false in the user-created " + fnName + " function";
		}
	}

	expectIsInteger(variable, variableName) {
		if (!Number.isInteger(variable)) {
			throw "Validation error: " + variableName + " should be an integer "
				+ "in the user-created " + fnName + " function";
		}

	};

	expectIsNumber(variable, variableName, fnName, acceptNull = false) {
		if (acceptNull && !(variable === null
				|| typeof variable === "number")) {
			throw "Validation error: " + variableName + 
				+ "should be null or a number in the user-created "
				+ fnName + " function";
		} else if (!acceptNull && typeof variable !== "number") {
			throw "Validation error: " + variableName + " should be numeric "
				+ "in the user-created " + fnName + " function";
		}
	}

	expectIsArray(variable, variableName, fnName) {
		if (!Array.isArray(variable)) {
			throw "Validastion error: " + varibleName + " should be an array "
				+ "in the user-created " + fnName + " function";
		}
	}

	expectIsString(variable, variableName, fnName, acceptNull = false) {
		if (acceptNull && !(variable === null
				|| typeof variable === "string")) {
			throw "Validation error: " + variableName + 
				+ "should be null or a string in the user-created "
				+ fnName + " function";
		} else if (!acceptNull && typeof variable !== "string") {
			throw "Validation error: " + variableName + " should be a string "
				+ "in the user-created " + fnName + " function";
		}
	}

	validateQuiz(quiz) {
		var fq = 'fetchQuiz';
		this.expectIsDefined(
			quiz.settings.doesAdvanceTogether,
			'quiz.settings.doesAdvanceTogether',
			fq);
		this.expectIsBoolean(
			quiz.settings.doesAdvanceTogether,
			'quiz.settings.doesAdvanceTogether',
			fq);
		
		this.expectIsDefined(
			quiz.settings.isTimePerQuestion,
			'quiz.settings.isTimePerQuestion',
			fq);
		this.expectIsBoolean(
			quiz.settings.isTimePerQuestion,
			'quiz.settings.isTimePerQuestion',
			fq);

		this.expectIsDefined(
			quiz.settings.doesHostPlay,
			'quiz.settings.doesHostPlay',
			fq);
		this.expectIsBoolean(
			quiz.settings.doesHostPlay,
			'quiz.settings.doesHostPlay',
			fq);
	
		this.expectIsDefined(quiz.settings.time, 'quiz.settings.time', fq);
		this.expectIsNumber(quiz.settings.time, 'quiz.settings.time', fq);

		var nQuestions = quiz.questions.length;
		for (let i = 0; i < nQuestions; i++) {
			let question = quiz.questions[i];
			let questionStr = 'quiz.questions[' + i + ']';

			this.expectIsDefined(question.text, questionStr + '.text', fq);
			this.expectIsString(question.text, questionStr + '.text', fq);

			this.expectIsDefined(question.index, questionStr + '.index', fq);
			this.expectIsInteger(question.index, questionStr + '.index', fq);

			// check that each question index falls in the correct range
			if (question.index < 1 || question.index > nQuestions) {
				throw "Validation error: the index (" + question.index
					+ ") of quiz.questions[" + i + "] should be between "
					+ "1 and " + nQuestions + " in the user-created "
					+ fq + " function";
			}

			// check that each question index is unique
			if (quiz.questions.filter((x)=> (x.index === question.index))
				.length > 1) {
				throw "Validation error: multiple questions have the index "
					+ question.index + "; each question's index should be "
					+ "unique in the user-created " + fq + "function";
			}

			this.expectIsDefined(question.time, questionStr + '.time', fq);
			this.expectIsNumber(question.time, questionStr + '.time', fq, true);

			this.expectIsDefined(question.points, questionStr + '.points', fq);
			this.expectIsNumber(question.points, questionStr + '.points', fq);
		
			this.expectIsDefined(
				question.correctAnswer,
				questionStr + '.correctAnswer',
				fq);
			this.expectIsArray(
				question.correctAnswer,
				questionStr + '.correctAnswer',
				fq);

			if (question.correctAnswer.length === 0) {
				throw "Validation error: " + questionStr + ".correctAnswer "
					+ "should not be empty in the user-created " + fq
					+ "function";
			}

			if (question.correctAnswer.length > question.answers.length) {
				throw "Validation error: " + questionStr + ".correctAnswer "
					+ "should not contain more elements than there are "
					+ "answers to its question in the user-created " + fq
					+ "function";
			}

			for (let j = 1; j < question.correctAnswer.length; j++) { 
				let entry = question.correctAnswer[j];

				// check that each entry in the correctAnswer array
				// falls into the correct range
				if (entry < 1 || entry > question.answers.length) {
					throw "Validation error: the index of " + questionStr
						+ ".correctAnswer[" + i + "] should be between 1 and "
						+ question.answers.length
						+ "in the user-created " + fq + "function";
				}

				// check that each entry in the correctAnswer array is unique
				if (question.correctAnswer.filter(
					(x)=> (x === entry))
					.length > 1) {
					throw "Validation error: multiple entries in the "
						+ "correctAnswer array for the question with index "
						+ question.index + " have the same value; "
						+ "each entry in a given correctAnswer array should be "
						+ "unique in the user-created " + fq + "function";
				}
			}

			this.expectIsDefined(
				question.commentary,
				questionStr + '.commentary',
				fq);

			this.expectIsString(
				question.commentary,
				questionStr + '.commentary',
				fq, true);

			let nAnswers = question.answers.length;
			for (let j = 0; j < nAnswers; j++) {
				let answer = question.answers[j];
				let answerStr = 'quiz.question[' + i + '].answers[' + j + ']';
				
				this.expectIsDefined(answer.index, answerStr + '.index', fq);
				this.expectIsInteger(answer.index, answerStr + '.index', fq);

				// check that each answer index falls in the correct range
				if (answer.index < 1 || answer.index > nAnswers) {
					throw "Validation error: the index (" + answer.index
						+ ") of " + answerStr + " should be between "
						+ "1 and " + nAnswers + " in the user-created "
						+ fq + " function";
				}

				// check that each answer index is unique
				if (question.answers.filter((x) => (x.index === answer.index))
					.length > 1) {
					throw "Validation error: multiple answers to the question "
						+ "with index " + question.index + " have the index "
						+ answer.index + "; each answer's index should be "
						+ "unique within a given question in the "
						+ "user-created " + fq + "function";
				}

				this.expectIsDefined(answer.text, answerStr + '.text', fq);
				this.expectIsString(answer.text, answerStr + '.text', fq);
			}
		}
	}
}

wss.on('connection', function (ws) {
	var conn = new WebsocketConnection(ws);
	wss.conns.push(conn);

	ws.on('message', function (msg) {
		var ktime = new Date(); //current time
		if (conn.throttleExpiry > ktime) {
			conn.sendError('WebsocketError',
				'Eroare websocket: prea multe mesaje într-un interval '
				+ 'prea scurt de timp');
			return;
		}
		msg = JSON.parse(msg);

		if (msg.type !== "create" && wss.doesThrottle) {
			conn.throttleExpiry = ktime.setMilliseconds(
				ktime.getMilliseconds() + config.throttleTime);
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
			case "cancelStart":
				conn.respondToCancelStart(msg);
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

	ws.on('close', function (code, reason) {
		if (!reason) {
			reason = ""; 
		}

		if (conn.qinst) {
			// remove the connection from the quiz's connection roster
			conn.qinst.conns.splice(conn.qinst.conns.indexOf(conn), 1);

			if (code === 1000) {
				// the leave was under normal conditions

				if (conn.qinst.hostNickname === conn.player.nickname) {
					// place the game in hostless mode
					conn.qinst.hostConn = null;
					conn.qinst.hostNickname = null;

					// if the game is in the prep phase, notify all players that
					// the host has left and close all their connections
					if (conn.qinst.phase === wss.QINST_PHASE_PREP) {
						for (let otherConn of conn.qinst.conns) {
							conn.qinst.conns.splice(
								conn.qinst.conns.indexOf(otherConn), 1);
							otherConn.sendConnectionClosed(conn.player.nickname
								+ " a plecat din joc; jocul nu poate "
								+ "continua."
							);
							if (otherConn.ws.readyState === otherConn.ws.OPEN) {
								otherConn.ws.close(1000,
									otherConn.player.nickname
									+ " a fost scos din joc");
							}
						}
					} else {
						// send the remaining players a notice that the host
						// has left
						for (let otherConn of conn.qinst.conns) {
							otherConn.sendPlayerLeft(conn.player.nickname,
								reason, false);
						}
						conn.qinst.players.splice(
							conn.qinst.players.indexOf(conn.player), 1);
					}
				} else {
					// if the player is not the host, simply notify the
					// remaining players that the player has left
					for (let otherConn of conn.qinst.conns) {
						otherConn.sendPlayerLeft(conn.player.nickname,
							reason, false);
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
					// if the player was the host, place the game temporarily
					// in hostless mode
					if (conn.player.nickname === conn.qinst.hostNickname) {
						conn.qinst.hostConn = null;
					}

					// turn off the player's ready status if possible
					if ([wss.QINST_PHASE_PREP, wss.QINST_PHASE_ACTIVE]
							.indexOf(conn.qinst.phase) !== -1) {
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
	console.log('bquiz websocket server started');
});

module.exports = wss;
