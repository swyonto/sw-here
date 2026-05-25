const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, 'public/images/sw-here-logo.png');
const icoPath = path.join(__dirname, 'public/images/sw-here-logo.ico');

if (!fs.existsSync(pngPath)) {
  console.error('Source PNG not found at:', pngPath);
  process.exit(1);
}

try {
  const pngData = fs.readFileSync(pngPath);
  const pngSize = pngData.length;

  // Create 22-byte ICO header
  const header = Buffer.alloc(22);

  // ICO Header (6 bytes)
  header.writeUInt16LE(0, 0);     // Reserved (must be 0)
  header.writeUInt16LE(1, 2);     // Image type (1 = icon)
  header.writeUInt16LE(1, 4);     // Number of images (1)

  // Directory Entry (16 bytes)
  header.writeUInt8(0, 6);        // Width (0 means 256px)
  header.writeUInt8(0, 7);        // Height (0 means 256px)
  header.writeUInt8(0, 8);        // Color count (0 if >= 8bpp)
  header.writeUInt8(0, 9);        // Reserved (must be 0)
  header.writeUInt16LE(1, 10);    // Color planes (1)
  header.writeUInt16LE(32, 12);   // Bits per pixel (32)
  header.writeUInt32LE(pngSize, 14); // Size of image data
  header.writeUInt32LE(22, 18);   // Offset of image data (starts at byte 22)

  // Combine header and PNG data
  const icoData = Buffer.concat([header, pngData]);

  fs.writeFileSync(icoPath, icoData);
  console.log('[ICO Generator] Successfully created ICO file at:', icoPath);
} catch (err) {
  console.error('[ICO Generator] Failed to write ICO file:', err);
}
