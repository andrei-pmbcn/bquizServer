<template>
	<div class="mt-3" align="center">
		<button
			id="btn-visit-creation"
			class="btn btn-success"
			:disabled="isLoading"
			@click="visitCreation"
		>Începe un joc</button>
		<div class="form-group">
			<label
				class="mt-3"
				for="input-qinst-code"
			>Sau scrie codul jocului aici</label>
			<input
				id="input-qinst-code"
				class="form-control input-small"
				type="number"
				name="qinst-code"
				v-model.number="qinstCode"
			>
			<small
				id="error-qinst-code"
				class="form-text text-danger"
				v-if="errorQinstCode !== null"
			>{{errorQinstCode}}</small>
		</div>

		<div class="form-group">
			<label
				for="input-qinst-nickname"
			>Numele jucătorului:</label>
			<input
				id="input-qinst-nickname"
				class="form-control input-small"
				type="text"
				name="qinst-nickname"
				v-model="qinstNickname"
			>
			<small
				id="error-qinst-nickname"
				class="form-text text-danger"
				v-if="errorQinstNickname !== null"
			>{{errorQinstNickname}}</small>
		</div>

		<button
			id="btn-visit-game"
			class="btn btn-success"
			:disabled="isLoading || !flags.isWebSocketOpen"
			@click="visitGame"
		>
			<span v-if="!isLoading">Joacă</span>
			<span
				class="spinner-border spinner-border-sm"
				role="status"
				aria-hidden="true"
				v-if="isLoading"
			>
				<span class="sr-only">Loading...</span>
			</span>
		</button>
		<small 
			id="error-ws-closed"
			class="form-text text-danger"
			v-if="!flags.isWebSocketOpen"
		>Conexiunea websocket nu funcționează. Jocul este inaccesibil.</small>
	</div>
</template>

<script>
import { mapState, mapMutations } from 'vuex';

function visitCreation() {
	this.$emit('visit-creation');
}

function visitGame() {
	// validate the code
	var isValid = true;

	if (this.qinstCode === null) {
		this.errorQinstCode = "Vă rugăm să introduceți un cod.";
		isValid = false;
	} else if (this.qinstCode < 10**9 || this.qinstCode >= 10**10) {
		this.errorQinstCode = "Codul trebuie să aibă 9 cifre.";
		isValid = false;
	}

	if (this.qinstNickname === "") {
		this.errorQinstNickname = "Vă rugăm să introduceți un nume de jucător "
			+ "pentru dumneavoastră";
		isValid = false;
	}

	if (isValid === false) {
		return;
	}

	// request the quiz instance from the websocket server
	this.webSocket.send(JSON.stringify({
		type: 'join',
		code: this.qinstCode,
		locale: 'ro',
		username: this.username,
		password: this.password,
		nickname: this.qinstNickname,
	}));

	var enterGameOrError = function(msg) {
		if (msg.type === 'welcome') {
			// if the welcome message is received, enter the game screen
			this.webSocket.removeEventListener('message', enterGameOrError);
			this.$emit('visit-game', msg);
		} else if (msg.type === 'error' && msg.responseTo === 'join') {
			// else send the error message
			this.webSocket.removeEventListener('message', enterGameOrError);
			this.$emit('error', msg);
		}
	}

	this.webSocket.addEventListener('message', enterGameOrError);
}

export default {
	name: 'menu-screen',
	data: function() {
		return {
			isLoading: false,
			qinstCode: null,
			qinstNickname: "",
			errorQinstCode: null,
			errorQinstNickname: null,

		}
	},
	computed: {
		...mapState(['username', 'password', 'flags'])
	},
	methods: {
		visitCreation,
		visitGame,
	},
	components: {
	},
	created() {
	}
}


</script>

<style>
.input-small {
	max-width: 200px;
}

/* disable spin buttons for number fields */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
    /* display: none; <- Crashes Chrome on hover */
    -webkit-appearance: none;
    margin: 0; /* <-- Apparently some margin are still there even though it's hidden */
}

input[type=number] {
    -moz-appearance:textfield; /* Firefox */
}
</style>
