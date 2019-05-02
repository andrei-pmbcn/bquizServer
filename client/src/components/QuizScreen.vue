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
}

export default {
	name: 'menu-screen',
	props: {
		webSocket: {
			type: Object,
			required: true,
		}

	},
	data: function() {
		return {

		}
	},
	methods: {
		visitList,
	},
	components: {
	},
}
</script>

<style>
</style>
