const path = require('path');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
	mode: process.env.NODE_ENV,
	entry: './js/index.js',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: '[name].bundle.js'
	},
	devServer: {
		static: {
			directory: path.resolve(__dirname, 'public')
		},
		compress: false,
		port: 9000,
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader']
			},
			{
				test: /\.ttf$/,
				use: ['file-loader']
			}
		]
	},
	plugins: [
		new MonacoWebpackPlugin({
			languages: ['typescript', 'javascript', 'css', 'json']
		})
	]
};
