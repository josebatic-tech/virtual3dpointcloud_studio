import { readFileSync } from 'fs';

const c = readFileSync('node_modules/@huggingface/transformers/dist/transformers.js', 'utf8');
for (const pat of ['image.png', 'does not support image', 'Cannot read']) {
  if (c.includes(pat)) {
    const idx = c.indexOf(pat);
    console.log('FOUND "' + pat + '" at byte ' + idx);
    console.log('CONTEXT:', c.substring(Math.max(0, idx-150), idx+200).replace(/[\n\r]/g, ' '));
    console.log();
  }
}
console.log('done');
