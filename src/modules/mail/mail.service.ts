import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendVerificationCode(email: string, code: string) {
    const {data, error} = await this.resend.emails.send({
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
    if (error) {
      console.error('ERROR RESEND: ', JSON.stringify(error, null, 2));
      throw new Error(error.message || 'No se pudo enviar el email');
    }

    console.log('MAIL ENVIADO:', data);
    return data;
  }

  async sendPasswordResetEmail(email: string, resetLink: string) {
    const {data, error} = await this.resend.emails.send({
      from: process.env.MAIL_FROM!,
      to: email,
      subject: 'Recuperá tu contraseña - BuyMarket',
      html: `
        <h2>Recuperá tu contraseña</h2>
        <p>Hacé click en el siguiente botón para elegir una nueva contraseña:</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">
            Restablecer contraseña
          </a>
        </p>
        <p>Si el botón no funciona, copiá y pegá este enlace en tu navegador:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Este enlace vence en 1 hora. Si no solicitaste este cambio, podés ignorar este email.</p>
      `,
    });
    if (error) {
      console.error('ERROR RESEND: ', JSON.stringify(error, null, 2));
      throw new Error(error.message || 'No se pudo enviar el email');
    }

    console.log('MAIL ENVIADO:', data);
    return data;
  }
}