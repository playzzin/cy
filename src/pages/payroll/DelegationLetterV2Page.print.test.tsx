/* eslint-disable testing-library/no-node-access, testing-library/no-container -- Verify physical print-page structure. */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DelegationLetterV2Page from './DelegationLetterV2Page';
import { siteService } from '../../services/siteService';
import { teamService } from '../../services/teamService';
import { manpowerService } from '../../services/manpowerService';
import { dailyReportService } from '../../services/dailyReportService';
import { companyService } from '../../services/companyService';
import { delegationLetterTemplateService } from '../../services/delegationLetterTemplateService';

jest.mock('../../services/siteService', () => ({siteService:{getSites:jest.fn()}}));
jest.mock('../../services/teamService', () => ({teamService:{getTeams:jest.fn()}}));
jest.mock('../../services/manpowerService', () => ({manpowerService:{getWorkers:jest.fn(),subscribeWorkers:jest.fn()}}));
jest.mock('../../services/dailyReportService', () => ({dailyReportService:{getReportsByRange:jest.fn()}}));
jest.mock('../../services/companyService', () => ({companyService:{getCompanies:jest.fn()}}));
jest.mock('../../services/delegationLetterTemplateService', () => ({delegationLetterTemplateService:{getPublicTemplate:jest.fn(),savePublicTemplate:jest.fn()}}));
jest.mock('./SignatureGeneratorPage', () => () => null);
jest.mock('../../components/common/YearMonthPicker', () => ({YearMonthPicker:() => null}));
jest.mock('html2canvas', () => jest.fn());

it.each([20,21])('%s명의 위임자를 페이지당 최대 20명으로 출력한다', async count => {
    const workers = Array.from({length:count},(_,i) => ({id:`test-${i}`,name:`검증작업자${String(i+1).padStart(2,'0')}`,address:'테스트시 테스트구 테스트로 100, 검증아파트 100동 100호',unitPrice:200000}));
    (siteService.getSites as jest.Mock).mockResolvedValue([{id:'test-site',name:'검증현장'}]);
    (teamService.getTeams as jest.Mock).mockResolvedValue([]);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue(workers);
    (manpowerService.subscribeWorkers as jest.Mock).mockImplementation(callback => {callback(workers);return () => undefined;});
    (companyService.getCompanies as jest.Mock).mockResolvedValue([]);
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue([{siteId:'test-site',workers:workers.map(worker => ({workerId:worker.id,manDay:1}))}]);
    (delegationLetterTemplateService.getPublicTemplate as jest.Mock).mockResolvedValue(null);
    (delegationLetterTemplateService.savePublicTemplate as jest.Mock).mockResolvedValue(undefined);
    const {container} = render(<DelegationLetterV2Page />);
    const sitePicker = await screen.findByRole('button',{name:'현장 선택'});
    await waitFor(() => expect((sitePicker as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(sitePicker);
    fireEvent.click(await screen.findByRole('option',{name:'검증현장'}));
    await waitFor(() => expect(container.querySelectorAll('.delegation-letter-page').length).toBe(Math.ceil(count/20)));
    const pages = container.querySelectorAll('.delegation-letter-page');
    expect(pages[0].querySelectorAll('.delegation-workers-table tbody tr').length).toBe(20);
    expect(pages[pages.length-1].querySelectorAll('.delegation-workers-table tbody tr').length).toBe(count === 20 ? 20 : 1);
    if (process.env.CY_REQUEST_PREVIEW_DIR) {
        const fs = require('fs');
        const path = require('path');
        const styles = Array.from(container.querySelectorAll('style')).map(element=>element.outerHTML).join('');
        fs.writeFileSync(path.join(process.env.CY_REQUEST_PREVIEW_DIR,`delegation-preview-${count}.html`),`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>위임장 20명 출력 검증</title>${styles}</head><body>${Array.from(pages).map(page=>page.outerHTML).join('')}</body></html>`);
    }
});
