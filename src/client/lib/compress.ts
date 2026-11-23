export type CompressedImage = {
  blob: Blob;
  dataUrl: string;
  base64: string;
  mimeType: 'image/jpeg';
};

type CompressOptions = {
  maxEdge?: number;
  quality?: number;
  maxBytes?: number;
};

type Raster = ImageBitmap | HTMLImageElement;

export async function compressImage(file: Blob, options: CompressOptions = {}): Promise<CompressedImage> {
  const maxEdge = options.maxEdge ?? 2048;
  const quality = options.quality ?? 0.9;
  const maxBytes = options.maxBytes ?? 3_500_000;
  const source = await loadSource(file);
  try {
    const passes = compressionPasses(maxEdge, quality);
    let blob = await render(source, passes[0][0], passes[0][1]);
    for (const [edge, nextQuality] of passes.slice(1)) {
      if (blob.size <= maxBytes) break;
      blob = await render(source, edge, nextQuality);
    }
    const dataUrl = await blobToDataUrl(blob);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return { blob, dataUrl, base64, mimeType: 'image/jpeg' };
  } finally {
    if ('close' in source) source.close();
  }
}

async function loadSource(file: Blob): Promise<Raster> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Some phone formats fail here and still decode via an Image element.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not read that photo. Try a JPEG or PNG.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function compressionPasses(maxEdge: number, quality: number): Array<[number, number]> {
  const steps: Array<[number, number]> = [
    [maxEdge, quality],
    [maxEdge, Math.min(quality, 0.82)],
    [Math.min(maxEdge, 1600), Math.min(quality, 0.8)],
    [Math.min(maxEdge, 1280), Math.min(quality, 0.72)],
    [Math.min(maxEdge, 960), Math.min(quality, 0.64)],
    [Math.min(maxEdge, 720), Math.min(quality, 0.52)],
  ];
  return steps.filter((step, index) => index === 0 || step[0] !== steps[index - 1][0] || step[1] !== steps[index - 1][1]);
}

function render(source: Raster, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Could not prepare that photo.'));
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not compress that photo.'))),
      'image/jpeg',
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the compressed photo.'));
    reader.readAsDataURL(blob);
  });
}
