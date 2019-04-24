DELETE FROM bible_quiz;
DELETE FROM bible_quiz_question_link;

INSERT INTO bible_quiz (
	name, description, time, is_time_per_question,
	does_advance_together, does_host_play) VALUES
	("Întrebări despre Isus", "O serie de întrebări legate de Isus", 20,
	false, true, false);

SET @quiz_id = LAST_INSERT_ID();

INSERT INTO bible_quiz_question_link (
	bible_quiz_id, bible_quiz_question_id, idx, points, time) VALUES
	(@quiz_id, 47, 1, 1, null),
	(@quiz_id, 57, 2, 1, null),
	(@quiz_id, 91, 3, 2, null),
	(@quiz_id, 99, 4, 1, 15),
	(@quiz_id, 113, 5, 1, 15);

