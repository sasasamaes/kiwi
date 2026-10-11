// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OnvoPayProvider } from '../providers/onvopay.provider';

@Injectable()
export class DriverMarketplaceService {
  constructor(
    private prisma: PrismaService,
    private onvo: OnvoPayProvider,
  ) {}

  async startOnboarding(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Repartidor no encontrado');
    if (driver.onvoConnectedAccountId) return this.refreshStatus(driverId);
    const fee = Number(process.env.MARKETPLACE_DRIVER_FEE ?? 15);
    const acc = await this.onvo.createConnectedAccount(driver.fullName, fee);
    if (!acc.id) throw new BadRequestException(acc.error ?? 'No se pudo crear la cuenta');
    await this.prisma.driverProfile.update({
      where: { id: driverId },
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

  async refreshStatus(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver?.onvoConnectedAccountId) throw new BadRequestException('Sin cuenta conectada');
    const acc = await this.onvo.getConnectedAccount(driver.onvoConnectedAccountId);
    await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { onvoOnboardingStatus: acc.status },
    });
    return { accountId: driver.onvoConnectedAccountId, status: acc.status };
  }

  async regenerateLink(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver?.onvoConnectedAccountId) return this.startOnboarding(driverId);
    const link = await this.onvo.regenerateOnboardingLink(driver.onvoConnectedAccountId);
    if (link.error === 'already_completed') return this.refreshStatus(driverId);
    if (link.error) throw new BadRequestException(link.error);
    return { accountId: driver.onvoConnectedAccountId, onboardingUrl: link.onboardingUrl };
  }

  async sellerIntents(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver?.onvoConnectedAccountId) throw new BadRequestException('Sin cuenta conectada');
    return this.onvo.listSellerIntents(driver.onvoConnectedAccountId);
  }
}
