import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendVerificationCode(email: string, code: string) {
    await this.resend.emails.send({
      from: process.env.MAIL_FROM!,
      to: email,
      subject: 'Código de verificación - BuyMarket',
      html: `
        <h2>Verificá tu email</h2>
        <p>Tu código de verificación es:</p>
        <h1>${code}</h1>
        <p>Este código vence en 10 minutos.</p>
      `,
    });
  }
}