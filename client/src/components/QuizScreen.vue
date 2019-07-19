<template>
	<div
		class="d-flex flex-column align-items-center"
		align="center"
		@click="clickGeneric"
	>
		<div id="modal-del" class="modal" tabindex="-1" role="dialog">
			<div class="modal-dialog" role="document">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">Ștergere</h5>
						<button
							id="btn-modal-del-close"
							type="button"
							class="close"
							data-dismiss="modal"
							aria-label="Close"
						>
				  			<span aria-hidden="true">&times;</span>
						</button>
			  		</div>
			  		<div class="modal-body">
				  		<p>Sigur vrei să ștergi jocul "{{this.kquiz.name}}"?</p>
			  		</div>
			  		<div class="modal-footer">
						<button
							type="button"
							class="btn btn-secondary"
							data-dismiss="modal"
						>Înapoi</button>
						<button
		  					type="button"
							class="btn btn-primary"
							@click="del"
						>Șterge</button>
					</div>
				</div>
			</div>
		</div>

		<transition name="fade">
			<div
				v-show="shouldDisplayQuizSelectionIntro"
				class="m-1"
			>Alege un tip de joc din lista următoare:</div>
		</transition>
		<table class="table table-striped main-width">
			<thead>
				<tr>
					<th scope="col">Nume</th>
						<!-- number of questions -->
					<th
		 				scope="col"
					>
						<button
							class="info-popover"
							data-trigger="focus"
							data-toggle="popover"
							data-placement="bottom"
							data-content="numărul de întrebări din joc"
	   					>&#x2753;</button>
					</th>
					
						<!-- time -->
					<th
						v-if="isTableExtended"
						scope="col"
					>
						<button
							class="info-popover"
							data-trigger="focus"
							data-toggle="popover"
							data-placement="bottom"
							data-content="timpul alocat"
	   					>&#x23F3;</button>
					</th>
						<!-- is time per question -->
					<th scope="col" v-if="isTableExtended">&#x23F3;&#x2753;</th>
						<!-- does advance together -->
					<th scope="col" v-if="isTableExtended"></th>
						<!-- does host play -->
					<th scope="col" v-if="isTableExtended">&#x1F464;</th>
				</tr>
			</thead>
			<tbody>
				<tr
		 			v-for="quiz in quizzes"
					@click="kquiz = quiz"
				>
				<td colspan="3">{{quiz.name}}</td>
				</tr>
				<tr
					v-if="quizzes.length === 0"	
				>
					<td :colspan="isTableExtended ? 8 : 4">
						Nu ați creat nici un tip de joc.
					</td>
				</tr>
			</tbody>
		</table>
		<transition name="fade">
			<div
				v-show="shouldDisplayQuizSelectionIntro"
				class="m-1"
			>sau crează un tip de joc nou.</div>
		</transition>

		<div
			class="array-buttons mb-2"
			role="group"
		>
			<button
				class="btn btn-success mr-1"
				type="button"
				@click="visitMenu"
			>înapoi</button>
			<button
				class="btn btn-success mr-1"
				type="button"
				@click="create"
			>nou</button>
			<button
				:class="['btn', 'btn-success', 'mr-1',
					{disabled: isLoading}]"
				:disabled="isLoading || kquiz.name === ''"
				type="button"
				@click="save"
			>salvează</button>
			<button
				:class="['btn', 'btn-success', 'mr-1', {
					disabled: isLoading || kquiz.id === null
				}]"
				:disabled="isLoading || kquiz.id === null"
				type="button"
				data-toggle="modal"
				data-target="#modal-del"
			>șterge</button>
			<button
				:class="['btn', 'btn-success', {
					disabled: isLoading || kquiz.id === null
				}]"
				:disabled="isLoading || kquiz.id === null"
				type="button"
				@click="play"
			>joacă</button>
		</div>

		<transition name="fade">
			<div v-show="!shouldDisplayQuizSelectionIntro">
				<div
					id="input-group-name"
					class="input-group mb-3 main-width"
				>
					<div class="input-group-prepend">
						<span
							id="input-label-name"
							class="input-group-text"
						>Nume</span>
					</div>
					<input
						type="text"
						class="form-control"
						aria-label="Small"
						aria-describedby="input-label-name"
						v-model="kquiz.name"
					>
				</div>

				<div class="form-group main-width w-100">
					<label for="input-description">Descriere</label>
					<textarea
						id="input-description"
						class="form-control"
						rows="4"
						v-model="kquiz.description"
					></textarea>
				</div>

				<div
					id="input-group-time"
					class="input-group mb-3 minor-width"
				>
					<div class="input-group-prepend">
						<span
							id="input-label-time"
							class="input-group-text"
						>Timp</span>
					</div>
					<input
						type="number"
						class="form-control"
						aria-label="Small"
						aria-describedby="input-name-label"
						v-model.number="kquiz.time"
					>
					<div class="input-group-append">
						<span class="input-group-text">secunde</span>
					</div>
				</div>

				<div class="mb-3 main-width">
					<span
						id="btn-group-label-does-advance-together"
						class="mr-1"
					>Jucătorii progresează</span>
					<div
						class="btn-group"
						role="group"
						aria-labelledby="btn-group-label-does-advance-together"
					>
						<button
							:class="['btn', {
								'btn-primary': kquiz.doesAdvanceTogether,
								'btn-outline-secondary':
									!kquiz.doesAdvanceTogether, 	
							}]"
							@click="kquiz.doesAdvanceTogether = true;
							kquiz.isTimePerQuestion = true;"
						>împreună</button>
						<button
							:class="['btn', {
								'btn-primary': !kquiz.doesAdvanceTogether,
								'btn-outline-secondary':
									kquiz.doesAdvanceTogether,
							}]"
							@click="kquiz.doesAdvanceTogether = false"
						>individual</button>
					</div>
					<button
						class="info-popover"
						data-trigger="focus"
						data-toggle="popover"
						data-placement="top"
						data-content="Alege dacă jucătorii parcurg jocul individual, caz în care pot răspunde la oricât de multe întrebări până le expiră timpul pentru întrebare sau pentru joc în general, sau dacă toți trec prin fiecare întrebare împreună, caz în care jocul se oprește la fiecare întrebare până ce timpul întrebării expiră sau toți jucătorii au răspuns la întrebare."
					>
						&#x2139;
					</button>
				</div>

				<div class="mb-3 main-width">
					<span
						id="btn-group-label-is-time-per-question"
						:class="['mr-1', {
							'text-muted': kquiz.doesAdvanceTogether,

						}]"
					>Timpul este pentru fiecare</span>
					<div
						class="btn-group"
						role="group"
						aria-labelledby="btn-group-label-is-time-per-question"
					>
						<button
							:class="['btn', {
								'btn-primary': kquiz.isTimePerQuestion
									&& !kquiz.doesAdvanceTogether,
								'btn-outline-secondary':
									!kquiz.isTimePerQuestion,
								'btn-secondary': kquiz.doesAdvanceTogether,
								'disabled': kquiz.doesAdvanceTogether,
							}]"
							:disabled="kquiz.doesAdvanceTogether"
							@click="kquiz.isTimePerQuestion = true"
						>întrebare</button>
						<button
							:class="['btn', {
								'btn-primary': !kquiz.isTimePerQuestion,
								'btn-outline-secondary':
									kquiz.isTimePerQuestion,
								'disabled': kquiz.doesAdvanceTogether,
							}]"
							:disabled="kquiz.doesAdvanceTogether"
							@click="kquiz.isTimePerQuestion = false"
						>joc</button>
					</div>
					<button
						class="info-popover"
						data-trigger="focus"
						data-toggle="popover"
						data-placement="top"
						data-content="Alege dacă timpul specificat mai sus este pentru fiecare întrebare sau pentru întreg jocul."
					>
						&#x2139;
					</button>
				</div>


				<div class="mb-3 main-width">
					<span
						id="btn-group-label-does-host-play"
						class="mr-1"
					>Organizatorul joacă?</span>
					<div
						class="btn-group"
						role="group"
						aria-labelledby="btn-group-label-does-host-play"
					>
						<button
							:class="['btn', {
								'btn-primary': kquiz.doesHostPlay,
								'btn-outline-secondary': !kquiz.doesHostPlay, 	
							}]"
							@click="kquiz.doesHostPlay = true"
						>da</button>
						<button
							:class="['btn', {
								'btn-primary': !kquiz.doesHostPlay,
								'btn-outline-secondary': kquiz.doesHostPlay,
							}]"
							@click="kquiz.doesHostPlay = false"
						>nu</button>
					</div>
					<button
						class="info-popover"
						data-toggle="popover"
						data-trigger="focus"
						data-placement="top"
						data-content="Alege dacă organizatorul jocului (tu) participă la joc, răspunzând la întrebări și neavând dinainte acces la răspunsuri."
					>
						&#x2139;
					</button>
				</div>

				<div>Adaugă o secțiune</div>
				<div>
					<button
						id="btn-select-book"
						:class="['btn',
							isBtnSelectBookExpanded ?
								'btn-primary' : 'btn-secondary', 
							'm-1']"
						type="button"
					>{{ kBook === null ? "Carte" : kBook.name }}</button>

					<button
						id="btn-select-chapter"
						:class="['btn',
							isBtnSelectChapterExpanded ? 'btn-primary' : 'btn-secondary',
							kBook === null ? 'disabled' : '',
							'm-1']"
						:disabled="kBook === null"
						type="button"
					>{{ kChapter === null ? "Capitol" : kChapter.number }}
					</button>

					<span>:</span>

					<button
						id="btn-select-verset"
						:class="['btn', 
							isBtnSelectVersetExpanded ? 'btn-primary' : 'btn-secondary',
							kChapter === null ? 'disabled' : '',
							'm-1']"
						:disabled="kChapter === null"
						type="button"
					>{{ kVerset === null ? "Verset" : kVerset.number }}</button>

					<button
						id="btn-add-section"
						:class="[{disabled: kBook === null}, 
							'btn', 'btn-success', 'm-1', 'ml-2']"
						type="button"
						@click="addSection"
					>Adaugă</button>

					<div
						class="text-danger"
						v-if="addSectionError !== null"
					>
						{{addSectionError}}
					</div>

					<!-- section's book -->
					<transition name="fade">
						<div
							v-if="isBtnSelectBookExpanded"
						>
							<button
								v-for="book in books"
								:key="book.name"
								:class="['btn',
									kBook === book ?
										'btn-primary' : 'btn-orange',
									'm-1']"
								type="button"
								@click="kBook = book;
									kChapter = null;
									kVerset = null"
							> {{ book.name }}
							</button>
						</div>
					</transition>

					<!-- section's chapter -->
					<transition name="fade">
						<div
							v-if="isBtnSelectChapterExpanded"
						>
							<button
								:class="['btn',
									kChapter === null ?
										'btn-primary' : 'btn-orange',
									'm-1']"
								@click="kChapter = null; kVerset = null;"
							>Toate capitolele</button>

							<div v-if="kBook !== null">
								<button
									v-for="chapter in kBook.chapters"
									:key="chapter.number"
									:class="['btn',
										kChapter === chapter
											? 'btn-primary' : 'btn-orange',
										'm-1']"
									type="button"
									@click="kChapter = chapter; kVerset = null"
								> {{ chapter.number }}
								</button>
							</div>
						</div>
					</transition>

					<!-- section's verset -->
					<transition name="fade">
						<div
							v-if="isBtnSelectVersetExpanded"
						>
							<button
								:class="['btn',
									kVerset === null ?
										'btn-primary' : 'btn-orange',
									'm-1']"
								type="button"
								@click="kVerset = null"
							>Verset
							</button>

							<div v-if="kChapter !== null">
								<button
									v-for="verset in kChapter.versets"
									:key="verset.number"
									:class="['btn',
										kVerset === verset ?
											'btn-primary' : 'btn-orange',
										'm-1']"
									type="button"
									@click="kVerset = verset"
								> {{ verset.number }}
								</button>
							</div>
						</div>
					</transition>

					<!-- list of currently included sections -->
					<ul class="list-group">
						<li
							v-for="section in kquiz.contents"
							:key="genSectionTitle(section)"
							class="list-group-item"		
						>
							{{genSectionTitle(section)}}
							<button
								type="button"
								class="close"
								aria-label="Delete"
								@click="kquiz.contents.splice(
									kquiz.contents.indexOf(section), 1)"
							>
								<span aria-hidden="true">&times;</span>
							</button>
						</li>
					</ul>
				</div>
			</div>
		</transition>
	</div>
