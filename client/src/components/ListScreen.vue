<template>
	<div class="mt-3" align="center">
		<table class="table">
			<thead>
				<tr>
					<th scope="col">Nume</th>
					<th scope="col">Creator</th>
					<th scope="col">Scor</th>
					<th scope="col">Nr. jucări</th>
				</tr>
			</thead>
			<tr
		 		v-for="(summary, index) in quizzes"
	  			:class="{
	  				'list-unsel-1': index % 2 === 0 && selectedIndex !== index,
					'list-unsel-2': index % 2 === 1 && selectedIndex !== index,
					'list-sel': selectedIndex === index,
	  			}"
	   			:key="summary.identifier"
			>
				<td>summary.name</td>
				
			</tr>
		</table>
		<button
			class="btn btn-success mt-2"
			@click="visitMenu"
		>înapoi</button>
		<button
			class="btn btn-success m-2"
			@click="startQuiz"
		>alege</button>
	</div>
</template>

<script>
function visitMenu() {
	this.$emit('visitMenu');
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
			selectedIndex: null,
			quizzes: [],
		}
	},
	methods: {
		visitMenu,
	},
	components: {
	},
}
</script>

<style>
</style>
