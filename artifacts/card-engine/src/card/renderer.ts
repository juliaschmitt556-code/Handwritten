export type PaperTone = 'warm-cream' | 'ivory' | 'blush-ivory';
export type Decoration = 'rose-sprig' | 'wildflower' | 'olive-branch' | 'none';
export type ArtworkStyle = 'watercolor' | 'botanical-linework' | 'pressed-petals';

export interface CardSpec {
  recipient: string;
  german: string;
  english: string;
  paperTone: PaperTone;
  ink: string;
  handwriting: string;
  artworkStyle: ArtworkStyle;
  decoration: Decoration;
  englishScale: number;
  messageOffset: number;
  size: '5x7' | '4x6';
}

export const EXACT_GERMAN = `Für meine liebe Opal,

Aus Deutschland habe ich nur an dich gedacht.
Von meinem Fan zu meiner Freundin – du bist mein Herz.
Ich kann es kaum erwarten, dich in Texas zu sehen.

Für immer dein,
Val`;
export const EXACT_ENGLISH = `For my dear Opal,

From Germany, I could think of nothing but you.
From being your fan to being your boyfriend – you are my heart.
I can’t wait to see you in Texas.

Forever yours,
Val`;

const PAPER_COLORS: Record<PaperTone, string> = {
  'warm-cream': '#f6eddb',
  ivory: '#fffaf0',
  'blush-ivory': '#f7e9e4',
};

function drawSprig(ctx: CanvasRenderingContext2D, w: number, h: number, decoration: Decoration) {
  if (decoration === 'none') return;
  ctx.save();
  ctx.translate(w * 0.79, h * 0.11);
  ctx.rotate(-0.28);
  ctx.strokeStyle = decoration === 'olive-branch' ? '#78836b' : '#a77b7b';
  ctx.fillStyle = decoration === 'olive-branch' ? '#8b9677' : '#b9878a';
  ctx.lineWidth = Math.max(1.1, w / 900);
  ctx.globalAlpha = 0.64;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.03);
  ctx.bezierCurveTo(w * 0.02, h * 0.08, -w * 0.025, h * 0.12, w * 0.01, h * 0.18);
  ctx.stroke();
  for (let i = 0; i < 5; i += 1) {
    const y = h * (0.045 + i * 0.027);
    const side = i % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.ellipse(side * w * 0.012, y, w * 0.011, h * 0.009, side * -0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  if (decoration === 'rose-sprig') {
    ctx.beginPath();
    ctx.arc(w * 0.006, h * 0.015, w * 0.012, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.006, h * 0.015, w * 0.006, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPaper(ctx: CanvasRenderingContext2D, w: number, h: number, tone: PaperTone) {
  ctx.fillStyle = PAPER_COLORS[tone];
  ctx.fillRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, 'rgba(255,255,255,.20)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0)');
  gradient.addColorStop(1, 'rgba(134,100,70,.045)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  let seed = 412;
  for (let i = 0; i < Math.floor(w * h / 1850); i += 1) {
    seed = (seed * 16807) % 2147483647;
    const x = seed / 2147483647 * w;
    seed = (seed * 16807) % 2147483647;
    const y = seed / 2147483647 * h;
    ctx.fillStyle = `rgba(114,85,60,${0.012 + (seed % 7) / 1000})`;
    ctx.fillRect(x, y, Math.max(1, w / 800), Math.max(1, h / 1400));
  }
}

export async function renderCardCanvas(spec: CardSpec, width: number, height: number, artwork?: string): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  drawPaper(ctx, width, height, spec.paperTone);
  if (artwork) {
    const image = new Image();
    image.src = artwork;
    await image.decode().catch(() => undefined);
    if (image.naturalWidth) ctx.drawImage(image, width * 0.69, height * 0.035, width * 0.25, height * 0.21);
    else drawSprig(ctx, width, height, spec.decoration);
  } else drawSprig(ctx, width, height, spec.decoration);

  // Preserve the exact bilingual message as a separate transparent layer until
  // the final compositing step; artwork generation never supplies card text.
  const messageLayer = document.createElement('canvas');
  messageLayer.width = width;
  messageLayer.height = height;
  const messageCtx = messageLayer.getContext('2d');
  if (!messageCtx) return canvas;
  const scale = width / 1500;
  const left = width * 0.08;
  const maxWidth = width * 0.84;
  let y = height * (0.215 + spec.messageOffset * 0.00175);
  const handwritingFont = spec.handwriting === 'Classic script' ? '"Cormorant Garamond", serif' : '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
  const drawLines = (message: string, size: number, font: string, lineGap: number) => {
    messageCtx.font = `${size * scale}px ${font}`;
    messageCtx.fillStyle = spec.ink;
    messageCtx.textBaseline = 'top';
    for (const line of message.split('\n')) {
      if (!line) { y += lineGap * scale * 0.75; continue; }
      const words = line.split(' ');
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (messageCtx.measureText(candidate).width > maxWidth && current) {
          messageCtx.fillText(current, left, y);
          y += lineGap * scale;
          current = word;
        } else current = candidate;
      }
      messageCtx.fillText(current, left, y);
      y += lineGap * scale;
    }
  };
  drawLines(spec.german, 69, handwritingFont, 101);
  y += height * 0.028;
  drawLines(spec.english, 50 * spec.englishScale, '"Cormorant Garamond", Georgia, serif', 73);
  ctx.drawImage(messageLayer, 0, 0);
  ctx.strokeStyle = 'rgba(117,81,68,.19)';
  ctx.lineWidth = Math.max(1, width / 1200);
  ctx.strokeRect(width * 0.025, height * 0.018, width * 0.95, height * 0.964);
  return canvas;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function with300Dpi(bytes: Uint8Array, format: 'png' | 'jpg') {
  if (format === 'png' && bytes[0] === 137) {
    const content = new Uint8Array([0x70, 0x48, 0x59, 0x73, 0, 0, 0x2e, 0x23, 0, 0, 0x2e, 0x23, 1]);
    const checksum = crc32(content);
    const chunk = new Uint8Array(21);
    chunk.set([0, 0, 0, 9], 0);
    chunk.set(content, 4);
    chunk.set([(checksum >>> 24) & 255, (checksum >>> 16) & 255, (checksum >>> 8) & 255, checksum & 255], 17);
    let end = bytes.length - 12;
    for (let i = 8; i < bytes.length - 3; i += 1) {
      if (bytes[i] === 0x49 && bytes[i + 1] === 0x45 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x44) { end = i - 4; break; }
    }
    const output = new Uint8Array(bytes.length + chunk.length);
    output.set(bytes.subarray(0, end));
    output.set(chunk, end);
    output.set(bytes.subarray(end), end + chunk.length);
    return output;
  }
  if (format === 'jpg') {
    const output = bytes.slice();
    let offset = 2;
    while (offset + 4 < output.length && output[offset] === 0xff) {
      const marker = output[offset + 1];
      const length = output[offset + 2] * 256 + output[offset + 3];
      if (marker === 0xe0 && length >= 16 && output[offset + 4] === 0x4a && output[offset + 5] === 0x46 && output[offset + 6] === 0x49 && output[offset + 7] === 0x46) {
        output[offset + 11] = 1;
        output[offset + 12] = 1;
        output[offset + 13] = 0x2c;
        output[offset + 14] = 1;
        output[offset + 15] = 0x2c;
        return output;
      }
      if (marker === 0xda || marker === 0xd9) break;
      offset += length + 2;
    }
    const segment = new Uint8Array([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, 1, 0x2c, 1, 0x2c, 0, 0]);
    const patched = new Uint8Array(output.length + segment.length);
    patched.set(output.subarray(0, 2));
    patched.set(segment, 2);
    patched.set(output.subarray(2), 2 + segment.length);
    return patched;
  }
  return bytes;
}

export function cardBlob(canvas: HTMLCanvasElement, format: 'png' | 'jpg', quality = 0.96): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Could not create export.')); return; }
      const encoded = new Uint8Array(await blob.arrayBuffer());
      const tagged = with300Dpi(encoded, format);
      resolve(new Blob([tagged.buffer as ArrayBuffer], { type: format === 'png' ? 'image/png' : 'image/jpeg' }));
    }, format === 'png' ? 'image/png' : 'image/jpeg', quality);
  });
}

