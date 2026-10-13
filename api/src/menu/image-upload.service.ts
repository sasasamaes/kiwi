// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

/**
 * Subida REAL de imágenes de producto.
 *
 * - Cloudinary via CLOUDINARY_URL (cloudinary://key:secret@cloud). Gratis en el
 *   plan free, transforma/cosecha URLs https listas para <img>.
 * - Gracious degradation: sin credenciales el endpoint responde 503 con un
 *   mensaje claro en vez de 500 críptico — la app sigue funcionando con emojis.
 *
 * Validación estricta ANTES de tocar el proveedor (el binario jamás se
 * parsea como JSON — Multer usa memoryStorage y límite en bytes):
 * - Solo image/jpeg|png|webp|gif|heic. Los "magic bytes" se verifican, no se
 *   confía en el filename ni en el content-type que manda el cliente. HEIC
 *   (modo alta eficiencia de Samsung/iPhone) lo ingiere Cloudinary y el
 *   eager con fetch_format auto lo entrega como webp visible en todos lados.
 * - Máx 5 MB (límite free de Cloudinary).
 * - Extensiones: deshabilitadas — un .php renombrado a .jpg es exactamente
 *   lo que esto bloquea.
 */

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const HEIC_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
]);

const MAGIC_BYTES: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  {
    mime: 'image/png',
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d,
  },
  // WEBP: "RIFF"...."WEBP"
  {
    mime: 'image/webp',
    test: (b) =>
      b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP',
  },
  // GIF: "GIF8"
  { mime: 'image/gif', test: (b) => b.slice(0, 4).toString('ascii') === 'GIF8' },
  // HEIC/HEIF: ...."ftyp"+marca (alta eficiencia Samsung/iPhone)
  {
    mime: 'image/heic',
    test: (b) =>
      b.slice(4, 8).toString('ascii') === 'ftyp' &&
      HEIC_BRANDS.has(b.slice(8, 12).toString('ascii')),
  },
];

@Injectable()
export class ImageUploadService {
  private readonly logger = new Logger(ImageUploadService.name);
  private configured: boolean;

  constructor(private config: ConfigService) {
    const url = this.config.get<string>('CLOUDINARY_URL');
    this.configured = typeof url === 'string' && url.startsWith('cloudinary://');
    if (this.configured) {
      // cloudinary.config() parsea CLOUDINARY_URL del entorno por sí solo.
      cloudinary.config({ secure: true });
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Valida y sube. Devuelve la URL https entregable a <img>.
   * Transformación eager: cuadrado 512px cover + webp — el client pinta
   * thumbnails de 80px y el detalle de 512: una sola versión liviana sirve ambos.
   */
  async uploadProductImage(file: {
    buffer: Buffer;
    size: number;
    originalname?: string;
  }): Promise<{ url: string }> {
    return this.uploadToFolder(file, 'kiwi/products');
  }

  /**
   * Valida y sube la foto de evidencia del pedido (carpeta `kiwi/proofs`).
   * Misma validación estricta que `uploadProductImage` (magic bytes, 5MB,
   * eager 512, errores 400/503); solo cambia la carpeta de destino.
   */
  async uploadProofImage(file: {
    buffer: Buffer;
    size: number;
    originalname?: string;
  }): Promise<{ url: string }> {
    return this.uploadToFolder(file, 'kiwi/proofs');
  }

  /**
   * Valida y sube la foto de perfil del repartidor (carpeta `kiwi/drivers`).
   * Misma validación que el resto; solo cambia la carpeta de destino.
   */
  async uploadDriverPhoto(file: {
    buffer: Buffer;
    size: number;
    originalname?: string;
  }): Promise<{ url: string }> {
    return this.uploadToFolder(file, 'kiwi/drivers');
  }

  /**
   * Valida y sube el avatar del cliente (carpeta `kiwi/customers`).
   * Misma validación que el resto; solo cambia la carpeta de destino.
   */
  async uploadCustomerAvatar(file: {
    buffer: Buffer;
    size: number;
    originalname?: string;
  }): Promise<{ url: string }> {
    return this.uploadToFolder(file, 'kiwi/customers');
  }

  /**
   * Valida y sube el logo del comercio (carpeta `kiwi/merchants`).
   * Misma validación que el resto; solo cambia la carpeta de destino.
   */
  async uploadMerchantLogo(file: {
    buffer: Buffer;
    size: number;
    originalname?: string;
  }): Promise<{ url: string }> {
    return this.uploadToFolder(file, 'kiwi/merchants');
  }

  /** Núcleo compartido: validación estricta + subida a la carpeta indicada. */
  private async uploadToFolder(
    file: { buffer: Buffer; size: number; originalname?: string },
    folder: string,
  ): Promise<{ url: string }> {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Subida de imágenes no configurada. Contacta al administrador.',
      );
    }

    if (!file || !Buffer.isBuffer(file.buffer) || file.size === 0) {
      throw new BadRequestException('Archivo vacío o inválido');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException('Imagen demasiado grande (máx 5 MB)');
    }

    const sniff = Buffer.from(file.buffer.subarray(0, 12));
    const match = MAGIC_BYTES.find((m) => m.test(sniff));
    if (!match) {
      throw new BadRequestException('Formato no soportado. Usa JPG, PNG, WEBP, GIF o HEIC.');
    }

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'image',
            // Eager: thumbnail webp 512×512 cover. Sirve listas y detalle.
            eager: [
              { width: 512, height: 512, crop: 'fill', fetch_format: 'auto', quality: 'auto' },
            ],
            eager_async: false,
          },
          (error, res) =>
            error || !res ? reject(error ?? new Error('no response')) : resolve(res),
        );
        stream.end(file.buffer);
      });

      // eager[0].secure_url ya trae /c_fill,w_512,h_512/ en la URL.
      const url = result.eager?.[0]?.secure_url || result.secure_url;
      if (!url || !url.startsWith('https://')) {
        throw new Error('Cloudinary devolvió una URL inesperada');
      }
      return { url };
    } catch (err: any) {
      // Errores de validación que levantamos arriba NO se tragan: ya son 4xx.
      if (err?.status && err.status >= 400 && err.status < 500) throw err;
      this.logger.error(`Cloudinary upload falló: ${err?.message ?? err}`);
      throw new ServiceUnavailableException('No se pudo subir la imagen. Intenta de nuevo.');
    }
  }
}
