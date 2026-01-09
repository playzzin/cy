
const soap = require('soap');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BAROBILL_CONFIG = {
    TEST_KAKAO_WSDL_URL: 'https://testws.barobill.co.kr/KAKAOTALK.asmx?WSDL',
};

// 직접 환경변수 확인
console.log('Barobill ID:', process.env.BAROBILL_ID);
const wsdlUrl = BAROBILL_CONFIG.TEST_KAKAO_WSDL_URL;

const auth = {
    certKey: process.env.BAROBILL_CERT_KEY || '',
    corpNum: process.env.BAROBILL_CORP_NUM || '',
    id: process.env.BAROBILL_ID || '',
    pwd: process.env.BAROBILL_PWD || '',
};

const requestData = {
    CERTKEY: auth.certKey,
    CorpNum: auth.corpNum,
    ID: auth.id,
    PWD: auth.pwd,
};

soap.createClient(wsdlUrl, {
    wsdl_options: { strictSSL: false, rejectUnauthorized: false },
    defaults: { rejectUnauthorized: false }
}, function (err, client) {
    if (err) {
        console.error('Client Creation Error:', err);
        return;
    }

    console.log('Client Created. Fetching links...');

    // 채널 관리 URL
    if (client.GetKakaotalkChannelManagementURL) {
        client.GetKakaotalkChannelManagementURL(requestData, (err, result) => {
            if (err) console.error('GetChannelUrl Error:', err);
            else console.log('\n[채널 관리 URL]\n', result.GetKakaotalkChannelManagementURLResult);
        });
    }

    // 템플릿 관리 URL
    if (client.GetKakaotalkTemplateManagementURL) {
        client.GetKakaotalkTemplateManagementURL(requestData, (err, result) => {
            if (err) console.error('GetTemplateUrl Error:', err);
            else console.log('\n[템플릿 관리 URL]\n', result.GetKakaotalkTemplateManagementURLResult);
        });
    }
});
