# Generated React README
This README will guide you through the process of using the generated React SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `JavaScript README`, you can find it at [`dataconnect-generated/README.md`](../README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

You can use this generated SDK by importing from the package `@dataconnect/generated/react` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#react).

# Table of Contents
- [**Overview**](#generated-react-readme)
- [**TanStack Query Firebase & TanStack React Query**](#tanstack-query-firebase-tanstack-react-query)
  - [*Package Installation*](#installing-tanstack-query-firebase-and-tanstack-react-query-packages)
  - [*Configuring TanStack Query*](#configuring-tanstack-query)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListCompanies*](#listcompanies)
  - [*GetCompany*](#getcompany)
  - [*ListTeams*](#listteams)
  - [*GetTeam*](#getteam)
  - [*ListWorkers*](#listworkers)
  - [*ListPositions*](#listpositions)
  - [*GetWorker*](#getworker)
  - [*ListSites*](#listsites)
  - [*GetSite*](#getsite)
  - [*ListDailyReports*](#listdailyreports)
  - [*ListDailyReportWorkers*](#listdailyreportworkers)
  - [*ListAppUsers*](#listappusers)
  - [*ListMenuConfigs*](#listmenuconfigs)
  - [*ListSystemLogs*](#listsystemlogs)
  - [*ListAuditLogs*](#listauditlogs)
  - [*ListAgents*](#listagents)
  - [*ListAgentConversations*](#listagentconversations)
  - [*ListSettings*](#listsettings)
  - [*ListSystemConfigs*](#listsystemconfigs)
  - [*ListAllCompanies*](#listallcompanies)
  - [*ListAllTeams*](#listallteams)
  - [*ListAllWorkers*](#listallworkers)
  - [*ListAllPositions*](#listallpositions)
  - [*ListAllSites*](#listallsites)
  - [*ListAllDailyReports*](#listalldailyreports)
  - [*ListAllDailyReportWorkers*](#listalldailyreportworkers)
  - [*ListAllAppUsers*](#listallappusers)
  - [*ListAllMenuConfigs*](#listallmenuconfigs)
  - [*ListAllSystemLogs*](#listallsystemlogs)
  - [*ListAllAuditLogs*](#listallauditlogs)
  - [*ListAllAgents*](#listallagents)
  - [*ListAllAgentConversations*](#listallagentconversations)
  - [*ListAllSettings*](#listallsettings)
  - [*ListAllSystemConfigs*](#listallsystemconfigs)
  - [*ListAllAccommodations*](#listallaccommodations)
  - [*ListAllAccommodationAssignments*](#listallaccommodationassignments)
  - [*ListAllUtilityRecords*](#listallutilityrecords)
  - [*ListAllAccommodationBillingDocuments*](#listallaccommodationbillingdocuments)
  - [*ListAllAccommodationBillingLineItems*](#listallaccommodationbillinglineitems)
  - [*ListAllAdvancePayments*](#listalladvancepayments)
  - [*ListAllSmartMemoCategories*](#listallsmartmemocategories)
  - [*ListAllSmartMemos*](#listallsmartmemos)
  - [*ListAllVehicles*](#listallvehicles)
  - [*ListAllVehicleAssignments*](#listallvehicleassignments)
  - [*ListAllVehicleExpenses*](#listallvehicleexpenses)
  - [*ListAllVehicleBillingDocuments*](#listallvehiclebillingdocuments)
  - [*ListAllDailyDispatches*](#listalldailydispatches)
  - [*ListAllPayments*](#listallpayments)
  - [*ListAllTaxInvoices*](#listalltaxinvoices)
  - [*ListAllReceivables*](#listallreceivables)
- [**Mutations**](#mutations)
  - [*CreateCompany*](#createcompany)
  - [*CreateTeam*](#createteam)
  - [*CreateWorker*](#createworker)
  - [*CreateSite*](#createsite)
  - [*CreateDailyReport*](#createdailyreport)
  - [*CreateDailyReportWorker*](#createdailyreportworker)
  - [*UpdateDailyReportWorker*](#updatedailyreportworker)
  - [*DeleteDailyReportWorker*](#deletedailyreportworker)
  - [*CreatePosition*](#createposition)
  - [*CreateAuditLog*](#createauditlog)
  - [*CreateAgent*](#createagent)
  - [*CreateAgentConversation*](#createagentconversation)
  - [*CreateSetting*](#createsetting)
  - [*UpdateSetting*](#updatesetting)
  - [*CreateSystemConfig*](#createsystemconfig)
  - [*UpdateSystemConfig*](#updatesystemconfig)
  - [*DeletePosition*](#deleteposition)
  - [*UpdateCompany*](#updatecompany)
  - [*DeleteCompany*](#deletecompany)
  - [*UpdateTeam*](#updateteam)
  - [*DeleteTeam*](#deleteteam)
  - [*UpdateWorker*](#updateworker)
  - [*DeleteWorker*](#deleteworker)
  - [*UpdateSite*](#updatesite)
  - [*DeleteSite*](#deletesite)
  - [*UpdateDailyReport*](#updatedailyreport)
  - [*DeleteDailyReport*](#deletedailyreport)
  - [*CreateAppUser*](#createappuser)
  - [*UpdateAppUser*](#updateappuser)
  - [*DeleteAppUser*](#deleteappuser)
  - [*CreateMenuConfig*](#createmenuconfig)
  - [*UpdateMenuConfig*](#updatemenuconfig)
  - [*DeleteMenuConfig*](#deletemenuconfig)
  - [*CreateSystemLog*](#createsystemlog)
  - [*CreateAccommodation*](#createaccommodation)
  - [*UpdateAccommodation*](#updateaccommodation)
  - [*DeleteAccommodation*](#deleteaccommodation)
  - [*CreateAccommodationAssignment*](#createaccommodationassignment)
  - [*UpdateAccommodationAssignment*](#updateaccommodationassignment)
  - [*DeleteAccommodationAssignment*](#deleteaccommodationassignment)
  - [*CreateUtilityRecord*](#createutilityrecord)
  - [*UpdateUtilityRecord*](#updateutilityrecord)
  - [*DeleteUtilityRecord*](#deleteutilityrecord)
  - [*CreateAccommodationBillingDocument*](#createaccommodationbillingdocument)
  - [*UpdateAccommodationBillingDocument*](#updateaccommodationbillingdocument)
  - [*CreateAccommodationBillingLineItem*](#createaccommodationbillinglineitem)
  - [*DeleteAccommodationBillingLineItem*](#deleteaccommodationbillinglineitem)
  - [*CreateAdvancePayment*](#createadvancepayment)
  - [*UpdateAdvancePayment*](#updateadvancepayment)
  - [*DeleteAdvancePayment*](#deleteadvancepayment)
  - [*CreateSmartMemo*](#createsmartmemo)
  - [*UpdateSmartMemo*](#updatesmartmemo)
  - [*DeleteSmartMemo*](#deletesmartmemo)
  - [*CreateSmartMemoCategory*](#createsmartmemocategory)
  - [*UpdateSmartMemoCategory*](#updatesmartmemocategory)
  - [*DeleteSmartMemoCategory*](#deletesmartmemocategory)
  - [*CreateVehicle*](#createvehicle)
  - [*UpdateVehicle*](#updatevehicle)
  - [*DeleteVehicle*](#deletevehicle)
  - [*CreateVehicleAssignment*](#createvehicleassignment)
  - [*UpdateVehicleAssignment*](#updatevehicleassignment)
  - [*DeleteVehicleAssignment*](#deletevehicleassignment)
  - [*CreateVehicleExpense*](#createvehicleexpense)
  - [*UpdateVehicleExpense*](#updatevehicleexpense)
  - [*DeleteVehicleExpense*](#deletevehicleexpense)
  - [*CreateVehicleBillingDocument*](#createvehiclebillingdocument)
  - [*UpdateVehicleBillingDocument*](#updatevehiclebillingdocument)
  - [*DeleteVehicleBillingDocument*](#deletevehiclebillingdocument)
  - [*UpdateAgent*](#updateagent)
  - [*UpdateAgentConversation*](#updateagentconversation)
  - [*CreateDailyDispatch*](#createdailydispatch)
  - [*UpdateDailyDispatch*](#updatedailydispatch)
  - [*DeleteDailyDispatch*](#deletedailydispatch)
  - [*CreatePayment*](#createpayment)
  - [*UpdatePayment*](#updatepayment)
  - [*DeletePayment*](#deletepayment)
  - [*CreateTaxInvoice*](#createtaxinvoice)
  - [*UpdateTaxInvoice*](#updatetaxinvoice)
  - [*DeleteTaxInvoice*](#deletetaxinvoice)
  - [*CreateReceivable*](#createreceivable)
  - [*UpdateReceivable*](#updatereceivable)
  - [*DeleteReceivable*](#deletereceivable)

# TanStack Query Firebase & TanStack React Query
This SDK provides [React](https://react.dev/) hooks generated specific to your application, for the operations found in the connector `example`. These hooks are generated using [TanStack Query Firebase](https://react-query-firebase.invertase.dev/) by our partners at Invertase, a library built on top of [TanStack React Query v5](https://tanstack.com/query/v5/docs/framework/react/overview).

***You do not need to be familiar with Tanstack Query or Tanstack Query Firebase to use this SDK.*** However, you may find it useful to learn more about them, as they will empower you as a user of this Generated React SDK.

## Installing TanStack Query Firebase and TanStack React Query Packages
In order to use the React generated SDK, you must install the `TanStack React Query` and `TanStack Query Firebase` packages.
```bash
npm i --save @tanstack/react-query @tanstack-query-firebase/react
```
```bash
npm i --save firebase@latest # Note: React has a peer dependency on ^11.3.0
```

You can also follow the installation instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#tanstack-install), or the [TanStack Query Firebase documentation](https://react-query-firebase.invertase.dev/react) and [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/installation).

## Configuring TanStack Query
In order to use the React generated SDK in your application, you must wrap your application's component tree in a `QueryClientProvider` component from TanStack React Query. None of your generated React SDK hooks will work without this provider.

```javascript
import { QueryClientProvider } from '@tanstack/react-query';

// Create a TanStack Query client instance
const queryClient = new QueryClient()

function App() {
  return (
    // Provide the client to your App
    <QueryClientProvider client={queryClient}>
      <MyApplication />
    </QueryClientProvider>
  )
}
```

To learn more about `QueryClientProvider`, see the [TanStack React Query documentation](https://tanstack.com/query/latest/docs/framework/react/quick-start) and the [TanStack Query Firebase documentation](https://invertase.docs.page/tanstack-query-firebase/react#usage).

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`.

You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#emulator-react-angular).

```javascript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) using the hooks provided from your generated React SDK.

# Queries

The React generated SDK provides Query hook functions that call and return [`useDataConnectQuery`](https://react-query-firebase.invertase.dev/react/data-connect/querying) hooks from TanStack Query Firebase.

Calling these hook functions will return a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and the most recent data returned by the Query, among other things. To learn more about these hooks and how to use them, see the [TanStack Query Firebase documentation](https://react-query-firebase.invertase.dev/react/data-connect/querying).

TanStack React Query caches the results of your Queries, so using the same Query hook function in multiple places in your application allows the entire application to automatically see updates to that Query's data.

Query hooks execute their Queries automatically when called, and periodically refresh, unless you change the `queryOptions` for the Query. To learn how to stop a Query from automatically executing, including how to make a query "lazy", see the [TanStack React Query documentation](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries).

To learn more about TanStack React Query's Queries, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/guides/queries).

## Using Query Hooks
Here's a general overview of how to use the generated Query hooks in your code:

- If the Query has no variables, the Query hook function does not require arguments.
- If the Query has any required variables, the Query hook function will require at least one argument: an object that contains all the required variables for the Query.
- If the Query has some required and some optional variables, only required variables are necessary in the variables argument object, and optional variables may be provided as well.
- If all of the Query's variables are optional, the Query hook function does not require any arguments.
- Query hook functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.
- Query hooks functions can be called with or without passing in an `options` argument of type `useDataConnectQueryOptions`. To learn more about the `options` argument, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/guides/query-options).
  - ***Special case:***  If the Query has all optional variables and you would like to provide an `options` argument to the Query hook function without providing any variables, you must pass `undefined` where you would normally pass the Query's variables, and then may provide the `options` argument.

Below are examples of how to use the `example` connector's generated Query hook functions to execute each Query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#operations-react-angular).

## ListCompanies
You can execute the `ListCompanies` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListCompanies(dc: DataConnect, options?: useDataConnectQueryOptions<ListCompaniesData>): UseDataConnectQueryResult<ListCompaniesData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListCompanies(options?: useDataConnectQueryOptions<ListCompaniesData>): UseDataConnectQueryResult<ListCompaniesData, undefined>;
```

### Variables
The `ListCompanies` Query has no variables.
### Return Type
Recall that calling the `ListCompanies` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListCompanies` Query is of type `ListCompaniesData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListCompaniesData {
  companies: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code: string;
    businessNumber?: string | null;
    ceoName?: string | null;
    type?: string | null;
    status: Status;
    createdAt: TimestampString;
  } & Company_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListCompanies`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListCompanies } from '@dataconnect/generated/react'

export default function ListCompaniesComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListCompanies();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListCompanies(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListCompanies(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListCompanies(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.companies);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## GetCompany
You can execute the `GetCompany` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useGetCompany(dc: DataConnect, vars: GetCompanyVariables, options?: useDataConnectQueryOptions<GetCompanyData>): UseDataConnectQueryResult<GetCompanyData, GetCompanyVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useGetCompany(vars: GetCompanyVariables, options?: useDataConnectQueryOptions<GetCompanyData>): UseDataConnectQueryResult<GetCompanyData, GetCompanyVariables>;
```

### Variables
The `GetCompany` Query requires an argument of type `GetCompanyVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface GetCompanyVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `GetCompany` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `GetCompany` Query is of type `GetCompanyData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface GetCompanyData {
  company?: {
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code: string;
    businessNumber?: string | null;
    ceoName?: string | null;
    type?: string | null;
    status: Status;
    createdAt: TimestampString;
  } & Company_Key;
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `GetCompany`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, GetCompanyVariables } from '@dataconnect/generated';
import { useGetCompany } from '@dataconnect/generated/react'

export default function GetCompanyComponent() {
  // The `useGetCompany` Query hook requires an argument of type `GetCompanyVariables`:
  const getCompanyVars: GetCompanyVariables = {
    id: ..., 
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useGetCompany(getCompanyVars);
  // Variables can be defined inline as well.
  const query = useGetCompany({ id: ..., });

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useGetCompany(dataConnect, getCompanyVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useGetCompany(getCompanyVars, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useGetCompany(dataConnect, getCompanyVars, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.company);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListTeams
You can execute the `ListTeams` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListTeams(dc: DataConnect, options?: useDataConnectQueryOptions<ListTeamsData>): UseDataConnectQueryResult<ListTeamsData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListTeams(options?: useDataConnectQueryOptions<ListTeamsData>): UseDataConnectQueryResult<ListTeamsData, undefined>;
```

### Variables
The `ListTeams` Query has no variables.
### Return Type
Recall that calling the `ListTeams` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListTeams` Query is of type `ListTeamsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListTeamsData {
  teams: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    company?: {
      id: UUIDString;
      name: string;
    } & Company_Key;
      leader?: {
        id: UUIDString;
        name: string;
      } & Worker_Key;
        type?: string | null;
        status: Status;
        totalManDay?: number | null;
        createdAt: TimestampString;
  } & Team_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListTeams`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListTeams } from '@dataconnect/generated/react'

export default function ListTeamsComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListTeams();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListTeams(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListTeams(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListTeams(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.teams);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## GetTeam
You can execute the `GetTeam` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useGetTeam(dc: DataConnect, vars: GetTeamVariables, options?: useDataConnectQueryOptions<GetTeamData>): UseDataConnectQueryResult<GetTeamData, GetTeamVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useGetTeam(vars: GetTeamVariables, options?: useDataConnectQueryOptions<GetTeamData>): UseDataConnectQueryResult<GetTeamData, GetTeamVariables>;
```

### Variables
The `GetTeam` Query requires an argument of type `GetTeamVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface GetTeamVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `GetTeam` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `GetTeam` Query is of type `GetTeamData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface GetTeamData {
  team?: {
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    company?: {
      id: UUIDString;
      name: string;
    } & Company_Key;
      leader?: {
        id: UUIDString;
        name: string;
      } & Worker_Key;
        type?: string | null;
        status: Status;
        totalManDay?: number | null;
        createdAt: TimestampString;
  } & Team_Key;
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `GetTeam`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, GetTeamVariables } from '@dataconnect/generated';
import { useGetTeam } from '@dataconnect/generated/react'

export default function GetTeamComponent() {
  // The `useGetTeam` Query hook requires an argument of type `GetTeamVariables`:
  const getTeamVars: GetTeamVariables = {
    id: ..., 
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useGetTeam(getTeamVars);
  // Variables can be defined inline as well.
  const query = useGetTeam({ id: ..., });

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useGetTeam(dataConnect, getTeamVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useGetTeam(getTeamVars, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useGetTeam(dataConnect, getTeamVars, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.team);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListWorkers
You can execute the `ListWorkers` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListWorkers(dc: DataConnect, options?: useDataConnectQueryOptions<ListWorkersData>): UseDataConnectQueryResult<ListWorkersData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListWorkers(options?: useDataConnectQueryOptions<ListWorkersData>): UseDataConnectQueryResult<ListWorkersData, undefined>;
```

### Variables
The `ListWorkers` Query has no variables.
### Return Type
Recall that calling the `ListWorkers` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListWorkers` Query is of type `ListWorkersData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListWorkersData {
  workers: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    role?: string | null;
    team?: {
      id: UUIDString;
      name: string;
      company?: {
        id: UUIDString;
        name: string;
      } & Company_Key;
    } & Team_Key;
      payType?: string | null;
      unitPrice?: number | null;
      phone?: string | null;
      residentNumber?: string | null;
      address?: string | null;
      isActive?: boolean | null;
      joinDate?: DateString | null;
      createdAt: TimestampString;
  } & Worker_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListWorkers`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListWorkers } from '@dataconnect/generated/react'

export default function ListWorkersComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListWorkers();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListWorkers(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListWorkers(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListWorkers(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.workers);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListPositions
You can execute the `ListPositions` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListPositions(dc: DataConnect, options?: useDataConnectQueryOptions<ListPositionsData>): UseDataConnectQueryResult<ListPositionsData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListPositions(options?: useDataConnectQueryOptions<ListPositionsData>): UseDataConnectQueryResult<ListPositionsData, undefined>;
```

### Variables
The `ListPositions` Query has no variables.
### Return Type
Recall that calling the `ListPositions` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListPositions` Query is of type `ListPositionsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListPositionsData {
  positions: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    rank?: number | null;
    color?: string | null;
    icon?: string | null;
    isDefault?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Position_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListPositions`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListPositions } from '@dataconnect/generated/react'

export default function ListPositionsComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListPositions();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListPositions(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListPositions(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListPositions(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.positions);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## GetWorker
You can execute the `GetWorker` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useGetWorker(dc: DataConnect, vars: GetWorkerVariables, options?: useDataConnectQueryOptions<GetWorkerData>): UseDataConnectQueryResult<GetWorkerData, GetWorkerVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useGetWorker(vars: GetWorkerVariables, options?: useDataConnectQueryOptions<GetWorkerData>): UseDataConnectQueryResult<GetWorkerData, GetWorkerVariables>;
```

### Variables
The `GetWorker` Query requires an argument of type `GetWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface GetWorkerVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `GetWorker` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `GetWorker` Query is of type `GetWorkerData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface GetWorkerData {
  worker?: {
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    role?: string | null;
    team?: {
      id: UUIDString;
      name: string;
      company?: {
        id: UUIDString;
        name: string;
      } & Company_Key;
    } & Team_Key;
      payType?: string | null;
      unitPrice?: number | null;
      phone?: string | null;
      residentNumber?: string | null;
      address?: string | null;
      isActive?: boolean | null;
      joinDate?: DateString | null;
      createdAt: TimestampString;
  } & Worker_Key;
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `GetWorker`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, GetWorkerVariables } from '@dataconnect/generated';
import { useGetWorker } from '@dataconnect/generated/react'

export default function GetWorkerComponent() {
  // The `useGetWorker` Query hook requires an argument of type `GetWorkerVariables`:
  const getWorkerVars: GetWorkerVariables = {
    id: ..., 
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useGetWorker(getWorkerVars);
  // Variables can be defined inline as well.
  const query = useGetWorker({ id: ..., });

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useGetWorker(dataConnect, getWorkerVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useGetWorker(getWorkerVars, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useGetWorker(dataConnect, getWorkerVars, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.worker);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListSites
You can execute the `ListSites` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListSites(dc: DataConnect, options?: useDataConnectQueryOptions<ListSitesData>): UseDataConnectQueryResult<ListSitesData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListSites(options?: useDataConnectQueryOptions<ListSitesData>): UseDataConnectQueryResult<ListSitesData, undefined>;
```

### Variables
The `ListSites` Query has no variables.
### Return Type
Recall that calling the `ListSites` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListSites` Query is of type `ListSitesData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListSitesData {
  sites: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code?: string | null;
    address?: string | null;
    startDate?: DateString | null;
    endDate?: DateString | null;
    status: Status;
    createdAt: TimestampString;
  } & Site_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListSites`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListSites } from '@dataconnect/generated/react'

export default function ListSitesComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListSites();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListSites(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListSites(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListSites(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.sites);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## GetSite
You can execute the `GetSite` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useGetSite(dc: DataConnect, vars: GetSiteVariables, options?: useDataConnectQueryOptions<GetSiteData>): UseDataConnectQueryResult<GetSiteData, GetSiteVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useGetSite(vars: GetSiteVariables, options?: useDataConnectQueryOptions<GetSiteData>): UseDataConnectQueryResult<GetSiteData, GetSiteVariables>;
```

### Variables
The `GetSite` Query requires an argument of type `GetSiteVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface GetSiteVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `GetSite` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `GetSite` Query is of type `GetSiteData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface GetSiteData {
  site?: {
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code?: string | null;
    address?: string | null;
    startDate?: DateString | null;
    endDate?: DateString | null;
    status: Status;
    createdAt: TimestampString;
  } & Site_Key;
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `GetSite`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, GetSiteVariables } from '@dataconnect/generated';
import { useGetSite } from '@dataconnect/generated/react'

export default function GetSiteComponent() {
  // The `useGetSite` Query hook requires an argument of type `GetSiteVariables`:
  const getSiteVars: GetSiteVariables = {
    id: ..., 
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useGetSite(getSiteVars);
  // Variables can be defined inline as well.
  const query = useGetSite({ id: ..., });

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useGetSite(dataConnect, getSiteVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useGetSite(getSiteVars, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useGetSite(dataConnect, getSiteVars, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.site);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListDailyReports
You can execute the `ListDailyReports` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListDailyReports(dc: DataConnect, options?: useDataConnectQueryOptions<ListDailyReportsData>): UseDataConnectQueryResult<ListDailyReportsData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListDailyReports(options?: useDataConnectQueryOptions<ListDailyReportsData>): UseDataConnectQueryResult<ListDailyReportsData, undefined>;
```

### Variables
The `ListDailyReports` Query has no variables.
### Return Type
Recall that calling the `ListDailyReports` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListDailyReports` Query is of type `ListDailyReportsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListDailyReportsData {
  dailyReports: ({
    id: UUIDString;
    legacyId?: string | null;
    date: DateString;
    writerUid?: string | null;
    companyName?: string | null;
    responsibleTeamName?: string | null;
    responsibleTeamLegacyId?: string | null;
    team: {
      id: UUIDString;
      legacyId?: string | null;
      name: string;
    } & Team_Key;
      site?: {
        id: UUIDString;
        legacyId?: string | null;
        name: string;
      } & Site_Key;
        siteName?: string | null;
        status?: string | null;
        totalManDay?: number | null;
        totalAmount?: number | null;
        weather?: string | null;
        workContent?: string | null;
        createdAt: TimestampString;
  } & DailyReport_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListDailyReports`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListDailyReports } from '@dataconnect/generated/react'

export default function ListDailyReportsComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListDailyReports();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListDailyReports(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListDailyReports(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListDailyReports(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.dailyReports);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListDailyReportWorkers
You can execute the `ListDailyReportWorkers` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListDailyReportWorkers(dc: DataConnect, options?: useDataConnectQueryOptions<ListDailyReportWorkersData>): UseDataConnectQueryResult<ListDailyReportWorkersData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListDailyReportWorkers(options?: useDataConnectQueryOptions<ListDailyReportWorkersData>): UseDataConnectQueryResult<ListDailyReportWorkersData, undefined>;
```

### Variables
The `ListDailyReportWorkers` Query has no variables.
### Return Type
Recall that calling the `ListDailyReportWorkers` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListDailyReportWorkers` Query is of type `ListDailyReportWorkersData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListDailyReportWorkersData {
  dailyReportWorkers: ({
    id: UUIDString;
    dailyReport: {
      id: UUIDString;
      legacyId?: string | null;
      date: DateString;
    } & DailyReport_Key;
      worker: {
        id: UUIDString;
        legacyId?: string | null;
        name: string;
      } & Worker_Key;
        gongsu: number;
        unitPrice: number;
        amount: number;
        workDescription?: string | null;
        legacyWorkerId?: string | null;
        legacyTeamId?: string | null;
        workerName?: string | null;
        role?: string | null;
        status?: string | null;
        manDay?: number | null;
        payType?: string | null;
        salaryModel?: string | null;
        workContent?: string | null;
        createdAt: TimestampString;
  })[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListDailyReportWorkers`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListDailyReportWorkers } from '@dataconnect/generated/react'

export default function ListDailyReportWorkersComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListDailyReportWorkers();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListDailyReportWorkers(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListDailyReportWorkers(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListDailyReportWorkers(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.dailyReportWorkers);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAppUsers
You can execute the `ListAppUsers` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAppUsers(dc: DataConnect, options?: useDataConnectQueryOptions<ListAppUsersData>): UseDataConnectQueryResult<ListAppUsersData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAppUsers(options?: useDataConnectQueryOptions<ListAppUsersData>): UseDataConnectQueryResult<ListAppUsersData, undefined>;
```

### Variables
The `ListAppUsers` Query has no variables.
### Return Type
Recall that calling the `ListAppUsers` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAppUsers` Query is of type `ListAppUsersData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAppUsersData {
  appUsers: ({
    id: string;
    uid?: string | null;
    email?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
    linkedWorkerIds?: string | null;
    role?: string | null;
    lastLogin?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & AppUser_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAppUsers`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListAppUsers } from '@dataconnect/generated/react'

export default function ListAppUsersComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAppUsers();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAppUsers(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAppUsers(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAppUsers(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.appUsers);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListMenuConfigs
You can execute the `ListMenuConfigs` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListMenuConfigs(dc: DataConnect, options?: useDataConnectQueryOptions<ListMenuConfigsData>): UseDataConnectQueryResult<ListMenuConfigsData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListMenuConfigs(options?: useDataConnectQueryOptions<ListMenuConfigsData>): UseDataConnectQueryResult<ListMenuConfigsData, undefined>;
```

### Variables
The `ListMenuConfigs` Query has no variables.
### Return Type
Recall that calling the `ListMenuConfigs` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListMenuConfigs` Query is of type `ListMenuConfigsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListMenuConfigsData {
  menuConfigs: ({
    id: string;
    config: string;
    updatedAt: TimestampString;
  } & MenuConfig_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListMenuConfigs`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListMenuConfigs } from '@dataconnect/generated/react'

export default function ListMenuConfigsComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListMenuConfigs();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListMenuConfigs(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListMenuConfigs(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListMenuConfigs(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.menuConfigs);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListSystemLogs
You can execute the `ListSystemLogs` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListSystemLogs(dc: DataConnect, options?: useDataConnectQueryOptions<ListSystemLogsData>): UseDataConnectQueryResult<ListSystemLogsData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListSystemLogs(options?: useDataConnectQueryOptions<ListSystemLogsData>): UseDataConnectQueryResult<ListSystemLogsData, undefined>;
```

### Variables
The `ListSystemLogs` Query has no variables.
### Return Type
Recall that calling the `ListSystemLogs` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListSystemLogs` Query is of type `ListSystemLogsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListSystemLogsData {
  systemLogs: ({
    id: UUIDString;
    category: string;
    action: string;
    userEmail?: string | null;
    details?: string | null;
    createdAt: TimestampString;
  } & SystemLog_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListSystemLogs`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListSystemLogs } from '@dataconnect/generated/react'

export default function ListSystemLogsComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListSystemLogs();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListSystemLogs(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListSystemLogs(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListSystemLogs(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.systemLogs);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAuditLogs
You can execute the `ListAuditLogs` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAuditLogs(dc: DataConnect, options?: useDataConnectQueryOptions<ListAuditLogsData>): UseDataConnectQueryResult<ListAuditLogsData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAuditLogs(options?: useDataConnectQueryOptions<ListAuditLogsData>): UseDataConnectQueryResult<ListAuditLogsData, undefined>;
```

### Variables
The `ListAuditLogs` Query has no variables.
### Return Type
Recall that calling the `ListAuditLogs` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAuditLogs` Query is of type `ListAuditLogsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAuditLogsData {
  auditLogs: ({
    id: string;
    action?: string | null;
    category?: string | null;
    actorId?: string | null;
    actorEmail?: string | null;
    targetId?: string | null;
    details?: string | null;
    timestamp?: TimestampString | null;
    createdAt: TimestampString;
  } & AuditLog_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAuditLogs`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListAuditLogs } from '@dataconnect/generated/react'

export default function ListAuditLogsComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAuditLogs();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAuditLogs(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAuditLogs(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAuditLogs(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.auditLogs);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAgents
You can execute the `ListAgents` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAgents(dc: DataConnect, options?: useDataConnectQueryOptions<ListAgentsData>): UseDataConnectQueryResult<ListAgentsData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAgents(options?: useDataConnectQueryOptions<ListAgentsData>): UseDataConnectQueryResult<ListAgentsData, undefined>;
```

### Variables
The `ListAgents` Query has no variables.
### Return Type
Recall that calling the `ListAgents` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAgents` Query is of type `ListAgentsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAgentsData {
  agents: ({
    id: string;
    name?: string | null;
    type?: string | null;
    role?: string | null;
    capabilities?: string | null;
    systemPrompt?: string | null;
    status?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Agent_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAgents`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListAgents } from '@dataconnect/generated/react'

export default function ListAgentsComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAgents();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAgents(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAgents(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAgents(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.agents);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAgentConversations
You can execute the `ListAgentConversations` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAgentConversations(dc: DataConnect, options?: useDataConnectQueryOptions<ListAgentConversationsData>): UseDataConnectQueryResult<ListAgentConversationsData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAgentConversations(options?: useDataConnectQueryOptions<ListAgentConversationsData>): UseDataConnectQueryResult<ListAgentConversationsData, undefined>;
```

### Variables
The `ListAgentConversations` Query has no variables.
### Return Type
Recall that calling the `ListAgentConversations` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAgentConversations` Query is of type `ListAgentConversationsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAgentConversationsData {
  agentConversations: ({
    id: string;
    mainAgentId?: string | null;
    userId?: string | null;
    messages?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & AgentConversation_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAgentConversations`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListAgentConversations } from '@dataconnect/generated/react'

export default function ListAgentConversationsComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAgentConversations();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAgentConversations(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAgentConversations(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAgentConversations(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.agentConversations);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListSettings
You can execute the `ListSettings` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListSettings(dc: DataConnect, options?: useDataConnectQueryOptions<ListSettingsData>): UseDataConnectQueryResult<ListSettingsData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListSettings(options?: useDataConnectQueryOptions<ListSettingsData>): UseDataConnectQueryResult<ListSettingsData, undefined>;
```

### Variables
The `ListSettings` Query has no variables.
### Return Type
Recall that calling the `ListSettings` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListSettings` Query is of type `ListSettingsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListSettingsData {
  settings: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & Setting_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListSettings`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListSettings } from '@dataconnect/generated/react'

export default function ListSettingsComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListSettings();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListSettings(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListSettings(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListSettings(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.settings);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListSystemConfigs
You can execute the `ListSystemConfigs` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListSystemConfigs(dc: DataConnect, options?: useDataConnectQueryOptions<ListSystemConfigsData>): UseDataConnectQueryResult<ListSystemConfigsData, undefined>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListSystemConfigs(options?: useDataConnectQueryOptions<ListSystemConfigsData>): UseDataConnectQueryResult<ListSystemConfigsData, undefined>;
```

### Variables
The `ListSystemConfigs` Query has no variables.
### Return Type
Recall that calling the `ListSystemConfigs` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListSystemConfigs` Query is of type `ListSystemConfigsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListSystemConfigsData {
  systemConfigs: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & SystemConfig_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListSystemConfigs`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';
import { useListSystemConfigs } from '@dataconnect/generated/react'

export default function ListSystemConfigsComponent() {
  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListSystemConfigs();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListSystemConfigs(dataConnect);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListSystemConfigs(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListSystemConfigs(dataConnect, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.systemConfigs);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllCompanies
You can execute the `ListAllCompanies` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllCompanies(dc: DataConnect, vars?: ListAllCompaniesVariables, options?: useDataConnectQueryOptions<ListAllCompaniesData>): UseDataConnectQueryResult<ListAllCompaniesData, ListAllCompaniesVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllCompanies(vars?: ListAllCompaniesVariables, options?: useDataConnectQueryOptions<ListAllCompaniesData>): UseDataConnectQueryResult<ListAllCompaniesData, ListAllCompaniesVariables>;
```

### Variables
The `ListAllCompanies` Query has an optional argument of type `ListAllCompaniesVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllCompaniesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllCompanies` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllCompanies` Query is of type `ListAllCompaniesData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllCompaniesData {
  companies: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code: string;
    businessNumber?: string | null;
    ceoName?: string | null;
    type?: string | null;
    status: Status;
    createdAt: TimestampString;
  } & Company_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllCompanies`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllCompaniesVariables } from '@dataconnect/generated';
import { useListAllCompanies } from '@dataconnect/generated/react'

export default function ListAllCompaniesComponent() {
  // The `useListAllCompanies` Query hook has an optional argument of type `ListAllCompaniesVariables`:
  const listAllCompaniesVars: ListAllCompaniesVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllCompanies(listAllCompaniesVars);
  // Variables can be defined inline as well.
  const query = useListAllCompanies({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllCompaniesVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllCompanies();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllCompanies(dataConnect, listAllCompaniesVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllCompanies(listAllCompaniesVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllCompanies(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllCompanies(dataConnect, listAllCompaniesVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.companies);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllTeams
You can execute the `ListAllTeams` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllTeams(dc: DataConnect, vars?: ListAllTeamsVariables, options?: useDataConnectQueryOptions<ListAllTeamsData>): UseDataConnectQueryResult<ListAllTeamsData, ListAllTeamsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllTeams(vars?: ListAllTeamsVariables, options?: useDataConnectQueryOptions<ListAllTeamsData>): UseDataConnectQueryResult<ListAllTeamsData, ListAllTeamsVariables>;
```

### Variables
The `ListAllTeams` Query has an optional argument of type `ListAllTeamsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllTeamsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllTeams` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllTeams` Query is of type `ListAllTeamsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllTeamsData {
  teams: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    company?: {
      id: UUIDString;
      name: string;
    } & Company_Key;
      leader?: {
        id: UUIDString;
        name: string;
      } & Worker_Key;
        type?: string | null;
        status: Status;
        totalManDay?: number | null;
        createdAt: TimestampString;
  } & Team_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllTeams`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllTeamsVariables } from '@dataconnect/generated';
import { useListAllTeams } from '@dataconnect/generated/react'

export default function ListAllTeamsComponent() {
  // The `useListAllTeams` Query hook has an optional argument of type `ListAllTeamsVariables`:
  const listAllTeamsVars: ListAllTeamsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllTeams(listAllTeamsVars);
  // Variables can be defined inline as well.
  const query = useListAllTeams({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllTeamsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllTeams();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllTeams(dataConnect, listAllTeamsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllTeams(listAllTeamsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllTeams(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllTeams(dataConnect, listAllTeamsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.teams);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllWorkers
You can execute the `ListAllWorkers` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllWorkers(dc: DataConnect, vars?: ListAllWorkersVariables, options?: useDataConnectQueryOptions<ListAllWorkersData>): UseDataConnectQueryResult<ListAllWorkersData, ListAllWorkersVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllWorkers(vars?: ListAllWorkersVariables, options?: useDataConnectQueryOptions<ListAllWorkersData>): UseDataConnectQueryResult<ListAllWorkersData, ListAllWorkersVariables>;
```

### Variables
The `ListAllWorkers` Query has an optional argument of type `ListAllWorkersVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllWorkersVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllWorkers` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllWorkers` Query is of type `ListAllWorkersData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllWorkersData {
  workers: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    role?: string | null;
    team?: {
      id: UUIDString;
      name: string;
      company?: {
        id: UUIDString;
        name: string;
      } & Company_Key;
    } & Team_Key;
      payType?: string | null;
      unitPrice?: number | null;
      phone?: string | null;
      residentNumber?: string | null;
      address?: string | null;
      isActive?: boolean | null;
      joinDate?: DateString | null;
      createdAt: TimestampString;
  } & Worker_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllWorkers`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllWorkersVariables } from '@dataconnect/generated';
import { useListAllWorkers } from '@dataconnect/generated/react'

export default function ListAllWorkersComponent() {
  // The `useListAllWorkers` Query hook has an optional argument of type `ListAllWorkersVariables`:
  const listAllWorkersVars: ListAllWorkersVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllWorkers(listAllWorkersVars);
  // Variables can be defined inline as well.
  const query = useListAllWorkers({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllWorkersVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllWorkers();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllWorkers(dataConnect, listAllWorkersVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllWorkers(listAllWorkersVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllWorkers(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllWorkers(dataConnect, listAllWorkersVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.workers);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllPositions
You can execute the `ListAllPositions` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllPositions(dc: DataConnect, vars?: ListAllPositionsVariables, options?: useDataConnectQueryOptions<ListAllPositionsData>): UseDataConnectQueryResult<ListAllPositionsData, ListAllPositionsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllPositions(vars?: ListAllPositionsVariables, options?: useDataConnectQueryOptions<ListAllPositionsData>): UseDataConnectQueryResult<ListAllPositionsData, ListAllPositionsVariables>;
```

### Variables
The `ListAllPositions` Query has an optional argument of type `ListAllPositionsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllPositionsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllPositions` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllPositions` Query is of type `ListAllPositionsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllPositionsData {
  positions: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    rank?: number | null;
    color?: string | null;
    icon?: string | null;
    isDefault?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Position_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllPositions`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllPositionsVariables } from '@dataconnect/generated';
import { useListAllPositions } from '@dataconnect/generated/react'

export default function ListAllPositionsComponent() {
  // The `useListAllPositions` Query hook has an optional argument of type `ListAllPositionsVariables`:
  const listAllPositionsVars: ListAllPositionsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllPositions(listAllPositionsVars);
  // Variables can be defined inline as well.
  const query = useListAllPositions({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllPositionsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllPositions();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllPositions(dataConnect, listAllPositionsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllPositions(listAllPositionsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllPositions(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllPositions(dataConnect, listAllPositionsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.positions);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllSites
You can execute the `ListAllSites` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllSites(dc: DataConnect, vars?: ListAllSitesVariables, options?: useDataConnectQueryOptions<ListAllSitesData>): UseDataConnectQueryResult<ListAllSitesData, ListAllSitesVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllSites(vars?: ListAllSitesVariables, options?: useDataConnectQueryOptions<ListAllSitesData>): UseDataConnectQueryResult<ListAllSitesData, ListAllSitesVariables>;
```

### Variables
The `ListAllSites` Query has an optional argument of type `ListAllSitesVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllSitesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllSites` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllSites` Query is of type `ListAllSitesData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllSitesData {
  sites: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code?: string | null;
    address?: string | null;
    startDate?: DateString | null;
    endDate?: DateString | null;
    status: Status;
    createdAt: TimestampString;
  } & Site_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllSites`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllSitesVariables } from '@dataconnect/generated';
import { useListAllSites } from '@dataconnect/generated/react'

export default function ListAllSitesComponent() {
  // The `useListAllSites` Query hook has an optional argument of type `ListAllSitesVariables`:
  const listAllSitesVars: ListAllSitesVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllSites(listAllSitesVars);
  // Variables can be defined inline as well.
  const query = useListAllSites({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllSitesVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllSites();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllSites(dataConnect, listAllSitesVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSites(listAllSitesVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllSites(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSites(dataConnect, listAllSitesVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.sites);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllDailyReports
You can execute the `ListAllDailyReports` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllDailyReports(dc: DataConnect, vars?: ListAllDailyReportsVariables, options?: useDataConnectQueryOptions<ListAllDailyReportsData>): UseDataConnectQueryResult<ListAllDailyReportsData, ListAllDailyReportsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllDailyReports(vars?: ListAllDailyReportsVariables, options?: useDataConnectQueryOptions<ListAllDailyReportsData>): UseDataConnectQueryResult<ListAllDailyReportsData, ListAllDailyReportsVariables>;
```

### Variables
The `ListAllDailyReports` Query has an optional argument of type `ListAllDailyReportsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllDailyReportsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllDailyReports` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllDailyReports` Query is of type `ListAllDailyReportsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllDailyReportsData {
  dailyReports: ({
    id: UUIDString;
    legacyId?: string | null;
    date: DateString;
    writerUid?: string | null;
    companyName?: string | null;
    responsibleTeamName?: string | null;
    responsibleTeamLegacyId?: string | null;
    team: {
      id: UUIDString;
      legacyId?: string | null;
      name: string;
    } & Team_Key;
      site?: {
        id: UUIDString;
        legacyId?: string | null;
        name: string;
      } & Site_Key;
        siteName?: string | null;
        status?: string | null;
        totalManDay?: number | null;
        totalAmount?: number | null;
        weather?: string | null;
        workContent?: string | null;
        createdAt: TimestampString;
  } & DailyReport_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllDailyReports`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllDailyReportsVariables } from '@dataconnect/generated';
import { useListAllDailyReports } from '@dataconnect/generated/react'

export default function ListAllDailyReportsComponent() {
  // The `useListAllDailyReports` Query hook has an optional argument of type `ListAllDailyReportsVariables`:
  const listAllDailyReportsVars: ListAllDailyReportsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllDailyReports(listAllDailyReportsVars);
  // Variables can be defined inline as well.
  const query = useListAllDailyReports({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllDailyReportsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllDailyReports();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllDailyReports(dataConnect, listAllDailyReportsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllDailyReports(listAllDailyReportsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllDailyReports(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllDailyReports(dataConnect, listAllDailyReportsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.dailyReports);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllDailyReportWorkers
You can execute the `ListAllDailyReportWorkers` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllDailyReportWorkers(dc: DataConnect, vars?: ListAllDailyReportWorkersVariables, options?: useDataConnectQueryOptions<ListAllDailyReportWorkersData>): UseDataConnectQueryResult<ListAllDailyReportWorkersData, ListAllDailyReportWorkersVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllDailyReportWorkers(vars?: ListAllDailyReportWorkersVariables, options?: useDataConnectQueryOptions<ListAllDailyReportWorkersData>): UseDataConnectQueryResult<ListAllDailyReportWorkersData, ListAllDailyReportWorkersVariables>;
```

### Variables
The `ListAllDailyReportWorkers` Query has an optional argument of type `ListAllDailyReportWorkersVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllDailyReportWorkersVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllDailyReportWorkers` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllDailyReportWorkers` Query is of type `ListAllDailyReportWorkersData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllDailyReportWorkersData {
  dailyReportWorkers: ({
    id: UUIDString;
    dailyReport: {
      id: UUIDString;
      legacyId?: string | null;
      date: DateString;
    } & DailyReport_Key;
      worker: {
        id: UUIDString;
        legacyId?: string | null;
        name: string;
      } & Worker_Key;
        gongsu: number;
        unitPrice: number;
        amount: number;
        workDescription?: string | null;
        legacyWorkerId?: string | null;
        legacyTeamId?: string | null;
        workerName?: string | null;
        role?: string | null;
        status?: string | null;
        manDay?: number | null;
        payType?: string | null;
        salaryModel?: string | null;
        workContent?: string | null;
        createdAt: TimestampString;
  })[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllDailyReportWorkers`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllDailyReportWorkersVariables } from '@dataconnect/generated';
import { useListAllDailyReportWorkers } from '@dataconnect/generated/react'

export default function ListAllDailyReportWorkersComponent() {
  // The `useListAllDailyReportWorkers` Query hook has an optional argument of type `ListAllDailyReportWorkersVariables`:
  const listAllDailyReportWorkersVars: ListAllDailyReportWorkersVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllDailyReportWorkers(listAllDailyReportWorkersVars);
  // Variables can be defined inline as well.
  const query = useListAllDailyReportWorkers({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllDailyReportWorkersVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllDailyReportWorkers();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllDailyReportWorkers(dataConnect, listAllDailyReportWorkersVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllDailyReportWorkers(listAllDailyReportWorkersVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllDailyReportWorkers(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllDailyReportWorkers(dataConnect, listAllDailyReportWorkersVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.dailyReportWorkers);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllAppUsers
You can execute the `ListAllAppUsers` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllAppUsers(dc: DataConnect, vars?: ListAllAppUsersVariables, options?: useDataConnectQueryOptions<ListAllAppUsersData>): UseDataConnectQueryResult<ListAllAppUsersData, ListAllAppUsersVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllAppUsers(vars?: ListAllAppUsersVariables, options?: useDataConnectQueryOptions<ListAllAppUsersData>): UseDataConnectQueryResult<ListAllAppUsersData, ListAllAppUsersVariables>;
```

### Variables
The `ListAllAppUsers` Query has an optional argument of type `ListAllAppUsersVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllAppUsersVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllAppUsers` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllAppUsers` Query is of type `ListAllAppUsersData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllAppUsersData {
  appUsers: ({
    id: string;
    uid?: string | null;
    email?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
    linkedWorkerIds?: string | null;
    role?: string | null;
    lastLogin?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & AppUser_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllAppUsers`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllAppUsersVariables } from '@dataconnect/generated';
import { useListAllAppUsers } from '@dataconnect/generated/react'

export default function ListAllAppUsersComponent() {
  // The `useListAllAppUsers` Query hook has an optional argument of type `ListAllAppUsersVariables`:
  const listAllAppUsersVars: ListAllAppUsersVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllAppUsers(listAllAppUsersVars);
  // Variables can be defined inline as well.
  const query = useListAllAppUsers({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllAppUsersVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllAppUsers();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllAppUsers(dataConnect, listAllAppUsersVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAppUsers(listAllAppUsersVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllAppUsers(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAppUsers(dataConnect, listAllAppUsersVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.appUsers);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllMenuConfigs
You can execute the `ListAllMenuConfigs` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllMenuConfigs(dc: DataConnect, vars?: ListAllMenuConfigsVariables, options?: useDataConnectQueryOptions<ListAllMenuConfigsData>): UseDataConnectQueryResult<ListAllMenuConfigsData, ListAllMenuConfigsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllMenuConfigs(vars?: ListAllMenuConfigsVariables, options?: useDataConnectQueryOptions<ListAllMenuConfigsData>): UseDataConnectQueryResult<ListAllMenuConfigsData, ListAllMenuConfigsVariables>;
```

### Variables
The `ListAllMenuConfigs` Query has an optional argument of type `ListAllMenuConfigsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllMenuConfigsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllMenuConfigs` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllMenuConfigs` Query is of type `ListAllMenuConfigsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllMenuConfigsData {
  menuConfigs: ({
    id: string;
    config: string;
    updatedAt: TimestampString;
  } & MenuConfig_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllMenuConfigs`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllMenuConfigsVariables } from '@dataconnect/generated';
import { useListAllMenuConfigs } from '@dataconnect/generated/react'

export default function ListAllMenuConfigsComponent() {
  // The `useListAllMenuConfigs` Query hook has an optional argument of type `ListAllMenuConfigsVariables`:
  const listAllMenuConfigsVars: ListAllMenuConfigsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllMenuConfigs(listAllMenuConfigsVars);
  // Variables can be defined inline as well.
  const query = useListAllMenuConfigs({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllMenuConfigsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllMenuConfigs();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllMenuConfigs(dataConnect, listAllMenuConfigsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllMenuConfigs(listAllMenuConfigsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllMenuConfigs(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllMenuConfigs(dataConnect, listAllMenuConfigsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.menuConfigs);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllSystemLogs
You can execute the `ListAllSystemLogs` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllSystemLogs(dc: DataConnect, vars?: ListAllSystemLogsVariables, options?: useDataConnectQueryOptions<ListAllSystemLogsData>): UseDataConnectQueryResult<ListAllSystemLogsData, ListAllSystemLogsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllSystemLogs(vars?: ListAllSystemLogsVariables, options?: useDataConnectQueryOptions<ListAllSystemLogsData>): UseDataConnectQueryResult<ListAllSystemLogsData, ListAllSystemLogsVariables>;
```

### Variables
The `ListAllSystemLogs` Query has an optional argument of type `ListAllSystemLogsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllSystemLogsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllSystemLogs` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllSystemLogs` Query is of type `ListAllSystemLogsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllSystemLogsData {
  systemLogs: ({
    id: UUIDString;
    category: string;
    action: string;
    userEmail?: string | null;
    details?: string | null;
    createdAt: TimestampString;
  } & SystemLog_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllSystemLogs`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllSystemLogsVariables } from '@dataconnect/generated';
import { useListAllSystemLogs } from '@dataconnect/generated/react'

export default function ListAllSystemLogsComponent() {
  // The `useListAllSystemLogs` Query hook has an optional argument of type `ListAllSystemLogsVariables`:
  const listAllSystemLogsVars: ListAllSystemLogsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllSystemLogs(listAllSystemLogsVars);
  // Variables can be defined inline as well.
  const query = useListAllSystemLogs({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllSystemLogsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllSystemLogs();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllSystemLogs(dataConnect, listAllSystemLogsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSystemLogs(listAllSystemLogsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllSystemLogs(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSystemLogs(dataConnect, listAllSystemLogsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.systemLogs);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllAuditLogs
You can execute the `ListAllAuditLogs` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllAuditLogs(dc: DataConnect, vars?: ListAllAuditLogsVariables, options?: useDataConnectQueryOptions<ListAllAuditLogsData>): UseDataConnectQueryResult<ListAllAuditLogsData, ListAllAuditLogsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllAuditLogs(vars?: ListAllAuditLogsVariables, options?: useDataConnectQueryOptions<ListAllAuditLogsData>): UseDataConnectQueryResult<ListAllAuditLogsData, ListAllAuditLogsVariables>;
```

### Variables
The `ListAllAuditLogs` Query has an optional argument of type `ListAllAuditLogsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllAuditLogsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllAuditLogs` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllAuditLogs` Query is of type `ListAllAuditLogsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllAuditLogsData {
  auditLogs: ({
    id: string;
    action?: string | null;
    category?: string | null;
    actorId?: string | null;
    actorEmail?: string | null;
    targetId?: string | null;
    details?: string | null;
    timestamp?: TimestampString | null;
    createdAt: TimestampString;
  } & AuditLog_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllAuditLogs`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllAuditLogsVariables } from '@dataconnect/generated';
import { useListAllAuditLogs } from '@dataconnect/generated/react'

export default function ListAllAuditLogsComponent() {
  // The `useListAllAuditLogs` Query hook has an optional argument of type `ListAllAuditLogsVariables`:
  const listAllAuditLogsVars: ListAllAuditLogsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllAuditLogs(listAllAuditLogsVars);
  // Variables can be defined inline as well.
  const query = useListAllAuditLogs({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllAuditLogsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllAuditLogs();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllAuditLogs(dataConnect, listAllAuditLogsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAuditLogs(listAllAuditLogsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllAuditLogs(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAuditLogs(dataConnect, listAllAuditLogsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.auditLogs);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllAgents
You can execute the `ListAllAgents` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllAgents(dc: DataConnect, vars?: ListAllAgentsVariables, options?: useDataConnectQueryOptions<ListAllAgentsData>): UseDataConnectQueryResult<ListAllAgentsData, ListAllAgentsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllAgents(vars?: ListAllAgentsVariables, options?: useDataConnectQueryOptions<ListAllAgentsData>): UseDataConnectQueryResult<ListAllAgentsData, ListAllAgentsVariables>;
```

### Variables
The `ListAllAgents` Query has an optional argument of type `ListAllAgentsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllAgentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllAgents` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllAgents` Query is of type `ListAllAgentsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllAgentsData {
  agents: ({
    id: string;
    name?: string | null;
    type?: string | null;
    role?: string | null;
    capabilities?: string | null;
    systemPrompt?: string | null;
    status?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Agent_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllAgents`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllAgentsVariables } from '@dataconnect/generated';
import { useListAllAgents } from '@dataconnect/generated/react'

export default function ListAllAgentsComponent() {
  // The `useListAllAgents` Query hook has an optional argument of type `ListAllAgentsVariables`:
  const listAllAgentsVars: ListAllAgentsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllAgents(listAllAgentsVars);
  // Variables can be defined inline as well.
  const query = useListAllAgents({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllAgentsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllAgents();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllAgents(dataConnect, listAllAgentsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAgents(listAllAgentsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllAgents(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAgents(dataConnect, listAllAgentsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.agents);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllAgentConversations
You can execute the `ListAllAgentConversations` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllAgentConversations(dc: DataConnect, vars?: ListAllAgentConversationsVariables, options?: useDataConnectQueryOptions<ListAllAgentConversationsData>): UseDataConnectQueryResult<ListAllAgentConversationsData, ListAllAgentConversationsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllAgentConversations(vars?: ListAllAgentConversationsVariables, options?: useDataConnectQueryOptions<ListAllAgentConversationsData>): UseDataConnectQueryResult<ListAllAgentConversationsData, ListAllAgentConversationsVariables>;
```

### Variables
The `ListAllAgentConversations` Query has an optional argument of type `ListAllAgentConversationsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllAgentConversationsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllAgentConversations` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllAgentConversations` Query is of type `ListAllAgentConversationsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllAgentConversationsData {
  agentConversations: ({
    id: string;
    mainAgentId?: string | null;
    userId?: string | null;
    messages?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & AgentConversation_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllAgentConversations`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllAgentConversationsVariables } from '@dataconnect/generated';
import { useListAllAgentConversations } from '@dataconnect/generated/react'

export default function ListAllAgentConversationsComponent() {
  // The `useListAllAgentConversations` Query hook has an optional argument of type `ListAllAgentConversationsVariables`:
  const listAllAgentConversationsVars: ListAllAgentConversationsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllAgentConversations(listAllAgentConversationsVars);
  // Variables can be defined inline as well.
  const query = useListAllAgentConversations({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllAgentConversationsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllAgentConversations();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllAgentConversations(dataConnect, listAllAgentConversationsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAgentConversations(listAllAgentConversationsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllAgentConversations(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAgentConversations(dataConnect, listAllAgentConversationsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.agentConversations);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllSettings
You can execute the `ListAllSettings` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllSettings(dc: DataConnect, vars?: ListAllSettingsVariables, options?: useDataConnectQueryOptions<ListAllSettingsData>): UseDataConnectQueryResult<ListAllSettingsData, ListAllSettingsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllSettings(vars?: ListAllSettingsVariables, options?: useDataConnectQueryOptions<ListAllSettingsData>): UseDataConnectQueryResult<ListAllSettingsData, ListAllSettingsVariables>;
```

### Variables
The `ListAllSettings` Query has an optional argument of type `ListAllSettingsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllSettingsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllSettings` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllSettings` Query is of type `ListAllSettingsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllSettingsData {
  settings: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & Setting_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllSettings`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllSettingsVariables } from '@dataconnect/generated';
import { useListAllSettings } from '@dataconnect/generated/react'

export default function ListAllSettingsComponent() {
  // The `useListAllSettings` Query hook has an optional argument of type `ListAllSettingsVariables`:
  const listAllSettingsVars: ListAllSettingsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllSettings(listAllSettingsVars);
  // Variables can be defined inline as well.
  const query = useListAllSettings({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllSettingsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllSettings();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllSettings(dataConnect, listAllSettingsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSettings(listAllSettingsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllSettings(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSettings(dataConnect, listAllSettingsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.settings);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllSystemConfigs
You can execute the `ListAllSystemConfigs` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllSystemConfigs(dc: DataConnect, vars?: ListAllSystemConfigsVariables, options?: useDataConnectQueryOptions<ListAllSystemConfigsData>): UseDataConnectQueryResult<ListAllSystemConfigsData, ListAllSystemConfigsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllSystemConfigs(vars?: ListAllSystemConfigsVariables, options?: useDataConnectQueryOptions<ListAllSystemConfigsData>): UseDataConnectQueryResult<ListAllSystemConfigsData, ListAllSystemConfigsVariables>;
```

### Variables
The `ListAllSystemConfigs` Query has an optional argument of type `ListAllSystemConfigsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllSystemConfigsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllSystemConfigs` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllSystemConfigs` Query is of type `ListAllSystemConfigsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllSystemConfigsData {
  systemConfigs: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & SystemConfig_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllSystemConfigs`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllSystemConfigsVariables } from '@dataconnect/generated';
import { useListAllSystemConfigs } from '@dataconnect/generated/react'

export default function ListAllSystemConfigsComponent() {
  // The `useListAllSystemConfigs` Query hook has an optional argument of type `ListAllSystemConfigsVariables`:
  const listAllSystemConfigsVars: ListAllSystemConfigsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllSystemConfigs(listAllSystemConfigsVars);
  // Variables can be defined inline as well.
  const query = useListAllSystemConfigs({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllSystemConfigsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllSystemConfigs();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllSystemConfigs(dataConnect, listAllSystemConfigsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSystemConfigs(listAllSystemConfigsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllSystemConfigs(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSystemConfigs(dataConnect, listAllSystemConfigsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.systemConfigs);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllAccommodations
You can execute the `ListAllAccommodations` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllAccommodations(dc: DataConnect, vars?: ListAllAccommodationsVariables, options?: useDataConnectQueryOptions<ListAllAccommodationsData>): UseDataConnectQueryResult<ListAllAccommodationsData, ListAllAccommodationsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllAccommodations(vars?: ListAllAccommodationsVariables, options?: useDataConnectQueryOptions<ListAllAccommodationsData>): UseDataConnectQueryResult<ListAllAccommodationsData, ListAllAccommodationsVariables>;
```

### Variables
The `ListAllAccommodations` Query has an optional argument of type `ListAllAccommodationsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllAccommodationsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllAccommodations` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllAccommodations` Query is of type `ListAllAccommodationsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllAccommodationsData {
  accommodations: ({
    id: UUIDString;
  } & Accommodation_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllAccommodations`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllAccommodationsVariables } from '@dataconnect/generated';
import { useListAllAccommodations } from '@dataconnect/generated/react'

export default function ListAllAccommodationsComponent() {
  // The `useListAllAccommodations` Query hook has an optional argument of type `ListAllAccommodationsVariables`:
  const listAllAccommodationsVars: ListAllAccommodationsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllAccommodations(listAllAccommodationsVars);
  // Variables can be defined inline as well.
  const query = useListAllAccommodations({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllAccommodationsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllAccommodations();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllAccommodations(dataConnect, listAllAccommodationsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAccommodations(listAllAccommodationsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllAccommodations(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAccommodations(dataConnect, listAllAccommodationsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.accommodations);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllAccommodationAssignments
You can execute the `ListAllAccommodationAssignments` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllAccommodationAssignments(dc: DataConnect, vars?: ListAllAccommodationAssignmentsVariables, options?: useDataConnectQueryOptions<ListAllAccommodationAssignmentsData>): UseDataConnectQueryResult<ListAllAccommodationAssignmentsData, ListAllAccommodationAssignmentsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllAccommodationAssignments(vars?: ListAllAccommodationAssignmentsVariables, options?: useDataConnectQueryOptions<ListAllAccommodationAssignmentsData>): UseDataConnectQueryResult<ListAllAccommodationAssignmentsData, ListAllAccommodationAssignmentsVariables>;
```

### Variables
The `ListAllAccommodationAssignments` Query has an optional argument of type `ListAllAccommodationAssignmentsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllAccommodationAssignmentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllAccommodationAssignments` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllAccommodationAssignments` Query is of type `ListAllAccommodationAssignmentsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllAccommodationAssignmentsData {
  accommodationAssignments: ({
    id: UUIDString;
  } & AccommodationAssignment_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllAccommodationAssignments`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllAccommodationAssignmentsVariables } from '@dataconnect/generated';
import { useListAllAccommodationAssignments } from '@dataconnect/generated/react'

export default function ListAllAccommodationAssignmentsComponent() {
  // The `useListAllAccommodationAssignments` Query hook has an optional argument of type `ListAllAccommodationAssignmentsVariables`:
  const listAllAccommodationAssignmentsVars: ListAllAccommodationAssignmentsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllAccommodationAssignments(listAllAccommodationAssignmentsVars);
  // Variables can be defined inline as well.
  const query = useListAllAccommodationAssignments({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllAccommodationAssignmentsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllAccommodationAssignments();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllAccommodationAssignments(dataConnect, listAllAccommodationAssignmentsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAccommodationAssignments(listAllAccommodationAssignmentsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllAccommodationAssignments(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAccommodationAssignments(dataConnect, listAllAccommodationAssignmentsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.accommodationAssignments);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllUtilityRecords
You can execute the `ListAllUtilityRecords` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllUtilityRecords(dc: DataConnect, vars?: ListAllUtilityRecordsVariables, options?: useDataConnectQueryOptions<ListAllUtilityRecordsData>): UseDataConnectQueryResult<ListAllUtilityRecordsData, ListAllUtilityRecordsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllUtilityRecords(vars?: ListAllUtilityRecordsVariables, options?: useDataConnectQueryOptions<ListAllUtilityRecordsData>): UseDataConnectQueryResult<ListAllUtilityRecordsData, ListAllUtilityRecordsVariables>;
```

### Variables
The `ListAllUtilityRecords` Query has an optional argument of type `ListAllUtilityRecordsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllUtilityRecordsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllUtilityRecords` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllUtilityRecords` Query is of type `ListAllUtilityRecordsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllUtilityRecordsData {
  utilityRecords: ({
    id: UUIDString;
  })[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllUtilityRecords`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllUtilityRecordsVariables } from '@dataconnect/generated';
import { useListAllUtilityRecords } from '@dataconnect/generated/react'

export default function ListAllUtilityRecordsComponent() {
  // The `useListAllUtilityRecords` Query hook has an optional argument of type `ListAllUtilityRecordsVariables`:
  const listAllUtilityRecordsVars: ListAllUtilityRecordsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllUtilityRecords(listAllUtilityRecordsVars);
  // Variables can be defined inline as well.
  const query = useListAllUtilityRecords({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllUtilityRecordsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllUtilityRecords();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllUtilityRecords(dataConnect, listAllUtilityRecordsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllUtilityRecords(listAllUtilityRecordsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllUtilityRecords(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllUtilityRecords(dataConnect, listAllUtilityRecordsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.utilityRecords);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllAccommodationBillingDocuments
You can execute the `ListAllAccommodationBillingDocuments` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllAccommodationBillingDocuments(dc: DataConnect, vars?: ListAllAccommodationBillingDocumentsVariables, options?: useDataConnectQueryOptions<ListAllAccommodationBillingDocumentsData>): UseDataConnectQueryResult<ListAllAccommodationBillingDocumentsData, ListAllAccommodationBillingDocumentsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllAccommodationBillingDocuments(vars?: ListAllAccommodationBillingDocumentsVariables, options?: useDataConnectQueryOptions<ListAllAccommodationBillingDocumentsData>): UseDataConnectQueryResult<ListAllAccommodationBillingDocumentsData, ListAllAccommodationBillingDocumentsVariables>;
```

### Variables
The `ListAllAccommodationBillingDocuments` Query has an optional argument of type `ListAllAccommodationBillingDocumentsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllAccommodationBillingDocumentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllAccommodationBillingDocuments` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllAccommodationBillingDocuments` Query is of type `ListAllAccommodationBillingDocumentsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllAccommodationBillingDocumentsData {
  accommodationBillingDocuments: ({
    id: UUIDString;
  } & AccommodationBillingDocument_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllAccommodationBillingDocuments`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllAccommodationBillingDocumentsVariables } from '@dataconnect/generated';
import { useListAllAccommodationBillingDocuments } from '@dataconnect/generated/react'

export default function ListAllAccommodationBillingDocumentsComponent() {
  // The `useListAllAccommodationBillingDocuments` Query hook has an optional argument of type `ListAllAccommodationBillingDocumentsVariables`:
  const listAllAccommodationBillingDocumentsVars: ListAllAccommodationBillingDocumentsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllAccommodationBillingDocuments(listAllAccommodationBillingDocumentsVars);
  // Variables can be defined inline as well.
  const query = useListAllAccommodationBillingDocuments({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllAccommodationBillingDocumentsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllAccommodationBillingDocuments();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllAccommodationBillingDocuments(dataConnect, listAllAccommodationBillingDocumentsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAccommodationBillingDocuments(listAllAccommodationBillingDocumentsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllAccommodationBillingDocuments(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAccommodationBillingDocuments(dataConnect, listAllAccommodationBillingDocumentsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.accommodationBillingDocuments);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllAccommodationBillingLineItems
You can execute the `ListAllAccommodationBillingLineItems` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllAccommodationBillingLineItems(dc: DataConnect, vars?: ListAllAccommodationBillingLineItemsVariables, options?: useDataConnectQueryOptions<ListAllAccommodationBillingLineItemsData>): UseDataConnectQueryResult<ListAllAccommodationBillingLineItemsData, ListAllAccommodationBillingLineItemsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllAccommodationBillingLineItems(vars?: ListAllAccommodationBillingLineItemsVariables, options?: useDataConnectQueryOptions<ListAllAccommodationBillingLineItemsData>): UseDataConnectQueryResult<ListAllAccommodationBillingLineItemsData, ListAllAccommodationBillingLineItemsVariables>;
```

### Variables
The `ListAllAccommodationBillingLineItems` Query has an optional argument of type `ListAllAccommodationBillingLineItemsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllAccommodationBillingLineItemsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllAccommodationBillingLineItems` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllAccommodationBillingLineItems` Query is of type `ListAllAccommodationBillingLineItemsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllAccommodationBillingLineItemsData {
  accommodationBillingLineItems: ({
    id: UUIDString;
  } & AccommodationBillingLineItem_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllAccommodationBillingLineItems`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllAccommodationBillingLineItemsVariables } from '@dataconnect/generated';
import { useListAllAccommodationBillingLineItems } from '@dataconnect/generated/react'

export default function ListAllAccommodationBillingLineItemsComponent() {
  // The `useListAllAccommodationBillingLineItems` Query hook has an optional argument of type `ListAllAccommodationBillingLineItemsVariables`:
  const listAllAccommodationBillingLineItemsVars: ListAllAccommodationBillingLineItemsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllAccommodationBillingLineItems(listAllAccommodationBillingLineItemsVars);
  // Variables can be defined inline as well.
  const query = useListAllAccommodationBillingLineItems({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllAccommodationBillingLineItemsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllAccommodationBillingLineItems();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllAccommodationBillingLineItems(dataConnect, listAllAccommodationBillingLineItemsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAccommodationBillingLineItems(listAllAccommodationBillingLineItemsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllAccommodationBillingLineItems(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAccommodationBillingLineItems(dataConnect, listAllAccommodationBillingLineItemsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.accommodationBillingLineItems);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllAdvancePayments
You can execute the `ListAllAdvancePayments` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllAdvancePayments(dc: DataConnect, vars?: ListAllAdvancePaymentsVariables, options?: useDataConnectQueryOptions<ListAllAdvancePaymentsData>): UseDataConnectQueryResult<ListAllAdvancePaymentsData, ListAllAdvancePaymentsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllAdvancePayments(vars?: ListAllAdvancePaymentsVariables, options?: useDataConnectQueryOptions<ListAllAdvancePaymentsData>): UseDataConnectQueryResult<ListAllAdvancePaymentsData, ListAllAdvancePaymentsVariables>;
```

### Variables
The `ListAllAdvancePayments` Query has an optional argument of type `ListAllAdvancePaymentsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllAdvancePaymentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllAdvancePayments` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllAdvancePayments` Query is of type `ListAllAdvancePaymentsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllAdvancePaymentsData {
  advancePayments: ({
    id: string;
  } & AdvancePayment_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllAdvancePayments`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllAdvancePaymentsVariables } from '@dataconnect/generated';
import { useListAllAdvancePayments } from '@dataconnect/generated/react'

export default function ListAllAdvancePaymentsComponent() {
  // The `useListAllAdvancePayments` Query hook has an optional argument of type `ListAllAdvancePaymentsVariables`:
  const listAllAdvancePaymentsVars: ListAllAdvancePaymentsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllAdvancePayments(listAllAdvancePaymentsVars);
  // Variables can be defined inline as well.
  const query = useListAllAdvancePayments({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllAdvancePaymentsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllAdvancePayments();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllAdvancePayments(dataConnect, listAllAdvancePaymentsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAdvancePayments(listAllAdvancePaymentsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllAdvancePayments(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllAdvancePayments(dataConnect, listAllAdvancePaymentsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.advancePayments);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllSmartMemoCategories
You can execute the `ListAllSmartMemoCategories` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllSmartMemoCategories(dc: DataConnect, vars?: ListAllSmartMemoCategoriesVariables, options?: useDataConnectQueryOptions<ListAllSmartMemoCategoriesData>): UseDataConnectQueryResult<ListAllSmartMemoCategoriesData, ListAllSmartMemoCategoriesVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllSmartMemoCategories(vars?: ListAllSmartMemoCategoriesVariables, options?: useDataConnectQueryOptions<ListAllSmartMemoCategoriesData>): UseDataConnectQueryResult<ListAllSmartMemoCategoriesData, ListAllSmartMemoCategoriesVariables>;
```

### Variables
The `ListAllSmartMemoCategories` Query has an optional argument of type `ListAllSmartMemoCategoriesVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllSmartMemoCategoriesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllSmartMemoCategories` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllSmartMemoCategories` Query is of type `ListAllSmartMemoCategoriesData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllSmartMemoCategoriesData {
  smartMemoCategories: ({
    id: UUIDString;
  } & SmartMemoCategory_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllSmartMemoCategories`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllSmartMemoCategoriesVariables } from '@dataconnect/generated';
import { useListAllSmartMemoCategories } from '@dataconnect/generated/react'

export default function ListAllSmartMemoCategoriesComponent() {
  // The `useListAllSmartMemoCategories` Query hook has an optional argument of type `ListAllSmartMemoCategoriesVariables`:
  const listAllSmartMemoCategoriesVars: ListAllSmartMemoCategoriesVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllSmartMemoCategories(listAllSmartMemoCategoriesVars);
  // Variables can be defined inline as well.
  const query = useListAllSmartMemoCategories({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllSmartMemoCategoriesVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllSmartMemoCategories();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllSmartMemoCategories(dataConnect, listAllSmartMemoCategoriesVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSmartMemoCategories(listAllSmartMemoCategoriesVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllSmartMemoCategories(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSmartMemoCategories(dataConnect, listAllSmartMemoCategoriesVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.smartMemoCategories);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllSmartMemos
You can execute the `ListAllSmartMemos` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllSmartMemos(dc: DataConnect, vars?: ListAllSmartMemosVariables, options?: useDataConnectQueryOptions<ListAllSmartMemosData>): UseDataConnectQueryResult<ListAllSmartMemosData, ListAllSmartMemosVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllSmartMemos(vars?: ListAllSmartMemosVariables, options?: useDataConnectQueryOptions<ListAllSmartMemosData>): UseDataConnectQueryResult<ListAllSmartMemosData, ListAllSmartMemosVariables>;
```

### Variables
The `ListAllSmartMemos` Query has an optional argument of type `ListAllSmartMemosVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllSmartMemosVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllSmartMemos` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllSmartMemos` Query is of type `ListAllSmartMemosData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllSmartMemosData {
  smartMemos: ({
    id: UUIDString;
  } & SmartMemo_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllSmartMemos`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllSmartMemosVariables } from '@dataconnect/generated';
import { useListAllSmartMemos } from '@dataconnect/generated/react'

export default function ListAllSmartMemosComponent() {
  // The `useListAllSmartMemos` Query hook has an optional argument of type `ListAllSmartMemosVariables`:
  const listAllSmartMemosVars: ListAllSmartMemosVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllSmartMemos(listAllSmartMemosVars);
  // Variables can be defined inline as well.
  const query = useListAllSmartMemos({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllSmartMemosVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllSmartMemos();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllSmartMemos(dataConnect, listAllSmartMemosVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSmartMemos(listAllSmartMemosVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllSmartMemos(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllSmartMemos(dataConnect, listAllSmartMemosVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.smartMemos);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllVehicles
You can execute the `ListAllVehicles` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllVehicles(dc: DataConnect, vars?: ListAllVehiclesVariables, options?: useDataConnectQueryOptions<ListAllVehiclesData>): UseDataConnectQueryResult<ListAllVehiclesData, ListAllVehiclesVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllVehicles(vars?: ListAllVehiclesVariables, options?: useDataConnectQueryOptions<ListAllVehiclesData>): UseDataConnectQueryResult<ListAllVehiclesData, ListAllVehiclesVariables>;
```

### Variables
The `ListAllVehicles` Query has an optional argument of type `ListAllVehiclesVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllVehiclesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllVehicles` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllVehicles` Query is of type `ListAllVehiclesData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllVehiclesData {
  vehicles: ({
    id: UUIDString;
  } & Vehicle_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllVehicles`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllVehiclesVariables } from '@dataconnect/generated';
import { useListAllVehicles } from '@dataconnect/generated/react'

export default function ListAllVehiclesComponent() {
  // The `useListAllVehicles` Query hook has an optional argument of type `ListAllVehiclesVariables`:
  const listAllVehiclesVars: ListAllVehiclesVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllVehicles(listAllVehiclesVars);
  // Variables can be defined inline as well.
  const query = useListAllVehicles({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllVehiclesVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllVehicles();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllVehicles(dataConnect, listAllVehiclesVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllVehicles(listAllVehiclesVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllVehicles(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllVehicles(dataConnect, listAllVehiclesVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.vehicles);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllVehicleAssignments
You can execute the `ListAllVehicleAssignments` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllVehicleAssignments(dc: DataConnect, vars?: ListAllVehicleAssignmentsVariables, options?: useDataConnectQueryOptions<ListAllVehicleAssignmentsData>): UseDataConnectQueryResult<ListAllVehicleAssignmentsData, ListAllVehicleAssignmentsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllVehicleAssignments(vars?: ListAllVehicleAssignmentsVariables, options?: useDataConnectQueryOptions<ListAllVehicleAssignmentsData>): UseDataConnectQueryResult<ListAllVehicleAssignmentsData, ListAllVehicleAssignmentsVariables>;
```

### Variables
The `ListAllVehicleAssignments` Query has an optional argument of type `ListAllVehicleAssignmentsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllVehicleAssignmentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllVehicleAssignments` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllVehicleAssignments` Query is of type `ListAllVehicleAssignmentsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllVehicleAssignmentsData {
  vehicleAssignments: ({
    id: UUIDString;
  } & VehicleAssignment_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllVehicleAssignments`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllVehicleAssignmentsVariables } from '@dataconnect/generated';
import { useListAllVehicleAssignments } from '@dataconnect/generated/react'

export default function ListAllVehicleAssignmentsComponent() {
  // The `useListAllVehicleAssignments` Query hook has an optional argument of type `ListAllVehicleAssignmentsVariables`:
  const listAllVehicleAssignmentsVars: ListAllVehicleAssignmentsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllVehicleAssignments(listAllVehicleAssignmentsVars);
  // Variables can be defined inline as well.
  const query = useListAllVehicleAssignments({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllVehicleAssignmentsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllVehicleAssignments();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllVehicleAssignments(dataConnect, listAllVehicleAssignmentsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllVehicleAssignments(listAllVehicleAssignmentsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllVehicleAssignments(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllVehicleAssignments(dataConnect, listAllVehicleAssignmentsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.vehicleAssignments);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllVehicleExpenses
You can execute the `ListAllVehicleExpenses` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllVehicleExpenses(dc: DataConnect, vars?: ListAllVehicleExpensesVariables, options?: useDataConnectQueryOptions<ListAllVehicleExpensesData>): UseDataConnectQueryResult<ListAllVehicleExpensesData, ListAllVehicleExpensesVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllVehicleExpenses(vars?: ListAllVehicleExpensesVariables, options?: useDataConnectQueryOptions<ListAllVehicleExpensesData>): UseDataConnectQueryResult<ListAllVehicleExpensesData, ListAllVehicleExpensesVariables>;
```

### Variables
The `ListAllVehicleExpenses` Query has an optional argument of type `ListAllVehicleExpensesVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllVehicleExpensesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllVehicleExpenses` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllVehicleExpenses` Query is of type `ListAllVehicleExpensesData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllVehicleExpensesData {
  vehicleExpenses: ({
    id: UUIDString;
  } & VehicleExpense_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllVehicleExpenses`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllVehicleExpensesVariables } from '@dataconnect/generated';
import { useListAllVehicleExpenses } from '@dataconnect/generated/react'

export default function ListAllVehicleExpensesComponent() {
  // The `useListAllVehicleExpenses` Query hook has an optional argument of type `ListAllVehicleExpensesVariables`:
  const listAllVehicleExpensesVars: ListAllVehicleExpensesVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllVehicleExpenses(listAllVehicleExpensesVars);
  // Variables can be defined inline as well.
  const query = useListAllVehicleExpenses({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllVehicleExpensesVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllVehicleExpenses();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllVehicleExpenses(dataConnect, listAllVehicleExpensesVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllVehicleExpenses(listAllVehicleExpensesVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllVehicleExpenses(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllVehicleExpenses(dataConnect, listAllVehicleExpensesVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.vehicleExpenses);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllVehicleBillingDocuments
You can execute the `ListAllVehicleBillingDocuments` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllVehicleBillingDocuments(dc: DataConnect, vars?: ListAllVehicleBillingDocumentsVariables, options?: useDataConnectQueryOptions<ListAllVehicleBillingDocumentsData>): UseDataConnectQueryResult<ListAllVehicleBillingDocumentsData, ListAllVehicleBillingDocumentsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllVehicleBillingDocuments(vars?: ListAllVehicleBillingDocumentsVariables, options?: useDataConnectQueryOptions<ListAllVehicleBillingDocumentsData>): UseDataConnectQueryResult<ListAllVehicleBillingDocumentsData, ListAllVehicleBillingDocumentsVariables>;
```

### Variables
The `ListAllVehicleBillingDocuments` Query has an optional argument of type `ListAllVehicleBillingDocumentsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllVehicleBillingDocumentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllVehicleBillingDocuments` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllVehicleBillingDocuments` Query is of type `ListAllVehicleBillingDocumentsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllVehicleBillingDocumentsData {
  vehicleBillingDocuments: ({
    id: UUIDString;
  } & VehicleBillingDocument_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllVehicleBillingDocuments`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllVehicleBillingDocumentsVariables } from '@dataconnect/generated';
import { useListAllVehicleBillingDocuments } from '@dataconnect/generated/react'

export default function ListAllVehicleBillingDocumentsComponent() {
  // The `useListAllVehicleBillingDocuments` Query hook has an optional argument of type `ListAllVehicleBillingDocumentsVariables`:
  const listAllVehicleBillingDocumentsVars: ListAllVehicleBillingDocumentsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllVehicleBillingDocuments(listAllVehicleBillingDocumentsVars);
  // Variables can be defined inline as well.
  const query = useListAllVehicleBillingDocuments({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllVehicleBillingDocumentsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllVehicleBillingDocuments();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllVehicleBillingDocuments(dataConnect, listAllVehicleBillingDocumentsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllVehicleBillingDocuments(listAllVehicleBillingDocumentsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllVehicleBillingDocuments(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllVehicleBillingDocuments(dataConnect, listAllVehicleBillingDocumentsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.vehicleBillingDocuments);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllDailyDispatches
You can execute the `ListAllDailyDispatches` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllDailyDispatches(dc: DataConnect, vars?: ListAllDailyDispatchesVariables, options?: useDataConnectQueryOptions<ListAllDailyDispatchesData>): UseDataConnectQueryResult<ListAllDailyDispatchesData, ListAllDailyDispatchesVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllDailyDispatches(vars?: ListAllDailyDispatchesVariables, options?: useDataConnectQueryOptions<ListAllDailyDispatchesData>): UseDataConnectQueryResult<ListAllDailyDispatchesData, ListAllDailyDispatchesVariables>;
```

### Variables
The `ListAllDailyDispatches` Query has an optional argument of type `ListAllDailyDispatchesVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllDailyDispatchesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllDailyDispatches` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllDailyDispatches` Query is of type `ListAllDailyDispatchesData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllDailyDispatchesData {
  dailyDispatches: ({
    id: UUIDString;
  } & DailyDispatch_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllDailyDispatches`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllDailyDispatchesVariables } from '@dataconnect/generated';
import { useListAllDailyDispatches } from '@dataconnect/generated/react'

export default function ListAllDailyDispatchesComponent() {
  // The `useListAllDailyDispatches` Query hook has an optional argument of type `ListAllDailyDispatchesVariables`:
  const listAllDailyDispatchesVars: ListAllDailyDispatchesVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllDailyDispatches(listAllDailyDispatchesVars);
  // Variables can be defined inline as well.
  const query = useListAllDailyDispatches({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllDailyDispatchesVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllDailyDispatches();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllDailyDispatches(dataConnect, listAllDailyDispatchesVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllDailyDispatches(listAllDailyDispatchesVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllDailyDispatches(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllDailyDispatches(dataConnect, listAllDailyDispatchesVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.dailyDispatches);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllPayments
You can execute the `ListAllPayments` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllPayments(dc: DataConnect, vars?: ListAllPaymentsVariables, options?: useDataConnectQueryOptions<ListAllPaymentsData>): UseDataConnectQueryResult<ListAllPaymentsData, ListAllPaymentsVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllPayments(vars?: ListAllPaymentsVariables, options?: useDataConnectQueryOptions<ListAllPaymentsData>): UseDataConnectQueryResult<ListAllPaymentsData, ListAllPaymentsVariables>;
```

### Variables
The `ListAllPayments` Query has an optional argument of type `ListAllPaymentsVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllPaymentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllPayments` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllPayments` Query is of type `ListAllPaymentsData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllPaymentsData {
  payments: ({
    id: UUIDString;
  } & Payment_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllPayments`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllPaymentsVariables } from '@dataconnect/generated';
import { useListAllPayments } from '@dataconnect/generated/react'

export default function ListAllPaymentsComponent() {
  // The `useListAllPayments` Query hook has an optional argument of type `ListAllPaymentsVariables`:
  const listAllPaymentsVars: ListAllPaymentsVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllPayments(listAllPaymentsVars);
  // Variables can be defined inline as well.
  const query = useListAllPayments({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllPaymentsVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllPayments();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllPayments(dataConnect, listAllPaymentsVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllPayments(listAllPaymentsVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllPayments(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllPayments(dataConnect, listAllPaymentsVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.payments);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllTaxInvoices
You can execute the `ListAllTaxInvoices` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllTaxInvoices(dc: DataConnect, vars?: ListAllTaxInvoicesVariables, options?: useDataConnectQueryOptions<ListAllTaxInvoicesData>): UseDataConnectQueryResult<ListAllTaxInvoicesData, ListAllTaxInvoicesVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllTaxInvoices(vars?: ListAllTaxInvoicesVariables, options?: useDataConnectQueryOptions<ListAllTaxInvoicesData>): UseDataConnectQueryResult<ListAllTaxInvoicesData, ListAllTaxInvoicesVariables>;
```

### Variables
The `ListAllTaxInvoices` Query has an optional argument of type `ListAllTaxInvoicesVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllTaxInvoicesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllTaxInvoices` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllTaxInvoices` Query is of type `ListAllTaxInvoicesData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllTaxInvoicesData {
  taxInvoices: ({
    id: UUIDString;
  } & TaxInvoice_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllTaxInvoices`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllTaxInvoicesVariables } from '@dataconnect/generated';
import { useListAllTaxInvoices } from '@dataconnect/generated/react'

export default function ListAllTaxInvoicesComponent() {
  // The `useListAllTaxInvoices` Query hook has an optional argument of type `ListAllTaxInvoicesVariables`:
  const listAllTaxInvoicesVars: ListAllTaxInvoicesVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllTaxInvoices(listAllTaxInvoicesVars);
  // Variables can be defined inline as well.
  const query = useListAllTaxInvoices({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllTaxInvoicesVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllTaxInvoices();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllTaxInvoices(dataConnect, listAllTaxInvoicesVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllTaxInvoices(listAllTaxInvoicesVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllTaxInvoices(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllTaxInvoices(dataConnect, listAllTaxInvoicesVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.taxInvoices);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## ListAllReceivables
You can execute the `ListAllReceivables` Query using the following Query hook function, which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts):

```javascript
useListAllReceivables(dc: DataConnect, vars?: ListAllReceivablesVariables, options?: useDataConnectQueryOptions<ListAllReceivablesData>): UseDataConnectQueryResult<ListAllReceivablesData, ListAllReceivablesVariables>;
```
You can also pass in a `DataConnect` instance to the Query hook function.
```javascript
useListAllReceivables(vars?: ListAllReceivablesVariables, options?: useDataConnectQueryOptions<ListAllReceivablesData>): UseDataConnectQueryResult<ListAllReceivablesData, ListAllReceivablesVariables>;
```

### Variables
The `ListAllReceivables` Query has an optional argument of type `ListAllReceivablesVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface ListAllReceivablesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that calling the `ListAllReceivables` Query hook function returns a `UseQueryResult` object. This object holds the state of your Query, including whether the Query is loading, has completed, or has succeeded/failed, and any data returned by the Query, among other things.

To check the status of a Query, use the `UseQueryResult.status` field. You can also check for pending / success / error status using the `UseQueryResult.isPending`, `UseQueryResult.isSuccess`, and `UseQueryResult.isError` fields.

To access the data returned by a Query, use the `UseQueryResult.data` field. The data for the `ListAllReceivables` Query is of type `ListAllReceivablesData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface ListAllReceivablesData {
  receivables: ({
    id: UUIDString;
  } & Receivable_Key)[];
}
```

To learn more about the `UseQueryResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery).

### Using `ListAllReceivables`'s Query hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ListAllReceivablesVariables } from '@dataconnect/generated';
import { useListAllReceivables } from '@dataconnect/generated/react'

export default function ListAllReceivablesComponent() {
  // The `useListAllReceivables` Query hook has an optional argument of type `ListAllReceivablesVariables`:
  const listAllReceivablesVars: ListAllReceivablesVariables = {
    limit: ..., // optional
    offset: ..., // optional
  };

  // You don't have to do anything to "execute" the Query.
  // Call the Query hook function to get a `UseQueryResult` object which holds the state of your Query.
  const query = useListAllReceivables(listAllReceivablesVars);
  // Variables can be defined inline as well.
  const query = useListAllReceivables({ limit: ..., offset: ..., });
  // Since all variables are optional for this Query, you can omit the `ListAllReceivablesVariables` argument.
  // (as long as you don't want to provide any `options`!)
  const query = useListAllReceivables();

  // You can also pass in a `DataConnect` instance to the Query hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const query = useListAllReceivables(dataConnect, listAllReceivablesVars);

  // You can also pass in a `useDataConnectQueryOptions` object to the Query hook function.
  const options = { staleTime: 5 * 1000 };
  const query = useListAllReceivables(listAllReceivablesVars, options);
  // If you'd like to provide options without providing any variables, you must
  // pass `undefined` where you would normally pass the variables.
  const query = useListAllReceivables(undefined, options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectQueryOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = { staleTime: 5 * 1000 };
  const query = useListAllReceivables(dataConnect, listAllReceivablesVars /** or undefined */, options);

  // Then, you can render your component dynamically based on the status of the Query.
  if (query.isPending) {
    return <div>Loading...</div>;
  }

  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }

  // If the Query is successful, you can access the data returned using the `UseQueryResult.data` field.
  if (query.isSuccess) {
    console.log(query.data.receivables);
  }
  return <div>Query execution {query.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

# Mutations

The React generated SDK provides Mutations hook functions that call and return [`useDataConnectMutation`](https://react-query-firebase.invertase.dev/react/data-connect/mutations) hooks from TanStack Query Firebase.

Calling these hook functions will return a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, and the most recent data returned by the Mutation, among other things. To learn more about these hooks and how to use them, see the [TanStack Query Firebase documentation](https://react-query-firebase.invertase.dev/react/data-connect/mutations).

Mutation hooks do not execute their Mutations automatically when called. Rather, after calling the Mutation hook function and getting a `UseMutationResult` object, you must call the `UseMutationResult.mutate()` function to execute the Mutation.

To learn more about TanStack React Query's Mutations, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/guides/mutations).

## Using Mutation Hooks
Here's a general overview of how to use the generated Mutation hooks in your code:

- Mutation hook functions are not called with the arguments to the Mutation. Instead, arguments are passed to `UseMutationResult.mutate()`.
- If the Mutation has no variables, the `mutate()` function does not require arguments.
- If the Mutation has any required variables, the `mutate()` function will require at least one argument: an object that contains all the required variables for the Mutation.
- If the Mutation has some required and some optional variables, only required variables are necessary in the variables argument object, and optional variables may be provided as well.
- If all of the Mutation's variables are optional, the Mutation hook function does not require any arguments.
- Mutation hook functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.
- Mutation hooks also accept an `options` argument of type `useDataConnectMutationOptions`. To learn more about the `options` argument, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/guides/mutations#mutation-side-effects).
  - `UseMutationResult.mutate()` also accepts an `options` argument of type `useDataConnectMutationOptions`.
  - ***Special case:*** If the Mutation has no arguments (or all optional arguments and you wish to provide none), and you want to pass `options` to `UseMutationResult.mutate()`, you must pass `undefined` where you would normally pass the Mutation's arguments, and then may provide the options argument.

Below are examples of how to use the `example` connector's generated Mutation hook functions to execute each Mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#operations-react-angular).

## CreateCompany
You can execute the `CreateCompany` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateCompany(options?: useDataConnectMutationOptions<CreateCompanyData, FirebaseError, CreateCompanyVariables>): UseDataConnectMutationResult<CreateCompanyData, CreateCompanyVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateCompany(dc: DataConnect, options?: useDataConnectMutationOptions<CreateCompanyData, FirebaseError, CreateCompanyVariables>): UseDataConnectMutationResult<CreateCompanyData, CreateCompanyVariables>;
```

### Variables
The `CreateCompany` Mutation requires an argument of type `CreateCompanyVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateCompanyVariables {
  name: string;
  code: string;
  legacyId?: string | null;
  businessNumber?: string | null;
  ceoName?: string | null;
  type?: string | null;
  status?: Status | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  ceoResidentNumber?: string | null;
  color?: string | null;
}
```
### Return Type
Recall that calling the `CreateCompany` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateCompany` Mutation is of type `CreateCompanyData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateCompanyData {
  company_insert: Company_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateCompany`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateCompanyVariables } from '@dataconnect/generated';
import { useCreateCompany } from '@dataconnect/generated/react'

export default function CreateCompanyComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateCompany();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateCompany(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateCompany(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateCompany(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateCompany` Mutation requires an argument of type `CreateCompanyVariables`:
  const createCompanyVars: CreateCompanyVariables = {
    name: ..., 
    code: ..., 
    legacyId: ..., // optional
    businessNumber: ..., // optional
    ceoName: ..., // optional
    type: ..., // optional
    status: ..., // optional
    address: ..., // optional
    phone: ..., // optional
    email: ..., // optional
    bankName: ..., // optional
    accountNumber: ..., // optional
    accountHolder: ..., // optional
    ceoResidentNumber: ..., // optional
    color: ..., // optional
  };
  mutation.mutate(createCompanyVars);
  // Variables can be defined inline as well.
  mutation.mutate({ name: ..., code: ..., legacyId: ..., businessNumber: ..., ceoName: ..., type: ..., status: ..., address: ..., phone: ..., email: ..., bankName: ..., accountNumber: ..., accountHolder: ..., ceoResidentNumber: ..., color: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createCompanyVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.company_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateTeam
You can execute the `CreateTeam` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateTeam(options?: useDataConnectMutationOptions<CreateTeamData, FirebaseError, CreateTeamVariables>): UseDataConnectMutationResult<CreateTeamData, CreateTeamVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateTeam(dc: DataConnect, options?: useDataConnectMutationOptions<CreateTeamData, FirebaseError, CreateTeamVariables>): UseDataConnectMutationResult<CreateTeamData, CreateTeamVariables>;
```

### Variables
The `CreateTeam` Mutation requires an argument of type `CreateTeamVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateTeamVariables {
  name: string;
  legacyId?: string | null;
  companyId?: UUIDString | null;
  leaderId?: UUIDString | null;
  type?: string | null;
  status?: Status | null;
  totalManDay?: number | null;
}
```
### Return Type
Recall that calling the `CreateTeam` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateTeam` Mutation is of type `CreateTeamData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateTeamData {
  team_insert: Team_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateTeam`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateTeamVariables } from '@dataconnect/generated';
import { useCreateTeam } from '@dataconnect/generated/react'

export default function CreateTeamComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateTeam();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateTeam(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateTeam(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateTeam(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateTeam` Mutation requires an argument of type `CreateTeamVariables`:
  const createTeamVars: CreateTeamVariables = {
    name: ..., 
    legacyId: ..., // optional
    companyId: ..., // optional
    leaderId: ..., // optional
    type: ..., // optional
    status: ..., // optional
    totalManDay: ..., // optional
  };
  mutation.mutate(createTeamVars);
  // Variables can be defined inline as well.
  mutation.mutate({ name: ..., legacyId: ..., companyId: ..., leaderId: ..., type: ..., status: ..., totalManDay: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createTeamVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.team_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateWorker
You can execute the `CreateWorker` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateWorker(options?: useDataConnectMutationOptions<CreateWorkerData, FirebaseError, CreateWorkerVariables>): UseDataConnectMutationResult<CreateWorkerData, CreateWorkerVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateWorker(dc: DataConnect, options?: useDataConnectMutationOptions<CreateWorkerData, FirebaseError, CreateWorkerVariables>): UseDataConnectMutationResult<CreateWorkerData, CreateWorkerVariables>;
```

### Variables
The `CreateWorker` Mutation requires an argument of type `CreateWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateWorkerVariables {
  name: string;
  legacyId?: string | null;
  teamId?: UUIDString | null;
  role?: string | null;
  payType?: string | null;
  unitPrice?: number | null;
  residentNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  isActive?: boolean | null;
  joinDate?: DateString | null;
}
```
### Return Type
Recall that calling the `CreateWorker` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateWorker` Mutation is of type `CreateWorkerData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateWorkerData {
  worker_insert: Worker_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateWorker`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateWorkerVariables } from '@dataconnect/generated';
import { useCreateWorker } from '@dataconnect/generated/react'

export default function CreateWorkerComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateWorker();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateWorker(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateWorker(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateWorker(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateWorker` Mutation requires an argument of type `CreateWorkerVariables`:
  const createWorkerVars: CreateWorkerVariables = {
    name: ..., 
    legacyId: ..., // optional
    teamId: ..., // optional
    role: ..., // optional
    payType: ..., // optional
    unitPrice: ..., // optional
    residentNumber: ..., // optional
    phone: ..., // optional
    address: ..., // optional
    bankAccount: ..., // optional
    bankName: ..., // optional
    isActive: ..., // optional
    joinDate: ..., // optional
  };
  mutation.mutate(createWorkerVars);
  // Variables can be defined inline as well.
  mutation.mutate({ name: ..., legacyId: ..., teamId: ..., role: ..., payType: ..., unitPrice: ..., residentNumber: ..., phone: ..., address: ..., bankAccount: ..., bankName: ..., isActive: ..., joinDate: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createWorkerVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.worker_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateSite
You can execute the `CreateSite` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateSite(options?: useDataConnectMutationOptions<CreateSiteData, FirebaseError, CreateSiteVariables>): UseDataConnectMutationResult<CreateSiteData, CreateSiteVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateSite(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSiteData, FirebaseError, CreateSiteVariables>): UseDataConnectMutationResult<CreateSiteData, CreateSiteVariables>;
```

### Variables
The `CreateSite` Mutation requires an argument of type `CreateSiteVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateSiteVariables {
  name: string;
  legacyId?: string | null;
  code?: string | null;
  address?: string | null;
  startDate?: DateString | null;
  endDate?: DateString | null;
  status?: Status | null;
}
```
### Return Type
Recall that calling the `CreateSite` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateSite` Mutation is of type `CreateSiteData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateSiteData {
  site_insert: Site_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateSite`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateSiteVariables } from '@dataconnect/generated';
import { useCreateSite } from '@dataconnect/generated/react'

export default function CreateSiteComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateSite();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateSite(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSite(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSite(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateSite` Mutation requires an argument of type `CreateSiteVariables`:
  const createSiteVars: CreateSiteVariables = {
    name: ..., 
    legacyId: ..., // optional
    code: ..., // optional
    address: ..., // optional
    startDate: ..., // optional
    endDate: ..., // optional
    status: ..., // optional
  };
  mutation.mutate(createSiteVars);
  // Variables can be defined inline as well.
  mutation.mutate({ name: ..., legacyId: ..., code: ..., address: ..., startDate: ..., endDate: ..., status: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createSiteVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.site_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateDailyReport
You can execute the `CreateDailyReport` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateDailyReport(options?: useDataConnectMutationOptions<CreateDailyReportData, FirebaseError, CreateDailyReportVariables>): UseDataConnectMutationResult<CreateDailyReportData, CreateDailyReportVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateDailyReport(dc: DataConnect, options?: useDataConnectMutationOptions<CreateDailyReportData, FirebaseError, CreateDailyReportVariables>): UseDataConnectMutationResult<CreateDailyReportData, CreateDailyReportVariables>;
```

### Variables
The `CreateDailyReport` Mutation requires an argument of type `CreateDailyReportVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateDailyReportVariables {
  date: DateString;
  legacyId?: string | null;
  teamId: UUIDString;
  siteId?: UUIDString | null;
  siteName?: string | null;
  status?: string | null;
  totalManDay?: number | null;
  totalAmount?: number | null;
  weather?: string | null;
  writerUid?: string | null;
  companyName?: string | null;
  responsibleTeamName?: string | null;
  responsibleTeamLegacyId?: string | null;
  workContent?: string | null;
}
```
### Return Type
Recall that calling the `CreateDailyReport` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateDailyReport` Mutation is of type `CreateDailyReportData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateDailyReportData {
  dailyReport_insert: DailyReport_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateDailyReport`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateDailyReportVariables } from '@dataconnect/generated';
import { useCreateDailyReport } from '@dataconnect/generated/react'

export default function CreateDailyReportComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateDailyReport();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateDailyReport(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateDailyReport(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateDailyReport(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateDailyReport` Mutation requires an argument of type `CreateDailyReportVariables`:
  const createDailyReportVars: CreateDailyReportVariables = {
    date: ..., 
    legacyId: ..., // optional
    teamId: ..., 
    siteId: ..., // optional
    siteName: ..., // optional
    status: ..., // optional
    totalManDay: ..., // optional
    totalAmount: ..., // optional
    weather: ..., // optional
    writerUid: ..., // optional
    companyName: ..., // optional
    responsibleTeamName: ..., // optional
    responsibleTeamLegacyId: ..., // optional
    workContent: ..., // optional
  };
  mutation.mutate(createDailyReportVars);
  // Variables can be defined inline as well.
  mutation.mutate({ date: ..., legacyId: ..., teamId: ..., siteId: ..., siteName: ..., status: ..., totalManDay: ..., totalAmount: ..., weather: ..., writerUid: ..., companyName: ..., responsibleTeamName: ..., responsibleTeamLegacyId: ..., workContent: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createDailyReportVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.dailyReport_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateDailyReportWorker
You can execute the `CreateDailyReportWorker` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateDailyReportWorker(options?: useDataConnectMutationOptions<CreateDailyReportWorkerData, FirebaseError, CreateDailyReportWorkerVariables>): UseDataConnectMutationResult<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateDailyReportWorker(dc: DataConnect, options?: useDataConnectMutationOptions<CreateDailyReportWorkerData, FirebaseError, CreateDailyReportWorkerVariables>): UseDataConnectMutationResult<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;
```

### Variables
The `CreateDailyReportWorker` Mutation requires an argument of type `CreateDailyReportWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateDailyReportWorkerVariables {
  dailyReportId: UUIDString;
  workerId: UUIDString;
  gongsu: number;
  unitPrice: number;
  amount: number;
  workDescription?: string | null;
  legacyWorkerId?: string | null;
  legacyTeamId?: string | null;
  workerName?: string | null;
  role?: string | null;
  status?: string | null;
  manDay?: number | null;
  payType?: string | null;
  salaryModel?: string | null;
  workContent?: string | null;
}
```
### Return Type
Recall that calling the `CreateDailyReportWorker` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateDailyReportWorker` Mutation is of type `CreateDailyReportWorkerData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateDailyReportWorkerData {
  dailyReportWorker_insert: DailyReportWorker_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateDailyReportWorker`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateDailyReportWorkerVariables } from '@dataconnect/generated';
import { useCreateDailyReportWorker } from '@dataconnect/generated/react'

export default function CreateDailyReportWorkerComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateDailyReportWorker();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateDailyReportWorker(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateDailyReportWorker(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateDailyReportWorker(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateDailyReportWorker` Mutation requires an argument of type `CreateDailyReportWorkerVariables`:
  const createDailyReportWorkerVars: CreateDailyReportWorkerVariables = {
    dailyReportId: ..., 
    workerId: ..., 
    gongsu: ..., 
    unitPrice: ..., 
    amount: ..., 
    workDescription: ..., // optional
    legacyWorkerId: ..., // optional
    legacyTeamId: ..., // optional
    workerName: ..., // optional
    role: ..., // optional
    status: ..., // optional
    manDay: ..., // optional
    payType: ..., // optional
    salaryModel: ..., // optional
    workContent: ..., // optional
  };
  mutation.mutate(createDailyReportWorkerVars);
  // Variables can be defined inline as well.
  mutation.mutate({ dailyReportId: ..., workerId: ..., gongsu: ..., unitPrice: ..., amount: ..., workDescription: ..., legacyWorkerId: ..., legacyTeamId: ..., workerName: ..., role: ..., status: ..., manDay: ..., payType: ..., salaryModel: ..., workContent: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createDailyReportWorkerVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.dailyReportWorker_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateDailyReportWorker
You can execute the `UpdateDailyReportWorker` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateDailyReportWorker(options?: useDataConnectMutationOptions<UpdateDailyReportWorkerData, FirebaseError, UpdateDailyReportWorkerVariables>): UseDataConnectMutationResult<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateDailyReportWorker(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateDailyReportWorkerData, FirebaseError, UpdateDailyReportWorkerVariables>): UseDataConnectMutationResult<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;
```

### Variables
The `UpdateDailyReportWorker` Mutation requires an argument of type `UpdateDailyReportWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateDailyReportWorkerVariables {
  dailyReportId: UUIDString;
  workerId: UUIDString;
  gongsu?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
  workDescription?: string | null;
  legacyWorkerId?: string | null;
  legacyTeamId?: string | null;
  workerName?: string | null;
  role?: string | null;
  status?: string | null;
  manDay?: number | null;
  payType?: string | null;
  salaryModel?: string | null;
  workContent?: string | null;
}
```
### Return Type
Recall that calling the `UpdateDailyReportWorker` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateDailyReportWorker` Mutation is of type `UpdateDailyReportWorkerData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateDailyReportWorkerData {
  dailyReportWorker_update?: DailyReportWorker_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateDailyReportWorker`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateDailyReportWorkerVariables } from '@dataconnect/generated';
import { useUpdateDailyReportWorker } from '@dataconnect/generated/react'

export default function UpdateDailyReportWorkerComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateDailyReportWorker();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateDailyReportWorker(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateDailyReportWorker(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateDailyReportWorker(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateDailyReportWorker` Mutation requires an argument of type `UpdateDailyReportWorkerVariables`:
  const updateDailyReportWorkerVars: UpdateDailyReportWorkerVariables = {
    dailyReportId: ..., 
    workerId: ..., 
    gongsu: ..., // optional
    unitPrice: ..., // optional
    amount: ..., // optional
    workDescription: ..., // optional
    legacyWorkerId: ..., // optional
    legacyTeamId: ..., // optional
    workerName: ..., // optional
    role: ..., // optional
    status: ..., // optional
    manDay: ..., // optional
    payType: ..., // optional
    salaryModel: ..., // optional
    workContent: ..., // optional
  };
  mutation.mutate(updateDailyReportWorkerVars);
  // Variables can be defined inline as well.
  mutation.mutate({ dailyReportId: ..., workerId: ..., gongsu: ..., unitPrice: ..., amount: ..., workDescription: ..., legacyWorkerId: ..., legacyTeamId: ..., workerName: ..., role: ..., status: ..., manDay: ..., payType: ..., salaryModel: ..., workContent: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateDailyReportWorkerVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.dailyReportWorker_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteDailyReportWorker
You can execute the `DeleteDailyReportWorker` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteDailyReportWorker(options?: useDataConnectMutationOptions<DeleteDailyReportWorkerData, FirebaseError, DeleteDailyReportWorkerVariables>): UseDataConnectMutationResult<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteDailyReportWorker(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteDailyReportWorkerData, FirebaseError, DeleteDailyReportWorkerVariables>): UseDataConnectMutationResult<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;
```

### Variables
The `DeleteDailyReportWorker` Mutation requires an argument of type `DeleteDailyReportWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteDailyReportWorkerVariables {
  dailyReportId: UUIDString;
  workerId: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteDailyReportWorker` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteDailyReportWorker` Mutation is of type `DeleteDailyReportWorkerData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteDailyReportWorkerData {
  dailyReportWorker_delete?: DailyReportWorker_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteDailyReportWorker`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteDailyReportWorkerVariables } from '@dataconnect/generated';
import { useDeleteDailyReportWorker } from '@dataconnect/generated/react'

export default function DeleteDailyReportWorkerComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteDailyReportWorker();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteDailyReportWorker(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteDailyReportWorker(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteDailyReportWorker(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteDailyReportWorker` Mutation requires an argument of type `DeleteDailyReportWorkerVariables`:
  const deleteDailyReportWorkerVars: DeleteDailyReportWorkerVariables = {
    dailyReportId: ..., 
    workerId: ..., 
  };
  mutation.mutate(deleteDailyReportWorkerVars);
  // Variables can be defined inline as well.
  mutation.mutate({ dailyReportId: ..., workerId: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteDailyReportWorkerVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.dailyReportWorker_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreatePosition
You can execute the `CreatePosition` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreatePosition(options?: useDataConnectMutationOptions<CreatePositionData, FirebaseError, CreatePositionVariables>): UseDataConnectMutationResult<CreatePositionData, CreatePositionVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreatePosition(dc: DataConnect, options?: useDataConnectMutationOptions<CreatePositionData, FirebaseError, CreatePositionVariables>): UseDataConnectMutationResult<CreatePositionData, CreatePositionVariables>;
```

### Variables
The `CreatePosition` Mutation requires an argument of type `CreatePositionVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreatePositionVariables {
  name: string;
  legacyId?: string | null;
  rank?: number | null;
  color?: string | null;
  icon?: string | null;
  isDefault?: boolean | null;
}
```
### Return Type
Recall that calling the `CreatePosition` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreatePosition` Mutation is of type `CreatePositionData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreatePositionData {
  position_insert: Position_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreatePosition`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreatePositionVariables } from '@dataconnect/generated';
import { useCreatePosition } from '@dataconnect/generated/react'

export default function CreatePositionComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreatePosition();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreatePosition(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreatePosition(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreatePosition(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreatePosition` Mutation requires an argument of type `CreatePositionVariables`:
  const createPositionVars: CreatePositionVariables = {
    name: ..., 
    legacyId: ..., // optional
    rank: ..., // optional
    color: ..., // optional
    icon: ..., // optional
    isDefault: ..., // optional
  };
  mutation.mutate(createPositionVars);
  // Variables can be defined inline as well.
  mutation.mutate({ name: ..., legacyId: ..., rank: ..., color: ..., icon: ..., isDefault: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createPositionVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.position_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateAuditLog
You can execute the `CreateAuditLog` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateAuditLog(options?: useDataConnectMutationOptions<CreateAuditLogData, FirebaseError, CreateAuditLogVariables>): UseDataConnectMutationResult<CreateAuditLogData, CreateAuditLogVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateAuditLog(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAuditLogData, FirebaseError, CreateAuditLogVariables>): UseDataConnectMutationResult<CreateAuditLogData, CreateAuditLogVariables>;
```

### Variables
The `CreateAuditLog` Mutation requires an argument of type `CreateAuditLogVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateAuditLogVariables {
  id: string;
  action?: string | null;
  category?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  targetId?: string | null;
  details?: string | null;
  timestamp?: TimestampString | null;
}
```
### Return Type
Recall that calling the `CreateAuditLog` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateAuditLog` Mutation is of type `CreateAuditLogData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateAuditLogData {
  auditLog_insert: AuditLog_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateAuditLog`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateAuditLogVariables } from '@dataconnect/generated';
import { useCreateAuditLog } from '@dataconnect/generated/react'

export default function CreateAuditLogComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateAuditLog();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateAuditLog(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAuditLog(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAuditLog(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateAuditLog` Mutation requires an argument of type `CreateAuditLogVariables`:
  const createAuditLogVars: CreateAuditLogVariables = {
    id: ..., 
    action: ..., // optional
    category: ..., // optional
    actorId: ..., // optional
    actorEmail: ..., // optional
    targetId: ..., // optional
    details: ..., // optional
    timestamp: ..., // optional
  };
  mutation.mutate(createAuditLogVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., action: ..., category: ..., actorId: ..., actorEmail: ..., targetId: ..., details: ..., timestamp: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createAuditLogVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.auditLog_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateAgent
You can execute the `CreateAgent` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateAgent(options?: useDataConnectMutationOptions<CreateAgentData, FirebaseError, CreateAgentVariables>): UseDataConnectMutationResult<CreateAgentData, CreateAgentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateAgent(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAgentData, FirebaseError, CreateAgentVariables>): UseDataConnectMutationResult<CreateAgentData, CreateAgentVariables>;
```

### Variables
The `CreateAgent` Mutation requires an argument of type `CreateAgentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateAgentVariables {
  id: string;
  name?: string | null;
  type?: string | null;
  role?: string | null;
  capabilities?: string | null;
  systemPrompt?: string | null;
  status?: string | null;
}
```
### Return Type
Recall that calling the `CreateAgent` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateAgent` Mutation is of type `CreateAgentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateAgentData {
  agent_insert: Agent_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateAgent`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateAgentVariables } from '@dataconnect/generated';
import { useCreateAgent } from '@dataconnect/generated/react'

export default function CreateAgentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateAgent();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateAgent(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAgent(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAgent(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateAgent` Mutation requires an argument of type `CreateAgentVariables`:
  const createAgentVars: CreateAgentVariables = {
    id: ..., 
    name: ..., // optional
    type: ..., // optional
    role: ..., // optional
    capabilities: ..., // optional
    systemPrompt: ..., // optional
    status: ..., // optional
  };
  mutation.mutate(createAgentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., name: ..., type: ..., role: ..., capabilities: ..., systemPrompt: ..., status: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createAgentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.agent_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateAgentConversation
You can execute the `CreateAgentConversation` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateAgentConversation(options?: useDataConnectMutationOptions<CreateAgentConversationData, FirebaseError, CreateAgentConversationVariables>): UseDataConnectMutationResult<CreateAgentConversationData, CreateAgentConversationVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateAgentConversation(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAgentConversationData, FirebaseError, CreateAgentConversationVariables>): UseDataConnectMutationResult<CreateAgentConversationData, CreateAgentConversationVariables>;
```

### Variables
The `CreateAgentConversation` Mutation requires an argument of type `CreateAgentConversationVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateAgentConversationVariables {
  id: string;
  mainAgentId?: string | null;
  userId?: string | null;
  messages?: string | null;
}
```
### Return Type
Recall that calling the `CreateAgentConversation` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateAgentConversation` Mutation is of type `CreateAgentConversationData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateAgentConversationData {
  agentConversation_insert: AgentConversation_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateAgentConversation`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateAgentConversationVariables } from '@dataconnect/generated';
import { useCreateAgentConversation } from '@dataconnect/generated/react'

export default function CreateAgentConversationComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateAgentConversation();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateAgentConversation(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAgentConversation(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAgentConversation(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateAgentConversation` Mutation requires an argument of type `CreateAgentConversationVariables`:
  const createAgentConversationVars: CreateAgentConversationVariables = {
    id: ..., 
    mainAgentId: ..., // optional
    userId: ..., // optional
    messages: ..., // optional
  };
  mutation.mutate(createAgentConversationVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., mainAgentId: ..., userId: ..., messages: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createAgentConversationVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.agentConversation_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateSetting
You can execute the `CreateSetting` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateSetting(options?: useDataConnectMutationOptions<CreateSettingData, FirebaseError, CreateSettingVariables>): UseDataConnectMutationResult<CreateSettingData, CreateSettingVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateSetting(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSettingData, FirebaseError, CreateSettingVariables>): UseDataConnectMutationResult<CreateSettingData, CreateSettingVariables>;
```

### Variables
The `CreateSetting` Mutation requires an argument of type `CreateSettingVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateSettingVariables {
  id: string;
  data: string;
}
```
### Return Type
Recall that calling the `CreateSetting` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateSetting` Mutation is of type `CreateSettingData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateSettingData {
  setting_insert: Setting_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateSetting`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateSettingVariables } from '@dataconnect/generated';
import { useCreateSetting } from '@dataconnect/generated/react'

export default function CreateSettingComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateSetting();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateSetting(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSetting(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSetting(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateSetting` Mutation requires an argument of type `CreateSettingVariables`:
  const createSettingVars: CreateSettingVariables = {
    id: ..., 
    data: ..., 
  };
  mutation.mutate(createSettingVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., data: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createSettingVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.setting_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateSetting
You can execute the `UpdateSetting` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateSetting(options?: useDataConnectMutationOptions<UpdateSettingData, FirebaseError, UpdateSettingVariables>): UseDataConnectMutationResult<UpdateSettingData, UpdateSettingVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateSetting(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateSettingData, FirebaseError, UpdateSettingVariables>): UseDataConnectMutationResult<UpdateSettingData, UpdateSettingVariables>;
```

### Variables
The `UpdateSetting` Mutation requires an argument of type `UpdateSettingVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateSettingVariables {
  id: string;
  data: string;
}
```
### Return Type
Recall that calling the `UpdateSetting` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateSetting` Mutation is of type `UpdateSettingData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateSettingData {
  setting_update?: Setting_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateSetting`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateSettingVariables } from '@dataconnect/generated';
import { useUpdateSetting } from '@dataconnect/generated/react'

export default function UpdateSettingComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateSetting();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateSetting(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateSetting(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateSetting(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateSetting` Mutation requires an argument of type `UpdateSettingVariables`:
  const updateSettingVars: UpdateSettingVariables = {
    id: ..., 
    data: ..., 
  };
  mutation.mutate(updateSettingVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., data: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateSettingVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.setting_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateSystemConfig
You can execute the `CreateSystemConfig` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateSystemConfig(options?: useDataConnectMutationOptions<CreateSystemConfigData, FirebaseError, CreateSystemConfigVariables>): UseDataConnectMutationResult<CreateSystemConfigData, CreateSystemConfigVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateSystemConfig(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSystemConfigData, FirebaseError, CreateSystemConfigVariables>): UseDataConnectMutationResult<CreateSystemConfigData, CreateSystemConfigVariables>;
```

### Variables
The `CreateSystemConfig` Mutation requires an argument of type `CreateSystemConfigVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateSystemConfigVariables {
  id: string;
  data: string;
}
```
### Return Type
Recall that calling the `CreateSystemConfig` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateSystemConfig` Mutation is of type `CreateSystemConfigData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateSystemConfigData {
  systemConfig_insert: SystemConfig_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateSystemConfig`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateSystemConfigVariables } from '@dataconnect/generated';
import { useCreateSystemConfig } from '@dataconnect/generated/react'

export default function CreateSystemConfigComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateSystemConfig();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateSystemConfig(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSystemConfig(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSystemConfig(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateSystemConfig` Mutation requires an argument of type `CreateSystemConfigVariables`:
  const createSystemConfigVars: CreateSystemConfigVariables = {
    id: ..., 
    data: ..., 
  };
  mutation.mutate(createSystemConfigVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., data: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createSystemConfigVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.systemConfig_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateSystemConfig
You can execute the `UpdateSystemConfig` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateSystemConfig(options?: useDataConnectMutationOptions<UpdateSystemConfigData, FirebaseError, UpdateSystemConfigVariables>): UseDataConnectMutationResult<UpdateSystemConfigData, UpdateSystemConfigVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateSystemConfig(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateSystemConfigData, FirebaseError, UpdateSystemConfigVariables>): UseDataConnectMutationResult<UpdateSystemConfigData, UpdateSystemConfigVariables>;
```

### Variables
The `UpdateSystemConfig` Mutation requires an argument of type `UpdateSystemConfigVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateSystemConfigVariables {
  id: string;
  data: string;
}
```
### Return Type
Recall that calling the `UpdateSystemConfig` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateSystemConfig` Mutation is of type `UpdateSystemConfigData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateSystemConfigData {
  systemConfig_update?: SystemConfig_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateSystemConfig`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateSystemConfigVariables } from '@dataconnect/generated';
import { useUpdateSystemConfig } from '@dataconnect/generated/react'

export default function UpdateSystemConfigComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateSystemConfig();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateSystemConfig(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateSystemConfig(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateSystemConfig(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateSystemConfig` Mutation requires an argument of type `UpdateSystemConfigVariables`:
  const updateSystemConfigVars: UpdateSystemConfigVariables = {
    id: ..., 
    data: ..., 
  };
  mutation.mutate(updateSystemConfigVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., data: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateSystemConfigVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.systemConfig_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeletePosition
You can execute the `DeletePosition` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeletePosition(options?: useDataConnectMutationOptions<DeletePositionData, FirebaseError, DeletePositionVariables>): UseDataConnectMutationResult<DeletePositionData, DeletePositionVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeletePosition(dc: DataConnect, options?: useDataConnectMutationOptions<DeletePositionData, FirebaseError, DeletePositionVariables>): UseDataConnectMutationResult<DeletePositionData, DeletePositionVariables>;
```

### Variables
The `DeletePosition` Mutation requires an argument of type `DeletePositionVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeletePositionVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeletePosition` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeletePosition` Mutation is of type `DeletePositionData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeletePositionData {
  position_delete?: Position_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeletePosition`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeletePositionVariables } from '@dataconnect/generated';
import { useDeletePosition } from '@dataconnect/generated/react'

export default function DeletePositionComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeletePosition();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeletePosition(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeletePosition(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeletePosition(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeletePosition` Mutation requires an argument of type `DeletePositionVariables`:
  const deletePositionVars: DeletePositionVariables = {
    id: ..., 
  };
  mutation.mutate(deletePositionVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deletePositionVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.position_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateCompany
You can execute the `UpdateCompany` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateCompany(options?: useDataConnectMutationOptions<UpdateCompanyData, FirebaseError, UpdateCompanyVariables>): UseDataConnectMutationResult<UpdateCompanyData, UpdateCompanyVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateCompany(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateCompanyData, FirebaseError, UpdateCompanyVariables>): UseDataConnectMutationResult<UpdateCompanyData, UpdateCompanyVariables>;
```

### Variables
The `UpdateCompany` Mutation requires an argument of type `UpdateCompanyVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateCompanyVariables {
  id: UUIDString;
  name?: string | null;
  code?: string | null;
  businessNumber?: string | null;
  ceoName?: string | null;
  type?: string | null;
  status?: Status | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  ceoResidentNumber?: string | null;
  color?: string | null;
}
```
### Return Type
Recall that calling the `UpdateCompany` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateCompany` Mutation is of type `UpdateCompanyData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateCompanyData {
  company_update?: Company_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateCompany`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateCompanyVariables } from '@dataconnect/generated';
import { useUpdateCompany } from '@dataconnect/generated/react'

export default function UpdateCompanyComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateCompany();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateCompany(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateCompany(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateCompany(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateCompany` Mutation requires an argument of type `UpdateCompanyVariables`:
  const updateCompanyVars: UpdateCompanyVariables = {
    id: ..., 
    name: ..., // optional
    code: ..., // optional
    businessNumber: ..., // optional
    ceoName: ..., // optional
    type: ..., // optional
    status: ..., // optional
    address: ..., // optional
    phone: ..., // optional
    email: ..., // optional
    bankName: ..., // optional
    accountNumber: ..., // optional
    accountHolder: ..., // optional
    ceoResidentNumber: ..., // optional
    color: ..., // optional
  };
  mutation.mutate(updateCompanyVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., name: ..., code: ..., businessNumber: ..., ceoName: ..., type: ..., status: ..., address: ..., phone: ..., email: ..., bankName: ..., accountNumber: ..., accountHolder: ..., ceoResidentNumber: ..., color: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateCompanyVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.company_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteCompany
You can execute the `DeleteCompany` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteCompany(options?: useDataConnectMutationOptions<DeleteCompanyData, FirebaseError, DeleteCompanyVariables>): UseDataConnectMutationResult<DeleteCompanyData, DeleteCompanyVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteCompany(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteCompanyData, FirebaseError, DeleteCompanyVariables>): UseDataConnectMutationResult<DeleteCompanyData, DeleteCompanyVariables>;
```

### Variables
The `DeleteCompany` Mutation requires an argument of type `DeleteCompanyVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteCompanyVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteCompany` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteCompany` Mutation is of type `DeleteCompanyData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteCompanyData {
  company_delete?: Company_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteCompany`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteCompanyVariables } from '@dataconnect/generated';
import { useDeleteCompany } from '@dataconnect/generated/react'

export default function DeleteCompanyComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteCompany();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteCompany(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteCompany(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteCompany(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteCompany` Mutation requires an argument of type `DeleteCompanyVariables`:
  const deleteCompanyVars: DeleteCompanyVariables = {
    id: ..., 
  };
  mutation.mutate(deleteCompanyVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteCompanyVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.company_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateTeam
You can execute the `UpdateTeam` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateTeam(options?: useDataConnectMutationOptions<UpdateTeamData, FirebaseError, UpdateTeamVariables>): UseDataConnectMutationResult<UpdateTeamData, UpdateTeamVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateTeam(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateTeamData, FirebaseError, UpdateTeamVariables>): UseDataConnectMutationResult<UpdateTeamData, UpdateTeamVariables>;
```

### Variables
The `UpdateTeam` Mutation requires an argument of type `UpdateTeamVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateTeamVariables {
  id: UUIDString;
  name?: string | null;
  companyId?: UUIDString | null;
  leaderId?: UUIDString | null;
  type?: string | null;
  status?: Status | null;
  totalManDay?: number | null;
}
```
### Return Type
Recall that calling the `UpdateTeam` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateTeam` Mutation is of type `UpdateTeamData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateTeamData {
  team_update?: Team_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateTeam`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateTeamVariables } from '@dataconnect/generated';
import { useUpdateTeam } from '@dataconnect/generated/react'

export default function UpdateTeamComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateTeam();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateTeam(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateTeam(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateTeam(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateTeam` Mutation requires an argument of type `UpdateTeamVariables`:
  const updateTeamVars: UpdateTeamVariables = {
    id: ..., 
    name: ..., // optional
    companyId: ..., // optional
    leaderId: ..., // optional
    type: ..., // optional
    status: ..., // optional
    totalManDay: ..., // optional
  };
  mutation.mutate(updateTeamVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., name: ..., companyId: ..., leaderId: ..., type: ..., status: ..., totalManDay: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateTeamVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.team_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteTeam
You can execute the `DeleteTeam` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteTeam(options?: useDataConnectMutationOptions<DeleteTeamData, FirebaseError, DeleteTeamVariables>): UseDataConnectMutationResult<DeleteTeamData, DeleteTeamVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteTeam(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteTeamData, FirebaseError, DeleteTeamVariables>): UseDataConnectMutationResult<DeleteTeamData, DeleteTeamVariables>;
```

### Variables
The `DeleteTeam` Mutation requires an argument of type `DeleteTeamVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteTeamVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteTeam` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteTeam` Mutation is of type `DeleteTeamData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteTeamData {
  team_delete?: Team_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteTeam`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteTeamVariables } from '@dataconnect/generated';
import { useDeleteTeam } from '@dataconnect/generated/react'

export default function DeleteTeamComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteTeam();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteTeam(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteTeam(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteTeam(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteTeam` Mutation requires an argument of type `DeleteTeamVariables`:
  const deleteTeamVars: DeleteTeamVariables = {
    id: ..., 
  };
  mutation.mutate(deleteTeamVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteTeamVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.team_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateWorker
You can execute the `UpdateWorker` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateWorker(options?: useDataConnectMutationOptions<UpdateWorkerData, FirebaseError, UpdateWorkerVariables>): UseDataConnectMutationResult<UpdateWorkerData, UpdateWorkerVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateWorker(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateWorkerData, FirebaseError, UpdateWorkerVariables>): UseDataConnectMutationResult<UpdateWorkerData, UpdateWorkerVariables>;
```

### Variables
The `UpdateWorker` Mutation requires an argument of type `UpdateWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateWorkerVariables {
  id: UUIDString;
  name?: string | null;
  teamId?: UUIDString | null;
  role?: string | null;
  payType?: string | null;
  unitPrice?: number | null;
  phone?: string | null;
  residentNumber?: string | null;
  address?: string | null;
  isActive?: boolean | null;
}
```
### Return Type
Recall that calling the `UpdateWorker` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateWorker` Mutation is of type `UpdateWorkerData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateWorkerData {
  worker_update?: Worker_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateWorker`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateWorkerVariables } from '@dataconnect/generated';
import { useUpdateWorker } from '@dataconnect/generated/react'

export default function UpdateWorkerComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateWorker();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateWorker(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateWorker(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateWorker(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateWorker` Mutation requires an argument of type `UpdateWorkerVariables`:
  const updateWorkerVars: UpdateWorkerVariables = {
    id: ..., 
    name: ..., // optional
    teamId: ..., // optional
    role: ..., // optional
    payType: ..., // optional
    unitPrice: ..., // optional
    phone: ..., // optional
    residentNumber: ..., // optional
    address: ..., // optional
    isActive: ..., // optional
  };
  mutation.mutate(updateWorkerVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., name: ..., teamId: ..., role: ..., payType: ..., unitPrice: ..., phone: ..., residentNumber: ..., address: ..., isActive: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateWorkerVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.worker_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteWorker
You can execute the `DeleteWorker` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteWorker(options?: useDataConnectMutationOptions<DeleteWorkerData, FirebaseError, DeleteWorkerVariables>): UseDataConnectMutationResult<DeleteWorkerData, DeleteWorkerVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteWorker(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteWorkerData, FirebaseError, DeleteWorkerVariables>): UseDataConnectMutationResult<DeleteWorkerData, DeleteWorkerVariables>;
```

### Variables
The `DeleteWorker` Mutation requires an argument of type `DeleteWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteWorkerVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteWorker` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteWorker` Mutation is of type `DeleteWorkerData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteWorkerData {
  worker_delete?: Worker_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteWorker`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteWorkerVariables } from '@dataconnect/generated';
import { useDeleteWorker } from '@dataconnect/generated/react'

export default function DeleteWorkerComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteWorker();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteWorker(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteWorker(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteWorker(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteWorker` Mutation requires an argument of type `DeleteWorkerVariables`:
  const deleteWorkerVars: DeleteWorkerVariables = {
    id: ..., 
  };
  mutation.mutate(deleteWorkerVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteWorkerVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.worker_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateSite
You can execute the `UpdateSite` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateSite(options?: useDataConnectMutationOptions<UpdateSiteData, FirebaseError, UpdateSiteVariables>): UseDataConnectMutationResult<UpdateSiteData, UpdateSiteVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateSite(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateSiteData, FirebaseError, UpdateSiteVariables>): UseDataConnectMutationResult<UpdateSiteData, UpdateSiteVariables>;
```

### Variables
The `UpdateSite` Mutation requires an argument of type `UpdateSiteVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateSiteVariables {
  id: UUIDString;
  name?: string | null;
  code?: string | null;
  address?: string | null;
  startDate?: DateString | null;
  endDate?: DateString | null;
  status?: Status | null;
}
```
### Return Type
Recall that calling the `UpdateSite` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateSite` Mutation is of type `UpdateSiteData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateSiteData {
  site_update?: Site_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateSite`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateSiteVariables } from '@dataconnect/generated';
import { useUpdateSite } from '@dataconnect/generated/react'

export default function UpdateSiteComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateSite();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateSite(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateSite(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateSite(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateSite` Mutation requires an argument of type `UpdateSiteVariables`:
  const updateSiteVars: UpdateSiteVariables = {
    id: ..., 
    name: ..., // optional
    code: ..., // optional
    address: ..., // optional
    startDate: ..., // optional
    endDate: ..., // optional
    status: ..., // optional
  };
  mutation.mutate(updateSiteVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., name: ..., code: ..., address: ..., startDate: ..., endDate: ..., status: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateSiteVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.site_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteSite
You can execute the `DeleteSite` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteSite(options?: useDataConnectMutationOptions<DeleteSiteData, FirebaseError, DeleteSiteVariables>): UseDataConnectMutationResult<DeleteSiteData, DeleteSiteVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteSite(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteSiteData, FirebaseError, DeleteSiteVariables>): UseDataConnectMutationResult<DeleteSiteData, DeleteSiteVariables>;
```

### Variables
The `DeleteSite` Mutation requires an argument of type `DeleteSiteVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteSiteVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteSite` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteSite` Mutation is of type `DeleteSiteData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteSiteData {
  site_delete?: Site_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteSite`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteSiteVariables } from '@dataconnect/generated';
import { useDeleteSite } from '@dataconnect/generated/react'

export default function DeleteSiteComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteSite();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteSite(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteSite(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteSite(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteSite` Mutation requires an argument of type `DeleteSiteVariables`:
  const deleteSiteVars: DeleteSiteVariables = {
    id: ..., 
  };
  mutation.mutate(deleteSiteVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteSiteVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.site_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateDailyReport
You can execute the `UpdateDailyReport` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateDailyReport(options?: useDataConnectMutationOptions<UpdateDailyReportData, FirebaseError, UpdateDailyReportVariables>): UseDataConnectMutationResult<UpdateDailyReportData, UpdateDailyReportVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateDailyReport(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateDailyReportData, FirebaseError, UpdateDailyReportVariables>): UseDataConnectMutationResult<UpdateDailyReportData, UpdateDailyReportVariables>;
```

### Variables
The `UpdateDailyReport` Mutation requires an argument of type `UpdateDailyReportVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateDailyReportVariables {
  id: UUIDString;
  date?: DateString | null;
  teamId?: UUIDString | null;
  siteId?: UUIDString | null;
  siteName?: string | null;
  status?: string | null;
  totalManDay?: number | null;
  totalAmount?: number | null;
  weather?: string | null;
  writerUid?: string | null;
  companyName?: string | null;
  responsibleTeamName?: string | null;
  responsibleTeamLegacyId?: string | null;
  workContent?: string | null;
}
```
### Return Type
Recall that calling the `UpdateDailyReport` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateDailyReport` Mutation is of type `UpdateDailyReportData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateDailyReportData {
  dailyReport_update?: DailyReport_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateDailyReport`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateDailyReportVariables } from '@dataconnect/generated';
import { useUpdateDailyReport } from '@dataconnect/generated/react'

export default function UpdateDailyReportComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateDailyReport();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateDailyReport(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateDailyReport(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateDailyReport(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateDailyReport` Mutation requires an argument of type `UpdateDailyReportVariables`:
  const updateDailyReportVars: UpdateDailyReportVariables = {
    id: ..., 
    date: ..., // optional
    teamId: ..., // optional
    siteId: ..., // optional
    siteName: ..., // optional
    status: ..., // optional
    totalManDay: ..., // optional
    totalAmount: ..., // optional
    weather: ..., // optional
    writerUid: ..., // optional
    companyName: ..., // optional
    responsibleTeamName: ..., // optional
    responsibleTeamLegacyId: ..., // optional
    workContent: ..., // optional
  };
  mutation.mutate(updateDailyReportVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., date: ..., teamId: ..., siteId: ..., siteName: ..., status: ..., totalManDay: ..., totalAmount: ..., weather: ..., writerUid: ..., companyName: ..., responsibleTeamName: ..., responsibleTeamLegacyId: ..., workContent: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateDailyReportVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.dailyReport_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteDailyReport
You can execute the `DeleteDailyReport` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteDailyReport(options?: useDataConnectMutationOptions<DeleteDailyReportData, FirebaseError, DeleteDailyReportVariables>): UseDataConnectMutationResult<DeleteDailyReportData, DeleteDailyReportVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteDailyReport(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteDailyReportData, FirebaseError, DeleteDailyReportVariables>): UseDataConnectMutationResult<DeleteDailyReportData, DeleteDailyReportVariables>;
```

### Variables
The `DeleteDailyReport` Mutation requires an argument of type `DeleteDailyReportVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteDailyReportVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteDailyReport` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteDailyReport` Mutation is of type `DeleteDailyReportData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteDailyReportData {
  dailyReport_delete?: DailyReport_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteDailyReport`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteDailyReportVariables } from '@dataconnect/generated';
import { useDeleteDailyReport } from '@dataconnect/generated/react'

export default function DeleteDailyReportComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteDailyReport();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteDailyReport(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteDailyReport(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteDailyReport(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteDailyReport` Mutation requires an argument of type `DeleteDailyReportVariables`:
  const deleteDailyReportVars: DeleteDailyReportVariables = {
    id: ..., 
  };
  mutation.mutate(deleteDailyReportVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteDailyReportVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.dailyReport_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateAppUser
You can execute the `CreateAppUser` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateAppUser(options?: useDataConnectMutationOptions<CreateAppUserData, FirebaseError, CreateAppUserVariables>): UseDataConnectMutationResult<CreateAppUserData, CreateAppUserVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateAppUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAppUserData, FirebaseError, CreateAppUserVariables>): UseDataConnectMutationResult<CreateAppUserData, CreateAppUserVariables>;
```

### Variables
The `CreateAppUser` Mutation requires an argument of type `CreateAppUserVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateAppUserVariables {
  id: string;
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
  photoUrl?: string | null;
  linkedWorkerIds?: string | null;
  role?: string | null;
  lastLogin?: TimestampString | null;
}
```
### Return Type
Recall that calling the `CreateAppUser` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateAppUser` Mutation is of type `CreateAppUserData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateAppUserData {
  appUser_insert: AppUser_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateAppUser`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateAppUserVariables } from '@dataconnect/generated';
import { useCreateAppUser } from '@dataconnect/generated/react'

export default function CreateAppUserComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateAppUser();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateAppUser(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAppUser(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAppUser(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateAppUser` Mutation requires an argument of type `CreateAppUserVariables`:
  const createAppUserVars: CreateAppUserVariables = {
    id: ..., 
    uid: ..., // optional
    email: ..., // optional
    displayName: ..., // optional
    photoUrl: ..., // optional
    linkedWorkerIds: ..., // optional
    role: ..., // optional
    lastLogin: ..., // optional
  };
  mutation.mutate(createAppUserVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., uid: ..., email: ..., displayName: ..., photoUrl: ..., linkedWorkerIds: ..., role: ..., lastLogin: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createAppUserVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.appUser_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateAppUser
You can execute the `UpdateAppUser` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateAppUser(options?: useDataConnectMutationOptions<UpdateAppUserData, FirebaseError, UpdateAppUserVariables>): UseDataConnectMutationResult<UpdateAppUserData, UpdateAppUserVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateAppUser(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateAppUserData, FirebaseError, UpdateAppUserVariables>): UseDataConnectMutationResult<UpdateAppUserData, UpdateAppUserVariables>;
```

### Variables
The `UpdateAppUser` Mutation requires an argument of type `UpdateAppUserVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateAppUserVariables {
  id: string;
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
  photoUrl?: string | null;
  linkedWorkerIds?: string | null;
  role?: string | null;
  lastLogin?: TimestampString | null;
}
```
### Return Type
Recall that calling the `UpdateAppUser` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateAppUser` Mutation is of type `UpdateAppUserData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateAppUserData {
  appUser_update?: AppUser_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateAppUser`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateAppUserVariables } from '@dataconnect/generated';
import { useUpdateAppUser } from '@dataconnect/generated/react'

export default function UpdateAppUserComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateAppUser();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateAppUser(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAppUser(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAppUser(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateAppUser` Mutation requires an argument of type `UpdateAppUserVariables`:
  const updateAppUserVars: UpdateAppUserVariables = {
    id: ..., 
    uid: ..., // optional
    email: ..., // optional
    displayName: ..., // optional
    photoUrl: ..., // optional
    linkedWorkerIds: ..., // optional
    role: ..., // optional
    lastLogin: ..., // optional
  };
  mutation.mutate(updateAppUserVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., uid: ..., email: ..., displayName: ..., photoUrl: ..., linkedWorkerIds: ..., role: ..., lastLogin: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateAppUserVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.appUser_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteAppUser
You can execute the `DeleteAppUser` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteAppUser(options?: useDataConnectMutationOptions<DeleteAppUserData, FirebaseError, DeleteAppUserVariables>): UseDataConnectMutationResult<DeleteAppUserData, DeleteAppUserVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteAppUser(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteAppUserData, FirebaseError, DeleteAppUserVariables>): UseDataConnectMutationResult<DeleteAppUserData, DeleteAppUserVariables>;
```

### Variables
The `DeleteAppUser` Mutation requires an argument of type `DeleteAppUserVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteAppUserVariables {
  id: string;
}
```
### Return Type
Recall that calling the `DeleteAppUser` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteAppUser` Mutation is of type `DeleteAppUserData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteAppUserData {
  appUser_delete?: AppUser_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteAppUser`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteAppUserVariables } from '@dataconnect/generated';
import { useDeleteAppUser } from '@dataconnect/generated/react'

export default function DeleteAppUserComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteAppUser();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteAppUser(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteAppUser(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteAppUser(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteAppUser` Mutation requires an argument of type `DeleteAppUserVariables`:
  const deleteAppUserVars: DeleteAppUserVariables = {
    id: ..., 
  };
  mutation.mutate(deleteAppUserVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteAppUserVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.appUser_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateMenuConfig
You can execute the `CreateMenuConfig` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateMenuConfig(options?: useDataConnectMutationOptions<CreateMenuConfigData, FirebaseError, CreateMenuConfigVariables>): UseDataConnectMutationResult<CreateMenuConfigData, CreateMenuConfigVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateMenuConfig(dc: DataConnect, options?: useDataConnectMutationOptions<CreateMenuConfigData, FirebaseError, CreateMenuConfigVariables>): UseDataConnectMutationResult<CreateMenuConfigData, CreateMenuConfigVariables>;
```

### Variables
The `CreateMenuConfig` Mutation requires an argument of type `CreateMenuConfigVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateMenuConfigVariables {
  id: string;
  config: string;
}
```
### Return Type
Recall that calling the `CreateMenuConfig` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateMenuConfig` Mutation is of type `CreateMenuConfigData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateMenuConfigData {
  menuConfig_insert: MenuConfig_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateMenuConfig`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateMenuConfigVariables } from '@dataconnect/generated';
import { useCreateMenuConfig } from '@dataconnect/generated/react'

export default function CreateMenuConfigComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateMenuConfig();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateMenuConfig(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateMenuConfig(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateMenuConfig(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateMenuConfig` Mutation requires an argument of type `CreateMenuConfigVariables`:
  const createMenuConfigVars: CreateMenuConfigVariables = {
    id: ..., 
    config: ..., 
  };
  mutation.mutate(createMenuConfigVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., config: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createMenuConfigVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.menuConfig_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateMenuConfig
You can execute the `UpdateMenuConfig` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateMenuConfig(options?: useDataConnectMutationOptions<UpdateMenuConfigData, FirebaseError, UpdateMenuConfigVariables>): UseDataConnectMutationResult<UpdateMenuConfigData, UpdateMenuConfigVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateMenuConfig(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateMenuConfigData, FirebaseError, UpdateMenuConfigVariables>): UseDataConnectMutationResult<UpdateMenuConfigData, UpdateMenuConfigVariables>;
```

### Variables
The `UpdateMenuConfig` Mutation requires an argument of type `UpdateMenuConfigVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateMenuConfigVariables {
  id: string;
  config: string;
}
```
### Return Type
Recall that calling the `UpdateMenuConfig` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateMenuConfig` Mutation is of type `UpdateMenuConfigData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateMenuConfigData {
  menuConfig_update?: MenuConfig_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateMenuConfig`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateMenuConfigVariables } from '@dataconnect/generated';
import { useUpdateMenuConfig } from '@dataconnect/generated/react'

export default function UpdateMenuConfigComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateMenuConfig();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateMenuConfig(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateMenuConfig(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateMenuConfig(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateMenuConfig` Mutation requires an argument of type `UpdateMenuConfigVariables`:
  const updateMenuConfigVars: UpdateMenuConfigVariables = {
    id: ..., 
    config: ..., 
  };
  mutation.mutate(updateMenuConfigVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., config: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateMenuConfigVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.menuConfig_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteMenuConfig
You can execute the `DeleteMenuConfig` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteMenuConfig(options?: useDataConnectMutationOptions<DeleteMenuConfigData, FirebaseError, DeleteMenuConfigVariables>): UseDataConnectMutationResult<DeleteMenuConfigData, DeleteMenuConfigVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteMenuConfig(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteMenuConfigData, FirebaseError, DeleteMenuConfigVariables>): UseDataConnectMutationResult<DeleteMenuConfigData, DeleteMenuConfigVariables>;
```

### Variables
The `DeleteMenuConfig` Mutation requires an argument of type `DeleteMenuConfigVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteMenuConfigVariables {
  id: string;
}
```
### Return Type
Recall that calling the `DeleteMenuConfig` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteMenuConfig` Mutation is of type `DeleteMenuConfigData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteMenuConfigData {
  menuConfig_delete?: MenuConfig_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteMenuConfig`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteMenuConfigVariables } from '@dataconnect/generated';
import { useDeleteMenuConfig } from '@dataconnect/generated/react'

export default function DeleteMenuConfigComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteMenuConfig();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteMenuConfig(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteMenuConfig(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteMenuConfig(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteMenuConfig` Mutation requires an argument of type `DeleteMenuConfigVariables`:
  const deleteMenuConfigVars: DeleteMenuConfigVariables = {
    id: ..., 
  };
  mutation.mutate(deleteMenuConfigVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteMenuConfigVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.menuConfig_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateSystemLog
You can execute the `CreateSystemLog` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateSystemLog(options?: useDataConnectMutationOptions<CreateSystemLogData, FirebaseError, CreateSystemLogVariables>): UseDataConnectMutationResult<CreateSystemLogData, CreateSystemLogVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateSystemLog(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSystemLogData, FirebaseError, CreateSystemLogVariables>): UseDataConnectMutationResult<CreateSystemLogData, CreateSystemLogVariables>;
```

### Variables
The `CreateSystemLog` Mutation requires an argument of type `CreateSystemLogVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateSystemLogVariables {
  category: string;
  action: string;
  userEmail?: string | null;
  details?: string | null;
}
```
### Return Type
Recall that calling the `CreateSystemLog` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateSystemLog` Mutation is of type `CreateSystemLogData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateSystemLogData {
  systemLog_insert: SystemLog_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateSystemLog`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateSystemLogVariables } from '@dataconnect/generated';
import { useCreateSystemLog } from '@dataconnect/generated/react'

export default function CreateSystemLogComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateSystemLog();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateSystemLog(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSystemLog(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSystemLog(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateSystemLog` Mutation requires an argument of type `CreateSystemLogVariables`:
  const createSystemLogVars: CreateSystemLogVariables = {
    category: ..., 
    action: ..., 
    userEmail: ..., // optional
    details: ..., // optional
  };
  mutation.mutate(createSystemLogVars);
  // Variables can be defined inline as well.
  mutation.mutate({ category: ..., action: ..., userEmail: ..., details: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createSystemLogVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.systemLog_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateAccommodation
You can execute the `CreateAccommodation` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateAccommodation(options?: useDataConnectMutationOptions<CreateAccommodationData, FirebaseError, CreateAccommodationVariables>): UseDataConnectMutationResult<CreateAccommodationData, CreateAccommodationVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateAccommodation(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAccommodationData, FirebaseError, CreateAccommodationVariables>): UseDataConnectMutationResult<CreateAccommodationData, CreateAccommodationVariables>;
```

### Variables
The `CreateAccommodation` Mutation requires an argument of type `CreateAccommodationVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateAccommodationVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  name: string;
  address: string;
  type: string;
  status: string;
  ownership?: string | null;
  electricityMode?: string | null;
  gasMode?: string | null;
  waterMode?: string | null;
  internetMode?: string | null;
  maintenanceMode?: string | null;
  fixedElectricity?: number | null;
  fixedGas?: number | null;
  fixedWater?: number | null;
  fixedInternet?: number | null;
  fixedMaintenance?: number | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  deposit?: number | null;
  monthlyRent?: number | null;
  paymentDay?: number | null;
  landlordName?: string | null;
  landlordContact?: string | null;
  isReported?: boolean | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  rentPayDate?: number | null;
  isAutoTransfer?: boolean | null;
  transferDay?: number | null;
  transferAccountInfo?: string | null;
  billingTargetType?: string | null;
  billingTargetTeamId?: string | null;
  billingTargetTeamName?: string | null;
  billingTargetWorkerId?: string | null;
  billingTargetWorkerName?: string | null;
  currentOccupantName?: string | null;
  currentOccupantPhone?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `CreateAccommodation` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateAccommodation` Mutation is of type `CreateAccommodationData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateAccommodationData {
  accommodation_insert: Accommodation_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateAccommodation`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateAccommodationVariables } from '@dataconnect/generated';
import { useCreateAccommodation } from '@dataconnect/generated/react'

export default function CreateAccommodationComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateAccommodation();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateAccommodation(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAccommodation(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAccommodation(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateAccommodation` Mutation requires an argument of type `CreateAccommodationVariables`:
  const createAccommodationVars: CreateAccommodationVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    name: ..., 
    address: ..., 
    type: ..., 
    status: ..., 
    ownership: ..., // optional
    electricityMode: ..., // optional
    gasMode: ..., // optional
    waterMode: ..., // optional
    internetMode: ..., // optional
    maintenanceMode: ..., // optional
    fixedElectricity: ..., // optional
    fixedGas: ..., // optional
    fixedWater: ..., // optional
    fixedInternet: ..., // optional
    fixedMaintenance: ..., // optional
    contractStartDate: ..., // optional
    contractEndDate: ..., // optional
    deposit: ..., // optional
    monthlyRent: ..., // optional
    paymentDay: ..., // optional
    landlordName: ..., // optional
    landlordContact: ..., // optional
    isReported: ..., // optional
    bankName: ..., // optional
    accountNumber: ..., // optional
    accountHolder: ..., // optional
    rentPayDate: ..., // optional
    isAutoTransfer: ..., // optional
    transferDay: ..., // optional
    transferAccountInfo: ..., // optional
    billingTargetType: ..., // optional
    billingTargetTeamId: ..., // optional
    billingTargetTeamName: ..., // optional
    billingTargetWorkerId: ..., // optional
    billingTargetWorkerName: ..., // optional
    currentOccupantName: ..., // optional
    currentOccupantPhone: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(createAccommodationVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., name: ..., address: ..., type: ..., status: ..., ownership: ..., electricityMode: ..., gasMode: ..., waterMode: ..., internetMode: ..., maintenanceMode: ..., fixedElectricity: ..., fixedGas: ..., fixedWater: ..., fixedInternet: ..., fixedMaintenance: ..., contractStartDate: ..., contractEndDate: ..., deposit: ..., monthlyRent: ..., paymentDay: ..., landlordName: ..., landlordContact: ..., isReported: ..., bankName: ..., accountNumber: ..., accountHolder: ..., rentPayDate: ..., isAutoTransfer: ..., transferDay: ..., transferAccountInfo: ..., billingTargetType: ..., billingTargetTeamId: ..., billingTargetTeamName: ..., billingTargetWorkerId: ..., billingTargetWorkerName: ..., currentOccupantName: ..., currentOccupantPhone: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createAccommodationVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.accommodation_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateAccommodation
You can execute the `UpdateAccommodation` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateAccommodation(options?: useDataConnectMutationOptions<UpdateAccommodationData, FirebaseError, UpdateAccommodationVariables>): UseDataConnectMutationResult<UpdateAccommodationData, UpdateAccommodationVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateAccommodation(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateAccommodationData, FirebaseError, UpdateAccommodationVariables>): UseDataConnectMutationResult<UpdateAccommodationData, UpdateAccommodationVariables>;
```

### Variables
The `UpdateAccommodation` Mutation requires an argument of type `UpdateAccommodationVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateAccommodationVariables {
  id: UUIDString;
  name?: string | null;
  address?: string | null;
  type?: string | null;
  status?: string | null;
  ownership?: string | null;
  electricityMode?: string | null;
  gasMode?: string | null;
  waterMode?: string | null;
  internetMode?: string | null;
  maintenanceMode?: string | null;
  fixedElectricity?: number | null;
  fixedGas?: number | null;
  fixedWater?: number | null;
  fixedInternet?: number | null;
  fixedMaintenance?: number | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  deposit?: number | null;
  monthlyRent?: number | null;
  paymentDay?: number | null;
  landlordName?: string | null;
  landlordContact?: string | null;
  isReported?: boolean | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  rentPayDate?: number | null;
  isAutoTransfer?: boolean | null;
  transferDay?: number | null;
  transferAccountInfo?: string | null;
  billingTargetType?: string | null;
  billingTargetTeamId?: string | null;
  billingTargetTeamName?: string | null;
  billingTargetWorkerId?: string | null;
  billingTargetWorkerName?: string | null;
  currentOccupantName?: string | null;
  currentOccupantPhone?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `UpdateAccommodation` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateAccommodation` Mutation is of type `UpdateAccommodationData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateAccommodationData {
  accommodation_update?: Accommodation_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateAccommodation`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateAccommodationVariables } from '@dataconnect/generated';
import { useUpdateAccommodation } from '@dataconnect/generated/react'

export default function UpdateAccommodationComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateAccommodation();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateAccommodation(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAccommodation(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAccommodation(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateAccommodation` Mutation requires an argument of type `UpdateAccommodationVariables`:
  const updateAccommodationVars: UpdateAccommodationVariables = {
    id: ..., 
    name: ..., // optional
    address: ..., // optional
    type: ..., // optional
    status: ..., // optional
    ownership: ..., // optional
    electricityMode: ..., // optional
    gasMode: ..., // optional
    waterMode: ..., // optional
    internetMode: ..., // optional
    maintenanceMode: ..., // optional
    fixedElectricity: ..., // optional
    fixedGas: ..., // optional
    fixedWater: ..., // optional
    fixedInternet: ..., // optional
    fixedMaintenance: ..., // optional
    contractStartDate: ..., // optional
    contractEndDate: ..., // optional
    deposit: ..., // optional
    monthlyRent: ..., // optional
    paymentDay: ..., // optional
    landlordName: ..., // optional
    landlordContact: ..., // optional
    isReported: ..., // optional
    bankName: ..., // optional
    accountNumber: ..., // optional
    accountHolder: ..., // optional
    rentPayDate: ..., // optional
    isAutoTransfer: ..., // optional
    transferDay: ..., // optional
    transferAccountInfo: ..., // optional
    billingTargetType: ..., // optional
    billingTargetTeamId: ..., // optional
    billingTargetTeamName: ..., // optional
    billingTargetWorkerId: ..., // optional
    billingTargetWorkerName: ..., // optional
    currentOccupantName: ..., // optional
    currentOccupantPhone: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(updateAccommodationVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., name: ..., address: ..., type: ..., status: ..., ownership: ..., electricityMode: ..., gasMode: ..., waterMode: ..., internetMode: ..., maintenanceMode: ..., fixedElectricity: ..., fixedGas: ..., fixedWater: ..., fixedInternet: ..., fixedMaintenance: ..., contractStartDate: ..., contractEndDate: ..., deposit: ..., monthlyRent: ..., paymentDay: ..., landlordName: ..., landlordContact: ..., isReported: ..., bankName: ..., accountNumber: ..., accountHolder: ..., rentPayDate: ..., isAutoTransfer: ..., transferDay: ..., transferAccountInfo: ..., billingTargetType: ..., billingTargetTeamId: ..., billingTargetTeamName: ..., billingTargetWorkerId: ..., billingTargetWorkerName: ..., currentOccupantName: ..., currentOccupantPhone: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateAccommodationVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.accommodation_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteAccommodation
You can execute the `DeleteAccommodation` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteAccommodation(options?: useDataConnectMutationOptions<DeleteAccommodationData, FirebaseError, DeleteAccommodationVariables>): UseDataConnectMutationResult<DeleteAccommodationData, DeleteAccommodationVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteAccommodation(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteAccommodationData, FirebaseError, DeleteAccommodationVariables>): UseDataConnectMutationResult<DeleteAccommodationData, DeleteAccommodationVariables>;
```

### Variables
The `DeleteAccommodation` Mutation requires an argument of type `DeleteAccommodationVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteAccommodationVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteAccommodation` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteAccommodation` Mutation is of type `DeleteAccommodationData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteAccommodationData {
  accommodation_delete?: Accommodation_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteAccommodation`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteAccommodationVariables } from '@dataconnect/generated';
import { useDeleteAccommodation } from '@dataconnect/generated/react'

export default function DeleteAccommodationComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteAccommodation();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteAccommodation(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteAccommodation(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteAccommodation(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteAccommodation` Mutation requires an argument of type `DeleteAccommodationVariables`:
  const deleteAccommodationVars: DeleteAccommodationVariables = {
    id: ..., 
  };
  mutation.mutate(deleteAccommodationVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteAccommodationVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.accommodation_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateAccommodationAssignment
You can execute the `CreateAccommodationAssignment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateAccommodationAssignment(options?: useDataConnectMutationOptions<CreateAccommodationAssignmentData, FirebaseError, CreateAccommodationAssignmentVariables>): UseDataConnectMutationResult<CreateAccommodationAssignmentData, CreateAccommodationAssignmentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateAccommodationAssignment(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAccommodationAssignmentData, FirebaseError, CreateAccommodationAssignmentVariables>): UseDataConnectMutationResult<CreateAccommodationAssignmentData, CreateAccommodationAssignmentVariables>;
```

### Variables
The `CreateAccommodationAssignment` Mutation requires an argument of type `CreateAccommodationAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateAccommodationAssignmentVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  accommodationId: UUIDString;
  teamId?: UUIDString | null;
  teamName?: string | null;
  workerId?: UUIDString | null;
  workerName?: string | null;
  startDate: string;
  endDate?: string | null;
  status?: string | null;
  source?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `CreateAccommodationAssignment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateAccommodationAssignment` Mutation is of type `CreateAccommodationAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateAccommodationAssignmentData {
  accommodationAssignment_insert: AccommodationAssignment_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateAccommodationAssignment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateAccommodationAssignmentVariables } from '@dataconnect/generated';
import { useCreateAccommodationAssignment } from '@dataconnect/generated/react'

export default function CreateAccommodationAssignmentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateAccommodationAssignment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateAccommodationAssignment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAccommodationAssignment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAccommodationAssignment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateAccommodationAssignment` Mutation requires an argument of type `CreateAccommodationAssignmentVariables`:
  const createAccommodationAssignmentVars: CreateAccommodationAssignmentVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    accommodationId: ..., 
    teamId: ..., // optional
    teamName: ..., // optional
    workerId: ..., // optional
    workerName: ..., // optional
    startDate: ..., 
    endDate: ..., // optional
    status: ..., // optional
    source: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(createAccommodationAssignmentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., accommodationId: ..., teamId: ..., teamName: ..., workerId: ..., workerName: ..., startDate: ..., endDate: ..., status: ..., source: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createAccommodationAssignmentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.accommodationAssignment_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateAccommodationAssignment
You can execute the `UpdateAccommodationAssignment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateAccommodationAssignment(options?: useDataConnectMutationOptions<UpdateAccommodationAssignmentData, FirebaseError, UpdateAccommodationAssignmentVariables>): UseDataConnectMutationResult<UpdateAccommodationAssignmentData, UpdateAccommodationAssignmentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateAccommodationAssignment(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateAccommodationAssignmentData, FirebaseError, UpdateAccommodationAssignmentVariables>): UseDataConnectMutationResult<UpdateAccommodationAssignmentData, UpdateAccommodationAssignmentVariables>;
```

### Variables
The `UpdateAccommodationAssignment` Mutation requires an argument of type `UpdateAccommodationAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateAccommodationAssignmentVariables {
  id: UUIDString;
  accommodationId?: UUIDString | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  workerId?: UUIDString | null;
  workerName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  source?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `UpdateAccommodationAssignment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateAccommodationAssignment` Mutation is of type `UpdateAccommodationAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateAccommodationAssignmentData {
  accommodationAssignment_update?: AccommodationAssignment_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateAccommodationAssignment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateAccommodationAssignmentVariables } from '@dataconnect/generated';
import { useUpdateAccommodationAssignment } from '@dataconnect/generated/react'

export default function UpdateAccommodationAssignmentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateAccommodationAssignment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateAccommodationAssignment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAccommodationAssignment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAccommodationAssignment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateAccommodationAssignment` Mutation requires an argument of type `UpdateAccommodationAssignmentVariables`:
  const updateAccommodationAssignmentVars: UpdateAccommodationAssignmentVariables = {
    id: ..., 
    accommodationId: ..., // optional
    teamId: ..., // optional
    teamName: ..., // optional
    workerId: ..., // optional
    workerName: ..., // optional
    startDate: ..., // optional
    endDate: ..., // optional
    status: ..., // optional
    source: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(updateAccommodationAssignmentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., accommodationId: ..., teamId: ..., teamName: ..., workerId: ..., workerName: ..., startDate: ..., endDate: ..., status: ..., source: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateAccommodationAssignmentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.accommodationAssignment_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteAccommodationAssignment
You can execute the `DeleteAccommodationAssignment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteAccommodationAssignment(options?: useDataConnectMutationOptions<DeleteAccommodationAssignmentData, FirebaseError, DeleteAccommodationAssignmentVariables>): UseDataConnectMutationResult<DeleteAccommodationAssignmentData, DeleteAccommodationAssignmentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteAccommodationAssignment(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteAccommodationAssignmentData, FirebaseError, DeleteAccommodationAssignmentVariables>): UseDataConnectMutationResult<DeleteAccommodationAssignmentData, DeleteAccommodationAssignmentVariables>;
```

### Variables
The `DeleteAccommodationAssignment` Mutation requires an argument of type `DeleteAccommodationAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteAccommodationAssignmentVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteAccommodationAssignment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteAccommodationAssignment` Mutation is of type `DeleteAccommodationAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteAccommodationAssignmentData {
  accommodationAssignment_delete?: AccommodationAssignment_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteAccommodationAssignment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteAccommodationAssignmentVariables } from '@dataconnect/generated';
import { useDeleteAccommodationAssignment } from '@dataconnect/generated/react'

export default function DeleteAccommodationAssignmentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteAccommodationAssignment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteAccommodationAssignment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteAccommodationAssignment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteAccommodationAssignment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteAccommodationAssignment` Mutation requires an argument of type `DeleteAccommodationAssignmentVariables`:
  const deleteAccommodationAssignmentVars: DeleteAccommodationAssignmentVariables = {
    id: ..., 
  };
  mutation.mutate(deleteAccommodationAssignmentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteAccommodationAssignmentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.accommodationAssignment_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateUtilityRecord
You can execute the `CreateUtilityRecord` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateUtilityRecord(options?: useDataConnectMutationOptions<CreateUtilityRecordData, FirebaseError, CreateUtilityRecordVariables>): UseDataConnectMutationResult<CreateUtilityRecordData, CreateUtilityRecordVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateUtilityRecord(dc: DataConnect, options?: useDataConnectMutationOptions<CreateUtilityRecordData, FirebaseError, CreateUtilityRecordVariables>): UseDataConnectMutationResult<CreateUtilityRecordData, CreateUtilityRecordVariables>;
```

### Variables
The `CreateUtilityRecord` Mutation requires an argument of type `CreateUtilityRecordVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateUtilityRecordVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  accommodationId: UUIDString;
  yearMonth: string;
  accommodationName?: string | null;
  costs?: string | null;
  paymentDate?: string | null;
  paymentStatus: string;
  memo?: string | null;
  isAnomaly?: boolean | null;
}
```
### Return Type
Recall that calling the `CreateUtilityRecord` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateUtilityRecord` Mutation is of type `CreateUtilityRecordData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateUtilityRecordData {
  utilityRecord_insert: UtilityRecord_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateUtilityRecord`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateUtilityRecordVariables } from '@dataconnect/generated';
import { useCreateUtilityRecord } from '@dataconnect/generated/react'

export default function CreateUtilityRecordComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateUtilityRecord();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateUtilityRecord(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateUtilityRecord(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateUtilityRecord(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateUtilityRecord` Mutation requires an argument of type `CreateUtilityRecordVariables`:
  const createUtilityRecordVars: CreateUtilityRecordVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    accommodationId: ..., 
    yearMonth: ..., 
    accommodationName: ..., // optional
    costs: ..., // optional
    paymentDate: ..., // optional
    paymentStatus: ..., 
    memo: ..., // optional
    isAnomaly: ..., // optional
  };
  mutation.mutate(createUtilityRecordVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., accommodationId: ..., yearMonth: ..., accommodationName: ..., costs: ..., paymentDate: ..., paymentStatus: ..., memo: ..., isAnomaly: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createUtilityRecordVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.utilityRecord_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateUtilityRecord
You can execute the `UpdateUtilityRecord` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateUtilityRecord(options?: useDataConnectMutationOptions<UpdateUtilityRecordData, FirebaseError, UpdateUtilityRecordVariables>): UseDataConnectMutationResult<UpdateUtilityRecordData, UpdateUtilityRecordVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateUtilityRecord(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateUtilityRecordData, FirebaseError, UpdateUtilityRecordVariables>): UseDataConnectMutationResult<UpdateUtilityRecordData, UpdateUtilityRecordVariables>;
```

### Variables
The `UpdateUtilityRecord` Mutation requires an argument of type `UpdateUtilityRecordVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateUtilityRecordVariables {
  accommodationId: UUIDString;
  yearMonth: string;
  accommodationName?: string | null;
  costs?: string | null;
  paymentDate?: string | null;
  paymentStatus?: string | null;
  memo?: string | null;
  isAnomaly?: boolean | null;
}
```
### Return Type
Recall that calling the `UpdateUtilityRecord` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateUtilityRecord` Mutation is of type `UpdateUtilityRecordData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateUtilityRecordData {
  utilityRecord_update?: UtilityRecord_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateUtilityRecord`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateUtilityRecordVariables } from '@dataconnect/generated';
import { useUpdateUtilityRecord } from '@dataconnect/generated/react'

export default function UpdateUtilityRecordComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateUtilityRecord();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateUtilityRecord(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateUtilityRecord(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateUtilityRecord(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateUtilityRecord` Mutation requires an argument of type `UpdateUtilityRecordVariables`:
  const updateUtilityRecordVars: UpdateUtilityRecordVariables = {
    accommodationId: ..., 
    yearMonth: ..., 
    accommodationName: ..., // optional
    costs: ..., // optional
    paymentDate: ..., // optional
    paymentStatus: ..., // optional
    memo: ..., // optional
    isAnomaly: ..., // optional
  };
  mutation.mutate(updateUtilityRecordVars);
  // Variables can be defined inline as well.
  mutation.mutate({ accommodationId: ..., yearMonth: ..., accommodationName: ..., costs: ..., paymentDate: ..., paymentStatus: ..., memo: ..., isAnomaly: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateUtilityRecordVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.utilityRecord_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteUtilityRecord
You can execute the `DeleteUtilityRecord` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteUtilityRecord(options?: useDataConnectMutationOptions<DeleteUtilityRecordData, FirebaseError, DeleteUtilityRecordVariables>): UseDataConnectMutationResult<DeleteUtilityRecordData, DeleteUtilityRecordVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteUtilityRecord(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteUtilityRecordData, FirebaseError, DeleteUtilityRecordVariables>): UseDataConnectMutationResult<DeleteUtilityRecordData, DeleteUtilityRecordVariables>;
```

### Variables
The `DeleteUtilityRecord` Mutation requires an argument of type `DeleteUtilityRecordVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteUtilityRecordVariables {
  accommodationId: UUIDString;
  yearMonth: string;
}
```
### Return Type
Recall that calling the `DeleteUtilityRecord` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteUtilityRecord` Mutation is of type `DeleteUtilityRecordData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteUtilityRecordData {
  utilityRecord_delete?: UtilityRecord_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteUtilityRecord`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteUtilityRecordVariables } from '@dataconnect/generated';
import { useDeleteUtilityRecord } from '@dataconnect/generated/react'

export default function DeleteUtilityRecordComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteUtilityRecord();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteUtilityRecord(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteUtilityRecord(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteUtilityRecord(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteUtilityRecord` Mutation requires an argument of type `DeleteUtilityRecordVariables`:
  const deleteUtilityRecordVars: DeleteUtilityRecordVariables = {
    accommodationId: ..., 
    yearMonth: ..., 
  };
  mutation.mutate(deleteUtilityRecordVars);
  // Variables can be defined inline as well.
  mutation.mutate({ accommodationId: ..., yearMonth: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteUtilityRecordVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.utilityRecord_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateAccommodationBillingDocument
You can execute the `CreateAccommodationBillingDocument` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateAccommodationBillingDocument(options?: useDataConnectMutationOptions<CreateAccommodationBillingDocumentData, FirebaseError, CreateAccommodationBillingDocumentVariables>): UseDataConnectMutationResult<CreateAccommodationBillingDocumentData, CreateAccommodationBillingDocumentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateAccommodationBillingDocument(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAccommodationBillingDocumentData, FirebaseError, CreateAccommodationBillingDocumentVariables>): UseDataConnectMutationResult<CreateAccommodationBillingDocumentData, CreateAccommodationBillingDocumentVariables>;
```

### Variables
The `CreateAccommodationBillingDocument` Mutation requires an argument of type `CreateAccommodationBillingDocumentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateAccommodationBillingDocumentVariables {
  id?: UUIDString | null;
  yearMonth: string;
  teamId?: UUIDString | null;
  teamName?: string | null;
  issuedToType: string;
  issuedToWorkerId?: UUIDString | null;
  issuedToWorkerName?: string | null;
  status?: string | null;
  memo?: string | null;
  confirmedAt?: TimestampString | null;
  postedAdvancePaymentId?: string | null;
}
```
### Return Type
Recall that calling the `CreateAccommodationBillingDocument` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateAccommodationBillingDocument` Mutation is of type `CreateAccommodationBillingDocumentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateAccommodationBillingDocumentData {
  accommodationBillingDocument_insert: AccommodationBillingDocument_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateAccommodationBillingDocument`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateAccommodationBillingDocumentVariables } from '@dataconnect/generated';
import { useCreateAccommodationBillingDocument } from '@dataconnect/generated/react'

export default function CreateAccommodationBillingDocumentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateAccommodationBillingDocument();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateAccommodationBillingDocument(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAccommodationBillingDocument(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAccommodationBillingDocument(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateAccommodationBillingDocument` Mutation requires an argument of type `CreateAccommodationBillingDocumentVariables`:
  const createAccommodationBillingDocumentVars: CreateAccommodationBillingDocumentVariables = {
    id: ..., // optional
    yearMonth: ..., 
    teamId: ..., // optional
    teamName: ..., // optional
    issuedToType: ..., 
    issuedToWorkerId: ..., // optional
    issuedToWorkerName: ..., // optional
    status: ..., // optional
    memo: ..., // optional
    confirmedAt: ..., // optional
    postedAdvancePaymentId: ..., // optional
  };
  mutation.mutate(createAccommodationBillingDocumentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., yearMonth: ..., teamId: ..., teamName: ..., issuedToType: ..., issuedToWorkerId: ..., issuedToWorkerName: ..., status: ..., memo: ..., confirmedAt: ..., postedAdvancePaymentId: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createAccommodationBillingDocumentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.accommodationBillingDocument_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateAccommodationBillingDocument
You can execute the `UpdateAccommodationBillingDocument` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateAccommodationBillingDocument(options?: useDataConnectMutationOptions<UpdateAccommodationBillingDocumentData, FirebaseError, UpdateAccommodationBillingDocumentVariables>): UseDataConnectMutationResult<UpdateAccommodationBillingDocumentData, UpdateAccommodationBillingDocumentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateAccommodationBillingDocument(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateAccommodationBillingDocumentData, FirebaseError, UpdateAccommodationBillingDocumentVariables>): UseDataConnectMutationResult<UpdateAccommodationBillingDocumentData, UpdateAccommodationBillingDocumentVariables>;
```

### Variables
The `UpdateAccommodationBillingDocument` Mutation requires an argument of type `UpdateAccommodationBillingDocumentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateAccommodationBillingDocumentVariables {
  id: UUIDString;
  yearMonth?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  issuedToType?: string | null;
  issuedToWorkerId?: UUIDString | null;
  issuedToWorkerName?: string | null;
  status?: string | null;
  memo?: string | null;
  confirmedAt?: TimestampString | null;
  postedAdvancePaymentId?: string | null;
}
```
### Return Type
Recall that calling the `UpdateAccommodationBillingDocument` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateAccommodationBillingDocument` Mutation is of type `UpdateAccommodationBillingDocumentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateAccommodationBillingDocumentData {
  accommodationBillingDocument_update?: AccommodationBillingDocument_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateAccommodationBillingDocument`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateAccommodationBillingDocumentVariables } from '@dataconnect/generated';
import { useUpdateAccommodationBillingDocument } from '@dataconnect/generated/react'

export default function UpdateAccommodationBillingDocumentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateAccommodationBillingDocument();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateAccommodationBillingDocument(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAccommodationBillingDocument(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAccommodationBillingDocument(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateAccommodationBillingDocument` Mutation requires an argument of type `UpdateAccommodationBillingDocumentVariables`:
  const updateAccommodationBillingDocumentVars: UpdateAccommodationBillingDocumentVariables = {
    id: ..., 
    yearMonth: ..., // optional
    teamId: ..., // optional
    teamName: ..., // optional
    issuedToType: ..., // optional
    issuedToWorkerId: ..., // optional
    issuedToWorkerName: ..., // optional
    status: ..., // optional
    memo: ..., // optional
    confirmedAt: ..., // optional
    postedAdvancePaymentId: ..., // optional
  };
  mutation.mutate(updateAccommodationBillingDocumentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., yearMonth: ..., teamId: ..., teamName: ..., issuedToType: ..., issuedToWorkerId: ..., issuedToWorkerName: ..., status: ..., memo: ..., confirmedAt: ..., postedAdvancePaymentId: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateAccommodationBillingDocumentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.accommodationBillingDocument_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateAccommodationBillingLineItem
You can execute the `CreateAccommodationBillingLineItem` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateAccommodationBillingLineItem(options?: useDataConnectMutationOptions<CreateAccommodationBillingLineItemData, FirebaseError, CreateAccommodationBillingLineItemVariables>): UseDataConnectMutationResult<CreateAccommodationBillingLineItemData, CreateAccommodationBillingLineItemVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateAccommodationBillingLineItem(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAccommodationBillingLineItemData, FirebaseError, CreateAccommodationBillingLineItemVariables>): UseDataConnectMutationResult<CreateAccommodationBillingLineItemData, CreateAccommodationBillingLineItemVariables>;
```

### Variables
The `CreateAccommodationBillingLineItem` Mutation requires an argument of type `CreateAccommodationBillingLineItemVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateAccommodationBillingLineItemVariables {
  id?: UUIDString | null;
  billingDocumentId: UUIDString;
  label: string;
  amount: number;
  targetField: string;
}
```
### Return Type
Recall that calling the `CreateAccommodationBillingLineItem` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateAccommodationBillingLineItem` Mutation is of type `CreateAccommodationBillingLineItemData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateAccommodationBillingLineItemData {
  accommodationBillingLineItem_insert: AccommodationBillingLineItem_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateAccommodationBillingLineItem`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateAccommodationBillingLineItemVariables } from '@dataconnect/generated';
import { useCreateAccommodationBillingLineItem } from '@dataconnect/generated/react'

export default function CreateAccommodationBillingLineItemComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateAccommodationBillingLineItem();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateAccommodationBillingLineItem(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAccommodationBillingLineItem(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAccommodationBillingLineItem(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateAccommodationBillingLineItem` Mutation requires an argument of type `CreateAccommodationBillingLineItemVariables`:
  const createAccommodationBillingLineItemVars: CreateAccommodationBillingLineItemVariables = {
    id: ..., // optional
    billingDocumentId: ..., 
    label: ..., 
    amount: ..., 
    targetField: ..., 
  };
  mutation.mutate(createAccommodationBillingLineItemVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., billingDocumentId: ..., label: ..., amount: ..., targetField: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createAccommodationBillingLineItemVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.accommodationBillingLineItem_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteAccommodationBillingLineItem
You can execute the `DeleteAccommodationBillingLineItem` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteAccommodationBillingLineItem(options?: useDataConnectMutationOptions<DeleteAccommodationBillingLineItemData, FirebaseError, DeleteAccommodationBillingLineItemVariables>): UseDataConnectMutationResult<DeleteAccommodationBillingLineItemData, DeleteAccommodationBillingLineItemVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteAccommodationBillingLineItem(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteAccommodationBillingLineItemData, FirebaseError, DeleteAccommodationBillingLineItemVariables>): UseDataConnectMutationResult<DeleteAccommodationBillingLineItemData, DeleteAccommodationBillingLineItemVariables>;
```

### Variables
The `DeleteAccommodationBillingLineItem` Mutation requires an argument of type `DeleteAccommodationBillingLineItemVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteAccommodationBillingLineItemVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteAccommodationBillingLineItem` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteAccommodationBillingLineItem` Mutation is of type `DeleteAccommodationBillingLineItemData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteAccommodationBillingLineItemData {
  accommodationBillingLineItem_delete?: AccommodationBillingLineItem_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteAccommodationBillingLineItem`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteAccommodationBillingLineItemVariables } from '@dataconnect/generated';
import { useDeleteAccommodationBillingLineItem } from '@dataconnect/generated/react'

export default function DeleteAccommodationBillingLineItemComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteAccommodationBillingLineItem();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteAccommodationBillingLineItem(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteAccommodationBillingLineItem(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteAccommodationBillingLineItem(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteAccommodationBillingLineItem` Mutation requires an argument of type `DeleteAccommodationBillingLineItemVariables`:
  const deleteAccommodationBillingLineItemVars: DeleteAccommodationBillingLineItemVariables = {
    id: ..., 
  };
  mutation.mutate(deleteAccommodationBillingLineItemVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteAccommodationBillingLineItemVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.accommodationBillingLineItem_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateAdvancePayment
You can execute the `CreateAdvancePayment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateAdvancePayment(options?: useDataConnectMutationOptions<CreateAdvancePaymentData, FirebaseError, CreateAdvancePaymentVariables>): UseDataConnectMutationResult<CreateAdvancePaymentData, CreateAdvancePaymentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateAdvancePayment(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAdvancePaymentData, FirebaseError, CreateAdvancePaymentVariables>): UseDataConnectMutationResult<CreateAdvancePaymentData, CreateAdvancePaymentVariables>;
```

### Variables
The `CreateAdvancePayment` Mutation requires an argument of type `CreateAdvancePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateAdvancePaymentVariables {
  id: string;
  workerId?: UUIDString | null;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  yearMonth: string;
  items?: string | null;
  prevMonthCarryover?: number | null;
  accommodation?: number | null;
  privateRoom?: number | null;
  gloves?: number | null;
  deposit?: number | null;
  fines?: number | null;
  electricity?: number | null;
  gas?: number | null;
  internet?: number | null;
  water?: number | null;
  totalDeduction?: number | null;
  memo?: string | null;
  updatedAt?: TimestampString | null;
}
```
### Return Type
Recall that calling the `CreateAdvancePayment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateAdvancePayment` Mutation is of type `CreateAdvancePaymentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateAdvancePaymentData {
  advancePayment_insert: AdvancePayment_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateAdvancePayment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateAdvancePaymentVariables } from '@dataconnect/generated';
import { useCreateAdvancePayment } from '@dataconnect/generated/react'

export default function CreateAdvancePaymentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateAdvancePayment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateAdvancePayment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAdvancePayment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateAdvancePayment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateAdvancePayment` Mutation requires an argument of type `CreateAdvancePaymentVariables`:
  const createAdvancePaymentVars: CreateAdvancePaymentVariables = {
    id: ..., 
    workerId: ..., // optional
    workerName: ..., // optional
    teamId: ..., // optional
    teamName: ..., // optional
    yearMonth: ..., 
    items: ..., // optional
    prevMonthCarryover: ..., // optional
    accommodation: ..., // optional
    privateRoom: ..., // optional
    gloves: ..., // optional
    deposit: ..., // optional
    fines: ..., // optional
    electricity: ..., // optional
    gas: ..., // optional
    internet: ..., // optional
    water: ..., // optional
    totalDeduction: ..., // optional
    memo: ..., // optional
    updatedAt: ..., // optional
  };
  mutation.mutate(createAdvancePaymentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., yearMonth: ..., items: ..., prevMonthCarryover: ..., accommodation: ..., privateRoom: ..., gloves: ..., deposit: ..., fines: ..., electricity: ..., gas: ..., internet: ..., water: ..., totalDeduction: ..., memo: ..., updatedAt: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createAdvancePaymentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.advancePayment_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateAdvancePayment
You can execute the `UpdateAdvancePayment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateAdvancePayment(options?: useDataConnectMutationOptions<UpdateAdvancePaymentData, FirebaseError, UpdateAdvancePaymentVariables>): UseDataConnectMutationResult<UpdateAdvancePaymentData, UpdateAdvancePaymentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateAdvancePayment(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateAdvancePaymentData, FirebaseError, UpdateAdvancePaymentVariables>): UseDataConnectMutationResult<UpdateAdvancePaymentData, UpdateAdvancePaymentVariables>;
```

### Variables
The `UpdateAdvancePayment` Mutation requires an argument of type `UpdateAdvancePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateAdvancePaymentVariables {
  id: string;
  workerId?: UUIDString | null;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  yearMonth?: string | null;
  items?: string | null;
  prevMonthCarryover?: number | null;
  accommodation?: number | null;
  privateRoom?: number | null;
  gloves?: number | null;
  deposit?: number | null;
  fines?: number | null;
  electricity?: number | null;
  gas?: number | null;
  internet?: number | null;
  water?: number | null;
  totalDeduction?: number | null;
  memo?: string | null;
  updatedAt?: TimestampString | null;
}
```
### Return Type
Recall that calling the `UpdateAdvancePayment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateAdvancePayment` Mutation is of type `UpdateAdvancePaymentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateAdvancePaymentData {
  advancePayment_update?: AdvancePayment_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateAdvancePayment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateAdvancePaymentVariables } from '@dataconnect/generated';
import { useUpdateAdvancePayment } from '@dataconnect/generated/react'

export default function UpdateAdvancePaymentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateAdvancePayment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateAdvancePayment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAdvancePayment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAdvancePayment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateAdvancePayment` Mutation requires an argument of type `UpdateAdvancePaymentVariables`:
  const updateAdvancePaymentVars: UpdateAdvancePaymentVariables = {
    id: ..., 
    workerId: ..., // optional
    workerName: ..., // optional
    teamId: ..., // optional
    teamName: ..., // optional
    yearMonth: ..., // optional
    items: ..., // optional
    prevMonthCarryover: ..., // optional
    accommodation: ..., // optional
    privateRoom: ..., // optional
    gloves: ..., // optional
    deposit: ..., // optional
    fines: ..., // optional
    electricity: ..., // optional
    gas: ..., // optional
    internet: ..., // optional
    water: ..., // optional
    totalDeduction: ..., // optional
    memo: ..., // optional
    updatedAt: ..., // optional
  };
  mutation.mutate(updateAdvancePaymentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., yearMonth: ..., items: ..., prevMonthCarryover: ..., accommodation: ..., privateRoom: ..., gloves: ..., deposit: ..., fines: ..., electricity: ..., gas: ..., internet: ..., water: ..., totalDeduction: ..., memo: ..., updatedAt: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateAdvancePaymentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.advancePayment_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteAdvancePayment
You can execute the `DeleteAdvancePayment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteAdvancePayment(options?: useDataConnectMutationOptions<DeleteAdvancePaymentData, FirebaseError, DeleteAdvancePaymentVariables>): UseDataConnectMutationResult<DeleteAdvancePaymentData, DeleteAdvancePaymentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteAdvancePayment(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteAdvancePaymentData, FirebaseError, DeleteAdvancePaymentVariables>): UseDataConnectMutationResult<DeleteAdvancePaymentData, DeleteAdvancePaymentVariables>;
```

### Variables
The `DeleteAdvancePayment` Mutation requires an argument of type `DeleteAdvancePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteAdvancePaymentVariables {
  id: string;
}
```
### Return Type
Recall that calling the `DeleteAdvancePayment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteAdvancePayment` Mutation is of type `DeleteAdvancePaymentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteAdvancePaymentData {
  advancePayment_delete?: AdvancePayment_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteAdvancePayment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteAdvancePaymentVariables } from '@dataconnect/generated';
import { useDeleteAdvancePayment } from '@dataconnect/generated/react'

export default function DeleteAdvancePaymentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteAdvancePayment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteAdvancePayment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteAdvancePayment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteAdvancePayment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteAdvancePayment` Mutation requires an argument of type `DeleteAdvancePaymentVariables`:
  const deleteAdvancePaymentVars: DeleteAdvancePaymentVariables = {
    id: ..., 
  };
  mutation.mutate(deleteAdvancePaymentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteAdvancePaymentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.advancePayment_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateSmartMemo
You can execute the `CreateSmartMemo` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateSmartMemo(options?: useDataConnectMutationOptions<CreateSmartMemoData, FirebaseError, CreateSmartMemoVariables>): UseDataConnectMutationResult<CreateSmartMemoData, CreateSmartMemoVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateSmartMemo(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSmartMemoData, FirebaseError, CreateSmartMemoVariables>): UseDataConnectMutationResult<CreateSmartMemoData, CreateSmartMemoVariables>;
```

### Variables
The `CreateSmartMemo` Mutation requires an argument of type `CreateSmartMemoVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateSmartMemoVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  userId: string;
  scope: string;
  type: string;
  title: string;
  content?: string | null;
  checklistItems?: string | null;
  color?: string | null;
  order?: number | null;
  isPinned?: boolean | null;
  tags?: string | null;
  categoryId?: UUIDString | null;
  categoryLegacyId?: string | null;
  priority?: string | null;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  isCollapsed?: boolean | null;
  prevW?: number | null;
  prevH?: number | null;
}
```
### Return Type
Recall that calling the `CreateSmartMemo` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateSmartMemo` Mutation is of type `CreateSmartMemoData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateSmartMemoData {
  smartMemo_insert: SmartMemo_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateSmartMemo`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateSmartMemoVariables } from '@dataconnect/generated';
import { useCreateSmartMemo } from '@dataconnect/generated/react'

export default function CreateSmartMemoComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateSmartMemo();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateSmartMemo(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSmartMemo(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSmartMemo(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateSmartMemo` Mutation requires an argument of type `CreateSmartMemoVariables`:
  const createSmartMemoVars: CreateSmartMemoVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    userId: ..., 
    scope: ..., 
    type: ..., 
    title: ..., 
    content: ..., // optional
    checklistItems: ..., // optional
    color: ..., // optional
    order: ..., // optional
    isPinned: ..., // optional
    tags: ..., // optional
    categoryId: ..., // optional
    categoryLegacyId: ..., // optional
    priority: ..., // optional
    x: ..., // optional
    y: ..., // optional
    w: ..., // optional
    h: ..., // optional
    isCollapsed: ..., // optional
    prevW: ..., // optional
    prevH: ..., // optional
  };
  mutation.mutate(createSmartMemoVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., userId: ..., scope: ..., type: ..., title: ..., content: ..., checklistItems: ..., color: ..., order: ..., isPinned: ..., tags: ..., categoryId: ..., categoryLegacyId: ..., priority: ..., x: ..., y: ..., w: ..., h: ..., isCollapsed: ..., prevW: ..., prevH: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createSmartMemoVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.smartMemo_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateSmartMemo
You can execute the `UpdateSmartMemo` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateSmartMemo(options?: useDataConnectMutationOptions<UpdateSmartMemoData, FirebaseError, UpdateSmartMemoVariables>): UseDataConnectMutationResult<UpdateSmartMemoData, UpdateSmartMemoVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateSmartMemo(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateSmartMemoData, FirebaseError, UpdateSmartMemoVariables>): UseDataConnectMutationResult<UpdateSmartMemoData, UpdateSmartMemoVariables>;
```

### Variables
The `UpdateSmartMemo` Mutation requires an argument of type `UpdateSmartMemoVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateSmartMemoVariables {
  id: UUIDString;
  scope?: string | null;
  type?: string | null;
  title?: string | null;
  content?: string | null;
  checklistItems?: string | null;
  color?: string | null;
  order?: number | null;
  isPinned?: boolean | null;
  tags?: string | null;
  categoryId?: UUIDString | null;
  categoryLegacyId?: string | null;
  priority?: string | null;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  isCollapsed?: boolean | null;
  prevW?: number | null;
  prevH?: number | null;
}
```
### Return Type
Recall that calling the `UpdateSmartMemo` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateSmartMemo` Mutation is of type `UpdateSmartMemoData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateSmartMemoData {
  smartMemo_update?: SmartMemo_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateSmartMemo`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateSmartMemoVariables } from '@dataconnect/generated';
import { useUpdateSmartMemo } from '@dataconnect/generated/react'

export default function UpdateSmartMemoComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateSmartMemo();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateSmartMemo(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateSmartMemo(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateSmartMemo(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateSmartMemo` Mutation requires an argument of type `UpdateSmartMemoVariables`:
  const updateSmartMemoVars: UpdateSmartMemoVariables = {
    id: ..., 
    scope: ..., // optional
    type: ..., // optional
    title: ..., // optional
    content: ..., // optional
    checklistItems: ..., // optional
    color: ..., // optional
    order: ..., // optional
    isPinned: ..., // optional
    tags: ..., // optional
    categoryId: ..., // optional
    categoryLegacyId: ..., // optional
    priority: ..., // optional
    x: ..., // optional
    y: ..., // optional
    w: ..., // optional
    h: ..., // optional
    isCollapsed: ..., // optional
    prevW: ..., // optional
    prevH: ..., // optional
  };
  mutation.mutate(updateSmartMemoVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., scope: ..., type: ..., title: ..., content: ..., checklistItems: ..., color: ..., order: ..., isPinned: ..., tags: ..., categoryId: ..., categoryLegacyId: ..., priority: ..., x: ..., y: ..., w: ..., h: ..., isCollapsed: ..., prevW: ..., prevH: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateSmartMemoVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.smartMemo_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteSmartMemo
You can execute the `DeleteSmartMemo` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteSmartMemo(options?: useDataConnectMutationOptions<DeleteSmartMemoData, FirebaseError, DeleteSmartMemoVariables>): UseDataConnectMutationResult<DeleteSmartMemoData, DeleteSmartMemoVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteSmartMemo(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteSmartMemoData, FirebaseError, DeleteSmartMemoVariables>): UseDataConnectMutationResult<DeleteSmartMemoData, DeleteSmartMemoVariables>;
```

### Variables
The `DeleteSmartMemo` Mutation requires an argument of type `DeleteSmartMemoVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteSmartMemoVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteSmartMemo` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteSmartMemo` Mutation is of type `DeleteSmartMemoData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteSmartMemoData {
  smartMemo_delete?: SmartMemo_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteSmartMemo`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteSmartMemoVariables } from '@dataconnect/generated';
import { useDeleteSmartMemo } from '@dataconnect/generated/react'

export default function DeleteSmartMemoComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteSmartMemo();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteSmartMemo(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteSmartMemo(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteSmartMemo(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteSmartMemo` Mutation requires an argument of type `DeleteSmartMemoVariables`:
  const deleteSmartMemoVars: DeleteSmartMemoVariables = {
    id: ..., 
  };
  mutation.mutate(deleteSmartMemoVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteSmartMemoVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.smartMemo_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateSmartMemoCategory
You can execute the `CreateSmartMemoCategory` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateSmartMemoCategory(options?: useDataConnectMutationOptions<CreateSmartMemoCategoryData, FirebaseError, CreateSmartMemoCategoryVariables>): UseDataConnectMutationResult<CreateSmartMemoCategoryData, CreateSmartMemoCategoryVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateSmartMemoCategory(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSmartMemoCategoryData, FirebaseError, CreateSmartMemoCategoryVariables>): UseDataConnectMutationResult<CreateSmartMemoCategoryData, CreateSmartMemoCategoryVariables>;
```

### Variables
The `CreateSmartMemoCategory` Mutation requires an argument of type `CreateSmartMemoCategoryVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateSmartMemoCategoryVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  userId: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  order?: number | null;
}
```
### Return Type
Recall that calling the `CreateSmartMemoCategory` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateSmartMemoCategory` Mutation is of type `CreateSmartMemoCategoryData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateSmartMemoCategoryData {
  smartMemoCategory_insert: SmartMemoCategory_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateSmartMemoCategory`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateSmartMemoCategoryVariables } from '@dataconnect/generated';
import { useCreateSmartMemoCategory } from '@dataconnect/generated/react'

export default function CreateSmartMemoCategoryComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateSmartMemoCategory();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateSmartMemoCategory(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSmartMemoCategory(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateSmartMemoCategory(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateSmartMemoCategory` Mutation requires an argument of type `CreateSmartMemoCategoryVariables`:
  const createSmartMemoCategoryVars: CreateSmartMemoCategoryVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    userId: ..., 
    name: ..., 
    color: ..., // optional
    icon: ..., // optional
    order: ..., // optional
  };
  mutation.mutate(createSmartMemoCategoryVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., userId: ..., name: ..., color: ..., icon: ..., order: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createSmartMemoCategoryVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.smartMemoCategory_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateSmartMemoCategory
You can execute the `UpdateSmartMemoCategory` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateSmartMemoCategory(options?: useDataConnectMutationOptions<UpdateSmartMemoCategoryData, FirebaseError, UpdateSmartMemoCategoryVariables>): UseDataConnectMutationResult<UpdateSmartMemoCategoryData, UpdateSmartMemoCategoryVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateSmartMemoCategory(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateSmartMemoCategoryData, FirebaseError, UpdateSmartMemoCategoryVariables>): UseDataConnectMutationResult<UpdateSmartMemoCategoryData, UpdateSmartMemoCategoryVariables>;
```

### Variables
The `UpdateSmartMemoCategory` Mutation requires an argument of type `UpdateSmartMemoCategoryVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateSmartMemoCategoryVariables {
  id: UUIDString;
  userId?: string | null;
  name?: string | null;
  color?: string | null;
  icon?: string | null;
  order?: number | null;
}
```
### Return Type
Recall that calling the `UpdateSmartMemoCategory` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateSmartMemoCategory` Mutation is of type `UpdateSmartMemoCategoryData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateSmartMemoCategoryData {
  smartMemoCategory_update?: SmartMemoCategory_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateSmartMemoCategory`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateSmartMemoCategoryVariables } from '@dataconnect/generated';
import { useUpdateSmartMemoCategory } from '@dataconnect/generated/react'

export default function UpdateSmartMemoCategoryComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateSmartMemoCategory();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateSmartMemoCategory(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateSmartMemoCategory(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateSmartMemoCategory(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateSmartMemoCategory` Mutation requires an argument of type `UpdateSmartMemoCategoryVariables`:
  const updateSmartMemoCategoryVars: UpdateSmartMemoCategoryVariables = {
    id: ..., 
    userId: ..., // optional
    name: ..., // optional
    color: ..., // optional
    icon: ..., // optional
    order: ..., // optional
  };
  mutation.mutate(updateSmartMemoCategoryVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., userId: ..., name: ..., color: ..., icon: ..., order: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateSmartMemoCategoryVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.smartMemoCategory_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteSmartMemoCategory
You can execute the `DeleteSmartMemoCategory` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteSmartMemoCategory(options?: useDataConnectMutationOptions<DeleteSmartMemoCategoryData, FirebaseError, DeleteSmartMemoCategoryVariables>): UseDataConnectMutationResult<DeleteSmartMemoCategoryData, DeleteSmartMemoCategoryVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteSmartMemoCategory(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteSmartMemoCategoryData, FirebaseError, DeleteSmartMemoCategoryVariables>): UseDataConnectMutationResult<DeleteSmartMemoCategoryData, DeleteSmartMemoCategoryVariables>;
```

### Variables
The `DeleteSmartMemoCategory` Mutation requires an argument of type `DeleteSmartMemoCategoryVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteSmartMemoCategoryVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteSmartMemoCategory` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteSmartMemoCategory` Mutation is of type `DeleteSmartMemoCategoryData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteSmartMemoCategoryData {
  smartMemoCategory_delete?: SmartMemoCategory_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteSmartMemoCategory`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteSmartMemoCategoryVariables } from '@dataconnect/generated';
import { useDeleteSmartMemoCategory } from '@dataconnect/generated/react'

export default function DeleteSmartMemoCategoryComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteSmartMemoCategory();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteSmartMemoCategory(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteSmartMemoCategory(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteSmartMemoCategory(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteSmartMemoCategory` Mutation requires an argument of type `DeleteSmartMemoCategoryVariables`:
  const deleteSmartMemoCategoryVars: DeleteSmartMemoCategoryVariables = {
    id: ..., 
  };
  mutation.mutate(deleteSmartMemoCategoryVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteSmartMemoCategoryVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.smartMemoCategory_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateVehicle
You can execute the `CreateVehicle` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateVehicle(options?: useDataConnectMutationOptions<CreateVehicleData, FirebaseError, CreateVehicleVariables>): UseDataConnectMutationResult<CreateVehicleData, CreateVehicleVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateVehicle(dc: DataConnect, options?: useDataConnectMutationOptions<CreateVehicleData, FirebaseError, CreateVehicleVariables>): UseDataConnectMutationResult<CreateVehicleData, CreateVehicleVariables>;
```

### Variables
The `CreateVehicle` Mutation requires an argument of type `CreateVehicleVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateVehicleVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  licensePlate: string;
  model?: string | null;
  type?: string | null;
  owner?: string | null;
  status?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `CreateVehicle` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateVehicle` Mutation is of type `CreateVehicleData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateVehicleData {
  vehicle_insert: Vehicle_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateVehicle`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateVehicleVariables } from '@dataconnect/generated';
import { useCreateVehicle } from '@dataconnect/generated/react'

export default function CreateVehicleComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateVehicle();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateVehicle(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateVehicle(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateVehicle(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateVehicle` Mutation requires an argument of type `CreateVehicleVariables`:
  const createVehicleVars: CreateVehicleVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    licensePlate: ..., 
    model: ..., // optional
    type: ..., // optional
    owner: ..., // optional
    status: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(createVehicleVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., licensePlate: ..., model: ..., type: ..., owner: ..., status: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createVehicleVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicle_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateVehicle
You can execute the `UpdateVehicle` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateVehicle(options?: useDataConnectMutationOptions<UpdateVehicleData, FirebaseError, UpdateVehicleVariables>): UseDataConnectMutationResult<UpdateVehicleData, UpdateVehicleVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateVehicle(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateVehicleData, FirebaseError, UpdateVehicleVariables>): UseDataConnectMutationResult<UpdateVehicleData, UpdateVehicleVariables>;
```

### Variables
The `UpdateVehicle` Mutation requires an argument of type `UpdateVehicleVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateVehicleVariables {
  id: UUIDString;
  licensePlate?: string | null;
  model?: string | null;
  type?: string | null;
  owner?: string | null;
  status?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `UpdateVehicle` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateVehicle` Mutation is of type `UpdateVehicleData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateVehicleData {
  vehicle_update?: Vehicle_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateVehicle`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateVehicleVariables } from '@dataconnect/generated';
import { useUpdateVehicle } from '@dataconnect/generated/react'

export default function UpdateVehicleComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateVehicle();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateVehicle(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateVehicle(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateVehicle(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateVehicle` Mutation requires an argument of type `UpdateVehicleVariables`:
  const updateVehicleVars: UpdateVehicleVariables = {
    id: ..., 
    licensePlate: ..., // optional
    model: ..., // optional
    type: ..., // optional
    owner: ..., // optional
    status: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(updateVehicleVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., licensePlate: ..., model: ..., type: ..., owner: ..., status: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateVehicleVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicle_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteVehicle
You can execute the `DeleteVehicle` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteVehicle(options?: useDataConnectMutationOptions<DeleteVehicleData, FirebaseError, DeleteVehicleVariables>): UseDataConnectMutationResult<DeleteVehicleData, DeleteVehicleVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteVehicle(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteVehicleData, FirebaseError, DeleteVehicleVariables>): UseDataConnectMutationResult<DeleteVehicleData, DeleteVehicleVariables>;
```

### Variables
The `DeleteVehicle` Mutation requires an argument of type `DeleteVehicleVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteVehicleVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteVehicle` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteVehicle` Mutation is of type `DeleteVehicleData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteVehicleData {
  vehicle_delete?: Vehicle_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteVehicle`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteVehicleVariables } from '@dataconnect/generated';
import { useDeleteVehicle } from '@dataconnect/generated/react'

export default function DeleteVehicleComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteVehicle();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteVehicle(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteVehicle(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteVehicle(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteVehicle` Mutation requires an argument of type `DeleteVehicleVariables`:
  const deleteVehicleVars: DeleteVehicleVariables = {
    id: ..., 
  };
  mutation.mutate(deleteVehicleVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteVehicleVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicle_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateVehicleAssignment
You can execute the `CreateVehicleAssignment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateVehicleAssignment(options?: useDataConnectMutationOptions<CreateVehicleAssignmentData, FirebaseError, CreateVehicleAssignmentVariables>): UseDataConnectMutationResult<CreateVehicleAssignmentData, CreateVehicleAssignmentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateVehicleAssignment(dc: DataConnect, options?: useDataConnectMutationOptions<CreateVehicleAssignmentData, FirebaseError, CreateVehicleAssignmentVariables>): UseDataConnectMutationResult<CreateVehicleAssignmentData, CreateVehicleAssignmentVariables>;
```

### Variables
The `CreateVehicleAssignment` Mutation requires an argument of type `CreateVehicleAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateVehicleAssignmentVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  vehicleId: UUIDString;
  workerId?: UUIDString | null;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  startDate: string;
  endDate?: string | null;
  status?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `CreateVehicleAssignment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateVehicleAssignment` Mutation is of type `CreateVehicleAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateVehicleAssignmentData {
  vehicleAssignment_insert: VehicleAssignment_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateVehicleAssignment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateVehicleAssignmentVariables } from '@dataconnect/generated';
import { useCreateVehicleAssignment } from '@dataconnect/generated/react'

export default function CreateVehicleAssignmentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateVehicleAssignment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateVehicleAssignment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateVehicleAssignment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateVehicleAssignment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateVehicleAssignment` Mutation requires an argument of type `CreateVehicleAssignmentVariables`:
  const createVehicleAssignmentVars: CreateVehicleAssignmentVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    vehicleId: ..., 
    workerId: ..., // optional
    workerName: ..., // optional
    teamId: ..., // optional
    teamName: ..., // optional
    startDate: ..., 
    endDate: ..., // optional
    status: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(createVehicleAssignmentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., vehicleId: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., startDate: ..., endDate: ..., status: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createVehicleAssignmentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicleAssignment_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateVehicleAssignment
You can execute the `UpdateVehicleAssignment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateVehicleAssignment(options?: useDataConnectMutationOptions<UpdateVehicleAssignmentData, FirebaseError, UpdateVehicleAssignmentVariables>): UseDataConnectMutationResult<UpdateVehicleAssignmentData, UpdateVehicleAssignmentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateVehicleAssignment(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateVehicleAssignmentData, FirebaseError, UpdateVehicleAssignmentVariables>): UseDataConnectMutationResult<UpdateVehicleAssignmentData, UpdateVehicleAssignmentVariables>;
```

### Variables
The `UpdateVehicleAssignment` Mutation requires an argument of type `UpdateVehicleAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateVehicleAssignmentVariables {
  id: UUIDString;
  vehicleId?: UUIDString | null;
  workerId?: UUIDString | null;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `UpdateVehicleAssignment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateVehicleAssignment` Mutation is of type `UpdateVehicleAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateVehicleAssignmentData {
  vehicleAssignment_update?: VehicleAssignment_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateVehicleAssignment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateVehicleAssignmentVariables } from '@dataconnect/generated';
import { useUpdateVehicleAssignment } from '@dataconnect/generated/react'

export default function UpdateVehicleAssignmentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateVehicleAssignment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateVehicleAssignment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateVehicleAssignment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateVehicleAssignment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateVehicleAssignment` Mutation requires an argument of type `UpdateVehicleAssignmentVariables`:
  const updateVehicleAssignmentVars: UpdateVehicleAssignmentVariables = {
    id: ..., 
    vehicleId: ..., // optional
    workerId: ..., // optional
    workerName: ..., // optional
    teamId: ..., // optional
    teamName: ..., // optional
    startDate: ..., // optional
    endDate: ..., // optional
    status: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(updateVehicleAssignmentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., vehicleId: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., startDate: ..., endDate: ..., status: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateVehicleAssignmentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicleAssignment_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteVehicleAssignment
You can execute the `DeleteVehicleAssignment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteVehicleAssignment(options?: useDataConnectMutationOptions<DeleteVehicleAssignmentData, FirebaseError, DeleteVehicleAssignmentVariables>): UseDataConnectMutationResult<DeleteVehicleAssignmentData, DeleteVehicleAssignmentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteVehicleAssignment(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteVehicleAssignmentData, FirebaseError, DeleteVehicleAssignmentVariables>): UseDataConnectMutationResult<DeleteVehicleAssignmentData, DeleteVehicleAssignmentVariables>;
```

### Variables
The `DeleteVehicleAssignment` Mutation requires an argument of type `DeleteVehicleAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteVehicleAssignmentVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteVehicleAssignment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteVehicleAssignment` Mutation is of type `DeleteVehicleAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteVehicleAssignmentData {
  vehicleAssignment_delete?: VehicleAssignment_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteVehicleAssignment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteVehicleAssignmentVariables } from '@dataconnect/generated';
import { useDeleteVehicleAssignment } from '@dataconnect/generated/react'

export default function DeleteVehicleAssignmentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteVehicleAssignment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteVehicleAssignment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteVehicleAssignment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteVehicleAssignment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteVehicleAssignment` Mutation requires an argument of type `DeleteVehicleAssignmentVariables`:
  const deleteVehicleAssignmentVars: DeleteVehicleAssignmentVariables = {
    id: ..., 
  };
  mutation.mutate(deleteVehicleAssignmentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteVehicleAssignmentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicleAssignment_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateVehicleExpense
You can execute the `CreateVehicleExpense` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateVehicleExpense(options?: useDataConnectMutationOptions<CreateVehicleExpenseData, FirebaseError, CreateVehicleExpenseVariables>): UseDataConnectMutationResult<CreateVehicleExpenseData, CreateVehicleExpenseVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateVehicleExpense(dc: DataConnect, options?: useDataConnectMutationOptions<CreateVehicleExpenseData, FirebaseError, CreateVehicleExpenseVariables>): UseDataConnectMutationResult<CreateVehicleExpenseData, CreateVehicleExpenseVariables>;
```

### Variables
The `CreateVehicleExpense` Mutation requires an argument of type `CreateVehicleExpenseVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateVehicleExpenseVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  vehicleId: UUIDString;
  date: string;
  type: string;
  amount: number;
  odometer?: number | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `CreateVehicleExpense` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateVehicleExpense` Mutation is of type `CreateVehicleExpenseData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateVehicleExpenseData {
  vehicleExpense_insert: VehicleExpense_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateVehicleExpense`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateVehicleExpenseVariables } from '@dataconnect/generated';
import { useCreateVehicleExpense } from '@dataconnect/generated/react'

export default function CreateVehicleExpenseComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateVehicleExpense();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateVehicleExpense(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateVehicleExpense(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateVehicleExpense(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateVehicleExpense` Mutation requires an argument of type `CreateVehicleExpenseVariables`:
  const createVehicleExpenseVars: CreateVehicleExpenseVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    vehicleId: ..., 
    date: ..., 
    type: ..., 
    amount: ..., 
    odometer: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(createVehicleExpenseVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., vehicleId: ..., date: ..., type: ..., amount: ..., odometer: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createVehicleExpenseVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicleExpense_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateVehicleExpense
You can execute the `UpdateVehicleExpense` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateVehicleExpense(options?: useDataConnectMutationOptions<UpdateVehicleExpenseData, FirebaseError, UpdateVehicleExpenseVariables>): UseDataConnectMutationResult<UpdateVehicleExpenseData, UpdateVehicleExpenseVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateVehicleExpense(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateVehicleExpenseData, FirebaseError, UpdateVehicleExpenseVariables>): UseDataConnectMutationResult<UpdateVehicleExpenseData, UpdateVehicleExpenseVariables>;
```

### Variables
The `UpdateVehicleExpense` Mutation requires an argument of type `UpdateVehicleExpenseVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateVehicleExpenseVariables {
  id: UUIDString;
  vehicleId?: UUIDString | null;
  date?: string | null;
  type?: string | null;
  amount?: number | null;
  odometer?: number | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `UpdateVehicleExpense` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateVehicleExpense` Mutation is of type `UpdateVehicleExpenseData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateVehicleExpenseData {
  vehicleExpense_update?: VehicleExpense_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateVehicleExpense`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateVehicleExpenseVariables } from '@dataconnect/generated';
import { useUpdateVehicleExpense } from '@dataconnect/generated/react'

export default function UpdateVehicleExpenseComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateVehicleExpense();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateVehicleExpense(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateVehicleExpense(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateVehicleExpense(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateVehicleExpense` Mutation requires an argument of type `UpdateVehicleExpenseVariables`:
  const updateVehicleExpenseVars: UpdateVehicleExpenseVariables = {
    id: ..., 
    vehicleId: ..., // optional
    date: ..., // optional
    type: ..., // optional
    amount: ..., // optional
    odometer: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(updateVehicleExpenseVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., vehicleId: ..., date: ..., type: ..., amount: ..., odometer: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateVehicleExpenseVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicleExpense_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteVehicleExpense
You can execute the `DeleteVehicleExpense` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteVehicleExpense(options?: useDataConnectMutationOptions<DeleteVehicleExpenseData, FirebaseError, DeleteVehicleExpenseVariables>): UseDataConnectMutationResult<DeleteVehicleExpenseData, DeleteVehicleExpenseVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteVehicleExpense(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteVehicleExpenseData, FirebaseError, DeleteVehicleExpenseVariables>): UseDataConnectMutationResult<DeleteVehicleExpenseData, DeleteVehicleExpenseVariables>;
```

### Variables
The `DeleteVehicleExpense` Mutation requires an argument of type `DeleteVehicleExpenseVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteVehicleExpenseVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteVehicleExpense` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteVehicleExpense` Mutation is of type `DeleteVehicleExpenseData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteVehicleExpenseData {
  vehicleExpense_delete?: VehicleExpense_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteVehicleExpense`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteVehicleExpenseVariables } from '@dataconnect/generated';
import { useDeleteVehicleExpense } from '@dataconnect/generated/react'

export default function DeleteVehicleExpenseComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteVehicleExpense();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteVehicleExpense(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteVehicleExpense(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteVehicleExpense(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteVehicleExpense` Mutation requires an argument of type `DeleteVehicleExpenseVariables`:
  const deleteVehicleExpenseVars: DeleteVehicleExpenseVariables = {
    id: ..., 
  };
  mutation.mutate(deleteVehicleExpenseVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteVehicleExpenseVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicleExpense_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateVehicleBillingDocument
You can execute the `CreateVehicleBillingDocument` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateVehicleBillingDocument(options?: useDataConnectMutationOptions<CreateVehicleBillingDocumentData, FirebaseError, CreateVehicleBillingDocumentVariables>): UseDataConnectMutationResult<CreateVehicleBillingDocumentData, CreateVehicleBillingDocumentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateVehicleBillingDocument(dc: DataConnect, options?: useDataConnectMutationOptions<CreateVehicleBillingDocumentData, FirebaseError, CreateVehicleBillingDocumentVariables>): UseDataConnectMutationResult<CreateVehicleBillingDocumentData, CreateVehicleBillingDocumentVariables>;
```

### Variables
The `CreateVehicleBillingDocument` Mutation requires an argument of type `CreateVehicleBillingDocumentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateVehicleBillingDocumentVariables {
  id?: UUIDString | null;
  yearMonth: string;
  vehicleId: UUIDString;
  licensePlate: string;
  amount: number;
  status?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `CreateVehicleBillingDocument` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateVehicleBillingDocument` Mutation is of type `CreateVehicleBillingDocumentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateVehicleBillingDocumentData {
  vehicleBillingDocument_insert: VehicleBillingDocument_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateVehicleBillingDocument`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateVehicleBillingDocumentVariables } from '@dataconnect/generated';
import { useCreateVehicleBillingDocument } from '@dataconnect/generated/react'

export default function CreateVehicleBillingDocumentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateVehicleBillingDocument();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateVehicleBillingDocument(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateVehicleBillingDocument(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateVehicleBillingDocument(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateVehicleBillingDocument` Mutation requires an argument of type `CreateVehicleBillingDocumentVariables`:
  const createVehicleBillingDocumentVars: CreateVehicleBillingDocumentVariables = {
    id: ..., // optional
    yearMonth: ..., 
    vehicleId: ..., 
    licensePlate: ..., 
    amount: ..., 
    status: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(createVehicleBillingDocumentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., yearMonth: ..., vehicleId: ..., licensePlate: ..., amount: ..., status: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createVehicleBillingDocumentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicleBillingDocument_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateVehicleBillingDocument
You can execute the `UpdateVehicleBillingDocument` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateVehicleBillingDocument(options?: useDataConnectMutationOptions<UpdateVehicleBillingDocumentData, FirebaseError, UpdateVehicleBillingDocumentVariables>): UseDataConnectMutationResult<UpdateVehicleBillingDocumentData, UpdateVehicleBillingDocumentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateVehicleBillingDocument(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateVehicleBillingDocumentData, FirebaseError, UpdateVehicleBillingDocumentVariables>): UseDataConnectMutationResult<UpdateVehicleBillingDocumentData, UpdateVehicleBillingDocumentVariables>;
```

### Variables
The `UpdateVehicleBillingDocument` Mutation requires an argument of type `UpdateVehicleBillingDocumentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateVehicleBillingDocumentVariables {
  id: UUIDString;
  yearMonth?: string | null;
  vehicleId?: UUIDString | null;
  licensePlate?: string | null;
  amount?: number | null;
  status?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `UpdateVehicleBillingDocument` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateVehicleBillingDocument` Mutation is of type `UpdateVehicleBillingDocumentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateVehicleBillingDocumentData {
  vehicleBillingDocument_update?: VehicleBillingDocument_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateVehicleBillingDocument`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateVehicleBillingDocumentVariables } from '@dataconnect/generated';
import { useUpdateVehicleBillingDocument } from '@dataconnect/generated/react'

export default function UpdateVehicleBillingDocumentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateVehicleBillingDocument();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateVehicleBillingDocument(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateVehicleBillingDocument(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateVehicleBillingDocument(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateVehicleBillingDocument` Mutation requires an argument of type `UpdateVehicleBillingDocumentVariables`:
  const updateVehicleBillingDocumentVars: UpdateVehicleBillingDocumentVariables = {
    id: ..., 
    yearMonth: ..., // optional
    vehicleId: ..., // optional
    licensePlate: ..., // optional
    amount: ..., // optional
    status: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(updateVehicleBillingDocumentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., yearMonth: ..., vehicleId: ..., licensePlate: ..., amount: ..., status: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateVehicleBillingDocumentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicleBillingDocument_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteVehicleBillingDocument
You can execute the `DeleteVehicleBillingDocument` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteVehicleBillingDocument(options?: useDataConnectMutationOptions<DeleteVehicleBillingDocumentData, FirebaseError, DeleteVehicleBillingDocumentVariables>): UseDataConnectMutationResult<DeleteVehicleBillingDocumentData, DeleteVehicleBillingDocumentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteVehicleBillingDocument(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteVehicleBillingDocumentData, FirebaseError, DeleteVehicleBillingDocumentVariables>): UseDataConnectMutationResult<DeleteVehicleBillingDocumentData, DeleteVehicleBillingDocumentVariables>;
```

### Variables
The `DeleteVehicleBillingDocument` Mutation requires an argument of type `DeleteVehicleBillingDocumentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteVehicleBillingDocumentVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteVehicleBillingDocument` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteVehicleBillingDocument` Mutation is of type `DeleteVehicleBillingDocumentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteVehicleBillingDocumentData {
  vehicleBillingDocument_delete?: VehicleBillingDocument_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteVehicleBillingDocument`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteVehicleBillingDocumentVariables } from '@dataconnect/generated';
import { useDeleteVehicleBillingDocument } from '@dataconnect/generated/react'

export default function DeleteVehicleBillingDocumentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteVehicleBillingDocument();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteVehicleBillingDocument(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteVehicleBillingDocument(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteVehicleBillingDocument(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteVehicleBillingDocument` Mutation requires an argument of type `DeleteVehicleBillingDocumentVariables`:
  const deleteVehicleBillingDocumentVars: DeleteVehicleBillingDocumentVariables = {
    id: ..., 
  };
  mutation.mutate(deleteVehicleBillingDocumentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteVehicleBillingDocumentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.vehicleBillingDocument_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateAgent
You can execute the `UpdateAgent` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateAgent(options?: useDataConnectMutationOptions<UpdateAgentData, FirebaseError, UpdateAgentVariables>): UseDataConnectMutationResult<UpdateAgentData, UpdateAgentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateAgent(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateAgentData, FirebaseError, UpdateAgentVariables>): UseDataConnectMutationResult<UpdateAgentData, UpdateAgentVariables>;
```

### Variables
The `UpdateAgent` Mutation requires an argument of type `UpdateAgentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateAgentVariables {
  id: string;
  name?: string | null;
  status?: string | null;
}
```
### Return Type
Recall that calling the `UpdateAgent` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateAgent` Mutation is of type `UpdateAgentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateAgentData {
  agent_update?: Agent_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateAgent`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateAgentVariables } from '@dataconnect/generated';
import { useUpdateAgent } from '@dataconnect/generated/react'

export default function UpdateAgentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateAgent();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateAgent(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAgent(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAgent(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateAgent` Mutation requires an argument of type `UpdateAgentVariables`:
  const updateAgentVars: UpdateAgentVariables = {
    id: ..., 
    name: ..., // optional
    status: ..., // optional
  };
  mutation.mutate(updateAgentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., name: ..., status: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateAgentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.agent_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateAgentConversation
You can execute the `UpdateAgentConversation` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateAgentConversation(options?: useDataConnectMutationOptions<UpdateAgentConversationData, FirebaseError, UpdateAgentConversationVariables>): UseDataConnectMutationResult<UpdateAgentConversationData, UpdateAgentConversationVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateAgentConversation(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateAgentConversationData, FirebaseError, UpdateAgentConversationVariables>): UseDataConnectMutationResult<UpdateAgentConversationData, UpdateAgentConversationVariables>;
```

### Variables
The `UpdateAgentConversation` Mutation requires an argument of type `UpdateAgentConversationVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateAgentConversationVariables {
  id: string;
}
```
### Return Type
Recall that calling the `UpdateAgentConversation` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateAgentConversation` Mutation is of type `UpdateAgentConversationData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateAgentConversationData {
  agentConversation_update?: AgentConversation_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateAgentConversation`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateAgentConversationVariables } from '@dataconnect/generated';
import { useUpdateAgentConversation } from '@dataconnect/generated/react'

export default function UpdateAgentConversationComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateAgentConversation();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateAgentConversation(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAgentConversation(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateAgentConversation(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateAgentConversation` Mutation requires an argument of type `UpdateAgentConversationVariables`:
  const updateAgentConversationVars: UpdateAgentConversationVariables = {
    id: ..., 
  };
  mutation.mutate(updateAgentConversationVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateAgentConversationVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.agentConversation_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateDailyDispatch
You can execute the `CreateDailyDispatch` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateDailyDispatch(options?: useDataConnectMutationOptions<CreateDailyDispatchData, FirebaseError, CreateDailyDispatchVariables>): UseDataConnectMutationResult<CreateDailyDispatchData, CreateDailyDispatchVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateDailyDispatch(dc: DataConnect, options?: useDataConnectMutationOptions<CreateDailyDispatchData, FirebaseError, CreateDailyDispatchVariables>): UseDataConnectMutationResult<CreateDailyDispatchData, CreateDailyDispatchVariables>;
```

### Variables
The `CreateDailyDispatch` Mutation requires an argument of type `CreateDailyDispatchVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateDailyDispatchVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  date: string;
  workerId: UUIDString;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  siteId?: UUIDString | null;
  siteName?: string | null;
  status?: string | null;
}
```
### Return Type
Recall that calling the `CreateDailyDispatch` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateDailyDispatch` Mutation is of type `CreateDailyDispatchData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateDailyDispatchData {
  dailyDispatch_insert: DailyDispatch_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateDailyDispatch`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateDailyDispatchVariables } from '@dataconnect/generated';
import { useCreateDailyDispatch } from '@dataconnect/generated/react'

export default function CreateDailyDispatchComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateDailyDispatch();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateDailyDispatch(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateDailyDispatch(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateDailyDispatch(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateDailyDispatch` Mutation requires an argument of type `CreateDailyDispatchVariables`:
  const createDailyDispatchVars: CreateDailyDispatchVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    date: ..., 
    workerId: ..., 
    workerName: ..., // optional
    teamId: ..., // optional
    teamName: ..., // optional
    siteId: ..., // optional
    siteName: ..., // optional
    status: ..., // optional
  };
  mutation.mutate(createDailyDispatchVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., date: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., siteId: ..., siteName: ..., status: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createDailyDispatchVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.dailyDispatch_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateDailyDispatch
You can execute the `UpdateDailyDispatch` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateDailyDispatch(options?: useDataConnectMutationOptions<UpdateDailyDispatchData, FirebaseError, UpdateDailyDispatchVariables>): UseDataConnectMutationResult<UpdateDailyDispatchData, UpdateDailyDispatchVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateDailyDispatch(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateDailyDispatchData, FirebaseError, UpdateDailyDispatchVariables>): UseDataConnectMutationResult<UpdateDailyDispatchData, UpdateDailyDispatchVariables>;
```

### Variables
The `UpdateDailyDispatch` Mutation requires an argument of type `UpdateDailyDispatchVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateDailyDispatchVariables {
  id: UUIDString;
  date?: string | null;
  workerId?: UUIDString | null;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  siteId?: UUIDString | null;
  siteName?: string | null;
  status?: string | null;
}
```
### Return Type
Recall that calling the `UpdateDailyDispatch` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateDailyDispatch` Mutation is of type `UpdateDailyDispatchData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateDailyDispatchData {
  dailyDispatch_update?: DailyDispatch_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateDailyDispatch`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateDailyDispatchVariables } from '@dataconnect/generated';
import { useUpdateDailyDispatch } from '@dataconnect/generated/react'

export default function UpdateDailyDispatchComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateDailyDispatch();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateDailyDispatch(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateDailyDispatch(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateDailyDispatch(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateDailyDispatch` Mutation requires an argument of type `UpdateDailyDispatchVariables`:
  const updateDailyDispatchVars: UpdateDailyDispatchVariables = {
    id: ..., 
    date: ..., // optional
    workerId: ..., // optional
    workerName: ..., // optional
    teamId: ..., // optional
    teamName: ..., // optional
    siteId: ..., // optional
    siteName: ..., // optional
    status: ..., // optional
  };
  mutation.mutate(updateDailyDispatchVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., date: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., siteId: ..., siteName: ..., status: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateDailyDispatchVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.dailyDispatch_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteDailyDispatch
You can execute the `DeleteDailyDispatch` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteDailyDispatch(options?: useDataConnectMutationOptions<DeleteDailyDispatchData, FirebaseError, DeleteDailyDispatchVariables>): UseDataConnectMutationResult<DeleteDailyDispatchData, DeleteDailyDispatchVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteDailyDispatch(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteDailyDispatchData, FirebaseError, DeleteDailyDispatchVariables>): UseDataConnectMutationResult<DeleteDailyDispatchData, DeleteDailyDispatchVariables>;
```

### Variables
The `DeleteDailyDispatch` Mutation requires an argument of type `DeleteDailyDispatchVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteDailyDispatchVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteDailyDispatch` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteDailyDispatch` Mutation is of type `DeleteDailyDispatchData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteDailyDispatchData {
  dailyDispatch_delete?: DailyDispatch_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteDailyDispatch`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteDailyDispatchVariables } from '@dataconnect/generated';
import { useDeleteDailyDispatch } from '@dataconnect/generated/react'

export default function DeleteDailyDispatchComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteDailyDispatch();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteDailyDispatch(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteDailyDispatch(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteDailyDispatch(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteDailyDispatch` Mutation requires an argument of type `DeleteDailyDispatchVariables`:
  const deleteDailyDispatchVars: DeleteDailyDispatchVariables = {
    id: ..., 
  };
  mutation.mutate(deleteDailyDispatchVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteDailyDispatchVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.dailyDispatch_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreatePayment
You can execute the `CreatePayment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreatePayment(options?: useDataConnectMutationOptions<CreatePaymentData, FirebaseError, CreatePaymentVariables>): UseDataConnectMutationResult<CreatePaymentData, CreatePaymentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreatePayment(dc: DataConnect, options?: useDataConnectMutationOptions<CreatePaymentData, FirebaseError, CreatePaymentVariables>): UseDataConnectMutationResult<CreatePaymentData, CreatePaymentVariables>;
```

### Variables
The `CreatePayment` Mutation requires an argument of type `CreatePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreatePaymentVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  date: string;
  amount: number;
  type?: string | null;
  method?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `CreatePayment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreatePayment` Mutation is of type `CreatePaymentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreatePaymentData {
  payment_insert: Payment_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreatePayment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreatePaymentVariables } from '@dataconnect/generated';
import { useCreatePayment } from '@dataconnect/generated/react'

export default function CreatePaymentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreatePayment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreatePayment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreatePayment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreatePayment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreatePayment` Mutation requires an argument of type `CreatePaymentVariables`:
  const createPaymentVars: CreatePaymentVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    date: ..., 
    amount: ..., 
    type: ..., // optional
    method: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(createPaymentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., date: ..., amount: ..., type: ..., method: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createPaymentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.payment_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdatePayment
You can execute the `UpdatePayment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdatePayment(options?: useDataConnectMutationOptions<UpdatePaymentData, FirebaseError, UpdatePaymentVariables>): UseDataConnectMutationResult<UpdatePaymentData, UpdatePaymentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdatePayment(dc: DataConnect, options?: useDataConnectMutationOptions<UpdatePaymentData, FirebaseError, UpdatePaymentVariables>): UseDataConnectMutationResult<UpdatePaymentData, UpdatePaymentVariables>;
```

### Variables
The `UpdatePayment` Mutation requires an argument of type `UpdatePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdatePaymentVariables {
  id: UUIDString;
  date?: string | null;
  amount?: number | null;
  type?: string | null;
  method?: string | null;
  memo?: string | null;
}
```
### Return Type
Recall that calling the `UpdatePayment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdatePayment` Mutation is of type `UpdatePaymentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdatePaymentData {
  payment_update?: Payment_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdatePayment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdatePaymentVariables } from '@dataconnect/generated';
import { useUpdatePayment } from '@dataconnect/generated/react'

export default function UpdatePaymentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdatePayment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdatePayment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdatePayment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdatePayment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdatePayment` Mutation requires an argument of type `UpdatePaymentVariables`:
  const updatePaymentVars: UpdatePaymentVariables = {
    id: ..., 
    date: ..., // optional
    amount: ..., // optional
    type: ..., // optional
    method: ..., // optional
    memo: ..., // optional
  };
  mutation.mutate(updatePaymentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., date: ..., amount: ..., type: ..., method: ..., memo: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updatePaymentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.payment_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeletePayment
You can execute the `DeletePayment` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeletePayment(options?: useDataConnectMutationOptions<DeletePaymentData, FirebaseError, DeletePaymentVariables>): UseDataConnectMutationResult<DeletePaymentData, DeletePaymentVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeletePayment(dc: DataConnect, options?: useDataConnectMutationOptions<DeletePaymentData, FirebaseError, DeletePaymentVariables>): UseDataConnectMutationResult<DeletePaymentData, DeletePaymentVariables>;
```

### Variables
The `DeletePayment` Mutation requires an argument of type `DeletePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeletePaymentVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeletePayment` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeletePayment` Mutation is of type `DeletePaymentData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeletePaymentData {
  payment_delete?: Payment_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeletePayment`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeletePaymentVariables } from '@dataconnect/generated';
import { useDeletePayment } from '@dataconnect/generated/react'

export default function DeletePaymentComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeletePayment();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeletePayment(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeletePayment(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeletePayment(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeletePayment` Mutation requires an argument of type `DeletePaymentVariables`:
  const deletePaymentVars: DeletePaymentVariables = {
    id: ..., 
  };
  mutation.mutate(deletePaymentVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deletePaymentVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.payment_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateTaxInvoice
You can execute the `CreateTaxInvoice` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateTaxInvoice(options?: useDataConnectMutationOptions<CreateTaxInvoiceData, FirebaseError, CreateTaxInvoiceVariables>): UseDataConnectMutationResult<CreateTaxInvoiceData, CreateTaxInvoiceVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateTaxInvoice(dc: DataConnect, options?: useDataConnectMutationOptions<CreateTaxInvoiceData, FirebaseError, CreateTaxInvoiceVariables>): UseDataConnectMutationResult<CreateTaxInvoiceData, CreateTaxInvoiceVariables>;
```

### Variables
The `CreateTaxInvoice` Mutation requires an argument of type `CreateTaxInvoiceVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateTaxInvoiceVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  date: string;
  amount: number;
  tax: number;
  total: number;
  companyName?: string | null;
  status?: string | null;
}
```
### Return Type
Recall that calling the `CreateTaxInvoice` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateTaxInvoice` Mutation is of type `CreateTaxInvoiceData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateTaxInvoiceData {
  taxInvoice_insert: TaxInvoice_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateTaxInvoice`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateTaxInvoiceVariables } from '@dataconnect/generated';
import { useCreateTaxInvoice } from '@dataconnect/generated/react'

export default function CreateTaxInvoiceComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateTaxInvoice();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateTaxInvoice(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateTaxInvoice(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateTaxInvoice(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateTaxInvoice` Mutation requires an argument of type `CreateTaxInvoiceVariables`:
  const createTaxInvoiceVars: CreateTaxInvoiceVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    date: ..., 
    amount: ..., 
    tax: ..., 
    total: ..., 
    companyName: ..., // optional
    status: ..., // optional
  };
  mutation.mutate(createTaxInvoiceVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., date: ..., amount: ..., tax: ..., total: ..., companyName: ..., status: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createTaxInvoiceVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.taxInvoice_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateTaxInvoice
You can execute the `UpdateTaxInvoice` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateTaxInvoice(options?: useDataConnectMutationOptions<UpdateTaxInvoiceData, FirebaseError, UpdateTaxInvoiceVariables>): UseDataConnectMutationResult<UpdateTaxInvoiceData, UpdateTaxInvoiceVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateTaxInvoice(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateTaxInvoiceData, FirebaseError, UpdateTaxInvoiceVariables>): UseDataConnectMutationResult<UpdateTaxInvoiceData, UpdateTaxInvoiceVariables>;
```

### Variables
The `UpdateTaxInvoice` Mutation requires an argument of type `UpdateTaxInvoiceVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateTaxInvoiceVariables {
  id: UUIDString;
  date?: string | null;
  amount?: number | null;
  tax?: number | null;
  total?: number | null;
  companyName?: string | null;
  status?: string | null;
}
```
### Return Type
Recall that calling the `UpdateTaxInvoice` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateTaxInvoice` Mutation is of type `UpdateTaxInvoiceData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateTaxInvoiceData {
  taxInvoice_update?: TaxInvoice_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateTaxInvoice`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateTaxInvoiceVariables } from '@dataconnect/generated';
import { useUpdateTaxInvoice } from '@dataconnect/generated/react'

export default function UpdateTaxInvoiceComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateTaxInvoice();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateTaxInvoice(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateTaxInvoice(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateTaxInvoice(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateTaxInvoice` Mutation requires an argument of type `UpdateTaxInvoiceVariables`:
  const updateTaxInvoiceVars: UpdateTaxInvoiceVariables = {
    id: ..., 
    date: ..., // optional
    amount: ..., // optional
    tax: ..., // optional
    total: ..., // optional
    companyName: ..., // optional
    status: ..., // optional
  };
  mutation.mutate(updateTaxInvoiceVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., date: ..., amount: ..., tax: ..., total: ..., companyName: ..., status: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateTaxInvoiceVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.taxInvoice_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteTaxInvoice
You can execute the `DeleteTaxInvoice` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteTaxInvoice(options?: useDataConnectMutationOptions<DeleteTaxInvoiceData, FirebaseError, DeleteTaxInvoiceVariables>): UseDataConnectMutationResult<DeleteTaxInvoiceData, DeleteTaxInvoiceVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteTaxInvoice(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteTaxInvoiceData, FirebaseError, DeleteTaxInvoiceVariables>): UseDataConnectMutationResult<DeleteTaxInvoiceData, DeleteTaxInvoiceVariables>;
```

### Variables
The `DeleteTaxInvoice` Mutation requires an argument of type `DeleteTaxInvoiceVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteTaxInvoiceVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteTaxInvoice` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteTaxInvoice` Mutation is of type `DeleteTaxInvoiceData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteTaxInvoiceData {
  taxInvoice_delete?: TaxInvoice_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteTaxInvoice`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteTaxInvoiceVariables } from '@dataconnect/generated';
import { useDeleteTaxInvoice } from '@dataconnect/generated/react'

export default function DeleteTaxInvoiceComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteTaxInvoice();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteTaxInvoice(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteTaxInvoice(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteTaxInvoice(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteTaxInvoice` Mutation requires an argument of type `DeleteTaxInvoiceVariables`:
  const deleteTaxInvoiceVars: DeleteTaxInvoiceVariables = {
    id: ..., 
  };
  mutation.mutate(deleteTaxInvoiceVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteTaxInvoiceVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.taxInvoice_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## CreateReceivable
You can execute the `CreateReceivable` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useCreateReceivable(options?: useDataConnectMutationOptions<CreateReceivableData, FirebaseError, CreateReceivableVariables>): UseDataConnectMutationResult<CreateReceivableData, CreateReceivableVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useCreateReceivable(dc: DataConnect, options?: useDataConnectMutationOptions<CreateReceivableData, FirebaseError, CreateReceivableVariables>): UseDataConnectMutationResult<CreateReceivableData, CreateReceivableVariables>;
```

### Variables
The `CreateReceivable` Mutation requires an argument of type `CreateReceivableVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface CreateReceivableVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  date: string;
  amount: number;
  companyName?: string | null;
  status?: string | null;
}
```
### Return Type
Recall that calling the `CreateReceivable` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `CreateReceivable` Mutation is of type `CreateReceivableData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface CreateReceivableData {
  receivable_insert: Receivable_Key;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `CreateReceivable`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, CreateReceivableVariables } from '@dataconnect/generated';
import { useCreateReceivable } from '@dataconnect/generated/react'

export default function CreateReceivableComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useCreateReceivable();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useCreateReceivable(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateReceivable(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useCreateReceivable(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useCreateReceivable` Mutation requires an argument of type `CreateReceivableVariables`:
  const createReceivableVars: CreateReceivableVariables = {
    id: ..., // optional
    legacyId: ..., // optional
    date: ..., 
    amount: ..., 
    companyName: ..., // optional
    status: ..., // optional
  };
  mutation.mutate(createReceivableVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., legacyId: ..., date: ..., amount: ..., companyName: ..., status: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(createReceivableVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.receivable_insert);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## UpdateReceivable
You can execute the `UpdateReceivable` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useUpdateReceivable(options?: useDataConnectMutationOptions<UpdateReceivableData, FirebaseError, UpdateReceivableVariables>): UseDataConnectMutationResult<UpdateReceivableData, UpdateReceivableVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useUpdateReceivable(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateReceivableData, FirebaseError, UpdateReceivableVariables>): UseDataConnectMutationResult<UpdateReceivableData, UpdateReceivableVariables>;
```

### Variables
The `UpdateReceivable` Mutation requires an argument of type `UpdateReceivableVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface UpdateReceivableVariables {
  id: UUIDString;
  date?: string | null;
  amount?: number | null;
  companyName?: string | null;
  status?: string | null;
}
```
### Return Type
Recall that calling the `UpdateReceivable` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `UpdateReceivable` Mutation is of type `UpdateReceivableData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface UpdateReceivableData {
  receivable_update?: Receivable_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `UpdateReceivable`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, UpdateReceivableVariables } from '@dataconnect/generated';
import { useUpdateReceivable } from '@dataconnect/generated/react'

export default function UpdateReceivableComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useUpdateReceivable();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useUpdateReceivable(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateReceivable(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useUpdateReceivable(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useUpdateReceivable` Mutation requires an argument of type `UpdateReceivableVariables`:
  const updateReceivableVars: UpdateReceivableVariables = {
    id: ..., 
    date: ..., // optional
    amount: ..., // optional
    companyName: ..., // optional
    status: ..., // optional
  };
  mutation.mutate(updateReceivableVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., date: ..., amount: ..., companyName: ..., status: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(updateReceivableVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.receivable_update);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

## DeleteReceivable
You can execute the `DeleteReceivable` Mutation using the `UseMutationResult` object returned by the following Mutation hook function (which is defined in [dataconnect-generated/react/index.d.ts](./index.d.ts)):
```javascript
useDeleteReceivable(options?: useDataConnectMutationOptions<DeleteReceivableData, FirebaseError, DeleteReceivableVariables>): UseDataConnectMutationResult<DeleteReceivableData, DeleteReceivableVariables>;
```
You can also pass in a `DataConnect` instance to the Mutation hook function.
```javascript
useDeleteReceivable(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteReceivableData, FirebaseError, DeleteReceivableVariables>): UseDataConnectMutationResult<DeleteReceivableData, DeleteReceivableVariables>;
```

### Variables
The `DeleteReceivable` Mutation requires an argument of type `DeleteReceivableVariables`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:

```javascript
export interface DeleteReceivableVariables {
  id: UUIDString;
}
```
### Return Type
Recall that calling the `DeleteReceivable` Mutation hook function returns a `UseMutationResult` object. This object holds the state of your Mutation, including whether the Mutation is loading, has completed, or has succeeded/failed, among other things.

To check the status of a Mutation, use the `UseMutationResult.status` field. You can also check for pending / success / error status using the `UseMutationResult.isPending`, `UseMutationResult.isSuccess`, and `UseMutationResult.isError` fields.

To execute the Mutation, call `UseMutationResult.mutate()`. This function executes the Mutation, but does not return the data from the Mutation.

To access the data returned by a Mutation, use the `UseMutationResult.data` field. The data for the `DeleteReceivable` Mutation is of type `DeleteReceivableData`, which is defined in [dataconnect-generated/index.d.ts](../index.d.ts). It has the following fields:
```javascript
export interface DeleteReceivableData {
  receivable_delete?: Receivable_Key | null;
}
```

To learn more about the `UseMutationResult` object, see the [TanStack React Query documentation](https://tanstack.com/query/v5/docs/framework/react/reference/useMutation).

### Using `DeleteReceivable`'s Mutation hook function

```javascript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, DeleteReceivableVariables } from '@dataconnect/generated';
import { useDeleteReceivable } from '@dataconnect/generated/react'

export default function DeleteReceivableComponent() {
  // Call the Mutation hook function to get a `UseMutationResult` object which holds the state of your Mutation.
  const mutation = useDeleteReceivable();

  // You can also pass in a `DataConnect` instance to the Mutation hook function.
  const dataConnect = getDataConnect(connectorConfig);
  const mutation = useDeleteReceivable(dataConnect);

  // You can also pass in a `useDataConnectMutationOptions` object to the Mutation hook function.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteReceivable(options);

  // You can also pass both a `DataConnect` instance and a `useDataConnectMutationOptions` object.
  const dataConnect = getDataConnect(connectorConfig);
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  const mutation = useDeleteReceivable(dataConnect, options);

  // After calling the Mutation hook function, you must call `UseMutationResult.mutate()` to execute the Mutation.
  // The `useDeleteReceivable` Mutation requires an argument of type `DeleteReceivableVariables`:
  const deleteReceivableVars: DeleteReceivableVariables = {
    id: ..., 
  };
  mutation.mutate(deleteReceivableVars);
  // Variables can be defined inline as well.
  mutation.mutate({ id: ..., });

  // You can also pass in a `useDataConnectMutationOptions` object to `UseMutationResult.mutate()`.
  const options = {
    onSuccess: () => { console.log('Mutation succeeded!'); }
  };
  mutation.mutate(deleteReceivableVars, options);

  // Then, you can render your component dynamically based on the status of the Mutation.
  if (mutation.isPending) {
    return <div>Loading...</div>;
  }

  if (mutation.isError) {
    return <div>Error: {mutation.error.message}</div>;
  }

  // If the Mutation is successful, you can access the data returned using the `UseMutationResult.data` field.
  if (mutation.isSuccess) {
    console.log(mutation.data.receivable_delete);
  }
  return <div>Mutation execution {mutation.isSuccess ? 'successful' : 'failed'}!</div>;
}
```

