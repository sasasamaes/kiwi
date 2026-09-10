import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SMSPayload {
  to: string;
  message: string;
}

@Injectable()
export class EmailSmsService {
  private readonly logger = new Logger(EmailSmsService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // 📧 EMAIL NOTIFICATIONS
  // ============================================

  async sendEmail(payload: EmailPayload): Promise<boolean> {
    try {
      // In production, integrate with:
      // - SendGrid: @sendgrid/mail
      // - Mailgun: mailgun.js
      // - AWS SES: @aws-sdk/client-ses
      // - Resend: resend

      this.logger.log(`📧 Email sent to ${payload.to}: ${payload.subject}`);

      // TODO: Replace with real email provider
      // await this.sendGrid.send({
      //   to: payload.to,
      //   from: 'noreply@kiwi.app',
      //   subject: payload.subject,
      //   html: payload.html,
      //   text: payload.text,
      // });

      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${payload.to}:`, error);
      return false;
    }
  }

  // ============================================
  // 📱 SMS NOTIFICATIONS
  // ============================================

  async sendSMS(payload: SMSPayload): Promise<boolean> {
    try {
      // In production, integrate with:
      // - Twilio: twilio
      // - MessageBird
      // - Vonage: @vonage/server-sdk

      this.logger.log(`📱 SMS sent to ${payload.to}: ${payload.message.substring(0, 50)}...`);

      // TODO: Replace with real SMS provider
      // await this.twilio.messages.create({
      //   body: payload.message,
      //   from: '+506XXXXXXXX',
      //   to: payload.to,
      // });

      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${payload.to}:`, error);
      return false;
    }
  }

  // ============================================
  // 📋 ORDER NOTIFICATION TEMPLATES
  // ============================================

  async sendOrderConfirmation(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        merchant: { include: { user: true } },
        driver: { include: { user: true } },
        items: true,
      },
    });

    if (!order) return;

    // Email to merchant
    if (order.merchant?.user?.email) {
      await this.sendEmail({
        to: order.merchant.user.email,
        subject: `✅ Pedido #${orderId.slice(0, 8)} confirmado`,
        html: this.getOrderConfirmationHTML(order, 'merchant'),
      });
    }

    // SMS to merchant
    if (order.merchant?.user?.phone) {
      await this.sendSMS({
        to: order.merchant.user.phone,
        message: `Kiwi: Pedido #${orderId.slice(0, 8)} confirmado. ${order.items.length} productos.`,
      });
    }
  }

  async sendDriverAssigned(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        merchant: { include: { user: true } },
        driver: { include: { user: true } },
      },
    });

    if (!order?.driver?.user) return;

    // SMS to driver
    if (order.driver.user.phone) {
      await this.sendSMS({
        to: order.driver.user.phone,
        message: `Kiwi: Nuevo pedido asignado. Recoger en ${order.pickupAddress.substring(0, 30)}.`,
      });
    }
  }

  async sendOrderDelivered(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        merchant: { include: { user: true } },
        driver: { include: { user: true } },
        items: true,
      },
    });

    if (!order) return;

    // Email to merchant
    if (order.merchant?.user?.email) {
      await this.sendEmail({
        to: order.merchant.user.email,
        subject: `🎉 Pedido #${orderId.slice(0, 8)} entregado`,
        html: this.getOrderDeliveredHTML(order),
      });
    }
  }

  async sendPaymentReceived(orderId: string, amount: number, method: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        merchant: { include: { user: true } },
      },
    });

    if (!order?.merchant?.user?.email) return;

    await this.sendEmail({
      to: order.merchant.user.email,
      subject: `💰 Pago de ₡${amount.toLocaleString()} recibido`,
      html: this.getPaymentReceivedHTML(order, amount, method),
    });
  }

  async sendWithdrawalCompleted(driverUserId: string, amount: number, method: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
      include: { user: true },
    });

    if (!driver?.user?.phone) return;

    await this.sendSMS({
      to: driver.user.phone,
      message: `Kiwi: Retiro de ₡${amount.toLocaleString()} completado vía ${method}.`,
    });
  }

  // ============================================
  // 📝 HTML TEMPLATES
  // ============================================

  private getOrderConfirmationHTML(order: any, role: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; }
          .logo { font-size: 48px; margin-bottom: 10px; }
          .title { color: white; font-size: 24px; font-weight: 700; margin: 0; }
          .content { padding: 30px; }
          .order-info { background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0; }
          .order-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .order-row:last-child { border-bottom: none; }
          .label { color: #6b7280; }
          .value { font-weight: 600; color: #111827; }
          .total { font-size: 20px; color: #22c55e; }
          .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🥝</div>
            <h1 class="title">Pedido Confirmado</h1>
          </div>
          <div class="content">
            <p>Hola ${role === 'merchant' ? order.merchant?.businessName : 'Repartidor'},</p>
            <p>Tu pedido ha sido confirmado exitosamente.</p>
            
            <div class="order-info">
              <div class="order-row">
                <span class="label">Pedido</span>
                <span class="value">#${order.id.slice(0, 8)}</span>
              </div>
              <div class="order-row">
                <span class="label">Estado</span>
                <span class="value">✅ Confirmado</span>
              </div>
              <div class="order-row">
                <span class="label">Productos</span>
                <span class="value">${order.items.length} items</span>
              </div>
              <div class="order-row">
                <span class="label">Total</span>
                <span class="value total">₡${Number(order.totalAmount).toLocaleString()}</span>
              </div>
            </div>
            
            <p>Puedes rastrear tu pedido en la app Kiwi.</p>
          </div>
          <div class="footer">
            <p>🥝 Kiwi - Tu app de delivery en Nicoya</p>
            <p>Este es un correo automático, no respondas a este mensaje.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getOrderDeliveredHTML(order: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; }
          .logo { font-size: 48px; margin-bottom: 10px; }
          .title { color: white; font-size: 24px; font-weight: 700; margin: 0; }
          .content { padding: 30px; text-align: center; }
          .success-icon { font-size: 64px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🥝</div>
            <h1 class="title">Pedido Entregado</h1>
          </div>
          <div class="content">
            <div class="success-icon">🎉</div>
            <h2>¡Pedido entregado!</h2>
            <p>Tu pedido #${order.id.slice(0, 8)} fue entregado exitosamente.</p>
            <p>Gracias por usar Kiwi. ¿Te gustó el servicio? Califícalo en la app.</p>
          </div>
          <div class="footer">
            <p>🥝 Kiwi - Tu app de delivery en Nicoya</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPaymentReceivedHTML(order: any, amount: number, method: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; }
          .logo { font-size: 48px; margin-bottom: 10px; }
          .title { color: white; font-size: 24px; font-weight: 700; margin: 0; }
          .content { padding: 30px; text-align: center; }
          .amount { font-size: 36px; color: #22c55e; font-weight: 800; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🥝</div>
            <h1 class="title">Pago Recibido</h1>
          </div>
          <div class="content">
            <p>💰 Has recibido un pago</p>
            <div class="amount">₡${amount.toLocaleString()}</div>
            <p>Pedido: #${order.id.slice(0, 8)}</p>
            <p>Método: ${method}</p>
          </div>
          <div class="footer">
            <p>🥝 Kiwi - Tu app de delivery en Nicoya</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
