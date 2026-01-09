
import * as soap from 'soap';
import * as dotenv from 'dotenv';
import { getWsdlUrl, getBarobillAuth } from '../config/barobill';
import { resolve } from 'path';

// .env 로드 (functions/.env 파일 경로 확인)
dotenv.config({ path: resolve(__dirname, '../../.env') });

// SSL 인증서 오류 무시 (Barobill Test Server용)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function getLinks() {
    console.log('Fetching Barobill Kakao Management Links...');

    const auth = getBarobillAuth();
    const wsdlUrl = getWsdlUrl('kakao');

    console.log('Environment:', process.env.BAROBILL_ID ? 'Loaded' : 'Missing Env Vars');
    console.log('WSDL:', wsdlUrl);

    try {
        const client: any = await new Promise((resolve, reject) => {
            const options = {
                wsdl_options: { strictSSL: false, rejectUnauthorized: false },
                rejectUnauthorized: false,
                request: require('request').defaults({ strictSSL: false, rejectUnauthorized: false }) // soap might use axios or request
            };
            // soap.createClient(url, options, callback)
            soap.createClient(wsdlUrl, {
                wsdl_options: { rejectUnauthorized: false },
                defaults: { rejectUnauthorized: false }
            }, (err, client) => {
                if (err) reject(err);
                else {
                    // Method call options if needed, but usually client handles it.
                    // Also need to ensure the client request uses the same insecure agent if needed.
                    // But typically wsdl_options handles the initial load.
                    resolve(client);
                }
            });
        });

        const requestData = {
            CERTKEY: auth.certKey,
            CorpNum: auth.corpNum,
            ID: auth.id,
            PWD: auth.pwd,
        };

        // 1. 플러스친구 관리 페이지 URL
        // GetKakaotalkChannelManagementURL (WSDL method name verify needed, assuming based on pattern)
        // Usually: GetKakaotalkChannelManagementURL or similar.
        // Let's try GetKakaoTalkChannelManagementURL (case sensitive?) SOAP usually handles it.
        // Based on search it was GetKakaotalkChannelManagementURL.

        const channelUrlPromise = new Promise((resolve) => {
            // 메서드명 추정: GetKakaotalkChannelManagementURL
            if (client.GetKakaotalkChannelManagementURL) {
                client.GetKakaotalkChannelManagementURL(requestData, (err: any, result: any) => {
                    if (err) resolve(`Error: ${err.message}`);
                    else resolve(result.GetKakaotalkChannelManagementURLResult);
                });
            } else {
                resolve('Method GetKakaotalkChannelManagementURL not found');
            }
        });

        // 2. 알림톡 템플릿 관리 페이지 URL
        const templateManagementUrlPromise = new Promise((resolve) => {
            if (client.GetKakaotalkTemplateManagementURL) {
                client.GetKakaotalkTemplateManagementURL(requestData, (err: any, result: any) => {
                    if (err) resolve(`Error: ${err.message}`);
                    else resolve(result.GetKakaotalkTemplateManagementURLResult);
                });
            } else {
                resolve('Method GetKakaotalkTemplateManagementURL not found');
            }
        });

        const [channelUrl, templateUrl] = await Promise.all([channelUrlPromise, templateManagementUrlPromise]);

        console.log('\n==================================================');
        console.log(' [카카오톡 채널 관리 URL]');
        console.log(channelUrl);
        console.log('\n [알림톡 템플릿 관리 URL]');
        console.log(templateUrl);
        console.log('==================================================\n');

    } catch (error) {
        console.error('Fatal Error:', error);
    }
}

getLinks();
