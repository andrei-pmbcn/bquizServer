## API functions
Those who want to incorporate bquiz into their own quiz projects must write a module containing all of these functions, each returning objects in the specified format. The `apimodule` entry 

The module `bquiz.js` and its settings file `bquizconf.yml` constitute an example of how this can work.

##### fetchUser
Fetches a given user's username from the database if the provided username and password match, otherwise returns `null`.
- parameters
  - **username** (string): the username of the user being fetched; included in *create* and *join* client messages.
  - **password** (string): the password of the user being fetched; included in *join* client messages.

- return value (string | null): the username of the user being fetched, or `null`
##### fetchQuiz
Fetches the Quiz object from the database
- parameters
  - **quizId**: the variable (e.g. an integer database Id) of the quiz ; included in *create* client messages

- return value (object): a complete Quiz object
`{name, description, settings, questions}`
  - **name** (string): the name of the quiz
  - **description** (string): a description of the quiz
  - **settings** (object): a Settings object that contains the following:
    - **time** (double): the time, in seconds, during which either the quiz (if *isTimePerQuestion* is set to `false`) or each particular question (if *isTimePerQuestion* is set to `true`) will take place
    - **isTimePerQuestion** (bool): if true, the variable *time* refers to the time per question, else the variable *time* refers to the total time of the quiz
    - **doesAdvanceTogether** (bool): if true, all players advance to the next question together, whether when the host sends the *nextQuestion* message or when the time to the next question expires. If false, each individual player advances to the next question as soon as they answer the current question.
    - **doesHostPlay** (bool): if true, the game treats the host as a regular player, sending them questions etc.

  - **questions** (array of Questions): the questions in the quiz.

    Each Question object contains the following:
    - **index** (int): the question's index, from 1 to the number of questions in the quiz; all questions should have a unique index. The quiz supplies the questions to the players in the order of their indices.
    - **text** (string): the text of the question, ideally no greater than 200 characters
    - **commentary** (string): a description of why the correct answer is in fact correct; set this to `null` to omit it
    - **isMultipleResponse** (bool): whether the question allows more than one answer to be included in the correct answer
    - **correctAnswer** (int or array of ints): the index or indices of all sub-answers to the question that together comprise the correct answer
    - **time** (double): the time, in seconds, for the question; if not set to `null`, it overrides the *time* variable in the *settings* object when *isTimePerQuestion* is set to `true`, otherwise it has no effect.
    - **points** (double): the number of points awarded for answering the question correctly.
    - **answers** (array of SubAnswers): the available sub-answers to the question.

      Each SubAnswer object comprises one of the choices that the player can select when answering a question, and contains the following:
      - **index** (int): the sub-answer's index, ranging from 1 to the number of sub-answers available for the question. All sub-answers should have a unique index.
      - **text** (string): the text of the sub-answer, ideally no greater than 100 characters

## Events
Those who wish to treat bquiz as a framework and extend it can use the various events emitted by its websocket server object.
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

## Client messages
The players' clients may send the following messages to the server. Below the name of each message shown here is a list of the message object's keys.

##### create
`{type, quizId, username}`
- **type**: the string `'create'`
- **quizId**: the identifier (e.g. a database id) of the quiz on which this game will be based
- **nickname**: the nickname of the quiz instance's creator

Sent when the host creates the new quiz instance.
In response, the server triggers the *qinstCreation* event and sends the quiz instance's code to the player, who must then sign in by sending a join message.
##### join
`{type, code, username, password, nickname}`
- **type**: the string `'join'`
- **code**: the nine-digit code referencing the quiz instance
- **username**: the username of the person joining
- **password**: the password of the person joining
- **nickname**: the nickname used by the person joining
  
Sent when the player joins a given quiz instance.
In response, if no errors occur, the server adds the player to the game, or reconnects them if already added, then issues them a *welcome* message and sends all other players a *playerJoined* messsage. 
##### boot
`{type, nickname}`
- **type**: the string `'boot'`
- **nickname**: the nickname of the player to be booted

Sent when the host requests for another player to be booted.
In response, the server boots the target player if the player requesting the boot is the host, then broadcasts the *playerLeft* message to all players with 'booted by the game host' specified in the description.
##### ready
`{type}`
- **type**: the string `'ready'`
  
Sent when the player enters the ready state during game preparation.
In response, the server registers the player as ready and sends the *playerReady* message to all players.
##### notReady
`{type}`
- **type**: the string `'notReady'`

Sent when the player leaves the ready state during game preparation.
In response, the server unregisters the player from being ready and sends the *playerNotReady* message to all players.
##### start
`{type}`
- **type**: the string `'start'`

Sent when the game host starts the game.
In response, the server checks whether the sender is the host, whether all players are ready and whether the game is in the prep phase; if all three are true, triggers the qinstStartCountdown event
##### cancelStart
`{type}`
-**type**: the string `'cancelStart'`

