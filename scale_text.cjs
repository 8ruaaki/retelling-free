const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js') || fullPath.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      content = content.replace(/text-\[(\d+)px\]/g, (match, p1) => {
        const newSize = Math.round(parseInt(p1) * 1.3);
        changed = true;
        return `text-[${newSize}px]`;
      });
      
      // Also scale some explicitly defined classes in index.css
      if (fullPath.endsWith('index.css')) {
        content = content.replace(/font-size: 19px;/, 'font-size: 24px;');
      }

      // In Screen1Participant.jsx, make max-w-xl -> max-w-4xl
      if (fullPath.endsWith('Screen1Participant.jsx')) {
        content = content.replace(/max-w-xl/g, 'max-w-4xl');
        content = content.replace(/h-20 w-20/g, 'h-28 w-28');
        content = content.replace(/py-16/g, 'py-24');
      }

      if (changed || fullPath.endsWith('index.css') || fullPath.endsWith('Screen1Participant.jsx')) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir('src');
console.log('Scale update complete.');
