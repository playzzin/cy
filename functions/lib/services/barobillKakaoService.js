"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KAKAO_TEMPLATES = exports.sendAlimtalk = exports.barobillKakaoService = exports.BarobillKakaoService = void 0;
const soap = require("soap");
const barobill_1 = require("../config/barobill");
/**
 * Barobill Kakao Service
 * Handles interaction with Barobill's KAKAOTALK.asmx SOAP API
 */
class BarobillKakaoService {
    client = null;
    /**
     * Initialize SOAP client
     */
    async getClient() {
        if (this.client)
            return this.client;
        const wsdlUrl = (0, barobill_1.getWsdlUrl)('kakao');
        try {
            this.client = await soap.createClientAsync(wsdlUrl);
            return this.client;
        }
        catch (error) {
            console.error('[BarobillKakao] Failed to create SOAP client:', error);
            throw new Error('Barobill SOAP Client Initialization Failed');
        }
    }
    /**
     * Send AlimTalk (Notification)
     * Uses 'SendHTalk' method
     */
    async sendAlimTalk(to, // Receiver Phone (Hyphens allowed)
    templateCode, // Approved Template Code
    content, // Message Content (Must match template)
    refNum = '' // Optional Reference Number
    ) {
        const client = await this.getClient();
        const auth = (0, barobill_1.getBarobillAuth)();
        const sendKey = refNum || `KAKAO-${Date.now()}`;
        // Prepare SOAP Payload for SendHTalk
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
            TemplateCode: templateCode,
            SenderID: '',
            SendTime: '', // Empty for immediate send
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
            }
            else {
                return {
                    success: false,
                    message: `Barobill Error Code: ${resultCode}`
                };
            }
        }
        catch (error) {
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
    async sendFriendTalk(to, content, refNum = '') {
        const client = await this.getClient();
        const auth = (0, barobill_1.getBarobillAuth)();
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
            }
            else {
                return {
                    success: false,
                    message: `Barobill Error Code: ${resultCode}`
                };
            }
        }
        catch (error) {
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
    async getManagementUrl(type) {
        const client = await this.getClient();
        const auth = (0, barobill_1.getBarobillAuth)();
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
        }
        else {
            // If numeric, it's an error code
            throw new Error(`Barobill Error Code: ${url}`);
        }
    }
}
exports.BarobillKakaoService = BarobillKakaoService;
exports.barobillKakaoService = new BarobillKakaoService();
// 세금계산서 서비스 등에서 기대하는 독립 함수 export (모든 형식 허용하여 충돌 방지)
const sendAlimtalk = (data) => exports.barobillKakaoService.sendAlimTalk(data.to, data.templateCode || data.templateId, data.content || '', data.refNum);
exports.sendAlimtalk = sendAlimtalk;
// 알림톡 템플릿 코드 상수
exports.KAKAO_TEMPLATES = {
    TAX_INVOICE_ISSUED: 'TEMPLATE_001',
    ESTIMATE_SENT: 'TEMPLATE_002'
};
//# sourceMappingURL=barobillKakaoService.js.map