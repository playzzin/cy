import html2canvas from 'html2canvas';
import { capturePayslipImage, payslipImageFilename } from './payslipImage';

jest.mock('html2canvas', () => jest.fn());

test('이미지 생성 실패나 빈 결과를 성공한 파일로 반환하지 않는다', async () => {
    (html2canvas as jest.Mock).mockResolvedValue({ toBlob: (callback: (blob: Blob | null) => void) => callback(null) });
    await expect(capturePayslipImage(document.createElement('div'))).rejects.toThrow('이미지를 만들지 못했습니다');
    (html2canvas as jest.Mock).mockResolvedValue({ toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob([])) });
    await expect(capturePayslipImage(document.createElement('div'))).rejects.toThrow('이미지를 만들지 못했습니다');
});

test('파일명에 사용할 수 없는 문자만 치환하고 작업자 이름과 월을 보존한다', () => {
    expect(payslipImageFilename('가상/하나:2', '2026-10')).toBe('급여명세서_가상_하나_2_2026-10.png');
});
