const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const yaml = require('js-yaml');
const express = require('express');

const bodyParser = require('body-parser');
const basicAuth = require('basic-auth');

try {
	var config = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));
} catch (ex) {
	console.log(ex);
}

const { verifyUser, saveQuiz } = require(config.apimodule);

const privateKey = fs.readFileSync(config.privateKeyPath);
const certificate = fs.readFileSync(config.certificatePath);

var app = express();
app.use(bodyParser.json());

app.users = {}; // each username is the key for a user object
app.ips = {}; // each ip address is the key for an ip object
app.config = {doesThrottle: true};

// user object:
//   password
//   lastRequestTime
//   idleTimeout

// ip object:
//   throttleExpiry
//   throttleChecks
//   idleTimeout


// error object:
//   status: the status code sent by the server to the client
//   errtype: the error's type
//   error: the message contents of the error

// tests:
//   authentication:
//   * authenticates POST requests to [uris][TODO]
//   * sends a 401 error for requests that require authentication if the user
//     is not authenticated
//   * adds newly authenticated users to the server's user list
//   * removes users from the server's user list when they log off
//
//   throttling:
//   * throttles requests when the ip address has sent them too frequently
//   * ceases throttling requests after the throttleDuration has elapsed
//   * does not throttle requests when fewer than config.throttleCount requests
//     have been made in recent history
//   * removes an ip address from the registry if it has been idle for longer
//     than the idleDuration
//
//   bibleQuiz sample:
//   * sends an error message if the quiz to be saved shares the name of
//     another quiz
//   * writes a new quiz to the database if the quiz id is null
//   * overwrites the old quiz in the database if the quiz id is not null
//   * adds sections to the database when overwriting a quiz if they have not
//     already been added
//   * edits the number of questions in sections previously included in the
//     database when overwriting a quiz
//   * deletes sections not present in the new version of the quiz when
//     overwriting a quiz


// Check whether a user has been idle for too long, and if so, delete the user
// from the registry, else prepare another check for after the specified
// duration has elapsed
const attemptDeleteUser = function(user) {
	var interval = new Date().getTime()
		- user.lastRequestTime.getTime();
	if (interval > config.idleDuration) {
		delete app.users[user];
	} else {
		app.users[user].idleTimeout = setTimeout(
			attemptDeleteUser,
			config.idleDuration,
			user,
		);
	}
}

// Check whether an ip address has been idle for too long, and if so, delete it
// from the registry, else prepare another check for after the specified
// duration has elapsed
const attemptDeleteAddr = function(addr) {
	var interval = new Date().getTime()
		- addr.throttleChecks[addr.throttleChecks.length - 1].getTime();
	if (interval > config.idleDuration) {
		delete app.ips[addr];
	} else {
		//extend the ip address' lifetime within the registry
		app.ips[addr].idleTimeout = setTimeout(
			attemptDeleteAddr,
			config.idleDuration,
			addr,
		);
	}
}

// Throttle the requests from a particular ip address if too many requests have
// been made within too short a timespan
const throttleRequests = function(req, res, next) {
	console.log('in throttleRequests');
	var ktime = new Date();
	if (!Object.keys(app.ips).includes(req.connection.remoteAddress)) {
		app.ips[req.connection.remoteAddress] = {
			throttleExpiry: null,
			throttleChecks: [],
			idleTimeout: setTimeout(
				attemptDeleteAddr,
				config.idleDuration,
				req.connection.remoteAddress,
			)
		}
	}
	var addr = app.ips[req.connection.remoteAddress];

	const errorTooManyRequests = {
		status: 429, //429: too many requests
		errtype: 'TooManyRequests',
		error: "Eroare HTTP: ați trimis prea multe mesaje într-un "
			+ "interval prea scurt de timp",
	};

	if (!app.config.doesThrottle) {
		next();
		return;
	}

	if (addr.throttleExpiry !== null) {
		if (addr.throttleExpiry > ktime) {
			next(errorTooManyRequests);
			return;
		} else {
			addr.throttleExpiry = null;
		}
	}

	addr.throttleChecks.push(new Date());
	if (addr.throttleChecks.length > config.throttleCount) {
		addr.throttleChecks.shift();

		var interval = addr.throttleChecks[
			config.throttleCount - 1].getTime()
			- addr.throttleChecks[0].getTime();
		if (interval < config.throttleReqInterval) {
			addr.throttleExpiry = new Date(ktime).setTime(
				ktime.getTime() + config.throttleTime);
			next(errorTooManyRequests);
		} else {
			next();
		}
	} else {
		next();
	}
}

