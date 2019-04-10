five-second timer issued to the game lobby before starting the game
players may give ratings of the game's individual questions
playerJoined, playerLeft descriptions

## Events
##### qinstCreation
triggered after the quiz instance is generated

##### qinstStartCountdown
triggered when everyone issues their ready state and the host starts the game; sets isJoinable to false.
##### qinstStart
triggered five seconds after qinstStartCountdown; prior to it, the quiz instance enters the active state, schedules its finishTime and issues a gameActive message to all players
##### qinstEnd
triggered when the game ends; prior to this, the server issues a gameFinish message to the players that contains the overall results for all players as well as the individual results for the player to whom it is issued, and waits for each player to respond with an acknowledgement message; if no such message is given by a player after 30 seconds, the game removes that player
##### qinstDeletion
triggered after the last player leaves the game and the server deletes the quiz instance
##### connClosed
the server has closed a connection and performed cleanup

## Client messages
Players may send the following messages to the server. Below the name of each message shown here is a list of the message object's keys.

##### create
`{type, quizId, username}`
- **type**: the string 'create'
- **quizId**: the database id of the quiz on which this game will be based
- **username**: the username of the quiz instance's creator

Sent when the host creates the new quiz instance.
In response, the server triggers the *qinstCreation* event and sends the quiz instance's code to the player, who must then sign in by sending a join message.
##### join
`{type, code, username, password, nickname}`
- **type**: the string 'join'
- **code**: the nine-digit code referencing the quiz instance
- **username**: the username of the person joining
- **password**: the password of the person joining
- **nickname**: the nickname used by the person joining
  
Sent when the player joins a given quiz instance.
In response, if no errors occur, the server adds the player to the game, or reconnects them if already added, then issues them a *welcome* message and sends all other players a *playerJoined* messsage. 
##### boot
`{type, nickname}`
- **type**: the string 'boot'
- **nickname**: the nickname of the player to be booted

Sent when the host requests for another player to be booted.
In response, the server boots the target player if the player requesting the boot is the host, then broadcasts the *playerLeft* message to all players with 'booted by the game host' specified in the description.
##### ready
`{type}`
- **type**: the string 'ready'
  
Sent when the player enters the ready state during game preparation.
In response, the server registers the player as ready and sends the *playerReady* message to all players.
##### notReady
`{type}`
- **type**: the string 'notReady'

Sent when the player leaves the ready state during game preparation.
In response, the server unregisters the player from being ready and sends the *playerNotReady* message to all players.
##### start
`{type}`
- **type**: the string 'start'

Sent when the game host starts the game.
In response, the server checks whether the player sending this is a host and whether all players are ready; if both are true, triggers the qinstStartCountdown event

##### answer
`{type, answer}`
- **type**: the string 'answer'
- **answer**: an array of the answers selected by the player as correct this can contain a single answer for single-choice questions or multiple answers for multiple-choice questions

Sent when a player answers a question.
In response, the server checks whether the user has already given the answer, and if not, records the answer and whether it is correct, then sends the answerFeedback response to the player
##### nextQuestion
`{type}`
-**type**: the string 'nextQuestion'

Sent when the host advances the quiz to the next question.
In response, the server sends all players the next question if they have all submitted their answers.
##### endAcknowledged
`{type}`
- **type**: the string 'endAcknowledged'
  
Automatically sent by the player to prevent being booted 30 seconds after the game ends.
In response, the server cancels the 30-second timeout timer.
##### leave
`{type}`
- **type**: the string 'leave'
  
Sent by the player when leaving the game.
In response, the server removes the player from the player list; if the host leaves, the quiz instance enters hostless mode if no more players remain, trigger the *qinstDeletion* event.

## Server messages
The server may send the following messages to players. Below the name of each
message shown here is a list of the message object's keys.

##### welcome
the response to connections and reconnections.

when the game is in the 'prep' state:
`{type, state, players, quiz}`
- **type**: the string 'welcome'
- **state**: the string 'prep'
- **players**: the list of players currently taking part in the quiz
- **quiz**: the quiz object, which does not contain the questions

when the game is in the 'active' state:
`{type, state, players, question, finishTime, quiz}`
- **type**: the string 'welcome'
- **state**: the string 'active'
- **players**: the list of players currently taking part in the quiz
- **question**: the current question in the quiz
- **finishTime**: the time at which the current question will expire
- **quiz**: the quiz object, which does not contain the questions

