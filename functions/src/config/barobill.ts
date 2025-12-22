/**
 * 바로빌(Barobill) 세금계산서 API 연동 설정
 * 
 * 바로빌은 SOAP 방식의 API를 제공합니다.
 * 테스트 환경과 운영 환경의 WSDL URL이 다릅니다.
 */

// 바로빌 API 환경 설정
export const BAROBILL_CONFIG = {
    // 테스트 환경 WSDL URL
    TEST_WSDL_URL: 'https://testws.barobill.co.kr/BANKSERVICE.asmx?WSDL',
    TEST_TAX_WSDL_URL: 'https://testws.barobill.co.kr/TI.asmx?WSDL',

    // 운영 환경 WSDL URL
    PROD_WSDL_URL: 'https://ws.barobill.co.kr/BANKSERVICE.asmx?WSDL',
    PROD_TAX_WSDL_URL: 'https://ws.barobill.co.kr/TI.asmx?WSDL',

    // 현재 사용할 환경 (true: 테스트, false: 운영)
    IS_TEST: true,
};

// 환경에 따른 WSDL URL 반환
export const getWsdlUrl = (service: 'tax' | 'bank' = 'tax'): string => {
    if (BAROBILL_CONFIG.IS_TEST) {
        return service === 'tax'
            ? BAROBILL_CONFIG.TEST_TAX_WSDL_URL
            : BAROBILL_CONFIG.TEST_WSDL_URL;
    }
    return service === 'tax'
        ? BAROBILL_CONFIG.PROD_TAX_WSDL_URL
        : BAROBILL_CONFIG.PROD_WSDL_URL;
};

// 바로빌 인증 정보 (환경 변수에서 가져옴)
export const getBarobillAuth = () => ({
    certKey: process.env.BAROBILL_CERT_KEY || '',
    corpNum: process.env.BAROBILL_CORP_NUM || '',
    id: process.env.BAROBILL_ID || '',
    pwd: process.env.BAROBILL_PWD || '',
});
