// For authoring Nightwatch tests, see
// http://nightwatchjs.org/guide#usage

require('dotenv').config()

describe('default e2e tests', function() {
	it('tests', function(browser) {
		browser
			.url(process.env.VUE_DEV_SERVER_URL)
			.assert.containsText('#btn-visit-game', 'Joacă')
			.end()
	});

	it('tests again', function(browser) {
		browser
			.url(process.env.VUE_DEV_SERVER_URL)
			.assert.containsText('#btn-visit-game', 'Joacă')
			.end()
	});
});