export async function createPrintPdf(canvas: HTMLCanvasElement, size: '5x7' | '4x6', bleed: boolean): Promise<Blob> {
  const jpeg = await cardBlob(canvas, 'jpg', 0.98);
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  const [w, h] = size === '5x7' ? [5, 7] : [4, 6];
  const edge = bleed ? 0.125 : 0;
  const pageW = (w + edge * 2) * 72;
  const pageH = (h + edge * 2) * 72;
  const imageW = canvas.width;
  const imageH = canvas.height;
  const objects: Uint8Array[] = [];
  const enc = new TextEncoder();
  const add = (s: string) => objects.push(enc.encode(s));
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  const imgHead = enc.encode(`<< /Type /XObject /Subtype /Image /Width ${imageW} /Height ${imageH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
  const imgTail = enc.encode('\nendstream');
  const imageObj = new Uint8Array(imgHead.length + bytes.length + imgTail.length);
  imageObj.set(imgHead); imageObj.set(bytes, imgHead.length); imageObj.set(imgTail, imgHead.length + bytes.length);
  objects.push(imageObj);
  const content = `q ${w * 72} 0 0 ${h * 72} ${edge * 72} ${edge * 72} cm /Im0 Do Q`;
  add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const chunks: Uint8Array[] = [enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((obj, index) => {
    offsets.push(length);
    const before = enc.encode(`${index + 1} 0 obj\n`);
    const after = enc.encode('\nendobj\n');
    chunks.push(before, obj, after);
    length += before.length + obj.length + after.length;
  });
  const xrefOffset = length;
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(enc.encode(xref));
  const output = new Uint8Array(length + enc.encode(xref).length);
  let cursor = 0;
  for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
  return new Blob([output.buffer as ArrayBuffer], { type: 'application/pdf' });
}

export interface Point { x: number; y: number }
export type ScanAdjustments = { brightness: number; contrast: number; shadows: number; cleanup: number; sharpness: number; rotation: number };

function solveLinear(matrix: number[][], vector: number[]) {
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let i = 0; i < 8; i += 1) {
    let pivot = i;
    for (let j = i + 1; j < 8; j += 1) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    const divisor = a[i][i] || 1;
    for (let k = i; k < 9; k += 1) a[i][k] /= divisor;
    for (let j = 0; j < 8; j += 1) if (j !== i) {
      const factor = a[j][i];
      for (let k = i; k < 9; k += 1) a[j][k] -= factor * a[i][k];
    }
  }
  return a.map((row) => row[8]);
}

export function perspectiveWarp(source: HTMLImageElement, corners: Point[], adjustments: ScanAdjustments): HTMLCanvasElement {
  const sourceScale = Math.min(1, 2400 / Math.max(source.naturalWidth, source.naturalHeight));
  const sourceWidth = Math.max(1, Math.round(source.naturalWidth * sourceScale));
  const sourceHeight = Math.max(1, Math.round(source.naturalHeight * sourceScale));
  const scaledCorners = corners.map((point) => ({ x: point.x * sourceScale, y: point.y * sourceScale }));
  const [tl, tr, br, bl] = scaledCorners;
  const width = Math.max(320, Math.round(Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y))));
  const height = Math.max(420, Math.round(Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y))));
  const output = document.createElement('canvas');
  output.width = width; output.height = height;
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth; sourceCanvas.height = sourceHeight;
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const targetCtx = output.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx || !targetCtx) return output;
  sourceCtx.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  const input = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const result = targetCtx.createImageData(width, height);
  const matrix: number[][] = [];
  const values: number[] = [];
  const target = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  scaledCorners.forEach((p, i) => {
    const { x, y } = target[i];
    matrix.push([x, y, 1, 0, 0, 0, -p.x * x, -p.x * y]); values.push(p.x);
    matrix.push([0, 0, 0, x, y, 1, -p.y * x, -p.y * y]); values.push(p.y);
  });
  const [a, b, c, d, e, f, g, h] = solveLinear(matrix, values);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const divisor = g * x + h * y + 1;
    const sx = Math.round((a * x + b * y + c) / divisor);
    const sy = Math.round((d * x + e * y + f) / divisor);
    if (sx < 0 || sy < 0 || sx >= input.width || sy >= input.height) continue;
    const si = (sy * input.width + sx) * 4;
    const di = (y * width + x) * 4;
    const center = [input.data[si], input.data[si + 1], input.data[si + 2]];
    let r = center[0], green = center[1], blue = center[2];
    const bright = adjustments.brightness / 100;
    const contrast = adjustments.contrast / 100;
    const gray = (r + green + blue) / 3;
    const shadowWeight = Math.min(1, Math.max(0, (gray - 65) / 80));
    const shadowLift = adjustments.shadows / 100 * Math.min(38, Math.max(0, 132 - gray)) * shadowWeight;
    const sample = (nx: number, ny: number, channel: number) => input.data[(Math.min(input.height - 1, Math.max(0, ny)) * input.width + Math.min(input.width - 1, Math.max(0, nx))) * 4 + channel];
    const sharpen = adjustments.sharpness / 100 * 1.25;
    const detail = center.map((value, channel) => value - (sample(sx - 1, sy, channel) + sample(sx + 1, sy, channel) + sample(sx, sy - 1, channel) + sample(sx, sy + 1, channel)) / 4);
    r = Math.min(255, Math.max(0, (r - 128) * contrast + 128 + bright * 80 + shadowLift + detail[0] * sharpen));
    green = Math.min(255, Math.max(0, (green - 128) * contrast + 128 + bright * 80 + shadowLift + detail[1] * sharpen));
    blue = Math.min(255, Math.max(0, (blue - 128) * contrast + 128 + bright * 80 + shadowLift + detail[2] * sharpen));
    if (adjustments.cleanup > 0) {
      const gray = (r + green + blue) / 3;
      const inkProtection = Math.min(.55, Math.max(0, (gray - 72) / 180));
      const mix = adjustments.cleanup / 100 * inkProtection;
      r += (Math.max(gray, 239) - r) * mix;
      green += (Math.max(gray, 235) - green) * mix;
      blue += (Math.max(gray, 226) - blue) * mix;
    }
    result.data[di] = r; result.data[di + 1] = green; result.data[di + 2] = blue; result.data[di + 3] = 255;
  }
  targetCtx.putImageData(result, 0, 0);
  if (adjustments.rotation) {
    const rotated = document.createElement('canvas');
    rotated.width = adjustments.rotation % 180 ? height : width;
    rotated.height = adjustments.rotation % 180 ? width : height;
    const rctx = rotated.getContext('2d');
    if (rctx) {
      rctx.translate(rotated.width / 2, rotated.height / 2);
      rctx.rotate(adjustments.rotation * Math.PI / 180);
      rctx.drawImage(output, -width / 2, -height / 2);
      return rotated;
    }
  }
  return output;
}