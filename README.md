# Bquiz
**The framework is currently in pre-alpha and is not yet ready for production environments.**

Bquiz is a multiplayer web-plugin framework that lets you create and play quizzes online. It features a server and web API written in node.js, using the `ws` websocket library and `express` http server framework, and comes with a javascript client written in Vue. The client may be attached to any webpage that includes the bquiz.js file and supplies a `<div id="bquiz"></div>` element anywhere on the page.


## Getting started

\[Installation instructions\]

SSL requirements for the REST server
CORS notice for the REST server


## Front-end configuration functions
Those who want to use the bquiz framework must use a set of functions that interface with the framework's front-end. These functions supply the client's username and password and provide configuration parameters *TODO*.

##### setupUser
Provides bquiz with the details of the end-user.
- parameters:
  - **username** (string): the end-user's username
  - **password** (string): the end-user's password
  - **locale** (string): an optional locale setting, 'en' by default *TODO*
- return value: none


## Back-end API module
Those who want to incorporate the bquiz framework into their own quiz projects must write a back-end node.js module containing functions specific to their own quiz. The framework calls the functions in this module in order to save and load quizzes to and from any databases, xml files and other storage media the developer has set up. 

A default module, complete with a database for storing quizzes and their questions, will be provided at a later date.

For the time being, the module `biblequiz.js` and its settings file `biblequiz.yml` constitute an example of how a quiz can be plugged into the framework.

