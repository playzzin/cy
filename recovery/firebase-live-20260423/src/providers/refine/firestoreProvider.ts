import { DataProvider } from "@refinedev/core";
import { siteService } from "../../services/siteService";
import { teamService } from "../../services/teamService";
import { companyService } from "../../services/companyService";
import { manpowerService } from "../../services/manpowerService";
import { dailyReportService } from "../../services/dailyReportService";

/**
 * Firestore Refine Data Provider
 * Delegates Refine actions to our Facade services.
 */
export const firestoreRefineProvider: DataProvider = {
    getList: async ({ resource, pagination, filters, sorters }) => {
        let data: any[] = [];

        switch (resource) {
            case 'sites':
                data = await siteService.getSites();
                break;
            case 'teams':
                data = await teamService.getTeams();
                break;
            case 'companies':
                data = await companyService.getCompanies();
                break;
            case 'workers':
                data = await manpowerService.getWorkers();
                break;
            case 'daily_reports':
                data = await dailyReportService.getReports();
                break;
            default:
                throw new Error(`Resource ${resource} not implemented in getList`);
        }

        // Basic client-side filtering/sorting/pagination if needed (Simplified for now)
        // Note: Our services already return sorted data (createdAt desc)

        return {
            data,
            total: data.length,
        };
    },

    getOne: async ({ resource, id }) => {
        let data: any = null;
        const idStr = id.toString();

        switch (resource) {
            case 'sites':
                data = await siteService.getSite(idStr);
                break;
            case 'teams':
                data = await teamService.getTeam(idStr);
                break;
            case 'companies':
                data = await companyService.getCompanyById(idStr);
                break;
            case 'workers':
                data = await manpowerService.getWorker(idStr);
                break;
            case 'dailyReports':
                data = await dailyReportService.getReport(idStr);
                break;
            default:
                throw new Error(`Resource ${resource} not implemented in getOne`);
        }

        if (!data) throw new Error(`${resource} not found with id ${idStr}`);
        return { data };
    },

    create: async ({ resource, variables }) => {
        let id: string = "";

        switch (resource) {
            case 'sites':
                id = await siteService.addSite(variables as any);
                break;
            case 'teams':
                id = await teamService.addTeam(variables as any);
                break;
            case 'companies':
                id = await companyService.addCompany(variables as any);
                break;
            case 'workers':
                id = await manpowerService.addWorker(variables as any);
                break;
            case 'dailyReports':
                id = await dailyReportService.addReport(variables as any);
                break;
            default:
                throw new Error(`Resource ${resource} not implemented in create`);
        }

        return {
            data: { id, ...variables } as any
        };
    },

    update: async ({ resource, id, variables }) => {
        const idStr = id.toString();

        switch (resource) {
            case 'sites':
                await siteService.updateSite(idStr, variables as any);
                break;
            case 'teams':
                await teamService.updateTeam(idStr, variables as any);
                break;
            case 'companies':
                await companyService.updateCompany(idStr, variables as any);
                break;
            case 'workers':
                await manpowerService.updateWorker(idStr, variables as any);
                break;
            case 'dailyReports':
                await dailyReportService.updateReport(idStr, variables as any);
                break;
            default:
                throw new Error(`Resource ${resource} not implemented in update`);
        }

        return {
            data: { id, ...variables } as any
        };
    },

    deleteOne: async ({ resource, id }) => {
        const idStr = id.toString();

        switch (resource) {
            case 'sites':
                await siteService.deleteSite(idStr);
                break;
            case 'teams':
                await teamService.deleteTeam(idStr);
                break;
            case 'companies':
                await companyService.deleteCompany(idStr);
                break;
            case 'workers':
                await manpowerService.deleteWorker(idStr);
                break;
            case 'dailyReports':
                await dailyReportService.deleteReport(idStr);
                break;
            default:
                throw new Error(`Resource ${resource} not implemented in deleteOne`);
        }

        return { data: { id } as any };
    },

    getApiUrl: () => "",
};
