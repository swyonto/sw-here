const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, 'public/images/sw-here-logo.png');
const icoPath = path.join(__dirname, 'public/images/sw-here-logo.ico');

if (!fs.existsSync(pngPath)) {
  console.error('Source PNG not found at:', pngPath);
  process.exit(1);
}

pngToIco(pngPath)
  .then(buf => {
    fs.writeFileSync(icoPath, buf);
    console.log('[ICO Generator] Successfully created ICO file using png-to-ico package at:', icoPath);
  })
  .catch(err => {
    console.error('[ICO Generator] Conversion failed:', err);
  });
