import { DataProvider } from "@refinedev/core";
import { siteService, Site } from "../../services/siteService";
import { teamService } from "../../services/teamService";
import { companyService } from "../../services/companyService";

export const firebaseRefineProvider: DataProvider = {
    getList: async ({ resource, pagination, filters, sorters }) => {
        if (resource === 'sites') {
            const data = await siteService.getSites();
            return {
                data: data as any,
                total: data.length,
            };
        }
        if (resource === 'teams') {
            const data = await teamService.getTeams();
            return {
                data: data as any,
                total: data.length,
            };
        }
        if (resource === 'companies') {
            const data = await companyService.getCompanies();
            return {
                data: data as any,
                total: data.length,
            };
        }
        throw new Error(`Resource ${resource} not implemented`);
    },

    getOne: async ({ resource, id }) => {
        if (resource === 'sites') {
            const data = await siteService.getSite(id.toString());
            if (!data) throw new Error("Site not found");
            return { data: data as any };
        }
        if (resource === 'teams') {
            const data = await teamService.getTeam(id.toString());
            if (!data) throw new Error("Team not found");
            return { data: data as any };
        }
        if (resource === 'companies') {
            const data = await companyService.getCompanyById(id.toString());
            if (!data) throw new Error("Company not found");
            return { data: data as any };
        }
        throw new Error(`Resource ${resource} not implemented`);
    },

    create: async ({ resource, variables }) => {
        if (resource === 'sites') {
            const id = await siteService.addSite(variables as Omit<Site, 'id'>);
            return {
                data: { id, ...variables } as any
            };
        }
        // Add other resources as needed
        throw new Error(`Create for ${resource} not implemented`);
    },

    update: async ({ resource, id, variables }) => {
        if (resource === 'sites') {
            await siteService.updateSite(id.toString(), variables as Partial<Site>);
            return {
                data: { id, ...variables } as any
            };
        }
        throw new Error(`Update for ${resource} not implemented`);
    },

    deleteOne: async ({ resource, id }) => {
        if (resource === 'sites') {
            await siteService.deleteSite(id.toString());
            return { data: { id } as any };
        }
        throw new Error(`Delete for ${resource} not implemented`);
    },

    getApiUrl: () => "",
};
