const fs = require('fs');
['src/app/admin/crm.css', 'src/app/admin/admin.css'].forEach(file => {
  let css = fs.readFileSync(file, 'utf8');
  css = css.replace(/rgba\(255,\s*255,\s*255,\s*0\.([0-9]+)\)/g, (match, p1) => {
    let pct = parseInt(p1);
    if (p1.length === 1) {
      pct = pct * 10;
    }
    return `color-mix(in srgb, var(--admin-on-surface) ${pct}%, transparent)`;
  });
  fs.writeFileSync(file, css);
  console.log(`Processed ${file}`);
});