when the game is in the 'finished' state:
`{type, state, players, results, quiz}`
- **type**: the string 'welcome'
- **state**: the string 'finished'
- **players**: the list of players currently taking part in the quiz
- **results**: the full quiz results object
- **quiz**: the quiz object, which does not contain the questions
  
##### code
`{type, code}`
- **type**: the string 'code'
- **code**: the nine-digit code referencing the quiz instance

feedback in response to 'create' messages
##### playerJoined
`{type, nickname, description}`
- **type**: the string 'playerJoined'
- **nickname**: the nickname of the player that has joined
- **description**: a description of the circumstances of the joining event

notification to all players that another player has joined the game
##### playerLeft
`{type, nickname, description, isDisconnect}` 
- **type**: the string 'playerLeft'
- **nickname**: the nickname of the player that has left
- **description**: a description of the circumstances of the leaving event
- **isDisconnect**: whether the departure is owed to a disconnection instead of an actual leave message

notification to all players that another player has left the game
##### playerReady
`{type, nickname}`
-**type**: the string 'playerReady'
-**nickname**: the nickname of the player that is now ready

notification to all players that another player is ready
##### playerNotReady
`{type, nickname}`
-**type**: the string 'playerNotReady'
-**nickname**: the nickname of the player that is no longer ready

notification to all players that another player is no longer ready
##### qinstReady
`{type}`
-**type**: the string 'qinstReady'

notification to all players when the host triggers the qinstReady event
#### qinstNotReady
`{type}`
-**type**: the string 'qinstNotReady'

notification to all players when the host triggers the qinstNotReady event
##### qinstActive
`{type}`
-**type**: the string 'qinstActive'

notification to all players when the game begins
##### answerFeedback
`{type, answer}`
-**type**: the string 'answerFeedback'
-**answer**: the correct answer for the quiz question

notification after the player has answered a question
##### question
`{type, question, finishTime}`
-**type**: the string 'question'
- **question**: the current question in the quiz
- **finishTime**: the time at which the current question will expire

a new question sent during the game
##### qinstEnd
`{type, results}`
- **type**: the string 'qinstEnd'
- **results**: the full list of all players' results

notification that the game has ended, along with a list of results
#### connectionClosed
`{type, description}`
- **type**: the string 'closeConnection'
- **description**: the reason for closing the connection

notification that the server has closed its connection to the player
##### error
{type, errtype, error}
-**type**: the string 'error'
-**errtype**: an identifier for the type of error being shown
-**error**: the full error message

message sent when an error has arisen

## Objects
##### wss
The websocket server object as described in [the ws documentation](https://github.com/websockets/ws/blob/HEAD/doc/ws.md), along with extra fields used by the quiz server
`{doesThrottle, qinsts, conns, ...}`
- **doesThrottle**: whether the server throttles messages sent at an interval of less than one second. Does not take *create* and *endAcknowledged* messages into account. Set this to false when running test suites.
- **qinsts**: an object storing all quiz instances on the server; each key is a nine-digit code referencing the quiz instance
- **conns**: an array storing all connection objects to the server

##### qinst
a quiz instance, which contains all the information needed to run a single game
`{quiz, questions, conns, players, isJoinable, state, code}`
- **quiz**: the quiz object
- **questions**: an array of all questions in the quiz
- **conns**: an array of all connection objects for the quiz instance
- **players**: an array of all player objects for the quiz instance
- **hostUsername**: the game host's username
- **hostConn**: the game host's websocket connection
- **isJoinable**: boolean, whether the quiz instance can be joined
- **state**: one of either 'prep', signifying that the quiz instance is undergoing preparations for the quiz to start; 'ready', signifying that the quiz is about to start; 'active', signifying that the quiz is being played; and 'finished', signifying that the quiz has finished.
- **code**: the nine-digit code referencing the quiz instance

##### player
`{nickname, username, isReady}`
- **nickname**: the nickname used throughout the quiz to identify the player
- **username**: the player's username, or 'null' if no username exists
- **isReady**: whether the player is ready for the game to start, or for the next question if already in the game

#### conn
`{ws, qinst, player, throttleExpiry}`
- **ws**: the websocket object as described in [the ws documentation](https://github.com/websockets/ws/blob/HEAD/doc/ws.md)
- **qinst**: the quiz instance being played
- **player**: the player connected to the websocket server
- **throttleExpiry**: the time at which the throttle will expire on this connection, allowing more messages from the connection to be processed

## Database tables
quiz:
  id, name varchar(255), description text, n\_questions
quiz\_question: 
  id, quiz\_id, quiz\_question\_id

