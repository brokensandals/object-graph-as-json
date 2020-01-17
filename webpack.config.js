const path = require('path');

module.exports = (env) => {
  if (env && env.embed) {
    return {
      entry: {
        Encoder: './src/Encoder.js',
        UnsafeDecoder: './src/UnsafeDecoder.js',
      },
      output: {
        path: path.resolve(__dirname, 'target', 'embed'),
        filename: '[name].min.js',
        library: '[name]',
        libraryTarget: 'var',
      },
    };
  }

  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'target', 'umd'),
      filename: 'object-graph-as-json.min.js',
      library: 'OGAJ',
      libraryTarget: 'umd',
    },
  };
};
