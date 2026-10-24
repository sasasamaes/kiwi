// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * Fotos de cámara/galería vienen de 3–12 MB y el backend corta en 5 MB
 * (además de que en datos móviles una subida así supera el timeout).
 * Se achican en el navegador (máx 1024px, JPEG 0.82) antes de subir.
 * Si el navegador no puede decodificarla (ej. HEIC viejo), se devuelve la
 * original y decide el backend. Nunca revienta: ante cualquier fallo
 * devuelve el archivo original.
 */
export function downscalePhoto(file: File): Promise<File> {
  if (!(file instanceof Blob) || file.size <= 1024 * 1024) return Promise.resolve(file);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvasEl = document.createElement('canvas');
        canvasEl.width = w;
        canvasEl.height = h;
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, w, h);
        canvasEl.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            resolve(
              new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
                type: 'image/jpeg',
              }),
            );
          },
          'image/jpeg',
          0.82,
        );
      } catch {
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}