Sent when the game host cancels starting the game.
In response, the server checks whether the sender is the host and whether the game is in the ready phase; if so, cancels the start countdown.
##### answer
`{type, questionIndex, answer}`
- **type**: the string `'answer'`
- **questionIndex**: the index of the question being answered
- **answer**: an array of the sub-answers selected by the player that together comprise what the player considers the correct answer.

Sent when a player answers a question.
##### nextQuestion
`{type, questionIndex}`
-**type**: the string `'nextQuestion'`
-**questionIndex**: the index of the current, not the next question

Sent when the host advances the quiz, or the quiz advances automatically, to the next question in quizzes where the setting `doesAdvanceTogether` is set to `true`, or when the player answers the question in quizzes where the setting `doesAdvanceTogether` is set to `false`.
##### endAcknowledged
`{type}`
- **type**: the string `'endAcknowledged'`
  
Automatically sent by the player to prevent being booted 30 seconds after the game ends.
In response, the server cancels the 30-second timeout timer.
##### leave
`{type}`
- **type**: the string `'leave'`
  
Sent by the player when leaving the game.
In response, the server removes the player from the player list; if the host leaves, the quiz instance enters hostless mode if no more players remain, trigger the *qinstDeletion* event.

## Server messages
The server may send the following messages to players. Below the name of each
message shown here is a list of the message object's keys.

##### welcome
the response to connections and reconnections.

when the game is in the 'prep' phase:
`{type, phase, players}`
- **type**: the string `'welcome'`
- **phase**: the string `'prep'`
- **players**: the list of players currently taking part in the quiz
- **settings**: the settings of the quiz

when the game is in the 'active' phase:
`{type, phase, players, question, finishTime}`
- **type**: the string `'welcome'`
- **phase**: the string `'active'`
- **players**: the list of players currently taking part in the quiz
- **question**: the current question in the quiz
- **finishTime**: the time at which the current question or the quiz will expire
-**correctAnswer**: only sent to the host, and only if *doesHostPlay* is set to `false`. Contains the correct answer for the first question of the quiz.
-**commentary**: only sent to the host, and only if *doesHostPlay* is set to `false`. Contains the commentary for the first question of the quiz.
- **settings**: the settings of the quiz

when the game is in the 'finished' phase:
`{type, phase, players, results}`
- **type**: the string `'welcome'`
- **phase**: the string `'finished'`
- **players**: the list of players currently taking part in the quiz
- **results**: the full quiz results object
- **settings**: the settings of the quiz  

##### code
`{type, code}`
- **type**: the string `'code'`
- **code**: the nine-digit code referencing the quiz instance

feedback in response to *create* messages
##### playerJoined
`{type, nickname, description}`
- **type**: the string `'playerJoined'`
- **nickname**: the nickname of the player that has joined
- **description**: a description of the circumstances of the joining event

notification to all players that another player has joined the game
##### playerLeft
`{type, nickname, description, isDisconnect}` 
- **type**: the string `'playerLeft'`
- **nickname**: the nickname of the player that has left
- **description**: a description of the circumstances of the leaving event
- **isDisconnect**: whether the departure is owed to a disconnection instead of an actual leave message

notification to all players that another player has left the game
##### playerReady
`{type, nickname}`
-**type**: the string `'playerReady'`
-**nickname**: the nickname of the player that is now ready

notification to all players that another player is ready
##### playerNotReady
`{type, nickname}`
-**type**: the string `'playerNotReady'`
-**nickname**: the nickname of the player that is no longer ready

notification to all players that another player is no longer ready
##### qinstStartCountdown
`{type}`
-**type**: the string `'qinstStartCountdown'`

notification to all players when the host triggers the qinstStartCountdown event
#### qinstCancelCountdown
`{type}`
-**type**: the string `'qinstNotReady'`

notification to all players when the host triggers the qinstCancelCountdown event
##### qinstActive
`{type, questionIndex, finishTime, isPlaying}`
-**type** (string): the string `'qinstActive'`
-**question** (Question): the first question of the quiz
-**finishTime** (Date): the time when the question or the quiz will expire
-**isPlaying**: whether the player is playing or simply spectating. If this is the host and the *doesHostPlay* setting is set to `false`, *isPlaying* is likewise set to `false`; otherwise, it is set to `true`.
-**correctAnswer**: only sent to the host, and only if *doesHostPlay* is set to `false`. Contains the correct answer for the first question of the quiz.
-**commentary**: only sent to the host, and only if *doesHostPlay* is set to `false`. Contains the commentary for the first question of the quiz.

notification to all players when the game begins, also containing the first question in the quiz
##### answerFeedback
`{type, question, correctAnswer, commentary}`
-**type** (string): the string `'answerFeedback'`;
-**questionIndex** (int): the index of the question
-**correctAnswer** (array of ints): the indices of the sub-answers that together comprise the correct answer for the quiz question
-**commentary** (string): the text of the question's commentary, which describes why the answer is correct

