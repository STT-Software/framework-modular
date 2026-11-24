/**
 * Client-side image optimization utility.
 * Resizes large images to a bounding box and converts them to WebP (with PNG fallback)
 * to minimize payload transfer over the network and reduce database storage in MongoDB.
 */
export interface ImageOptimizationOptions {
  maxSide?: number;
  quality?: number;
}

export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {},
): Promise<File> {
  const { maxSide = 256, quality = 0.85 } = options;

  // SVGs and environments without createImageBitmap are left as-is
  if (file.type === "image/svg+xml" || typeof createImageBitmap !== "function") {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const blob = await drawToBlob(bitmap, width, height, quality);
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? "webp" : "png";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.${ext}`, { type: blob.type });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

async function drawToBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  const encode = async (type: string): Promise<Blob | null> => {
    if (typeof OffscreenCanvas === "function") {
      const canvas = new OffscreenCanvas(width, height);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
      return canvas.convertToBlob({ type, quality });
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  };

  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  return encode("image/png");
}
