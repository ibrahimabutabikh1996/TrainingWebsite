const fs = require('fs');
const path = require('path');

const replacements = [
  // Hex colors
  { regex: /#C9A84C/gi, replace: '#2563eb' },
  { regex: /#E8C96A/gi, replace: '#3b82f6' },
  { regex: /#96701A/gi, replace: '#2563eb' },
  { regex: /#B38B30/gi, replace: '#3b82f6' },
  
  // rgba colors
  { regex: /rgba\(\s*201\s*,\s*168\s*,\s*76\s*,/g, replace: 'rgba(37, 99, 235,' },
  { regex: /rgba\(\s*150\s*,\s*112\s*,\s*26\s*,/g, replace: 'rgba(37, 99, 235,' },
  
  // Variables
  { regex: /var\(--gold\)/g, replace: 'var(--primary)' },
  { regex: /var\(--gold-light\)/g, replace: 'var(--primary-hover)' },
  { regex: /var\(--gold-dim\)/g, replace: 'var(--primary-dim)' },
  { regex: /var\(--border-gold\)/g, replace: 'var(--border-primary)' },
  
  // Classes
  { regex: /gold-tag/g, replace: 'primary-tag' },
  { regex: /gold-text/g, replace: 'primary-text' },
  { regex: /gold-divider/g, replace: 'primary-divider' },
  { regex: /gold-box/g, replace: 'primary-box' },
  { regex: /gold-icon/g, replace: 'primary-icon' },
  { regex: /className="([^"]*\s)?gold(\s[^"]*)?"/g, replace: 'className="$1primary$2"' },
  { regex: /className={`([^`]*\s)?gold(\s[^`]*)?`/g, replace: 'className={`$1primary$2`' },
  { regex: / className="gold"/g, replace: ' className="primary"' },
  
  // Custom standalone classes in CSS and TSX
  { regex: /\.gold\b/g, replace: '.primary' },
  { regex: /"gold"/g, replace: '"primary"' },
  { regex: /'gold'/g, replace: "'primary'" },
  { regex: /`gold`/g, replace: "`primary`" },
  { regex: / gold /g, replace: ' primary ' },
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (filePath.endsWith('.css') || filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = walk('src');
let changedFilesCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  replacements.forEach(({ regex, replace }) => {
    content = content.replace(regex, replace);
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated: ${file}`);
    changedFilesCount++;
  }
});

console.log(`\nFinished! Updated ${changedFilesCount} files.`);
