const path = require('path');

module.exports = {
  entry: {
    Encoder: './src/Encoder.js',
    UnsafeDecoder: './src/UnsafeDecoder.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'object-graph-as-json.[name].min.js',
    library: ['OGAJ', '[name]'],
    libraryTarget: 'var',
  },
};