### API classes
##### <a name="Quiz">Quiz</a>
`{identifier, name, description, settings, questions}`
- **identifier** (mixed): the identifier, such as a database id, that identifies the quiz; should be set to `null` when creating a new quiz.
- **name** (string): the name of the quiz
- **description** (string): a description of the quiz
- **settings** ([QuizSettings](#QuizSettings) object): the settings of the quiz
- **questions** (array of [Questions](#Question)): the questions in the quiz
- **rating** (double): the overall rating of the quiz *TODO*
- **ratingCount** (int): the number of people who rated the quiz *TODO*
- **plays** (int): the number of times the quiz has been played to completion *TODO*

#####<a name="QuizSettings">QuizSettings</a>
The settings of a given quiz
`{time, isTimePerQuestion, doesAdvanceTogether, doesHostPlay}`
- **time** (double): the time, in seconds, during which either the quiz (if *isTimePerQuestion* is set to `false`) or each particular question (if *isTimePerQuestion* is set to `true`) will take place
- **isTimePerQuestion** (bool): if true, the variable *time* refers to the time per question, else the variable *time* refers to the total time of the quiz
- **doesAdvanceTogether** (bool): if true, all players advance to the next question together, whether when the host sends the *nextQuestion* message or when the time to the next question expires. If false, each individual player advances to the next question as soon as they answer the current question.
- **doesHostPlay** (bool): if true, the game treats the host as a regular player, sending them questions etc.

##### <a name="Question">Question</a>
A question found within a given quiz
`{identifier, index, text, commentary, isMultipleResponse, correctAnswer, time, points, choices}`
- **identifier** (mixed): the question's identifier, such as a database id, that identifies the question; used when creating a new quiz to establish that it is using previously defined questions. Can be set to `null`to signify that the question is not currently in the database or other storage medium.
- **index** (int): the question's index, from 1 to the number of questions in the quiz; all questions should have a unique index. The quiz supplies the questions to the players in the order of their indices.
- **text** (string): the text of the question, ideally no greater than 200 characters
- **commentary** (string | null): a description of why the correct answer is in fact correct; set this to `null` to omit it
- **isMultipleResponse** (bool): whether the question allows more than one answer to be included in the correct answer
- **correctAnswer** (array of ints): an array containing the index or indices of all choices in the question that together comprise the correct answer
- **time** (double | null): the time, in seconds, for the question; if not set to `null`, it overrides the *time* variable in the *settings* object when *isTimePerQuestion* is set to `true`, otherwise it has no effect.
- **points** (double): the number of points awarded for answering the question correctly.
- **choices** (array of [Choices](#Choice)): the available choices in the question.

##### <a name="PreparedQuestion">PreparedQuestion</a>
A Question that has had its correctAnswer and commentary fields removed, so that it may be sent to the player without risk of cheating.

##### <a name="Choice">Choice</a>
A choice is one of the available options that players can tick when answering a given question.
`{identifier, index, text}`
- **identifier** (mixed): the choice's identifier, such as a database id, that identifies the choice; used when creating a new quiz to establish that one of its questions is using previously defined choices. Can be set to `null`to signify that the choice is not currently in the database or other storage medium.
- **index** (int): the choice's index, ranging from 1 to the number of choices available for the question. All choices should have a unique index.
- **text** (string): the text of the choice, ideally no greater than 100 characters

##### <a name="QuizSummary">QuizSummary</a>
A summary of a given quiz, used when listing quizzes for prospective players
`{identifier, name, rating, plays}`
- **identifier** (mixed): the identifier, such as a database id, that identifies the quiz; should be set to `null` when creating a new quiz.
- **name** (string): the name of the quiz
- **creator** (string | null): the username of the quiz's creator; can be set to `null` when the quiz is meant to be anonymous
- **description** (string): the description of the quiz
- **rating** (double): the overall rating of the quiz *TODO*
- **plays** (int): the number of times the quiz has been played to completion *TODO*

### API functions

The following functions must be present in the API module. Be sure to provide exceptions for all undesired behavior.

##### verifyUser
Verifies whether the specified username and password match a given user from the website's user directory (which can be, for example, a database table); returns true if so, otherwise returns false. Bquiz allows users to be logged in and provides various benefits for logged in users, and so requires this function to identify users who are logged in.
- parameters
  - **username** (string): the username of the user being fetched; included in *create* and *join* client messages.
  - **password** (string): the password of the user being fetched; included in *join* client messages.

- return value (string | null): the username of the user being fetched, or `null`
##### fetchQuiz
Fetches the complete Quiz object corresponding to a given quiz from the database or other storage medium.
- parameters
  - **identifier** (mixed): the variable (e.g. an integer database Id) that identifies the quiz

- return value ([Quiz](#Quiz) object): a complete Quiz object

##### fetchQuizList
Fetches the summaries of a set of quizzes from the database, in descending order of the time of their creation, using the search criteria described below. If a search criterion is set to `null`, the function must ignore it. The summaries will be used when the player seeks prospective quizzes to play.
- parameters
  - **username** (string): search criterion; the username of the quizzes' creator
  - **quizName** (string): search criterion; a part of the quiz's name.
  - **description** (string): search criterion; a part of the quiz's description.
  - **minRating** (double): search criterion; the minimum rating of the quizzes *TODO*
  - **minPlays** (int): search criterion; the minimum number of plays of the quizzes *TODO*
  - **offset** (int): the offset of the first quiz in the database or other storage medium
  - **limit** (int): the number of quiz summaries to fetch

- return value(Array of [QuizSummaries](#QuizSummary)): the summaries of the selected quizzes




##### createQuiz
Creates the quiz in the database or other storage medium and identifies the user as its owner.
- parameters
  - **quiz** ([Quiz](#Quiz)): the quiz to be created in the storage medium

- return value (mixed): the variable (e.g. an integer database Id) that identifies the quiz

##### updateQuiz
Updates the quiz in the database or other storage medium if the user is its owner.
- parameters
  - **quiz** ([Quiz](#Quiz)): the quiz to be updated in the storage medium; the quiz's identifier attribute must not be null as it must reference the quiz to be updated. However, any other attributes of the quiz object may be undefined, and if they are, the updateQuiz function must ignore them.

- return value: none

##### deleteQuiz
Deletes the quiz from the database or other storage medium if the user is its owner.
- parameters
  - **identifier** (mixed): the identifier, such as a database id, that identifies the quiz.

##### debriefQuiz
Updates the ratings and statistics of the quiz in the database or other storage medium after a given play-through of the quiz.
- parameters
  - **identifier** (mixed): the identifier, such as a database id, that identifies the quiz.
 - **ratings** (Array of Ratings): the ratings for the quiz




# Internals 
The following is only of interest to those wishing to develop extensions for bquiz or develop bquiz itself; users who simply want to incorporate bquiz into their own projects should only ever need to use the API functions.

Bquiz uses a websocket server for interacting with the players during a game, an XMPP server for handling player chatting and a REST server for saving and loading quizzes. All messages used by the websocket and REST servers employ the JSON format.

## REST client messges
The client sends these messages to the REST web service when loading and saving quizzes. All REST client messages contain the following:
-**username** (string): the requester's username
-**password** (string): the requester's password

##### saveQuiz
`{username, password, quizIdentifier, quiz}`
-**identifier** (mixed): 
-**quiz** (Quiz object): the quiz object to be saved

Saves a quiz, invoking the createQuiz API method with the specified quiz object on the server side if the identifier is set to `null`, or updateQuiz on the server side otherwise.

##### deleteQuiz
`{username, password, quizIdentifier}`

, invoking the deleteQuiz API method with 





## REST server messages








## Websocket server Events
Those who wish to extend the bquiz framework can use the various events emitted by its websocket server object.
##### qinstCreated
triggered after the quiz instance is generated, when the game has entered the `'prep'` phase
##### qinstStartCountdown
triggered in the  after everyone has issued their ready state and the host begins the countdown to the start of the game; sets isJoinable to false.
#####qinstCountdownCancelled
triggered when the host cancels the countdown for the start of the game
##### qinstStarted
triggered five seconds after qinstStartCountdown, when the game has entered the `'active'` phase
##### qinstEnded
triggered when the game ends; prior to this, the server issues a gameFinish message to the players that contains the overall results for all players as well as the individual results for the player to whom it is issued, and waits for each player to respond with an acknowledgement message; if no such message is given by a player after 30 seconds, the game removes that player
##### qinstDeleted
triggered after the last player leaves the game and the server deletes the quiz instance
##### connClosed
the server has closed a connection and performed cleanup

## Websocket client messages
The players' clients may send the following messages to the server. Below the name of each message shown here is a list of the message object's keys.

##### create
`{type, identifier, username}`
- **type** (string): the string `'create'`
- **identifier** (mixed): the identifier (e.g. a database id) of the quiz on which this game will be based
- **nickname** (string): the nickname of the quiz instance's creator
- **locale** (string): the locale of the quiz instance's creator, indicating the language in which messages to the creator will be shown *TODO*

Sent when the host creates the new quiz instance.
In response, the server triggers the *qinstCreation* event and sends the quiz instance's code to the player, who must then sign in by sending a join message.
##### join
`{type, code, username, password, nickname}`
- **type** (string): the string `'join'`
- **code** (int): the nine-digit code referencing the quiz instance
- **locale** (string): the locale of the player, indicating the language in which messages to the player will be shown *TODO*
- **username** (string): the username of the person joining
- **password** (string): the password of the person joining
- **nickname** (string): the nickname used by the person joining
  
Sent when the player joins a given quiz instance.
In response, if no errors occur, the server adds the player to the game, or reconnects them if already added, then issues them a *welcome* message and sends all other players a *playerJoined* messsage. 
##### boot
`{type, nickname}`
- **type** (string): the string `'boot'`
- **nickname** (string): the nickname of the player to be booted

Sent when the host requests for another player to be booted.
In response, the server boots the target player if the player requesting the boot is the host, then broadcasts the *playerLeft* message to all players with 'booted by the game host' specified in the description.
##### ready
`{type}`
- **type** (string): the string `'ready'`
  
Sent when the player enters the ready state during game preparation.
In response, the server registers the player as ready and sends the *playerReady* message to all players.
##### notReady
`{type}`
- **type** (string): the string `'notReady'`

Sent when the player leaves the ready state during game preparation.
In response, the server unregisters the player from being ready and sends the *playerNotReady* message to all players.
##### start
`{type}`
- **type** (string): the string `'start'`

Sent when the game host starts the game.
In response, the server checks whether the sender is the host, whether all players are ready and whether the game is in the prep phase; if all three are true, triggers the qinstStartCountdown event
##### cancelStart
`{type}`
-**type** (string): the string `'cancelStart'`

Sent when the game host cancels starting the game.
In response, the server checks whether the sender is the host and whether the game is in the ready phase; if so, cancels the start countdown.
##### answer
`{type, questionIndex, answer}`
- **type** (string): the string `'answer'`
- **questionIndex** (int): the index of the question being answered
- **answer** (array of ints): an array of the choices selected by the player that together comprise what the player considers the correct answer.

Sent when a player answers a question.
##### nextQuestion
`{type, questionIndex}`
-**type** (string): the string `'nextQuestion'`
-**questionIndex** (int): the index of the current, not the next question

Sent when the host advances the quiz, or the quiz advances automatically, to the next question in quizzes where the setting `doesAdvanceTogether` is set to `true`, or when the player answers the question in quizzes where the setting `doesAdvanceTogether` is set to `false`.


##### leave
`{type}`
- **type** )string): the string `'leave'`
  
Sent by the player when leaving the game.
In response, the server removes the player from the player list; if the host leaves, the quiz instance enters hostless mode if no more players remain, trigger the *qinstDeletion* event.

## Websocket server messages
The server may send the following messages to players. Below the name of each
message shown here is a list of the message object's keys.

##### welcome
the response to connections and reconnections.

when the game is in the 'prep' or 'ready' phase:
`{type, phase, players, host}`
- **type** (string): the string `''welcome'`
- **phase** (string): the string `'prep'`
- **players** (array of ClientPlayers): the list of players currently taking part in the game
- **host** (string): the nickname of the quiz's host
- **settings** (QuizSettings object): the settings of the quiz

when the game is in the 'active' phase:
`{type, phase, players, host, question, finishTime}`
- **type** (string): the string `'welcome'`
- **phase** (string): the string `'active'`
- **players** (array of ClientPlayers): the list of players currently taking part in the quiz
- **host** (string): the nickname of the quiz's host
- **settings** (QuizSettings object): the settings of the quiz
- **question** (PreparedQuestion object): the current question in the quiz
- **finishTime** (Date object): the time at which the current question or the quiz will expire
-**correctAnswer** (array of ints): only sent to the host, and only if *doesHostPlay* is set to `false`. Contains the correct answer for the first question of the quiz.
-**commentary** (string): only sent to the host, and only if *doesHostPlay* is set to `false`. Contains the commentary for the first question of the quiz.

when the game is in the 'finished' phase:
`{type, phase, players, results}`
- **type** (string): the string `'welcome'`
- **phase** (string): the string `'finished'`
- **players** (array of ClientPlayers): the list of players currently taking part in the quiz
- **host** (string): the nickname of the quiz's host
- **settings** (QuizSettings object): the settings of the quiz  
- **questions** (array of Questions): the questions of the quiz
- **results** (array of Results): the full quiz results

##### code
`{type, code}`
- **type** (string): the string `'code'`
- **code** (int): the nine-digit code referencing the quiz instance

feedback in response to *create* messages
##### playerJoined
`{type, nickname, description}`
- **type** (string): the string `'playerJoined'`
- **nickname** (string): the nickname of the player that has joined
- **description** (string): a description of the circumstances of the joining event
- **isReconnect** (bool): whether the joining is a reconnection

notification to all players that another player has joined the game
##### playerLeft
`{type, nickname, description, isDisconnect}` 
- **type** (string): the string `'playerLeft'`
- **nickname** (string): the nickname of the player that has left
- **description** (string): a description of the circumstances of the leaving event
- **isDisconnect** (bool): whether the departure is owed to a disconnection instead of an actual leave message

notification to all players that another player has left the game
##### playerReady
`{type, nickname}`
-**type** (string): the string `'playerReady'`
-**nickname** (string): the nickname of the player that is now ready

notification to all players that another player is ready
##### playerNotReady
`{type, nickname}`
-**type** (string): the string `'playerNotReady'`
-**nickname** (string): the nickname of the player that is no longer ready

notification to all players that another player is no longer ready
##### qinstStartCountdown
`{type}`
-**type** (string): the string `'qinstStartCountdown'`

notification to all players when the host triggers the qinstStartCountdown event
#### qinstCancelCountdown
`{type}`
-**type** (string): the string `'qinstNotReady'`

notification to all players when the host triggers the qinstCancelCountdown event
##### qinstActive
`{type, questionIndex, finishTime, correctAnswer, commentary}`
-**type** (string): the string `'qinstActive'`
-**question** (Question): the first question of the quiz
-**finishTime** (Date): the time when the question or the quiz will expire
-**correctAnswer**: only sent to the host, and only if *doesHostPlay* is set to `false`. Contains the correct answer for the first question of the quiz.
-**commentary**: only sent to the host, and only if *doesHostPlay* is set to `false`. Contains the commentary for the first question of the quiz.

notification to all players when the game begins, also containing the first question in the quiz
##### answerFeedback
`{type, questionIndex, correctAnswer, commentary}`
-**type** (string): the string `'answerFeedback'`;
-**questionIndex** (int): the index of the question
-**correctAnswer** (array of ints): the indices of the choices that together comprise the correct answer for the quiz question
-**commentary** (string): the text of the question's commentary, which describes why the answer is correct

notification sent to the player after the player has answered a question
##### answerNotice
`{type, nickname, questionIndex, answer}`
-**type** (string): the string `'answerNotice'`;
-**nickname** (string): the nickname of the player answering the question
-**questionIndex** (int): the index of the question
-**answer** (array of ints): the indices of the choices that together comprise the player's answer

notification sent to the host, if the host is not playing, after a player has answered a question
##### question
`{type, question, finishTime, correctAnswer, commentary}`
-**type** (string): the string `'question'`
-**question** (Question): the current question in the quiz
-**finishTime** (Date): the time at which the current question or the quiz will expire
-**correctAnswer**: only sent to the host, and only if *doesHostPlay* is set to `false`. Contains the correct answer for the question.
-**commentary**: only sent to the host, and only if *doesHostPlay* is set to `false`. Contains the commentary for the question.

a new question sent during the game
##### playerResults
`{type, questions, results}`
-**type** (string): the string `'playerResults'`
-**questions** (array of Questions): a list of all the questions in the quiz, including their correct answers and commentary
-**answers** (array of Answers): the player's answers

the player's results, sent when the player has finished the quiz in games where the players do not advance together
##### qinstEnd
`{type, questions, results}`
- **type** (string): the string `'qinstEnd'`
- **questions** (array of Questions): a list of all the questions in the quiz, including their correct answers and commentary
- **results** (array of Results): the full list of all players' results

notification that the game has ended, along with a list of results
#### connectionClosed
`{type, description}`
- **type** (string): the string `'closeConnection'`
- **description** (string): the reason for closing the connection

notification that the server has closed its connection to the player
##### error
`{type, errtype, responseTo, error}`
-**type** (string): the string `'error'`
-**errtype** (string): an identifier for the type of error being shown
-**responseTo** (string | null): the message to which the error is a response; can be `null` when the error is not in response to a particular message
-**error** (string): the full error message
-**doesDisplay** (bool): whether to display the error to the user

message sent when an error has arisen

## Websocket client classes

##### Game
A singleton object describing the state of an ongoing game.
`{phase, players, settings, currentQuestion, finishTime, correctAnswer, commentary, questions, results}`
-**phase** (string): the current phase of the game. Can be one of `prep`, `ready`, `active` and `finished`.
-**players** (array of ClientPlayers: the players currently taking part in the game.
-**settings** (QuizSettings object): the game's settings.
-**currentQuestion** (Question object): the player's current question.
-**finishTime**:
-**correctAnswer**: the correct answer to this question, if the player is an observer, or the correct answer to the previous question, if the player has answered and doesAdvanceTogether is set to true.
-**commentary**: the commentary for the question, which explains why the correct answer is correct; shown if the player is an observer, or if the player has answered and doesAdvanceTogether is set to true.
-**questions**: the set of questions in the game.
-**results**: the game's results, shown during the *finished* phase.

##### <a name="ClientPlayer">ClientPlayer</a>
A player object used by the bquiz client
`{nickname, isReady, hasAnswered, hasFinished, isConnected}`
-**nickname** (string): the nickname used throughout the quiz to identify the player
-**isReady** (bool): whether the player is ready for the game to start, or for the next question if already in the game
-**hasAnswered** (bool): whether the player has answered the current question.
-**hasFinished** (bool): whether the player has finished the quiz. Only used when doesAdvanceTogether is set to `false`.
-**isConnected** (bool): whether the player is currently connected to the WebSocket server.


## Websocket server classes

##### WebSocket.Server
The websocket server object as described in [the ws documentation](https://github.com/websockets/ws/blob/HEAD/doc/ws.md), along with extra fields used by the quiz server
`{doesThrottle, qinsts, conns, ...}`
- **doesThrottle**: whether the server throttles messages after a series of messages is sent at a small enough interval. Set this to false when running test suites.
- **qinsts**: an object storing all quiz instances on the server; each key is a nine-digit code referencing the quiz instance
- **conns**: an array storing all connection objects to the server

##### Qinst
a quiz instance, which contains all the information needed to run a single game
`{quiz, questions, conns, players, isJoinable, phase, code}`
- **quiz** (Quiz): the quiz object
- **preparedQuestions** (array of PreparedQuestions): all the questions in the quiz, not including their *commentary* and *answer.isCorrect* attributes. These can be sent to the players without any risk of cheating.
- **conns** (array of Conns): all connection objects for the quiz instance
- **players** (array of Players): all player objects for the quiz instance
- **results** (array of Results): the results of the quiz so far
- **hostUsername** (string): the game host's username
- **hostConn** (Conn): the game host's websocket connection
- **isJoinable** (bool): whether the quiz instance can be joined
- **phase** (int): can take one of the following values:
  - `QINST_PHASE_PREP = 0`, signifying that the quiz instance is undergoing preparations for the quiz to start
  - `QINST_PHASE_READY = 1` signifying that the quiz is about to start
  - `QINST_PHASE_ACTIVE = 2`, signifying that the quiz is being played
  - `QINST_PHASE_FINISHED = 3`, signifying that the quiz has finished
- **timeout** (Timeout): the timeout for either the qinstStart event, the nextQuestion event or the removal of inactive players after the qinstEnd event
- **questionIndex** (int | null): the index of the quiz's current question; set to `null` unless doesAdvanceTogether is set to `true`
- **finishTime** (double | null): the time until the current question expires for all players or the time until the quiz ends, depending on whether the quiz's *settings.isTimePerQuestion* value is `true` or `false`. Used only when *doesAdvanceTogether* is set to `true`, otherwise the value is set to `null`.
- **code** (int): the nine-digit code referencing the quiz instance

##### Player
Any player, including the host, in a given quiz instance
`{nickname, username, isReady, hasAnswered, hasFinished, timeout, currentQuestion, finishTime, answers}`
- **nickname** (string): the nickname used throughout the quiz to identify the player
- **username** (string | null): the player's username, or 'null' if the user is not logged in
- **isReady** (bool): whether the player is ready for the game to start, or for the next question if already in the game
- **hasAnswered** (bool): whether the player has answered the current question.
- **hasFinished** (bool): whether the player has finished the quiz. Only used when doesAdvanceTogether is set to `false`.
- **timeout** (Timeout): the timeout for the nextQuestion event, or the end-booting event (when the player has not acknowledged that the game has ended)
- **currentQuestion** (int | null): the index of the current question being answered by the player; set to `null` if doesAdvanceTogether is set to `true`
- **finishTime** (double | null): the time until the current question expires for the current player or the time until the quiz ends, depending on whether the quiz's *settings.isTimePerQuestion* value is `true` or `false`. Only used when *doesAdvanceTogether* is set to `false`, otherwise the value is set to `null`.
- **answers** (array of Answers): the player's answers so far

#### Conn
The data associated with a given websocket connection
`{ws, qinst, player, throttleExpiry}`
- **ws** (WebSocket): the websocket object as described in [the ws documentation](https://github.com/websockets/ws/blob/HEAD/doc/ws.md)
- **qinst** (Qinst): the quiz instance being played
- **player** (Player): the player connected to the websocket server
- **throttleChecks** (Array of Dates): the times of the five most recent requests issued during a period when no throttling was taking place
- **throttleExpiry** (Date): the time at which the throttle will expire on this connection, allowing more messages from the connection to be processed
- **timeout** (Timeout): the connection's idle timeout, which causes the connection to close if it does not periodically reply with pongs to the server's pings

#### Results
The quiz results for a given player; does not include the questions and their correct answers as these are sent separately in the same message
`{nickname, answers}`
- **nickname** (string): the player's nickname
- **answers** (array of Answer objects): the player's full answers

#### Answer
A given player's answer to a given question
`{questionIndex, answer}`
  - **questionIndex** (int): the index of the question answered
  - **answer** (array of ints): the indices of the choices that together comprise the player's answer

