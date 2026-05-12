const fs = require('fs');

let content = fs.readFileSync('src/app.js', 'utf-8');

// Find the start of the garbled text
const garbledStart = content.indexOf(' w i n d o w');
if (garbledStart !== -1) {
  content = content.substring(0, garbledStart);
}

const garbledStart2 = content.indexOf('\0w\0i\0n\0d\0o\0w');
if (garbledStart2 !== -1) {
  content = content.substring(0, garbledStart2);
}

fs.writeFileSync('src/app.js', content, 'utf-8');
console.log('Cleaned app.js');
