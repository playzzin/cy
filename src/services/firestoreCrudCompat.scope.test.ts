import { getDoc, getDocs } from 'firebase/firestore';
import { getTeamScopedRows } from './teamScopedReadService';
import { listAllAccommodationBillingDocuments, listAllAccommodationBillingLineItems, listAllVehicleBillingDocuments, listSystemConfigs } from './firestoreCrudCompat';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ getDoc: jest.fn(), getDocs: jest.fn(), doc: jest.fn(), collection: jest.fn() }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));

it('월별 청구의 문서와 항목 조회가 서버까지 월 조건을 전달하고 전체 조회를 하지 않는다', async () => {
    (getTeamScopedRows as jest.Mock).mockResolvedValue([{ id: 'own-month-row' }]);
    const results = await Promise.all([
        listAllAccommodationBillingDocuments({ yearMonth: '2026-09' }),
        listAllAccommodationBillingLineItems({ yearMonth: '2026-09' }),
        listAllVehicleBillingDocuments({ yearMonth: '2026-09' }),
    ]);
    for (const collection of ['accommodation_billing_documents', 'accommodation_billing_line_items', 'vehicle_billing_documents']) {
        expect(getTeamScopedRows).toHaveBeenCalledWith(collection, { yearMonth: '2026-09' });
    }
    expect(results[1].data.accommodationBillingLineItems).toEqual([{ id: 'own-month-row' }]);
    expect(getDocs).not.toHaveBeenCalled();
});

it('설정 한 건 조회는 서버에 ID를 전달하며 권한 검사를 우회하지 않는다', async () => {
    (getTeamScopedRows as jest.Mock).mockResolvedValue([{ id: 'support_site_rates', data: '{"rates":[]}' }]);
    expect((await listSystemConfigs({ configId: 'support_site_rates' })).data.systemConfigs).toHaveLength(1);
    expect(getTeamScopedRows).toHaveBeenCalledWith('system_configs', { configId: 'support_site_rates' });
    expect(getDoc).not.toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
});

it('관리자도 설정 ID가 있으면 해당 문서만 읽고 전체 설정을 읽지 않는다', async () => {
    (getTeamScopedRows as jest.Mock).mockResolvedValue(null);
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, id: 'support_site_rates', data: () => ({ data: '{"rates":[]}' }) });
    expect((await listSystemConfigs({ configId: 'support_site_rates' })).data.systemConfigs).toHaveLength(1);
    expect(getDoc).toHaveBeenCalledTimes(1);
    expect(getDocs).not.toHaveBeenCalled();
});
