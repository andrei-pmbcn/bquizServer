module.exports = {
	configureWebpack: {
		devtool: 'source-map',
		devServer: {
			/*
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, POST",
				"Access-Control-Allow-Headers":
					"X-Requested-With, content-type, Authorization",
			},
			*/
		},
		output: {
			filename: 'bquiz.js',
			library: 'bquiz',
		},
	}
}
