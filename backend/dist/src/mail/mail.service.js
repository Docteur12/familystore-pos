"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = require("nodemailer");
let MailService = MailService_1 = class MailService {
    constructor() {
        this.logger = new common_1.Logger(MailService_1.name);
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
    async sendStockAlert(productName, currentStock, alertThreshold) {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            this.logger.warn(`[MailAlert] EMAIL_USER/EMAIL_PASS non configurés — alerte ignorée pour "${productName}"`);
            return;
        }
        const subject = `⚠️ Alerte stock — ${productName}`;
        const recipient = process.env.EMAIL_ALERT_TO ?? process.env.EMAIL_USER;
        await this.transporter.sendMail({
            from: `"Family Store POS" <${process.env.EMAIL_USER}>`,
            to: recipient,
            subject,
            html: this.buildAlertHtml(productName, currentStock, alertThreshold),
            text: this.buildAlertText(productName, currentStock, alertThreshold),
        });
        this.logger.log(`[MailAlert] Email envoyé → ${recipient} | "${productName}" stock: ${currentStock}`);
    }
    buildAlertText(name, stock, threshold) {
        return [
            `⚠️ ALERTE STOCK — Family Store POS`,
            ``,
            `Produit        : ${name}`,
            `Stock restant  : ${stock} unité(s)`,
            `Seuil d'alerte : ${threshold} unité(s)`,
            ``,
            `Veuillez réapprovisionner ce produit dès que possible.`,
            ``,
            `— Family Store POS`,
        ].join('\n');
    }
    buildAlertHtml(name, stock, threshold) {
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
                Family Store POS &mdash; Alerte automatique
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
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MailService);
//# sourceMappingURL=mail.service.js.map