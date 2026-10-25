const fs = require('fs');
const path = require('path');

/**
 * Medición de texto compatible con libass (el motor que quema los subtítulos .ass en FFmpeg).
 * Sirve para dibujar formas vectoriales (como la caja redondeada estilo CapCut) exactamente
 * detrás de una palabra. Si una fuente no se encuentra, devuelve null y el llamador usa su respaldo.
 */

const FONT_DIRS = [
  path.join(__dirname, '..', 'fonts'),
  process.env.WINDIR ? path.join(process.env.WINDIR, 'Fonts') : 'C:\\Windows\\Fonts',
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts') : ''
].filter(Boolean);

let fontIndex = null;
const measurerCache = new Map();
let aliasCounter = 0;

const normalizeName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function readBytes(fd, offset, length) {
  const buf = Buffer.alloc(length);
  fs.readSync(fd, buf, 0, length, offset);
  return buf;
}

/**
 * Lee del archivo .ttf/.otf solo las tablas necesarias: nombres, unidades por em y métricas de Windows.
 */
function readFontInfo(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const header = readBytes(fd, 0, 12);
    const numTables = header.readUInt16BE(4);
    const dir = readBytes(fd, 12, numTables * 16);
    const tables = {};
    for (let i = 0; i < numTables; i++) {
      const o = i * 16;
      tables[dir.toString('ascii', o, o + 4)] = { offset: dir.readUInt32BE(o + 8), length: dir.readUInt32BE(o + 12) };
    }
    if (!tables.head || !tables['OS/2'] || !tables.name) return null;

    const head = readBytes(fd, tables.head.offset, 54);
    const upem = head.readUInt16BE(18);

    const os2 = readBytes(fd, tables['OS/2'].offset, Math.min(tables['OS/2'].length, 96));
    const os2Version = os2.readUInt16BE(0);
    const winAsc = os2.readUInt16BE(74);
    const winDesc = os2.readUInt16BE(76);
    const capHeight = os2Version >= 2 && os2.length >= 90 ? os2.readInt16BE(88) : Math.round(upem * 0.7);

    const nameTable = readBytes(fd, tables.name.offset, tables.name.length);
    const count = nameTable.readUInt16BE(2);
    const stringOffset = nameTable.readUInt16BE(4);
    const names = {};
    for (let i = 0; i < count; i++) {
      const r = 6 + i * 12;
      const platformId = nameTable.readUInt16BE(r);
      const nameId = nameTable.readUInt16BE(r + 6);
      const len = nameTable.readUInt16BE(r + 8);
      const off = stringOffset + nameTable.readUInt16BE(r + 10);
      if (![1, 2, 4].includes(nameId) || names[nameId]) continue;
      if (platformId === 3) {
        const raw = nameTable.subarray(off, off + len);
        let str = '';
        for (let j = 0; j + 1 < raw.length; j += 2) str += String.fromCharCode(raw.readUInt16BE(j));
        names[nameId] = str;
      } else if (platformId === 1) {
        names[nameId] = nameTable.toString('latin1', off, off + len);
      }
    }

    if (!upem || !(winAsc + winDesc)) return null;
    return { file, upem, winAsc, winDesc, capHeight, family: names[1], subfamily: names[2], fullName: names[4] };
  } finally {
    fs.closeSync(fd);
  }
}

function buildFontIndex() {
  const index = new Map();
  for (const dir of FONT_DIRS) {
    let files = [];
    try {
      files = fs.readdirSync(dir).filter(f => /\.(ttf|otf)$/i.test(f));
    } catch {
      continue;
    }
    for (const f of files) {
      let info = null;
      try {
        info = readFontInfo(path.join(dir, f));
      } catch {
        info = null;
      }
      if (!info) continue;
      const keys = [info.fullName, `${info.family} ${info.subfamily}`];
      // El nombre de familia solo apunta a la variante regular (o a la primera que aparezca)
      if (!info.subfamily || /regular|normal/i.test(info.subfamily)) keys.unshift(info.family);
      else keys.push(info.family);
      for (const key of keys) {
        const k = normalizeName(key);
        if (k && !index.has(k)) index.set(k, info);
      }
    }
  }
  return index;
}

function resolveFont(fontName) {
  if (!fontIndex) fontIndex = buildFontIndex();
  return fontIndex.get(normalizeName(fontName)) || null;
}

/**
 * Crea un medidor de texto para una fuente y tamaño de ASS.
 * @returns {null | { widthOf(text: string): number, lineBox(centerY: number): { capTop: number, baseline: number } }}
 */
function createTextMeasurer(fontName, fontSize, letterSpacing = 0) {
  const cacheKey = `${fontName}|${fontSize}|${letterSpacing}`;
  if (measurerCache.has(cacheKey)) return measurerCache.get(cacheKey);

  let measurer = null;
  try {
    const info = resolveFont(fontName);
    if (info) {
      const { GlobalFonts, createCanvas } = require('@napi-rs/canvas');
      const alias = `AssMeasure${++aliasCounter}`;
      GlobalFonts.registerFromPath(info.file, alias);

      // libass escala la fuente para que winAscent + winDescent = Fontsize (comportamiento GDI)
      const unitScale = fontSize / (info.winAsc + info.winDesc);
      const emPx = info.upem * unitScale;
      const ctx = createCanvas(4, 4).getContext('2d');
      ctx.font = `${emPx}px ${alias}`;
      const spacing = parseFloat(letterSpacing) || 0;

      measurer = {
        widthOf: (text) => ctx.measureText(text).width + spacing * [...text].length,
        lineBox: (centerY) => {
          const baseline = centerY - fontSize / 2 + info.winAsc * unitScale;
          return { capTop: baseline - info.capHeight * unitScale, baseline };
        }
      };
    }
  } catch (err) {
    console.warn(`[TextMetrics] No se pudo medir la fuente "${fontName}":`, err.message);
    measurer = null;
  }

  measurerCache.set(cacheKey, measurer);
  return measurer;
}

/**
 * Dibujo ASS (\p1) de un rectángulo con esquinas redondeadas, en coordenadas relativas a su esquina superior izquierda.
 */
function roundedRectDrawing(width, height, radius) {
  const w = Math.round(width);
  const h = Math.round(height);
  const r = Math.round(Math.min(radius, w / 2, h / 2));
  const k = Math.round(r * 0.5523); // aproximación de arco con curva Bézier
  return [
    `m ${r} 0`,
    `l ${w - r} 0`, `b ${w - r + k} 0 ${w} ${r - k} ${w} ${r}`,
    `l ${w} ${h - r}`, `b ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h}`,
    `l ${r} ${h}`, `b ${r - k} ${h} 0 ${h - r + k} 0 ${h - r}`,
    `l 0 ${r}`, `b 0 ${r - k} ${r - k} 0 ${r} 0`
  ].join(' ');
}

module.exports = {
  createTextMeasurer,
  roundedRectDrawing
};
