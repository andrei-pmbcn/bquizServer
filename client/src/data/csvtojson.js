// node script for compiling bible books, chapters and versets into a single
// JSON object and outputting it to a file

const fs = require('fs');
const parse = require('csv-parse/lib/sync');

const booksFile = fs.readFileSync('cartile-bibliei.csv');
const chaptersFile = fs.readFileSync('capitolele-bibliei.csv');

const booksCsv = parse(booksFile, {
	columns: ['book', 'nChapters'],
	quote:true,
	delimiter: ';',
});

const chaptersCsv = parse(chaptersFile, {
	columns: ['book', 'chapter', 'nVersets'],
	from: 2,
	delimiter: ',',
});

var books = [];
for (i=0; i < booksCsv.length; i++) {
	var bookCsv = booksCsv[i];
	var book = {
		id: i,
		name: bookCsv.book,
		chapters: [],
	};

	for (chapterCsv of chaptersCsv) {
		if (chapterCsv.book === book.name) {
			book.chapters.push({
				book: chapterCsv.book,
				number: parseInt(chapterCsv.chapter),
				versets: Array.from(Array(parseInt(chapterCsv.nVersets)).keys())
					.map(x => { return {
						book: chapterCsv.book,
						chapter: parseInt(chapterCsv.chapter),
						number: x + 1,
					}}),
			})
		}
	}

	book.chapters.sort((x, y) => (x.number - y.number));

	books.push(book);
}

var output = JSON.stringify(books);
fs.writeFileSync('biblebooks.json', output, {
	encoding: 'utf8',
	mode: 0o644,
	flag: 'w',
});

// book: {name, chapters: [{book, number, versets: [{book, chapter, number}]}]}

