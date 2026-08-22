import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings, SettingsDocument } from '../settings/settings.schema';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(@InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // Nom d'application affiché dans les e-mails : « <nom du magasin> POS ».
  private async appName(): Promise<string> {
    try {
      const s = await this.settingsModel.findOne().lean();
      return `${((s as any)?.nomMagasin || 'Family Store').trim()} POS`;
    } catch { return 'Family Store POS'; }
  }

  /**
   * Relance d'échéance de licence.
   *
   * Le bandeau dans l'application suppose que le commerçant l'ouvre : un
   * patron qui ne se connecte qu'une fois par semaine découvrirait
   * l'expiration le jour même. Cet e-mail est le dernier maillon du préavis.
   *
   * Renvoie `false` si l'envoi n'a pas eu lieu (messagerie non configurée,
   * panne) : l'appelant ne doit alors PAS marquer la relance comme envoyée,
   * sinon le rappel serait perdu pour de bon.
   */
  async envoyerRelanceLicence(params: {
    destinataire: string;
    nomBoutique: string;
    joursRestants: number;
    dateEcheance: Date;
    montant: number;
    devise: string;
  }): Promise<boolean> {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      this.logger.warn(`[Licence] messagerie non configurée — relance non envoyée pour ${params.nomBoutique}`);
      return false;
    }

    const app = await this.appName();
    const echeance = params.dateEcheance.toLocaleDateString('fr-FR');
    const montant = `${params.montant.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} ${params.devise}`;
    const quand = params.joursRestants <= 1
      ? "demain"
      : `dans ${params.joursRestants} jours`;

    try {
      await this.transporter.sendMail({
        from: `"${app}" <${process.env.EMAIL_USER}>`,
        to: params.destinataire,
        subject: `Licence ${params.nomBoutique} — échéance ${quand} (${echeance})`,
        text: [
          `La licence de la boutique « ${params.nomBoutique} » arrive à échéance ${quand}, le ${echeance}.`,
          '',
          `Renouvellement : ${montant} par an.`,
          '',
          "Passé l'échéance, la boutique reste consultable et vos états restent exportables :",
          "seules les nouvelles saisies (ventes, produits, stock) sont suspendues jusqu'au règlement.",
          '',
          `— ${app}`,
        ].join('\n'),
      });
      this.logger.log(`[Licence] relance J-${params.joursRestants} envoyée à ${params.destinataire} (${params.nomBoutique})`);
      return true;
    } catch (err) {
      this.logger.error(`[Licence] échec d'envoi pour ${params.nomBoutique} : ${(err as Error).message}`);
      return false;
    }
  }

  async sendStockAlert(
    productName: string,
    currentStock: number,
    alertThreshold: number,
  ): Promise<void> {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      this.logger.warn(`[MailAlert] EMAIL_USER/EMAIL_PASS non configurés — alerte ignorée pour "${productName}"`);
      return;
    }

    const subject = `⚠️ Alerte stock — ${productName}`;
    const recipient = process.env.EMAIL_ALERT_TO ?? process.env.EMAIL_USER;
    const app = await this.appName();

    await this.transporter.sendMail({
      from: `"${app}" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject,
      html: this.buildAlertHtml(productName, currentStock, alertThreshold, app),
      text: this.buildAlertText(productName, currentStock, alertThreshold, app),
    });

    this.logger.log(`[MailAlert] Email envoyé → ${recipient} | "${productName}" stock: ${currentStock}`);
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  private buildAlertText(name: string, stock: number, threshold: number, app: string): string {
    return [
      `⚠️ ALERTE STOCK — ${app}`,
      ``,
      `Produit        : ${name}`,
      `Stock restant  : ${stock} unité(s)`,
      `Seuil d'alerte : ${threshold} unité(s)`,
      ``,
      `Veuillez réapprovisionner ce produit dès que possible.`,
      ``,
      `— ${app}`,
    ].join('\n');
  }

  private buildAlertHtml(name: string, stock: number, threshold: number, app: string): string {
    const critical = stock === 0;
    const stockColor = critical ? '#dc2626' : '#d97706';
    const badge = critical ? 'RUPTURE DE STOCK' : 'STOCK BAS';
    const badgeBg = critical ? '#fee2e2' : '#fef3c7';
    const badgeColor = critical ? '#991b1b' : '#92400e';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alerte stock — ${name}</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:Arial,Helvetica,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:12px;overflow:hidden;
                 box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header bordeaux -->
          <tr>
            <td style="background:#8B1A2B;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:3px;">FAMILY</span>
                    <span style="color:#C9A84C;font-size:20px;font-weight:900;letter-spacing:3px;"> STORE</span>
                    <span style="color:rgba(255,255,255,0.6);font-size:13px;font-weight:400;
                                 margin-left:12px;padding-left:12px;
                                 border-left:1px solid rgba(255,255,255,0.3);">
                      Point de Vente
                    </span>
                  </td>
                  <td align="right">
                    <span style="background:${badgeBg};color:${badgeColor};
                                 font-size:11px;font-weight:700;padding:4px 10px;
                                 border-radius:20px;letter-spacing:1px;">
                      ${badge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Gold separator -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#8B1A2B,#C9A84C,#8B1A2B);"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">

              <!-- Icon + title -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="font-size:36px;padding-right:16px;vertical-align:middle;">⚠️</td>
                  <td style="vertical-align:middle;">
                    <h1 style="margin:0;font-size:20px;color:#1a1a1a;font-weight:700;">
                      Alerte stock
                    </h1>
                    <p style="margin:4px 0 0;color:#6b7280;font-size:14px;">
                      Un produit a atteint son seuil critique
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Product card -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#F5F0E8;border-radius:10px;border-left:4px solid ${stockColor};
                       margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;
                               text-transform:uppercase;letter-spacing:1px;">Produit</p>
                    <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1a1a1a;">
                      ${name}
                    </p>

                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:32px;">
                          <p style="margin:0 0 2px;font-size:11px;color:#9ca3af;
                                     text-transform:uppercase;letter-spacing:1px;">Stock restant</p>
                          <p style="margin:0;font-size:28px;font-weight:900;color:${stockColor};">
                            ${stock}
                          </p>
                          <p style="margin:2px 0 0;font-size:11px;color:#9ca3af;">unité(s)</p>
                        </td>
                        <td>
                          <p style="margin:0 0 2px;font-size:11px;color:#9ca3af;
                                     text-transform:uppercase;letter-spacing:1px;">Seuil d'alerte</p>
                          <p style="margin:0;font-size:28px;font-weight:900;color:#6b7280;">
                            ${threshold}
                          </p>
                          <p style="margin:2px 0 0;font-size:11px;color:#9ca3af;">unité(s)</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <p style="margin:0;padding:16px 20px;background:#fff8ec;border-radius:8px;
                         font-size:14px;color:#92400e;border:1px solid #fde68a;">
                Veuillez réapprovisionner ce produit dès que possible pour éviter
                une rupture de stock.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #f3f4f6;
                       padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                ${app} &mdash; Alerte automatique
                &mdash; ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
  }
}
