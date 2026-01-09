import * as soap from 'soap';
import { getWsdlUrl, getBarobillAuth } from '../config/barobill';

/**
 * Barobill Kakao Service
 * Handles interaction with Barobill's KAKAOTALK.asmx SOAP API
 */
export class BarobillKakaoService {
    private client: any = null;

    /**
     * Initialize SOAP client
     */
    private async getClient() {
        if (this.client) return this.client;

        const wsdlUrl = getWsdlUrl('kakao');
        try {
            this.client = await soap.createClientAsync(wsdlUrl);
            return this.client;
        } catch (error) {
            console.error('[BarobillKakao] Failed to create SOAP client:', error);
            throw new Error('Barobill SOAP Client Initialization Failed');
        }
    }

    /**
     * Send AlimTalk (Notification)
     * Uses 'SendHTalk' method
     */
    async sendAlimTalk(
        to: string,         // Receiver Phone (Hyphens allowed)
        templateCode: string, // Approved Template Code
        content: string,    // Message Content (Must match template)
        refNum: string = '' // Optional Reference Number
    ): Promise<{ success: boolean; receiptNum?: string; message: string }> {
        const client = await this.getClient();
        const auth = getBarobillAuth();
        const sendKey = refNum || `KAKAO-${Date.now()}`;

        // Prepare SOAP Payload for SendHTalk
        const payload = {
            CERTKEY: auth.certKey,
            CorpNum: auth.corpNum,
            ID: auth.id,
            PWD: auth.pwd,
            MgtKey: sendKey,          // Management Key (Unique per message)
            ToCorpNum: '',            // Optional: Receiver Corp Num
            ToName: '',               // Optional: Receiver Name
            ToHP: to.replace(/-/g, ''), // Receiver Phone (No hyphens generally preferred)
            Txt: content,             // Message Text
            TemplateCode: templateCode, // Barobill Template Code
            SenderID: '',             // Optional: Sender ID (if registered)
            SendTime: '',             // Empty for immediate send
        };

        try {
            // SendHTalk (AlimTalk)
            // Response format usually: [resultCode]
            const [result] = await client.SendHTalkAsync(payload);
            const resultCode = parseInt(result.SendHTalkResult, 10);

            if (resultCode > 0) {
                // Positive result code is usually the Receipt Number/Success indicator in some Barobill methods,
                // BUT for SendHTalk, 1 means Success often, or it returns a receipt string.
                // In Barobill, typical success is 1. If it returns a long string, it might be a receipt ID.
                // Checking docs: SendHTalk returns 1 (Success) or Error Code.
                // Wait, some methods return ReceiptNum. Let's assume positive = success.
                return {
                    success: true,
                    receiptNum: String(resultCode),
                    message: 'Sent successfully'
                };
            } else {
                return {
                    success: false,
                    message: `Barobill Error Code: ${resultCode}`
                };
            }
        } catch (error) {
            console.error('[BarobillKakao] SendHTalk Error:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown Error'
            };
        }
    }

    /**
     * Send FriendTalk (Marketing/General)
     * Uses 'SendFTalk' method
     */
    async sendFriendTalk(
        to: string,
        content: string,
        refNum: string = ''
    ): Promise<{ success: boolean; receiptNum?: string; message: string }> {
        const client = await this.getClient();
        const auth = getBarobillAuth();
        const sendKey = refNum || `FT-${Date.now()}`;

        const payload = {
            CERTKEY: auth.certKey,
            CorpNum: auth.corpNum,
            ID: auth.id,
            PWD: auth.pwd,
            MgtKey: sendKey,
            ToCorpNum: '',
            ToName: '',
            ToHP: to.replace(/-/g, ''),
            Txt: content,
            SenderID: '',
            SendTime: '',
        };

        try {
            const [result] = await client.SendFTalkAsync(payload);
            const resultCode = parseInt(result.SendFTalkResult, 10);

            if (resultCode > 0) {
                return {
                    success: true,
                    receiptNum: String(resultCode),
                    message: 'Sent successfully'
                };
            } else {
                return {
                    success: false,
                    message: `Barobill Error Code: ${resultCode}`
                };
            }
        } catch (error) {
            console.error('[BarobillKakao] SendFTalk Error:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown Error'
            };
        }
    }

    /**
     * Get URL for managing Kakao Channel/Templates
     * Uses 'GetKakaotalkURL'
     */
    async getManagementUrl(type: 'CHANNEL' | 'TEMPLATE'): Promise<string> {
        const client = await this.getClient();
        const auth = getBarobillAuth();

        // PWD for URL generation might be just ID/PWD authentication on the link itself,
        // typically this API returns a one-time magic link.
        // Method: GetKakaotalkURL
        // Args: CERTKEY, CorpNum, ID, PWD, TOGO (target page)

        // TOGO codes (Hypothetical - verify with docs if available, otherwise defaulting to valid guesses)
        // Usually: 'PLUSFRIEND' (Channel), 'TEMPLATE' (Template)
        const toGo = type === 'CHANNEL' ? 'PLUSFRIEND' : 'TEMPLATE';

        const payload = {
            CERTKEY: auth.certKey,
            CorpNum: auth.corpNum,
            ID: auth.id,
            PWD: auth.pwd,
            TOGO: toGo
        };

        const [result] = await client.GetKakaotalkURLAsync(payload);
        const url = result.GetKakaotalkURLResult;

        if (url && url.startsWith('http')) {
            return url;
        } else {
            // If numeric, it's an error code
            throw new Error(`Barobill Error Code: ${url}`);
        }
    }
}

export const barobillKakaoService = new BarobillKakaoService();
