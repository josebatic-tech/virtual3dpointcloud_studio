import { readFileSync } from 'fs';

const c = readFileSync('node_modules/@huggingface/transformers/dist/transformers.js', 'utf8');
// Search for error construction patterns
const patterns = ['does not support', 'cannot process', 'unsupported input', 'not support image'];
for (const pat of patterns) {
  let idx = 0;
  while ((idx = c.indexOf(pat, idx)) !== -1) {
    const start = Math.max(0, idx - 100);
    const end = Math.min(c.length, idx + 150);
    console.log('FOUND "' + pat + '"');
    console.log('  ' + c.substring(start, end).replace(/[\n\r]/g, ' '));
    console.log();
    idx += 1;
  }
}
console.log('search done');
