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

async function fetchQuiz(quizIdentifier) {
	var dbQuiz = await knex('bible_quiz')
		.first('id', 'name', 'description', 'time', 'is_time_per_question')
		.where({id: quizIdentifier});

	quiz = {
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

	//[TODO] Commentary

	var dbQuestions = await knex('bible_quiz_question')
		.select('id', 'question', 'a', 'b', 'c', 'answer', 'cancelled')
		.whereIn('id', questionIds);

	quiz.questions = [];
	for (let dbQuestionLink of dbQuestionLinks) {
		let dbQuestion = dbQuestions.find(
			(x) => (x.id === dbQuestionLink.bible_quiz_question_id));

		if (!dbQuestion.cancelled) {
			let answers = [];
			let kAnswer = 1;
			for (let answerIdx of ['a','b','c']) {
				let answer = {
					text: dbQuestion[answerIdx],
					index: kAnswer,
				};
				answers.push(answer);
				kAnswer++;
			}
			let question = {
				index: dbQuestionLink.idx,
				text: dbQuestion.question,
				answers: answers,
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
	fetchQuiz,

}