const authenticate = function(req, res, next) {
	console.log('in authenticate');

	// check whether the request warrants authentication
	console.log('request method:', req.method);

	req.auth = basicAuth(req);
	console.log('req.auth:', req.auth);
	console.log('request headers:', req.headers);
	// attempt to authenticate the request
	var isAuthenticated;
	if (req.auth) {
		isAuthenticated = verifyUser(req.auth.name, req.auth.pass);

	} else {
		isAuthenticated = false;
	}

	if (isAuthenticated) {
		if (!Object.keys(app.users).includes(req.auth.name)) {
			app.users[req.auth.name] = {
				password: req.auth.pass,
				lastRequestTime: new Date(),
				idleTimeout: setTimeout(
					attemptDeleteUser,
					config.idleDuration,
					req.auth.name
				)
			}
		}
		next();
	} else {
		next({
			status: 401,
			errtype: 'Unauthorized',
			error: 'Autentificare invalidă: nu am găsit combinația '
			+ 'numelui de utilizator și parolei specificate în baza de '
			+ 'date',
		});
	}
}

const sendError = function(err, req, res, next) {
	console.log('in sendError', err);
	res
		.status(err.status)
		.set({'Content-Type': 'application/json'})
		.send(JSON.stringify({
			errtype: err.errtype,
			error: err.error,
		}));
	next(err);
}

const coreMiddleware = [throttleRequests, authenticate, sendError];
const optionsMiddleware = [throttleRequests, sendError];

function getAllowedOrigin(req) {
	var origin = "";
	if (req.get('origin').startsWith('https://')) {
		origin += "https://";
	} else {
		origin += "http://";
	}
	origin += config.webOriginHost + ':' + config.webOriginPort;

	return origin;
}

app.options('/quiz/*', optionsMiddleware, function(req, res) {
	console.log('in options /quiz/save');
	res.status(204)
		.set({
			'Content-Type': 'text/plain',
			'Access-Control-Allow-Origin': getAllowedOrigin(req),
			'Access-Control-Allow-Headers': 'POST,OPTIONS',
			'Access-Control-Allow-Credentials': true,
			'Access-Control-Allow-Headers': 'authorization,Content-Type',
		})
		.send();
});

app.post('/quiz/save', coreMiddleware, function(req, res) {
	console.log('in post /quiz/save');
	console.log('body:', req.body);
	req.body.user = req.auth;
	saveQuiz(req.body)
		.then(function(id) {
			res.status(204)
				.set({
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': getAllowedOrigin(req),
					'Access-Control-Allow-Headers': 'POST,OPTIONS',
					'Access-Control-Allow-Credentials': true,
					'Access-Control-Allow-Headers':
						'authorization,Content-Type',
				})
				.send(id);
		});
});

app.post('/logoff', function(req, res) {
	if (req.auth.name in Object.keys(app.users)) {
		clearTimeout(app.users[req.auth.name].idleTimeout);
		delete app.users[req.auth.name];
		res.status(204)
			.send();
	} else {
		res.status(400)
			.set({'Content-Type': 'application/json'})
			.send(JSON.stringify({
				errtype: 'InvalidRequest',
				error: 'Ați cerut să vă dezautentificați deși nu erați '
					+ 'autentificat',
			}));
	}
});

//var httpServer = http.createServer(app);
var httpsServer = https.createServer({key: privateKey, cert: certificate}, app);

/*
httpServer.listen(config.rsHttpPort, function() {
	console.log(`bquiz http REST server started for port ${config.rsHttpPort}`);
});
*/

httpsServer.listen(config.rsHttpsPort, function() {
	console.log(`bquiz https REST server started for port ${config.rsHttpsPort}`
		);
});



