import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface ReservationConfirmationData {
  to: string;
  customerName: string;
  serviceName: string;
  slotStart: Date;
  slotEnd: Date;
  timezone: string;
  reservationId: number;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP not configured — email sending disabled');
    }
  }

  async sendReservationConfirmation(data: ReservationConfirmationData): Promise<void> {
    if (!this.transporter) return;

    const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
    const tz = data.timezone;

    const fmtDate = (d: Date) =>
      d.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz });
    const fmtTime = (d: Date) =>
      d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: tz });

    const dateStr = fmtDate(data.slotStart);
    const timeStr = `${fmtTime(data.slotStart)} – ${fmtTime(data.slotEnd)}`;

    try {
      await this.transporter.sendMail({
        from: `"campus reservas" <${from}>`,
        to: data.to,
        subject: `Reserva confirmada: ${data.serviceName}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
            <h2 style="color:#2563eb;margin-bottom:4px">¡Reserva confirmada!</h2>
            <p style="margin-top:0;color:#555">Hola ${data.customerName}, tu reserva ha sido registrada exitosamente.</p>
            <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:16px 0">
              <p style="margin:0 0 8px 0"><strong>${data.serviceName}</strong></p>
              <p style="margin:0 0 4px 0;color:#374151">${dateStr}</p>
              <p style="margin:0;color:#374151">${timeStr}</p>
            </div>
            <p style="color:#6b7280;font-size:13px">Reserva #${data.reservationId}</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
            <p style="color:#9ca3af;font-size:12px">campus · Portal de Reservas</p>
          </div>
        `,
      });
      this.logger.log(`Confirmation email sent to ${data.to} for reservation #${data.reservationId}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${data.to}: ${(err as Error).message}`);
    }
  }
}