</template>

<script>
import $ from 'jquery';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'popper.js/dist/popper.min.js';
import 'bootstrap/dist/js/bootstrap.min.js';

import books from '../data/biblebooks.json';
import { genRestUrlFromUri } from '../util.js';

// book: {name, chapters: [{book, number, versets: [{book, chapter, number}]}]}

// check if any newly added quiz section is identical to or contained by
// a previously added quiz section

// book object: {name, chapters: [{name, versets: []}]}

// QuizSection object:
// {book, chapter, verset}
//



function clickGeneric(evt) {
	this.isBtnSelectBookExpanded = (evt.target.id === "btn-select-book"
		&& !this.isBtnSelectBookExpanded);

	this.isBtnSelectChapterExpanded = (evt.target.id === "btn-select-chapter"
		&& !this.isBtnSelectChapterExpanded && this.kBook !== null);

	this.isBtnSelectVersetExpanded = (evt.target.id === "btn-select-verset"
		&& !this.isBtnSelectVersetExpanded && this.kChapter !== null);

	if (evt.target.id === "btn-select-book"
			|| evt.target.id === "btn-select-chapter"
			|| evt.target.id === "btn-select-verset") {
		this.addSectionError = null;
	}
}

function genSectionTitle(section) {
	var title = section.book.name;
	if (section.chapter) {
		title += " " + section.chapter.number;
	}
	if (section.verset) {
		title += ":" + section.verset.number;
	}
	return title;
	console.log('in sendError');
	/*
	var title = section.startBook + " " + section.startChapter + ":"
		+ section.startVerset;
	if (section.startBook === section.endBook) {
		if (section.startChapter === section.endChapter) {
			if (section.startVerset === section.endVerset) {
			} else {
				title += "-" + section.endVerset;	
			}
		} else {
			title += "-" + section.endChapter + ":" + section.endVerset;
		}
	} else {
		title += " - " + section.endBook + " " + section.endChapter
			+ ":" + section.endVerset;		
	}
	*/
}

