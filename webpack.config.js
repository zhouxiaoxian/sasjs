const path = require("path");
const webpack = require("webpack");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");

module.exports = {
  entry: "./src/index.ts",
  mode: "production",
  optimization: {
    minimize: true,
    minimizer: [new UglifyJsPlugin()]
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "build"),
    libraryTarget: "umd",
    library: "SASjs"
  },
  plugins: [new webpack.ContextReplacementPlugin(/moment[\/\\]locale$/, /en/)]
};
