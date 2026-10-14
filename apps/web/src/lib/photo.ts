/**
 * Converte uma foto em data URL JPEG comprimida para caber no sync
 * offline-first (mesmo payload da transação). Reduz para no máximo `maxSize`
 * px no maior lado e recompressa mais forte se ainda ficar pesada.
 */
export async function compressImageFile(
  file: File,
  maxSize = 1000,
  quality = 0.6,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível neste dispositivo.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  if (dataUrl.length > 350_000) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.4);
  }
  return dataUrl;
}

export function dataUrlSizeLabel(dataUrl: string | null | undefined): string {
  if (!dataUrl) return "";
  const base64 = dataUrl.split(",")[1] ?? "";
  const bytes = Math.round((base64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}