function addSection() {
	//check that the section is not identical to any pre-existent sections
	for (let section of this.kquiz.contents) {
		if (section.book === this.kBook
				&& section.chapter === this.kChapter
				&& section.verset === this.kVerset) {
			this.addSectionError = "Ați ales o secțiune care deja este "
				+ "pe listă";
			return;
		}
	}

	this.addSectionError = null;

	this.kquiz.contents.push({
		book: this.kBook,
		chapter: this.kChapter,
		verset: this.kVerset,
	});

	this.kBook = null;
	this.kChapter = null;
	this.kVerset = null;

	//sort the sections
	this.kquiz.contents.sort((x, y) => {
		var result = (x.book.id - y.book.id) * 1000000;
		if (x.chapter !== null && y.chapter !== null) {
			result += (x.chapter.number - y.chapter.number) * 1000;
		} else if (x.chapter !== null) {
			result += x.chapter.number * 1000;
		} else if (y.chapter !== null) {
			result -= y.chapter.number * 1000;
		}

		if (x.verset !== null && y.verset !== null) {
			result += x.verset.number - y.verset.number;
		} else if (x.verset !== null) {
			result += x.verset.number;
		} else if (y.verset !== null) {
			result -= y.verset.number;
		}
		return result;
	});
}

function visitMenu() {
	// cancel the effects of all other buttons
	this.isLoading = false;
	this.$emit('visitMenu');
}

