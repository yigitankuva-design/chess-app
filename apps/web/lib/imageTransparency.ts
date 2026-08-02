/** Canvas ImageData ile aynı şekle sahip, DOM'a bağımlı olmayan tip —
 *  jsdom/happy-dom gerçek ImageData sınıfını desteklemediği için testte
 *  düz obje verilebilsin diye ayrı tanımlandı. */
export interface RawImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function isNearWhite(r: number, g: number, b: number, threshold: number): boolean {
  return r >= threshold && g >= threshold && b >= threshold;
}

/**
 * Görselin KENARLARINDAN başlayıp bitişik beyaza-yakın pikselleri şeffaf yapar
 * (BFS flood-fill). Görselin İÇİNDEKİ beyaz alanlar (dıştan ulaşılamayan,
 * örn. bir gözün beyazı) etkilenmez — sadece zeminle bağlantılı bölge silinir.
 * `imageData` YERİNDE (in-place) değiştirilir.
 */
export function floodFillTransparent(imageData: RawImageData, threshold: number): void {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  function enqueue(x: number, y: number) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    const p = idx * 4;
    if (isNearWhite(data[p], data[p + 1], data[p + 2], threshold)) {
      queue.push(idx);
    }
  }

  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y); }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    const p = idx * 4;
    data[p + 3] = 0;
    const x = idx % width;
    const y = Math.floor(idx / width);
    enqueue(x + 1, y); enqueue(x - 1, y); enqueue(x, y + 1); enqueue(x, y - 1);
  }
}

/** İki rengin kanal-bazlı en büyük farkı (0-255). Basit ve hızlı. */
function colorDistance(
  r: number, g: number, b: number,
  br: number, bg: number, bb: number,
): number {
  return Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(b - bb));
}

/**
 * KÖŞE RENGİNİ örnekleyip ona `tolerance` mesafesindeki bitişik pikselleri
 * kenardan başlayarak şeffaf yapar. Eski `floodFillTransparent` yalnız SAF
 * beyazı (>=245) siliyordu; açık gri / hafif renkli zeminlerde HİÇBİR ŞEY
 * silmiyordu (kullanıcı şikayeti). Bu sürüm zemin rengini görselden okur.
 * `imageData` YERİNDE değiştirilir.
 */
export function removeBackground(imageData: RawImageData, tolerance = 40): void {
  const { width, height, data } = imageData;
  // Dört köşenin ortalaması = zemin rengi.
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];
  let br = 0, bg = 0, bb = 0;
  for (const c of corners) { br += data[c]; bg += data[c + 1]; bb += data[c + 2]; }
  br = Math.round(br / 4); bg = Math.round(bg / 4); bb = Math.round(bb / 4);

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  function enqueue(x: number, y: number) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    const p = idx * 4;
    if (colorDistance(data[p], data[p + 1], data[p + 2], br, bg, bb) <= tolerance) {
      queue.push(idx);
    }
  }

  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y); }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    data[idx * 4 + 3] = 0;
    const x = idx % width;
    const y = Math.floor(idx / width);
    enqueue(x + 1, y); enqueue(x - 1, y); enqueue(x, y + 1); enqueue(x, y - 1);
  }
}

/** Bir data-URI görselini canvas'a çizip şeffaflaştırıp yeni bir PNG
 *  data-URI olarak döner. Tarayıcı-taraflı — sunucu gerekmez. */
export async function makeBackgroundTransparent(dataUri: string, tolerance = 40): Promise<string> {
  const img = await loadImage(dataUri);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas desteklenmiyor');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  removeBackground(imageData, tolerance);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function loadImage(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel okunamadı'));
    img.src = dataUri;
  });
}
