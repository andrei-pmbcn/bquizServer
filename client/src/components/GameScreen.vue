<template>
	<div id="game-screen" class="container">
		<div
			v-if="phase === QINST_PHASE_PREP || phase === QINST_PHASE_READY"	
		>
				
		</div>
		<div
			v-if="phase === QINST_PHASE_ACTIVE"
		>
		</div>

		<div
			v-if="phase === QINST_PHASE_FINISHED"
		></div>
	
		<div class="row">
			<div class="col-xs-12">{{questionText}}</div>
		</div>
		<div class="row">
			<div class="col-xs-12 col-sm-6">{{answerText[0]}}</div>
			<div class="col-xs-12 col-sm-6">{{answerText[1]}}</div>
		</div>
		<div class="row">
			<div class="col-xs-12 col-sm-6">{{answerText[2]}}</div>
			<div class="col-xs-12 col-sm-6">{{answerText[3]}}</div>
		</div>
	</div>
</template>
<script>
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';

//the component must store the quiz id in the cache, and retrieve it upon loading
//leaving the quiz results in the component being cleared from the cache

//the quiz stores the current question and previous answers for all players server-side and returns them when they rejoin the quiz


//server-to-client message types:
//  question: a question and its answers
//  feedback: 

//client-to-server message types:
//  answer: 



export default {
	name: 'player-screen',
	props: {
		qinstCode: {
			required: true,
		},
		
		webSocket: {
			required: true,
		}

	},
	data: function() {
		return {

		};
	},
	methods: {
	},
	components: {
		
	},
	created: function () {
	},
}


</script>
<style>

</style>
