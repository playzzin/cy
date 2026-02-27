
import { DataProvider } from "@refinedev/core";
import {
    listCompanies,
    listTeams,
    listWorkers,
    listSites,
    listDailyReports,
    getCompany,
    getTeam,
    getWorker,
    getSite,
    createCompany,
    createTeam,
    createWorker,
    createSite,
    createDailyReport,
    updateCompany,
    updateTeam,
    updateWorker,
    updateSite,
    updateDailyReport,
    deleteCompany,
    deleteTeam,
    deleteWorker,
    deleteSite,
    deleteDailyReport,
    Status
} from '../../dataconnect-generated';

import { dc } from '../../config/firebase';

export const dataConnectProvider: DataProvider = {
    getList: async ({ resource }) => {
        // TODO: Implement pagination/filtering when GQL supports it
        try {
            if (resource === 'companies') {
                const response = await listCompanies(dc);
                const data = response.data.companies;
                return { data: data as any[], total: data.length };
            }
            if (resource === 'teams') {
                const response = await listTeams(dc);
                const data = response.data.teams;
                return { data: data as any[], total: data.length };
            }
            if (resource === 'workers') {
                const response = await listWorkers(dc);
                const data = response.data.workers;
                return { data: data as any[], total: data.length };
            }
            if (resource === 'sites') {
                const response = await listSites(dc);
                const data = response.data.sites;
                return { data: data as any[], total: data.length };
            }
            if (resource === 'daily_reports') {
                const response = await listDailyReports(dc);
                const data = response.data.dailyReports;
                return { data: data as any[], total: data.length };
            }
            throw new Error(`getList not implemented for ${resource}`);
        } catch (error) {
            console.error(`DataConnect getList Error (${resource}):`, error);
            throw error;
        }
    },

    getOne: async ({ resource, id }) => {
        try {
            if (resource === 'companies') {
                const response = await getCompany(dc, { id: id.toString() });
                if (!response.data.company) throw new Error("Not Found");
                return { data: response.data.company as any };
            }
            if (resource === 'teams') {
                const response = await getTeam(dc, { id: id.toString() });
                if (!response.data.team) throw new Error("Not Found");
                return { data: response.data.team as any };
            }
            if (resource === 'workers') {
                const response = await getWorker(dc, { id: id.toString() });
                if (!response.data.worker) throw new Error("Not Found");
                return { data: response.data.worker as any };
            }
            if (resource === 'sites') {
                const response = await getSite(dc, { id: id.toString() });
                if (!response.data.site) throw new Error("Not Found");
                return { data: response.data.site as any };
            }
            throw new Error(`getOne not implemented for ${resource}`);
        } catch (error) {
            console.error(`DataConnect getOne Error (${resource} ${id}):`, error);
            throw error;
        }
    },

    create: async ({ resource, variables }) => {
        try {
            const vars = variables as any;
            if (resource === 'companies') {
                const response = await createCompany(dc, {
                    name: vars.name,
                    code: vars.code,
                    businessNumber: vars.businessNumber,
                    ceoName: vars.ceoName,
                    type: vars.type,
                    status: vars.status || Status.ACTIVE
                });
                return { data: { id: response.data.company_insert.id, ...variables } as any };
            }
            if (resource === 'teams') {
                const response = await createTeam(dc, {
                    name: vars.name,
                    companyId: vars.companyId,
                    leaderId: vars.leaderId,
                    type: vars.type,
                    status: vars.status || Status.ACTIVE,
                    totalManDay: vars.totalManDay || 0
                });
                return { data: { id: response.data.team_insert.id, ...variables } as any };
            }
            if (resource === 'workers') {
                const response = await createWorker(dc, {
                    name: vars.name,
                    teamId: vars.teamId,
                    role: vars.role,
                    payType: vars.payType,
                    unitPrice: vars.unitPrice,
                    totalManDay: typeof vars.totalManDay === 'number' ? vars.totalManDay : 0,
                    phone: vars.phone,
                    residentNumber: vars.residentNumber,
                    address: vars.address,
                    bankAccount: vars.bankAccount,
                    bankName: vars.bankName,
                    isActive: true,
                    joinDate: vars.joinDate
                } as any);
                return { data: { id: response.data.worker_insert.id, ...variables } as any };
            }
            if (resource === 'sites') {
                const response = await createSite(dc, {
                    name: vars.name,
                    code: vars.code,
                    address: vars.address,
                    startDate: vars.startDate,
                    endDate: vars.endDate,
                    status: vars.status || Status.ACTIVE
                });
                return { data: { id: response.data.site_insert.id, ...variables } as any };
            }
            if (resource === 'daily_reports') {
                const response = await createDailyReport(dc, {
                    date: vars.date,
                    teamId: vars.teamId,
                    siteId: vars.siteId,
                    siteName: vars.siteName,
                    status: vars.status || 'draft',
                    totalManDay: vars.totalManDay || 0,
                    totalAmount: vars.totalAmount || 0,
                    weather: vars.weather
                });
                return { data: { id: response.data.dailyReport_insert.id, ...variables } as any };
            }

            throw new Error(`Create not implemented for ${resource}`);
        } catch (error) {
            console.error(`DataConnect create Error (${resource}):`, error);
            throw error;
        }
    },

    update: async ({ resource, id, variables }) => {
        try {
            const vars = variables as any;
            if (resource === 'companies') {
                await updateCompany(dc, {
                    id: id.toString(),
                    name: vars.name,
                    code: vars.code,
                    businessNumber: vars.businessNumber,
                    ceoName: vars.ceoName,
                    type: vars.type,
                    status: vars.status
                });
                return { data: { id, ...variables } as any };
            }
            if (resource === 'teams') {
                await updateTeam(dc, {
                    id: id.toString(),
                    name: vars.name,
                    companyId: vars.companyId,
                    leaderId: vars.leaderId,
                    type: vars.type,
                    status: vars.status,
                    totalManDay: vars.totalManDay
                });
                return { data: { id, ...variables } as any };
            }
            if (resource === 'workers') {
                await updateWorker(dc, {
                    id: id.toString(),
                    name: vars.name,
                    teamId: vars.teamId,
                    role: vars.role,
                    payType: vars.payType,
                    unitPrice: vars.unitPrice,
                    totalManDay: typeof vars.totalManDay === 'number' ? vars.totalManDay : undefined,
                    phone: vars.phone,
                    residentNumber: vars.residentNumber,
                    address: vars.address,
                    isActive: vars.isActive
                } as any);
                return { data: { id, ...variables } as any };
            }
            if (resource === 'sites') {
                await updateSite(dc, {
                    id: id.toString(),
                    name: vars.name,
                    code: vars.code,
                    address: vars.address,
                    startDate: vars.startDate,
                    endDate: vars.endDate,
                    status: vars.status
                });
                return { data: { id, ...variables } as any };
            }
            if (resource === 'daily_reports') {
                await updateDailyReport(dc, {
                    id: id.toString(),
                    date: vars.date,
                    teamId: vars.teamId,
                    siteId: vars.siteId,
                    siteName: vars.siteName,
                    status: vars.status,
                    totalManDay: vars.totalManDay,
                    totalAmount: vars.totalAmount,
                    weather: vars.weather
                });
                return { data: { id, ...variables } as any };
            }

            throw new Error(`Update not implemented for ${resource}`);
        } catch (error) {
            console.error(`DataConnect update Error (${resource} ${id}):`, error);
            throw error;
        }
    },

    deleteOne: async ({ resource, id }) => {
        try {
            if (resource === 'companies') {
                await deleteCompany(dc, { id: id.toString() });
                return { data: { id } as any };
            }
            if (resource === 'teams') {
                await deleteTeam(dc, { id: id.toString() });
                return { data: { id } as any };
            }
            if (resource === 'workers') {
                await deleteWorker(dc, { id: id.toString() });
                return { data: { id } as any };
            }
            if (resource === 'sites') {
                await deleteSite(dc, { id: id.toString() });
                return { data: { id } as any };
            }
            if (resource === 'daily_reports') {
                await deleteDailyReport(dc, { id: id.toString() });
                return { data: { id } as any };
            }

            throw new Error(`Delete not implemented for ${resource}`);
        } catch (error) {
            console.error(`DataConnect delete Error (${resource} ${id}):`, error);
            throw error;
        }
    },

    getApiUrl: () => "",
};
