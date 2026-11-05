import sharp from "sharp";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#0A1628"/><path d="M135 350 225 147h68L203 350Z" fill="#A8D5F7"/><path d="m243 350 90-203h44l-90 203Z" fill="#C8F24A"/><path d="M165 233h181v46H165z" fill="#A8D5F7"/></svg>`;
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
])
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile("public/" + name);
