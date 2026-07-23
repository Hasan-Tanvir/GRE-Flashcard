const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data.txt');
const rawContent = fs.readFileSync(dataPath, 'utf8');

// Find all JSON arrays in the content
const arrays = [];
let depth = 0;
let startIndex = null;

for (let i = 0; i < rawContent.length; i++) {
  const char = rawContent[i];
  if (char === '[') {
    if (depth === 0) {
      startIndex = i;
    }
    depth++;
  } else if (char === ']') {
    depth--;
    if (depth === 0 && startIndex !== null) {
      const arrayStr = rawContent.slice(startIndex, i + 1);
      try {
        const arr = JSON.parse(arrayStr);
        arrays.push(...arr);
      } catch (e) {
        console.error('Error parsing array:', e);
      }
      startIndex = null;
    }
  }
}

// Write the combined array back
fs.writeFileSync(dataPath, JSON.stringify(arrays, null, 2), 'utf8');
console.log('Fixed data.txt! Combined', arrays.length, 'categories');
