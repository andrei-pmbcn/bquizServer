<template>
	<div id="game-screen" class="container">
		<div
			v-if="phase === QINST_PHASE_PREP || phase === QINST_PHASE_READY"	
		>
		<!-- player list -->
			<div
				v-for="player in $store.state.game.players"
				:key="player.nickname"
			>
				{{ player.nickname }}
				<span data-toggle="tooltip" :title="langHost">
					{{
						$store.state.game.host === player.nickname ? 
							"🏠" : ""
					}}
				</span>
				<span data-toggle="tooltip" :title="langObserver">
					{{ !player.isPlaying ? "👁️" : "" }}
				</span>
				<span data-toggle="tooltip" :title="langReady">
					{{ player.isReady ? "✔️ " : "" }}
				</span>
				<span>
					{{ player.isConnected ? "" : langDisconnected }}
				</span>
			</div>
		</div>
		<div
			v-if="phase === QINST_PHASE_ACTIVE"
		>




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

		<div
			v-if="phase === QINST_PHASE_FINISHED"
		></div>
	
	</div>
</template>
<script>
import 'bootstrap/dist/css/bootstrap.min.css';
import $ from 'jquery/dist/jquery.slim.min.js';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

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
	computed: {
		langObserver: function() {
			return "acest jucător este un observator; el nu participă la joc";
		},
	},
	methods: {
	},
	components: {
		
	},
	created: function () {
		$('[data-toggle="tooltip"]').tooltip()
	},
}


</script>
<style>

</style>