notification sent to the player after the player has answered a question
##### answerNotice
-**type** (string): the string `'answerNotice'`;
-**nickname** (string): the nickname of the player answering the question
-**questionIndex** (int): the index of the question
-**answer** (array of ints): the indices of the sub-answers that together comprise the player's answer

notification sent to the host, if the host is not playing, after a player has answered a question
##### question
`{type, question, finishTime}`
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
-**answers** (array of playerAnswers): the player's answers

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
{type, errtype, error}
-**type** (string): the string `'error'`
-**errtype** (string): an identifier for the type of error being shown
-**error** (string): the full error message
-**doesDisplay** (bool): whether to display the error to the user

message sent when an error has arisen

## Internal objects
Only of interest to those wishing to develop extensions for bquiz or bquiz itself; users who simply want to incorporate bquiz into their own projects should only ever need to use the API objects.
##### wss
The websocket server object as described in [the ws documentation](https://github.com/websockets/ws/blob/HEAD/doc/ws.md), along with extra fields used by the quiz server
`{doesThrottle, qinsts, conns, ...}`
- **doesThrottle**: whether the server throttles messages sent at an interval of less than one second. Does not take *create* and *endAcknowledged* messages into account. Set this to false when running test suites.
- **qinsts**: an object storing all quiz instances on the server; each key is a nine-digit code referencing the quiz instance
- **conns**: an array storing all connection objects to the server

##### Qinst
a quiz instance, which contains all the information needed to run a single game
`{quiz, questions, conns, players, isJoinable, phase, code}`
- **quiz** (Quiz): the quiz object
- **preparedQuestions** (array of PreparedQuestions): all the questions in the quiz, not including their *commentary* and *answer.isCorrect* attributes. These can be sent to the players without any risk of cheating.
- **conns** (array of Conns): all connection objects for the quiz instance
- **players** (array of Players): all player objects for the quiz instance
- **hostUsername** (string): the game host's username
- **hostConn** (Conn): the game host's websocket connection
- **isJoinable** (bool): whether the quiz instance can be joined
- **phase** (int): can take one of the following values:
  - `QINST_PHASE_PREP = 0`, signifying that the quiz instance is undergoing preparations for the quiz to start
  - `QINST_PHASE_READY = 1` signifying that the quiz is about to start
  - `QINST_PHASE_ACTIVE = 2`, signifying that the quiz is being played
  - `QINST_PHASE_FINISHED = 3`, signifying that the quiz has finished
- **timeout** (Timeout): the timeout for either the qinstStart event, the nextQuestion event or the removal of inactive players after the qinstEnd event
- **questionIndex** (int): the index of the quiz's current question; set to `null` unless doesAdvanceTogether is set to `true`
- **finishTime** (double): the time until the current question expires for all players or the time until the quiz ends, depending on whether the quiz's *settings.isTimePerQuestion* value is `true` or `false`. Used only when *doesAdvanceTogether* is set to `true`, otherwise the value is set to `null`.
- **code** (int): the nine-digit code referencing the quiz instance

##### Player
Any player, including the host, in a given quiz instance
`{nickname, username, isReady}`
- **nickname** (string): the nickname used throughout the quiz to identify the player
- **username** (string): the player's username, or 'null' if no username exists
- **isReady** (bool): whether the player is ready for the game to start, or for the next question if already in the game
- **hasAnswered** (bool): whether the player has answered the current question. Only used when doesAdvanceTogether is set to `true`.
- **hasFinished** (bool): whether the player has finished the quiz. Only used when doesAdvanceTogether is set to `false`.
- **timeout** (Timeout): the timeout for the nextQuestion event 
- **currentQuestion** (int): the index of the current question being answered by the player; set to `null` if doesAdvanceTogether is set to `true`
- **finishTime** (double): the time until the current question expires for the current player or the time until the quiz ends, depending on whether the quiz's *settings.isTimePerQuestion* value is `true` or `false`. Only used when *doesAdvanceTogether* is set to `false`, otherwise the value is set to `null`.
- **answers** (array of PlayerAnswers): the player's answers so far

#### Conn
The data associated with a given websocket connection
`{ws, qinst, player, throttleExpiry}`
- **ws** (WebSocket): the websocket object as described in [the ws documentation](https://github.com/websockets/ws/blob/HEAD/doc/ws.md)
- **qinst** (Qinst): the quiz instance being played
- **player** (Player): the player connected to the websocket server
- **throttleExpiry** (Date): the time at which the throttle will expire on this connection, allowing more messages from the connection to be processed

#### Results
The quiz results for a given player; does not include the questions and their correct answers as these are sent separately in the same message
`{nickname, answers}`
-**nickname** (string): the player's nickname
-**answers** (array of PlayerAnswer objects): the player's full answers

#### PlayerAnswer
A given player's answer to a given question
`{questionIndex, answer}`
  - **questionIndex**: the index of the question answered
  - **answer**: the indices of the sub-answers that together comprise the player's answer

