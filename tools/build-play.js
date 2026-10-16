/* =========================================================================
   build-play.js — regenerate play.html (single-file build)
   Usage: node tools/build-play.js      (run from the repo root)
   Inlines styles.css, startng.js and game.js into index.html so the whole
   game is one portable file. index.html stays the canonical entry point —
   start.ng serves that one.
   ========================================================================= */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

let html = read('index.html');
const css = read('styles.css');
const startng = read('startng.js');
const game = read('game.js');

html = html
  .replace(/<link rel="stylesheet" href="styles\.css"\s*\/?>/, '<style>\n' + css + '\n</style>')
  .replace(/<script src="startng\.js"><\/script>/, '<script>\n' + startng + '\n</script>')
  .replace(/<script src="game\.js"><\/script>/, '<script>\n' + game + '\n</script>');

const leftovers = html.match(/(?:src|href)="(?!data:)(?!#)[^"]*\.(?:js|css)"/g);
if (leftovers) {
  console.error('Not inlined: ' + leftovers.join(', '));
  process.exit(1);
}

fs.writeFileSync(path.join(root, 'play.html'), html);
console.log('play.html written — ' + (html.length / 1024).toFixed(1) + ' KB');
