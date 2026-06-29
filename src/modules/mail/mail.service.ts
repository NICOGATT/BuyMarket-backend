import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  async sendVerificationCode(email: string, code: string) {
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM,
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