function create() {
	this.kquiz = this.newQuiz;
	this.shouldDisplayQuizSelectionIntro = false;

	//[TODO]
}

function postCatchDefault(err) {
	console.log('error');

	// No fallback to a http version of the API call as all requests
	// are authenticated
	/*
	if (err.request) {
		console.log('request error');
		if (err.message === 'Network Error') {
			console.log('test');
			this.axios.post(genRestUrlFromUri('/quiz/save',
					protocol = 'http'),
					JSON.stringify(this.kquiz))
				.then(postRes.bind(this))
				.catch(postHttpCatch.bind(this));
		}
	}
	*/

	this.$bus.emit('bus-error', err);
	this.isLoading = false;
}

function save() {
	//this.isLoading = true; //[TODO]
	console.log('attempting post');

	function postRes(res) {
		console.log(res.id); //[TODO] HTTP response must contain the ID of the
							 //   saved quiz
		if (this.kquiz.id === null) {
			this.kquiz.id = res.id;
			this.quizzes.push(this.kquiz);
		}
		this.isLoading = false;
	}

	return this.axios.post(genRestUrlFromUri('/quiz/save'),
		JSON.stringify(this.kquiz),
		{ 
			withCredentials: true,
			headers: {
				'Content-Type': 'application/json',
			},
			auth: {
				username: this.$store.state.username,
				password: this.$store.state.password,
			},
		})
	.then(postRes.bind(this))
	.catch(postCatchDefault.bind(this));
}

