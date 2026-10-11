// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OnvoPayProvider } from '../providers/onvopay.provider';

@Injectable()
export class MarketplaceService {
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
    if (!merchant?.onvoConnectedAccountId) throw new BadRequestException('Sin cuenta conectada');
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
    return this.onvo.listSellerIntents(merchant.onvoConnectedAccountId);
  }
}
