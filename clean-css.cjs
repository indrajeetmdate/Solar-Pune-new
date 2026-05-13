const fs = require('fs');

let content = fs.readFileSync('src/styles.css', 'utf-8');

// Find the start of the garbled text. The garbled text contains null bytes because it's UTF-16 interpreted as UTF-8.
// Or we can just split at '/* Wizard Styles */' or the null-byte version of it.
const garbledStart = content.indexOf('\0/\0*\0 \0W\0i\0z\0a\0r\0d');
if (garbledStart !== -1) {
  content = content.substring(0, garbledStart);
}

const garbledStart2 = content.indexOf(' / *   W i z a r d');
if (garbledStart2 !== -1) {
  content = content.substring(0, garbledStart2);
}

fs.writeFileSync('src/styles.css', content, 'utf-8');
console.log('Cleaned styles.css');
