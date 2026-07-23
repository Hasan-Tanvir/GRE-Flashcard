const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data.txt');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log('✅ data.txt is valid JSON!');
console.log('📚 Number of categories:', data.length);
console.log('');

data.forEach((cat, i) => {
    console.log(`Category ${i+1}: ${cat.category}`);
    console.log(`  Subcategories: ${cat.subCategories.length}`);
    let totalWords = 0;
    cat.subCategories.forEach((sub, j) => {
        totalWords += sub.words.length;
        console.log(`  - ${sub.name}: ${sub.words.length} words`);
        if (sub.words.length > 0) {
            console.log(`    First word: ${sub.words[0].word} (${sub.words[0].pos})`);
        }
    });
    console.log(`  Total words in category: ${totalWords}`);
    console.log('');
});
