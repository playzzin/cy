import React from "react";
import { Refine } from "@refinedev/core";
import routerBindings, {
    NavigateToResource,
    CatchAllNavigate,
    UnsavedChangesNotifier,
} from "@refinedev/react-router-v6";
import { firebaseRefineProvider } from "./firebaseProvider";
import { Outlet } from "react-router-dom";

export const RefineWrapper: React.FC = () => {
    return (
        <Refine
            dataProvider={firebaseRefineProvider}
            routerProvider={routerBindings}
            resources={[
                {
                    name: "sites",
                    list: "/manpower/refine-sites",
                    meta: { canDelete: true }
                },
                {
                    name: "workers",
                    list: "/manpower/refine-workers",
                    meta: { label: "작업자" }
                },
                {
                    name: "teams",
                    list: "/manpower/refine-teams",
                    meta: { label: "팀" }
                },
                {
                    name: "companies",
                    list: "/manpower/refine-companies",
                    meta: { label: "회사" }
                },
                {
                    name: "smart-select",
                    list: "/manpower/refine-smart-select",
                    meta: { label: "데모: Smart Select" }
                }
            ]}
            options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
            }}
        >
            <Outlet />
            <UnsavedChangesNotifier />
        </Refine>
    );
};
