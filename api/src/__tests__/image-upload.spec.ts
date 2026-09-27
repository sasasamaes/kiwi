// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ImageUploadService } from '../menu/image-upload.service';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Validación de la subida de imágenes SIN red: las reglas de aceptación
 * (configuración, magic bytes, tamaño) corren antes de tocar Cloudinary.
 * El path feliz real se verifica manualmente contra la API con credenciales.
 */
describe('ImageUploadService', () => {
  const build = async (cloudinaryUrl?: string) => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImageUploadService,
        {
          provide: ConfigService,
          useValue: { get: (k: string) => (k === 'CLOUDINARY_URL' ? cloudinaryUrl : undefined) },
        },
      ],
    }).compile();
    return moduleRef.get(ImageUploadService);
  };

  it('sin CLOUDINARY_URL responde 503 y reporta isConfigured=false', async () => {
    const svc = await build(undefined);
    expect(svc.isConfigured()).toBe(false);
    await expect(
      svc.uploadProductImage({ buffer: Buffer.from('x'), size: 1 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('configurado + archivo vacío → 400', async () => {
    const svc = await build('cloudinary://k:s@c');
    await expect(
      svc.uploadProductImage({ buffer: Buffer.alloc(0), size: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('configurado + magic bytes inválidos → 400 (no confía en filename)', async () => {
    const svc = await build('cloudinary://k:s@c');
    const fake = Buffer.concat([Buffer.from('<?php echo "shell"; ?>'), Buffer.alloc(1024, 0x41)]);
    await expect(
      svc.uploadProductImage({ buffer: fake, size: fake.length, originalname: 'foto.jpg' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('configurado + >5MB → 413', async () => {
    const svc = await build('cloudinary://k:s@c');
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0xff);
    await expect(svc.uploadProductImage({ buffer: big, size: big.length })).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('acepta PNG real por magic bytes (llega al proveedor; sin red falla como 503, no 400)', async () => {
    const svc = await build('cloudinary://k:s@c');
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(2048, 0x00),
    ]);
    // Mock del stream de Cloudinary para no depender de red: responde error
    // genérico; lo importante es que NO sea BadRequest (pasó la validación).
    jest.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation(((
      _options: any,
      cb: (e: any) => void,
    ) => {
      setImmediate(() => cb(new Error('network disabled in test')));
      return { end: () => {} } as any;
    }) as any);
    await expect(svc.uploadProductImage({ buffer: png, size: png.length })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    jest.restoreAllMocks();
  });
});
