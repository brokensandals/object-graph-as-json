const path = require('path');
const fs = require('fs');

const Encoder = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'object-graph-as-json.Encoder.min.js'), 'utf8');
const UnsafeDecoder = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'object-graph-as-json.UnsafeDecoder.min.js'), 'utf8');

const genSrcDir = path.resolve(__dirname, '..', 'gen-src');
fs.mkdirSync(genSrcDir);

const json = JSON.stringify({ Encoder, UnsafeDecoder }, null, 2);
const source = 'export default ' + json + ';';
fs.writeFileSync(path.resolve(genSrcDir, 'embed.js'), source);
