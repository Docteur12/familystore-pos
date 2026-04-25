export declare class MailService {
    private readonly logger;
    private transporter;
    constructor();
    sendStockAlert(productName: string, currentStock: number, alertThreshold: number): Promise<void>;
    private buildAlertText;
    private buildAlertHtml;
}
