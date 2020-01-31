const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'target', 'umd'),
    filename: 'object-graph-as-json.min.js',
    library: 'OGAJ',
    libraryTarget: 'umd',
  },
};
