<template>
	<div class="mt-3" align="center">
			<button
				class="btn btn-success mt-2"
				@click="visitList"
			>înapoi</button>
			<button
				class="btn btn-success m-2"
				@click="createQinst"
			>crează</button>
	</div>
</template>

<script>
function visitList() {
	this.$emit('visitList');
}

function createQinst() {
	this.webSocket.send(JSON.stringify({
		type: 'create',
	}));

	//disable the button until a response is given
}

export default {
	name: 'menu-screen',
	props: {
	},
	data: function() {
		return {

		}
	},
	methods: {
		visitList,
		createQinst,
	},
	components: {
	},
}
</script>

<style>
</style>