function del() {
	this.isLoading = true;

	function postRes() {
		this.quizzes.splice(this.quizzes.indexOf(this.kquiz), 1);
		this.isLoading = false;
	}

	return this.axios.post(genRestUrlFromUri('/quiz/del'),
		JSON.stringify(this.kquiz.id),
		{ 
			withCredentials: true,
			headers: {
				'Content-Type': 'application/json',
			},
			auth: {
				username: this.$store.state.username,
				password: this.$store.state.password,
			},
		})
	.then(postRes.bind(this))
	.catch(postCatchDefault.bind(this));
}

function play() {
	// save the quiz

	//disable the button until a response is given

	// send the quiz instance creation message
	this.webSocket.send(JSON.stringify({
		type: 'create',
	}));
}

export default {
	name: 'menu-screen',
	props: {
	},
	data: function() {
		return {
			kBook: null,
			kChapter: null,
			kVerset: null,
	
			isBtnSelectBookExpanded: false,
			isBtnSelectChapterExpanded: false,
			isBtnSelectVersetExpanded: false,

			shouldDisplayQuizSelectionIntro: true,

			addSectionError: null,
			isLoading: false,
			isTableExtended: false,

			quizzes: [],
			kquiz: {},
			books: books,
		}
	},
	computed: {
		//[TODO] Configure new quiz settings in the client API
		newQuiz: function() {
			return {
				id: null,
				name: "",
				description: "",
				time: 15, 
				isTimePerQuestion: true,
				doesAdvanceTogether: true,
				doesHostPlay: false,
				contents: [],
			};
		},
	},
	methods: {
		clickGeneric,
		genSectionTitle,

		addSection,
		visitMenu,
		create,
		save,
		del,
		play,
	},
	components: {
	},
	created() {
		this.kquiz = this.newQuiz;
		$(document).ready(function() {
			$('.info-popover').popover();
		});
	}
}
</script>

<style>
.btn-orange {
	background-color: darkorange;
	color: white;
}

.array-buttons {
	display: flex;
	flex-direction: row;
}

.main-width {
	max-width: 400px;
}

.minor-width {
	max-width: 300px;
}

.info-popover {
	background: transparent;
	border: none !important;
}

.info-popover:hover {
	text-decoration: none;
	cursor: pointer;
}
.info-popover:focus {
	outline: none;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity .3s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}
</style>
