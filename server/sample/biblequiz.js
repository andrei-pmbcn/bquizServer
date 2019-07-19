const yaml = require('js-yaml');
const fs = require('fs');

try {
	var config = yaml.safeLoad(fs.readFileSync('sample/biblequiz.yml', 'utf8'));
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

async function verifyUser(username, password) {
	var result = await knex('user')
		.first('username')
		.where({
			username: username,
			password: password,
		});
	return result ? true : false;
}

function dbNameToCcName(str) {
	var pattern = str.match(/_[a-z]/g);
	for (match of pattern) {
		str = str.replace(match, match[1].toUpperCase());
	}
	return str;
}

function ccNameToDbName(str) {
	var pattern = str.match(/[A-Z]/g);
	for (match of pattern) {
		str = str.replace(match, "_" + match.toLowerCase());
	}
	return str;
}

async function saveQuiz(quiz) {
	// Ensure that all quiz names are unique to a given user
	console.log(quiz.user);
	var user = await knex('user')
		.first('id', 'username', 'password')
		.where({username: quiz.user.name, password: quiz.user.pass});

	var sameNames = await knex('bible_quiz')
		.count({hits: 'id'})
		.where({name: quiz.name, user_id: user.id})
		.andWhereNot({id: quiz.id});
	console.log('sameNames[0]:', sameNames[0]);
	if (sameNames[0].hits) {
		throw new Error("InvalidQuizName: the name of the quiz to be saved "
			+ "is identical to another quiz's name");
	};
	
	//var testQuiz = await knex('bible_quiz')
	//	.first('id')
	//	.where({id: 10000000000});
	//console.log('testQuiz:', testQuiz); //undefined
	
	// If the quiz id is null, treat the quiz as a new quiz
	if (quiz.id === null) {
		// identify the owner of the quiz
		var user_id = await knex('user')
			.first('id')
			.where({username: quiz.user.name, password: quiz.user.pass});

		// save the quiz details
		var quiz_id = await knex('bible_quiz')
			.insert({
				name: quiz.name,
				description: quiz.description,
				user_id: user_id,
				time: quiz.time,
				is_time_per_question: quiz.isTimePerQuestion,
				does_advance_together: quiz.doesAdvanceTogether,
				does_host_play: quiz.doesHostPlay,
			}, ['id'])

		// save the quiz sections
		for (section of quiz.contents) {
			await knex('bible_quiz_section')
				.insert({
					bible_quiz_id: quiz_id,
					book: section.book,
					chapter: section.chapter,
					verset: section.verset,
					n_questions: section.nQuestions,
				})
		}
	} else {
		// otherwise check that the quiz exists and make the necessary changes
		// to it.
		var quiz_id = quiz.id;
		var oldQuiz = await knex('bible_quiz')
			.first('id', 'name', 'description', 'time',
				'is_time_per_question', 'does_advance_together',
				'does_host_play')
			.where({id: quiz.id});

		if (!oldQuiz) {
			throw new Error("InvalidQuizId: no quiz with the specified id "
				+ "can be found in the database");
		}

		var updates = {};
		for (attr of Object.keys(oldQuiz)) {
			var ccAttr = dbNameToCcName(attr)
			if (!["id"].includes(attr)
				&& oldQuiz[attr] !== quiz[ccAttr] ) {
					updates[attr] = quiz[ccAttr]
			}
		}

		await knex('bible_quiz')
			.update(updates)
			.where({id: oldQuiz.id});

		var sections = knex('bible_quiz_section')
			.select('book', 'chapter', 'verset', 'n_questions')
			.where({bible_quiz_id: oldQuiz.id});

		console.log(sections);

		for (newSection of quiz.contents) {
			
		}

		// add sections that are missing from the database


	}

	return quiz_id;
}

async function fetchQuiz(quizIdentifier) {
	var dbQuiz = await knex('bible_quiz')
		.first('id', 'name', 'description', 'time', 'is_time_per_question')
		.where({id: quizIdentifier});

	quiz = {
		identifier: quizIdentifier,
		name: dbQuiz.name,
		description: dbQuiz.description,
		settings: {
			time: dbQuiz.time,
			doesAdvanceTogether: true,
			isTimePerQuestion: true,
			doesHostPlay: false,
		}
	}

	var dbQuestionLinks = await knex('bible_quiz_question_link')
		.select('id', 'bible_quiz_question_id', 'idx', 'points')
		.where({bible_quiz_id: quizIdentifier});

	dbQuestionLinks.sort((x,y)=>(x.idx > y.idx));
	var questionIds = dbQuestionLinks.map((x)=>(x.bible_quiz_question_id));

	var dbQuestions = await knex('bible_quiz_question')
		.select('id', 'question', 'a', 'b', 'c', 'answer', 'cancelled')
		.whereIn('id', questionIds);

	quiz.questions = [];
	for (let dbQuestionLink of dbQuestionLinks) {
		let dbQuestion = dbQuestions.find(
			(x) => (x.id === dbQuestionLink.bible_quiz_question_id));

		if (!dbQuestion.cancelled) {
			let choices = [];
			let kAnswer = 1;
			for (let choiceIdx of ['a','b','c']) {
				let choice = {
					identifier: null,
					text: dbQuestion[choiceIdx],
					index: kAnswer,
				};
				choices.push(choice);
				kAnswer++;
			}
			let question = {
				identifier: dbQuestion.id,
				index: dbQuestionLink.idx,
				text: dbQuestion.question,
				choices: choices,
				time: null,
				isMultipleResponse: false,
				correctAnswer: [parseInt(dbQuestion.answer)],
				commentary: await fetchCommentary(dbQuestion),
				points: dbQuestionLink.points,
			}
			quiz.questions.push(question);
		}
	}

	return quiz;
}

async function fetchCommentary(dbQuestion) {
	var dbReferences = await knex('bible_quiz_question_references')
		.select('id', 'carte_from', 'capitol_from', 'verset_from',
			'carte_to', 'capitol_to', 'verset_to')
		.where({bible_quiz_question_id: dbQuestion.id});
	
	var str = ""
	for (let dbReference of dbReferences) {
		//[TODO] Include the actual bible verses

		if (dbReference.carte_from === dbReference.carte_to) {
			if (dbReference.capitol_from === dbReference.capitol_to) {
				if (dbReference.verset_from === dbReference.verset_to) {
					str += dbReference.carte_from + " "
						+ dbReference.capitol_from + ":"
						+ dbReference.verset_from;
				} else {
					str += dbReference.carte_from + " "
						+ dbReference.capitol_from + ":"
						+ dbReference.verset_from + "-"
						+ dbReference.verset_to;
				}
			} else {
				str += dbReference.carte_from + " "
					+ dbReference.capitol_from + ":"
					+ dbReference.verset_from + "-"
					+ dbReference.capitol_to + ":"
					+ dbReference.verset_to;
			}
		} else {
				str += dbReference.carte_from + " "
					+ dbReference.capitol_from + ":"
					+ dbReference.verset_from + " - "
					+ dbReference.carte_to + " "
					+ dbReference.capitol_to + ":"
					+ dbReference.verset_to;
		}
		str += ", ";
	}
	str = str.substring(0, str.length - 2);

	return str;
}

module.exports = {
	verifyUser,
	saveQuiz,
	fetchQuiz,

}
