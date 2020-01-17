const path = require('path');
const fs = require('fs');

const embedDir = path.resolve(__dirname, '..', 'target', 'embed');
const Encoder = fs.readFileSync(path.resolve(embedDir, 'Encoder.min.js'), 'utf8');
const UnsafeDecoder = fs.readFileSync(path.resolve(embedDir, 'UnsafeDecoder.min.js'), 'utf8');

const genSrcDir = path.resolve(__dirname, '..', 'target', 'gen-src');
if (!fs.existsSync(genSrcDir)) {
  fs.mkdirSync(genSrcDir);
}

const json = JSON.stringify({ Encoder, UnsafeDecoder }, null, 2);
const source = 'export default ' + json + ';';
fs.writeFileSync(path.resolve(genSrcDir, 'embed.js'), source);
