// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OnvoPayProvider } from '../providers/onvopay.provider';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private prisma: PrismaService,
    private onvo: OnvoPayProvider,
  ) {}

  async startOnboarding(merchantId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundException('Comercio no encontrado');
    if (merchant.onvoConnectedAccountId) return this.refreshStatus(merchantId);
    const fee = Number(process.env.MARKETPLACE_APP_FEE ?? 5);
    const acc = await this.onvo.createConnectedAccount(merchant.businessName, fee);
    if (!acc.id) throw new BadRequestException(acc.error ?? 'No se pudo crear la cuenta');
    await this.prisma.merchantProfile.update({
      where: { id: merchantId },
      data: {
        onvoConnectedAccountId: acc.id,
        onvoOnboardingStatus: acc.status ?? 'pending_onboarding',
      },
    });
    return {
      accountId: acc.id,
      status: acc.status ?? 'pending_onboarding',
      onboardingUrl: acc.onboardingUrl,
    };
  }

  async refreshStatus(merchantId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id: merchantId } });
    // Sin cuenta conectada no es un error: el cliente tipa
    // getMarketplaceStatus() como { accountId|null, status|null }.
    if (!merchant?.onvoConnectedAccountId) return { accountId: null, status: null };
    const acc = await this.onvo.getConnectedAccount(merchant.onvoConnectedAccountId);
    const data: any = { onvoOnboardingStatus: acc.status };
    if (acc.status === 'active') data.cardPaymentsEnabled = true;
    await this.prisma.merchantProfile.update({ where: { id: merchantId }, data });
    return { accountId: merchant.onvoConnectedAccountId, status: acc.status };
  }

  async regenerateLink(merchantId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id: merchantId } });
    if (!merchant?.onvoConnectedAccountId) return this.startOnboarding(merchantId);
    const link = await this.onvo.regenerateOnboardingLink(merchant.onvoConnectedAccountId);
    if (link.error === 'already_completed') return this.refreshStatus(merchantId);
    if (link.error) throw new BadRequestException(link.error);
    return { accountId: merchant.onvoConnectedAccountId, onboardingUrl: link.onboardingUrl };
  }

  async sellerIntents(merchantId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id: merchantId } });
    if (!merchant?.onvoConnectedAccountId) throw new BadRequestException('Sin cuenta conectada');
    // Listado best-effort: si Onvo falla, [] en vez de 500 (igual que drivers).
    try {
      return await this.onvo.listSellerIntents(merchant.onvoConnectedAccountId);
    } catch (error) {
      this.logger.warn(
        `listSellerIntents(${merchantId}) falló: ${String((error as any)?.message ?? error)}`,
      );
      return [];
    }
  }
}
