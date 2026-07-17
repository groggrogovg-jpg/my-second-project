import sharp from "sharp";

const WATERMARK_TEXT = "КАРДОМАТИК · TRIAL";

/**
 * Накладывает на изображение серверный водяной знак для пробного (trial) режима.
 * Знак представляет собой диагональную сетку из полупрозрачного текста,
 * распределённую по всему изображению. Результат возвращается в виде PNG-буфера.
 */
export async function applyTrialWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;

  const minDim = Math.min(width, height);
  const fontSize = Math.max(16, Math.round(minDim * 0.04));
  const spacingX = Math.round(width * 0.32);
  const spacingY = Math.round(height * 0.22);
  const angle = -30;

  // Создаём SVG-оверлей с диагональной сеткой текста.
  // Диапазон координат расширен, чтобы при повороте текст покрывал всё изображение.
  const startX = -width;
  const endX = width * 2;
  const startY = -height;
  const endY = height * 2;

  let textNodes = "";
  let row = 0;
  for (let y = startY; y < endY; y += spacingY) {
    const rowOffset = (row % 2) * Math.round(spacingX * 0.5);
    for (let x = startX + rowOffset; x < endX; x += spacingX) {
      textNodes += `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(255,255,255,0.35)" transform="rotate(${angle} ${x} ${y})" text-anchor="middle" dominant-baseline="middle">${WATERMARK_TEXT}</text>`;
    }
    row++;
  }

  // Добавляем тёмную тень под текстом для лучшей видимости на светлых фонах.
  const shadowNodes = textNodes.replace(/fill="rgba\(255,255,255,0\.35\)"/g, 'fill="rgba(0,0,0,0.28)"').replace(/transform="rotate\(([-0-9]+) ([-0-9]+) ([-0-9]+)\)"/g, (match, a, cx, cy) => `transform="rotate(${a} ${Number(cx) + 2} ${Number(cy) + 2})"`);

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${shadowNodes}${textNodes}</svg>`;

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png({ quality: 95 })
    .toBuffer();
}

/**
 * Возвращает data-URL (PNG) из буфера изображения.
 */
export function bufferToDataUrl(buffer: Buffer, mimeType = "image/png"): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
