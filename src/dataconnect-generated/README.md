# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
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

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListCompanies
You can execute the `ListCompanies` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listCompanies(): QueryPromise<ListCompaniesData, undefined>;

interface ListCompaniesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListCompaniesData, undefined>;
}
export const listCompaniesRef: ListCompaniesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listCompanies(dc: DataConnect): QueryPromise<ListCompaniesData, undefined>;

interface ListCompaniesRef {
  ...
  (dc: DataConnect): QueryRef<ListCompaniesData, undefined>;
}
export const listCompaniesRef: ListCompaniesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listCompaniesRef:
```typescript
const name = listCompaniesRef.operationName;
console.log(name);
```

### Variables
The `ListCompanies` query has no variables.
### Return Type
Recall that executing the `ListCompanies` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListCompaniesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListCompanies`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listCompanies } from '@dataconnect/generated';


// Call the `listCompanies()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listCompanies();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listCompanies(dataConnect);

console.log(data.companies);

// Or, you can use the `Promise` API.
listCompanies().then((response) => {
  const data = response.data;
  console.log(data.companies);
});
```

### Using `ListCompanies`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listCompaniesRef } from '@dataconnect/generated';


// Call the `listCompaniesRef()` function to get a reference to the query.
const ref = listCompaniesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listCompaniesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.companies);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.companies);
});
```

## GetCompany
You can execute the `GetCompany` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getCompany(vars: GetCompanyVariables): QueryPromise<GetCompanyData, GetCompanyVariables>;

interface GetCompanyRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetCompanyVariables): QueryRef<GetCompanyData, GetCompanyVariables>;
}
export const getCompanyRef: GetCompanyRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getCompany(dc: DataConnect, vars: GetCompanyVariables): QueryPromise<GetCompanyData, GetCompanyVariables>;

interface GetCompanyRef {
  ...
  (dc: DataConnect, vars: GetCompanyVariables): QueryRef<GetCompanyData, GetCompanyVariables>;
}
export const getCompanyRef: GetCompanyRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getCompanyRef:
```typescript
const name = getCompanyRef.operationName;
console.log(name);
```

### Variables
The `GetCompany` query requires an argument of type `GetCompanyVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetCompanyVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetCompany` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetCompanyData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `GetCompany`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getCompany, GetCompanyVariables } from '@dataconnect/generated';

// The `GetCompany` query requires an argument of type `GetCompanyVariables`:
const getCompanyVars: GetCompanyVariables = {
  id: ..., 
};

// Call the `getCompany()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getCompany(getCompanyVars);
// Variables can be defined inline as well.
const { data } = await getCompany({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getCompany(dataConnect, getCompanyVars);

console.log(data.company);

// Or, you can use the `Promise` API.
getCompany(getCompanyVars).then((response) => {
  const data = response.data;
  console.log(data.company);
});
```

### Using `GetCompany`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getCompanyRef, GetCompanyVariables } from '@dataconnect/generated';

// The `GetCompany` query requires an argument of type `GetCompanyVariables`:
const getCompanyVars: GetCompanyVariables = {
  id: ..., 
};

// Call the `getCompanyRef()` function to get a reference to the query.
const ref = getCompanyRef(getCompanyVars);
// Variables can be defined inline as well.
const ref = getCompanyRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getCompanyRef(dataConnect, getCompanyVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.company);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.company);
});
```

## ListTeams
You can execute the `ListTeams` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listTeams(): QueryPromise<ListTeamsData, undefined>;

interface ListTeamsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListTeamsData, undefined>;
}
export const listTeamsRef: ListTeamsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listTeams(dc: DataConnect): QueryPromise<ListTeamsData, undefined>;

interface ListTeamsRef {
  ...
  (dc: DataConnect): QueryRef<ListTeamsData, undefined>;
}
export const listTeamsRef: ListTeamsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listTeamsRef:
```typescript
const name = listTeamsRef.operationName;
console.log(name);
```

### Variables
The `ListTeams` query has no variables.
### Return Type
Recall that executing the `ListTeams` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListTeamsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListTeams`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listTeams } from '@dataconnect/generated';


// Call the `listTeams()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listTeams();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listTeams(dataConnect);

console.log(data.teams);

// Or, you can use the `Promise` API.
listTeams().then((response) => {
  const data = response.data;
  console.log(data.teams);
});
```

### Using `ListTeams`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listTeamsRef } from '@dataconnect/generated';


// Call the `listTeamsRef()` function to get a reference to the query.
const ref = listTeamsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listTeamsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.teams);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.teams);
});
```

## GetTeam
You can execute the `GetTeam` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getTeam(vars: GetTeamVariables): QueryPromise<GetTeamData, GetTeamVariables>;

interface GetTeamRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTeamVariables): QueryRef<GetTeamData, GetTeamVariables>;
}
export const getTeamRef: GetTeamRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getTeam(dc: DataConnect, vars: GetTeamVariables): QueryPromise<GetTeamData, GetTeamVariables>;

interface GetTeamRef {
  ...
  (dc: DataConnect, vars: GetTeamVariables): QueryRef<GetTeamData, GetTeamVariables>;
}
export const getTeamRef: GetTeamRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getTeamRef:
```typescript
const name = getTeamRef.operationName;
console.log(name);
```

### Variables
The `GetTeam` query requires an argument of type `GetTeamVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetTeamVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetTeam` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetTeamData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `GetTeam`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getTeam, GetTeamVariables } from '@dataconnect/generated';

// The `GetTeam` query requires an argument of type `GetTeamVariables`:
const getTeamVars: GetTeamVariables = {
  id: ..., 
};

// Call the `getTeam()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getTeam(getTeamVars);
// Variables can be defined inline as well.
const { data } = await getTeam({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getTeam(dataConnect, getTeamVars);

console.log(data.team);

// Or, you can use the `Promise` API.
getTeam(getTeamVars).then((response) => {
  const data = response.data;
  console.log(data.team);
});
```

### Using `GetTeam`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getTeamRef, GetTeamVariables } from '@dataconnect/generated';

// The `GetTeam` query requires an argument of type `GetTeamVariables`:
const getTeamVars: GetTeamVariables = {
  id: ..., 
};

// Call the `getTeamRef()` function to get a reference to the query.
const ref = getTeamRef(getTeamVars);
// Variables can be defined inline as well.
const ref = getTeamRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getTeamRef(dataConnect, getTeamVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.team);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.team);
});
```

## ListWorkers
You can execute the `ListWorkers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listWorkers(): QueryPromise<ListWorkersData, undefined>;

interface ListWorkersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListWorkersData, undefined>;
}
export const listWorkersRef: ListWorkersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listWorkers(dc: DataConnect): QueryPromise<ListWorkersData, undefined>;

interface ListWorkersRef {
  ...
  (dc: DataConnect): QueryRef<ListWorkersData, undefined>;
}
export const listWorkersRef: ListWorkersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listWorkersRef:
```typescript
const name = listWorkersRef.operationName;
console.log(name);
```

### Variables
The `ListWorkers` query has no variables.
### Return Type
Recall that executing the `ListWorkers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListWorkersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListWorkers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listWorkers } from '@dataconnect/generated';


// Call the `listWorkers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listWorkers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listWorkers(dataConnect);

console.log(data.workers);

// Or, you can use the `Promise` API.
listWorkers().then((response) => {
  const data = response.data;
  console.log(data.workers);
});
```

### Using `ListWorkers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listWorkersRef } from '@dataconnect/generated';


// Call the `listWorkersRef()` function to get a reference to the query.
const ref = listWorkersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listWorkersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.workers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.workers);
});
```

## ListPositions
You can execute the `ListPositions` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listPositions(): QueryPromise<ListPositionsData, undefined>;

interface ListPositionsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListPositionsData, undefined>;
}
export const listPositionsRef: ListPositionsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listPositions(dc: DataConnect): QueryPromise<ListPositionsData, undefined>;

interface ListPositionsRef {
  ...
  (dc: DataConnect): QueryRef<ListPositionsData, undefined>;
}
export const listPositionsRef: ListPositionsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listPositionsRef:
```typescript
const name = listPositionsRef.operationName;
console.log(name);
```

### Variables
The `ListPositions` query has no variables.
### Return Type
Recall that executing the `ListPositions` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListPositionsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListPositions`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listPositions } from '@dataconnect/generated';


// Call the `listPositions()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listPositions();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listPositions(dataConnect);

console.log(data.positions);

// Or, you can use the `Promise` API.
listPositions().then((response) => {
  const data = response.data;
  console.log(data.positions);
});
```

### Using `ListPositions`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listPositionsRef } from '@dataconnect/generated';


// Call the `listPositionsRef()` function to get a reference to the query.
const ref = listPositionsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listPositionsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.positions);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.positions);
});
```

## GetWorker
You can execute the `GetWorker` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getWorker(vars: GetWorkerVariables): QueryPromise<GetWorkerData, GetWorkerVariables>;

interface GetWorkerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetWorkerVariables): QueryRef<GetWorkerData, GetWorkerVariables>;
}
export const getWorkerRef: GetWorkerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getWorker(dc: DataConnect, vars: GetWorkerVariables): QueryPromise<GetWorkerData, GetWorkerVariables>;

interface GetWorkerRef {
  ...
  (dc: DataConnect, vars: GetWorkerVariables): QueryRef<GetWorkerData, GetWorkerVariables>;
}
export const getWorkerRef: GetWorkerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getWorkerRef:
```typescript
const name = getWorkerRef.operationName;
console.log(name);
```

### Variables
The `GetWorker` query requires an argument of type `GetWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetWorkerVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetWorker` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetWorkerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `GetWorker`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getWorker, GetWorkerVariables } from '@dataconnect/generated';

// The `GetWorker` query requires an argument of type `GetWorkerVariables`:
const getWorkerVars: GetWorkerVariables = {
  id: ..., 
};

// Call the `getWorker()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getWorker(getWorkerVars);
// Variables can be defined inline as well.
const { data } = await getWorker({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getWorker(dataConnect, getWorkerVars);

console.log(data.worker);

// Or, you can use the `Promise` API.
getWorker(getWorkerVars).then((response) => {
  const data = response.data;
  console.log(data.worker);
});
```

### Using `GetWorker`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getWorkerRef, GetWorkerVariables } from '@dataconnect/generated';

// The `GetWorker` query requires an argument of type `GetWorkerVariables`:
const getWorkerVars: GetWorkerVariables = {
  id: ..., 
};

// Call the `getWorkerRef()` function to get a reference to the query.
const ref = getWorkerRef(getWorkerVars);
// Variables can be defined inline as well.
const ref = getWorkerRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getWorkerRef(dataConnect, getWorkerVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.worker);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.worker);
});
```

## ListSites
You can execute the `ListSites` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listSites(): QueryPromise<ListSitesData, undefined>;

interface ListSitesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSitesData, undefined>;
}
export const listSitesRef: ListSitesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSites(dc: DataConnect): QueryPromise<ListSitesData, undefined>;

interface ListSitesRef {
  ...
  (dc: DataConnect): QueryRef<ListSitesData, undefined>;
}
export const listSitesRef: ListSitesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listSitesRef:
```typescript
const name = listSitesRef.operationName;
console.log(name);
```

### Variables
The `ListSites` query has no variables.
### Return Type
Recall that executing the `ListSites` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListSitesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListSites`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listSites } from '@dataconnect/generated';


// Call the `listSites()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listSites();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listSites(dataConnect);

console.log(data.sites);

// Or, you can use the `Promise` API.
listSites().then((response) => {
  const data = response.data;
  console.log(data.sites);
});
```

### Using `ListSites`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listSitesRef } from '@dataconnect/generated';


// Call the `listSitesRef()` function to get a reference to the query.
const ref = listSitesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listSitesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.sites);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.sites);
});
```

## GetSite
You can execute the `GetSite` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getSite(vars: GetSiteVariables): QueryPromise<GetSiteData, GetSiteVariables>;

interface GetSiteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSiteVariables): QueryRef<GetSiteData, GetSiteVariables>;
}
export const getSiteRef: GetSiteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSite(dc: DataConnect, vars: GetSiteVariables): QueryPromise<GetSiteData, GetSiteVariables>;

interface GetSiteRef {
  ...
  (dc: DataConnect, vars: GetSiteVariables): QueryRef<GetSiteData, GetSiteVariables>;
}
export const getSiteRef: GetSiteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSiteRef:
```typescript
const name = getSiteRef.operationName;
console.log(name);
```

### Variables
The `GetSite` query requires an argument of type `GetSiteVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetSiteVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetSite` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSiteData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `GetSite`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSite, GetSiteVariables } from '@dataconnect/generated';

// The `GetSite` query requires an argument of type `GetSiteVariables`:
const getSiteVars: GetSiteVariables = {
  id: ..., 
};

// Call the `getSite()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSite(getSiteVars);
// Variables can be defined inline as well.
const { data } = await getSite({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSite(dataConnect, getSiteVars);

console.log(data.site);

// Or, you can use the `Promise` API.
getSite(getSiteVars).then((response) => {
  const data = response.data;
  console.log(data.site);
});
```

### Using `GetSite`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSiteRef, GetSiteVariables } from '@dataconnect/generated';

// The `GetSite` query requires an argument of type `GetSiteVariables`:
const getSiteVars: GetSiteVariables = {
  id: ..., 
};

// Call the `getSiteRef()` function to get a reference to the query.
const ref = getSiteRef(getSiteVars);
// Variables can be defined inline as well.
const ref = getSiteRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSiteRef(dataConnect, getSiteVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.site);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.site);
});
```

## ListDailyReports
You can execute the `ListDailyReports` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listDailyReports(): QueryPromise<ListDailyReportsData, undefined>;

interface ListDailyReportsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListDailyReportsData, undefined>;
}
export const listDailyReportsRef: ListDailyReportsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listDailyReports(dc: DataConnect): QueryPromise<ListDailyReportsData, undefined>;

interface ListDailyReportsRef {
  ...
  (dc: DataConnect): QueryRef<ListDailyReportsData, undefined>;
}
export const listDailyReportsRef: ListDailyReportsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listDailyReportsRef:
```typescript
const name = listDailyReportsRef.operationName;
console.log(name);
```

### Variables
The `ListDailyReports` query has no variables.
### Return Type
Recall that executing the `ListDailyReports` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListDailyReportsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListDailyReports`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listDailyReports } from '@dataconnect/generated';


// Call the `listDailyReports()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listDailyReports();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listDailyReports(dataConnect);

console.log(data.dailyReports);

// Or, you can use the `Promise` API.
listDailyReports().then((response) => {
  const data = response.data;
  console.log(data.dailyReports);
});
```

### Using `ListDailyReports`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listDailyReportsRef } from '@dataconnect/generated';


// Call the `listDailyReportsRef()` function to get a reference to the query.
const ref = listDailyReportsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listDailyReportsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.dailyReports);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyReports);
});
```

## ListDailyReportWorkers
You can execute the `ListDailyReportWorkers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listDailyReportWorkers(): QueryPromise<ListDailyReportWorkersData, undefined>;

interface ListDailyReportWorkersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListDailyReportWorkersData, undefined>;
}
export const listDailyReportWorkersRef: ListDailyReportWorkersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listDailyReportWorkers(dc: DataConnect): QueryPromise<ListDailyReportWorkersData, undefined>;

interface ListDailyReportWorkersRef {
  ...
  (dc: DataConnect): QueryRef<ListDailyReportWorkersData, undefined>;
}
export const listDailyReportWorkersRef: ListDailyReportWorkersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listDailyReportWorkersRef:
```typescript
const name = listDailyReportWorkersRef.operationName;
console.log(name);
```

### Variables
The `ListDailyReportWorkers` query has no variables.
### Return Type
Recall that executing the `ListDailyReportWorkers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListDailyReportWorkersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListDailyReportWorkers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listDailyReportWorkers } from '@dataconnect/generated';


// Call the `listDailyReportWorkers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listDailyReportWorkers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listDailyReportWorkers(dataConnect);

console.log(data.dailyReportWorkers);

// Or, you can use the `Promise` API.
listDailyReportWorkers().then((response) => {
  const data = response.data;
  console.log(data.dailyReportWorkers);
});
```

### Using `ListDailyReportWorkers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listDailyReportWorkersRef } from '@dataconnect/generated';


// Call the `listDailyReportWorkersRef()` function to get a reference to the query.
const ref = listDailyReportWorkersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listDailyReportWorkersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.dailyReportWorkers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyReportWorkers);
});
```

## ListAppUsers
You can execute the `ListAppUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAppUsers(): QueryPromise<ListAppUsersData, undefined>;

interface ListAppUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAppUsersData, undefined>;
}
export const listAppUsersRef: ListAppUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAppUsers(dc: DataConnect): QueryPromise<ListAppUsersData, undefined>;

interface ListAppUsersRef {
  ...
  (dc: DataConnect): QueryRef<ListAppUsersData, undefined>;
}
export const listAppUsersRef: ListAppUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAppUsersRef:
```typescript
const name = listAppUsersRef.operationName;
console.log(name);
```

### Variables
The `ListAppUsers` query has no variables.
### Return Type
Recall that executing the `ListAppUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAppUsersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAppUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAppUsers } from '@dataconnect/generated';


// Call the `listAppUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAppUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAppUsers(dataConnect);

console.log(data.appUsers);

// Or, you can use the `Promise` API.
listAppUsers().then((response) => {
  const data = response.data;
  console.log(data.appUsers);
});
```

### Using `ListAppUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAppUsersRef } from '@dataconnect/generated';


// Call the `listAppUsersRef()` function to get a reference to the query.
const ref = listAppUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAppUsersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.appUsers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.appUsers);
});
```

## ListMenuConfigs
You can execute the `ListMenuConfigs` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMenuConfigs(): QueryPromise<ListMenuConfigsData, undefined>;

interface ListMenuConfigsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMenuConfigsData, undefined>;
}
export const listMenuConfigsRef: ListMenuConfigsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMenuConfigs(dc: DataConnect): QueryPromise<ListMenuConfigsData, undefined>;

interface ListMenuConfigsRef {
  ...
  (dc: DataConnect): QueryRef<ListMenuConfigsData, undefined>;
}
export const listMenuConfigsRef: ListMenuConfigsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMenuConfigsRef:
```typescript
const name = listMenuConfigsRef.operationName;
console.log(name);
```

### Variables
The `ListMenuConfigs` query has no variables.
### Return Type
Recall that executing the `ListMenuConfigs` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMenuConfigsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListMenuConfigsData {
  menuConfigs: ({
    id: string;
    config: string;
    updatedAt: TimestampString;
  } & MenuConfig_Key)[];
}
```
### Using `ListMenuConfigs`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMenuConfigs } from '@dataconnect/generated';


// Call the `listMenuConfigs()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMenuConfigs();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMenuConfigs(dataConnect);

console.log(data.menuConfigs);

// Or, you can use the `Promise` API.
listMenuConfigs().then((response) => {
  const data = response.data;
  console.log(data.menuConfigs);
});
```

### Using `ListMenuConfigs`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMenuConfigsRef } from '@dataconnect/generated';


// Call the `listMenuConfigsRef()` function to get a reference to the query.
const ref = listMenuConfigsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMenuConfigsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.menuConfigs);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.menuConfigs);
});
```

## ListSystemLogs
You can execute the `ListSystemLogs` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listSystemLogs(): QueryPromise<ListSystemLogsData, undefined>;

interface ListSystemLogsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSystemLogsData, undefined>;
}
export const listSystemLogsRef: ListSystemLogsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSystemLogs(dc: DataConnect): QueryPromise<ListSystemLogsData, undefined>;

interface ListSystemLogsRef {
  ...
  (dc: DataConnect): QueryRef<ListSystemLogsData, undefined>;
}
export const listSystemLogsRef: ListSystemLogsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listSystemLogsRef:
```typescript
const name = listSystemLogsRef.operationName;
console.log(name);
```

### Variables
The `ListSystemLogs` query has no variables.
### Return Type
Recall that executing the `ListSystemLogs` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListSystemLogsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListSystemLogs`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listSystemLogs } from '@dataconnect/generated';


// Call the `listSystemLogs()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listSystemLogs();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listSystemLogs(dataConnect);

console.log(data.systemLogs);

// Or, you can use the `Promise` API.
listSystemLogs().then((response) => {
  const data = response.data;
  console.log(data.systemLogs);
});
```

### Using `ListSystemLogs`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listSystemLogsRef } from '@dataconnect/generated';


// Call the `listSystemLogsRef()` function to get a reference to the query.
const ref = listSystemLogsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listSystemLogsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.systemLogs);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.systemLogs);
});
```

## ListAuditLogs
You can execute the `ListAuditLogs` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAuditLogs(): QueryPromise<ListAuditLogsData, undefined>;

interface ListAuditLogsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAuditLogsData, undefined>;
}
export const listAuditLogsRef: ListAuditLogsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAuditLogs(dc: DataConnect): QueryPromise<ListAuditLogsData, undefined>;

interface ListAuditLogsRef {
  ...
  (dc: DataConnect): QueryRef<ListAuditLogsData, undefined>;
}
export const listAuditLogsRef: ListAuditLogsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAuditLogsRef:
```typescript
const name = listAuditLogsRef.operationName;
console.log(name);
```

### Variables
The `ListAuditLogs` query has no variables.
### Return Type
Recall that executing the `ListAuditLogs` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAuditLogsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAuditLogs`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAuditLogs } from '@dataconnect/generated';


// Call the `listAuditLogs()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAuditLogs();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAuditLogs(dataConnect);

console.log(data.auditLogs);

// Or, you can use the `Promise` API.
listAuditLogs().then((response) => {
  const data = response.data;
  console.log(data.auditLogs);
});
```

### Using `ListAuditLogs`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAuditLogsRef } from '@dataconnect/generated';


// Call the `listAuditLogsRef()` function to get a reference to the query.
const ref = listAuditLogsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAuditLogsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.auditLogs);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.auditLogs);
});
```

## ListAgents
You can execute the `ListAgents` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAgents(): QueryPromise<ListAgentsData, undefined>;

interface ListAgentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAgentsData, undefined>;
}
export const listAgentsRef: ListAgentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAgents(dc: DataConnect): QueryPromise<ListAgentsData, undefined>;

interface ListAgentsRef {
  ...
  (dc: DataConnect): QueryRef<ListAgentsData, undefined>;
}
export const listAgentsRef: ListAgentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAgentsRef:
```typescript
const name = listAgentsRef.operationName;
console.log(name);
```

### Variables
The `ListAgents` query has no variables.
### Return Type
Recall that executing the `ListAgents` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAgentsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAgents`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAgents } from '@dataconnect/generated';


// Call the `listAgents()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAgents();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAgents(dataConnect);

console.log(data.agents);

// Or, you can use the `Promise` API.
listAgents().then((response) => {
  const data = response.data;
  console.log(data.agents);
});
```

### Using `ListAgents`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAgentsRef } from '@dataconnect/generated';


// Call the `listAgentsRef()` function to get a reference to the query.
const ref = listAgentsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAgentsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.agents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.agents);
});
```

## ListAgentConversations
You can execute the `ListAgentConversations` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAgentConversations(): QueryPromise<ListAgentConversationsData, undefined>;

interface ListAgentConversationsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAgentConversationsData, undefined>;
}
export const listAgentConversationsRef: ListAgentConversationsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAgentConversations(dc: DataConnect): QueryPromise<ListAgentConversationsData, undefined>;

interface ListAgentConversationsRef {
  ...
  (dc: DataConnect): QueryRef<ListAgentConversationsData, undefined>;
}
export const listAgentConversationsRef: ListAgentConversationsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAgentConversationsRef:
```typescript
const name = listAgentConversationsRef.operationName;
console.log(name);
```

### Variables
The `ListAgentConversations` query has no variables.
### Return Type
Recall that executing the `ListAgentConversations` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAgentConversationsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAgentConversations`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAgentConversations } from '@dataconnect/generated';


// Call the `listAgentConversations()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAgentConversations();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAgentConversations(dataConnect);

console.log(data.agentConversations);

// Or, you can use the `Promise` API.
listAgentConversations().then((response) => {
  const data = response.data;
  console.log(data.agentConversations);
});
```

### Using `ListAgentConversations`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAgentConversationsRef } from '@dataconnect/generated';


// Call the `listAgentConversationsRef()` function to get a reference to the query.
const ref = listAgentConversationsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAgentConversationsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.agentConversations);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.agentConversations);
});
```

## ListSettings
You can execute the `ListSettings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listSettings(): QueryPromise<ListSettingsData, undefined>;

interface ListSettingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSettingsData, undefined>;
}
export const listSettingsRef: ListSettingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSettings(dc: DataConnect): QueryPromise<ListSettingsData, undefined>;

interface ListSettingsRef {
  ...
  (dc: DataConnect): QueryRef<ListSettingsData, undefined>;
}
export const listSettingsRef: ListSettingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listSettingsRef:
```typescript
const name = listSettingsRef.operationName;
console.log(name);
```

### Variables
The `ListSettings` query has no variables.
### Return Type
Recall that executing the `ListSettings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListSettingsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListSettingsData {
  settings: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & Setting_Key)[];
}
```
### Using `ListSettings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listSettings } from '@dataconnect/generated';


// Call the `listSettings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listSettings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listSettings(dataConnect);

console.log(data.settings);

// Or, you can use the `Promise` API.
listSettings().then((response) => {
  const data = response.data;
  console.log(data.settings);
});
```

### Using `ListSettings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listSettingsRef } from '@dataconnect/generated';


// Call the `listSettingsRef()` function to get a reference to the query.
const ref = listSettingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listSettingsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.settings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.settings);
});
```

## ListSystemConfigs
You can execute the `ListSystemConfigs` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listSystemConfigs(): QueryPromise<ListSystemConfigsData, undefined>;

interface ListSystemConfigsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSystemConfigsData, undefined>;
}
export const listSystemConfigsRef: ListSystemConfigsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSystemConfigs(dc: DataConnect): QueryPromise<ListSystemConfigsData, undefined>;

interface ListSystemConfigsRef {
  ...
  (dc: DataConnect): QueryRef<ListSystemConfigsData, undefined>;
}
export const listSystemConfigsRef: ListSystemConfigsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listSystemConfigsRef:
```typescript
const name = listSystemConfigsRef.operationName;
console.log(name);
```

### Variables
The `ListSystemConfigs` query has no variables.
### Return Type
Recall that executing the `ListSystemConfigs` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListSystemConfigsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListSystemConfigsData {
  systemConfigs: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & SystemConfig_Key)[];
}
```
### Using `ListSystemConfigs`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listSystemConfigs } from '@dataconnect/generated';


// Call the `listSystemConfigs()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listSystemConfigs();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listSystemConfigs(dataConnect);

console.log(data.systemConfigs);

// Or, you can use the `Promise` API.
listSystemConfigs().then((response) => {
  const data = response.data;
  console.log(data.systemConfigs);
});
```

### Using `ListSystemConfigs`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listSystemConfigsRef } from '@dataconnect/generated';


// Call the `listSystemConfigsRef()` function to get a reference to the query.
const ref = listSystemConfigsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listSystemConfigsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.systemConfigs);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.systemConfigs);
});
```

## ListAllCompanies
You can execute the `ListAllCompanies` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllCompanies(vars?: ListAllCompaniesVariables): QueryPromise<ListAllCompaniesData, ListAllCompaniesVariables>;

interface ListAllCompaniesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllCompaniesVariables): QueryRef<ListAllCompaniesData, ListAllCompaniesVariables>;
}
export const listAllCompaniesRef: ListAllCompaniesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllCompanies(dc: DataConnect, vars?: ListAllCompaniesVariables): QueryPromise<ListAllCompaniesData, ListAllCompaniesVariables>;

interface ListAllCompaniesRef {
  ...
  (dc: DataConnect, vars?: ListAllCompaniesVariables): QueryRef<ListAllCompaniesData, ListAllCompaniesVariables>;
}
export const listAllCompaniesRef: ListAllCompaniesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllCompaniesRef:
```typescript
const name = listAllCompaniesRef.operationName;
console.log(name);
```

### Variables
The `ListAllCompanies` query has an optional argument of type `ListAllCompaniesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllCompaniesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllCompanies` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllCompaniesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllCompanies`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllCompanies, ListAllCompaniesVariables } from '@dataconnect/generated';

// The `ListAllCompanies` query has an optional argument of type `ListAllCompaniesVariables`:
const listAllCompaniesVars: ListAllCompaniesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllCompanies()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllCompanies(listAllCompaniesVars);
// Variables can be defined inline as well.
const { data } = await listAllCompanies({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllCompaniesVariables` argument.
const { data } = await listAllCompanies();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllCompanies(dataConnect, listAllCompaniesVars);

console.log(data.companies);

// Or, you can use the `Promise` API.
listAllCompanies(listAllCompaniesVars).then((response) => {
  const data = response.data;
  console.log(data.companies);
});
```

### Using `ListAllCompanies`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllCompaniesRef, ListAllCompaniesVariables } from '@dataconnect/generated';

// The `ListAllCompanies` query has an optional argument of type `ListAllCompaniesVariables`:
const listAllCompaniesVars: ListAllCompaniesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllCompaniesRef()` function to get a reference to the query.
const ref = listAllCompaniesRef(listAllCompaniesVars);
// Variables can be defined inline as well.
const ref = listAllCompaniesRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllCompaniesVariables` argument.
const ref = listAllCompaniesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllCompaniesRef(dataConnect, listAllCompaniesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.companies);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.companies);
});
```

## ListAllTeams
You can execute the `ListAllTeams` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllTeams(vars?: ListAllTeamsVariables): QueryPromise<ListAllTeamsData, ListAllTeamsVariables>;

interface ListAllTeamsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllTeamsVariables): QueryRef<ListAllTeamsData, ListAllTeamsVariables>;
}
export const listAllTeamsRef: ListAllTeamsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllTeams(dc: DataConnect, vars?: ListAllTeamsVariables): QueryPromise<ListAllTeamsData, ListAllTeamsVariables>;

interface ListAllTeamsRef {
  ...
  (dc: DataConnect, vars?: ListAllTeamsVariables): QueryRef<ListAllTeamsData, ListAllTeamsVariables>;
}
export const listAllTeamsRef: ListAllTeamsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllTeamsRef:
```typescript
const name = listAllTeamsRef.operationName;
console.log(name);
```

### Variables
The `ListAllTeams` query has an optional argument of type `ListAllTeamsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllTeamsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllTeams` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllTeamsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllTeams`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllTeams, ListAllTeamsVariables } from '@dataconnect/generated';

// The `ListAllTeams` query has an optional argument of type `ListAllTeamsVariables`:
const listAllTeamsVars: ListAllTeamsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllTeams()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllTeams(listAllTeamsVars);
// Variables can be defined inline as well.
const { data } = await listAllTeams({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllTeamsVariables` argument.
const { data } = await listAllTeams();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllTeams(dataConnect, listAllTeamsVars);

console.log(data.teams);

// Or, you can use the `Promise` API.
listAllTeams(listAllTeamsVars).then((response) => {
  const data = response.data;
  console.log(data.teams);
});
```

### Using `ListAllTeams`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllTeamsRef, ListAllTeamsVariables } from '@dataconnect/generated';

// The `ListAllTeams` query has an optional argument of type `ListAllTeamsVariables`:
const listAllTeamsVars: ListAllTeamsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllTeamsRef()` function to get a reference to the query.
const ref = listAllTeamsRef(listAllTeamsVars);
// Variables can be defined inline as well.
const ref = listAllTeamsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllTeamsVariables` argument.
const ref = listAllTeamsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllTeamsRef(dataConnect, listAllTeamsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.teams);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.teams);
});
```

## ListAllWorkers
You can execute the `ListAllWorkers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllWorkers(vars?: ListAllWorkersVariables): QueryPromise<ListAllWorkersData, ListAllWorkersVariables>;

interface ListAllWorkersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllWorkersVariables): QueryRef<ListAllWorkersData, ListAllWorkersVariables>;
}
export const listAllWorkersRef: ListAllWorkersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllWorkers(dc: DataConnect, vars?: ListAllWorkersVariables): QueryPromise<ListAllWorkersData, ListAllWorkersVariables>;

interface ListAllWorkersRef {
  ...
  (dc: DataConnect, vars?: ListAllWorkersVariables): QueryRef<ListAllWorkersData, ListAllWorkersVariables>;
}
export const listAllWorkersRef: ListAllWorkersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllWorkersRef:
```typescript
const name = listAllWorkersRef.operationName;
console.log(name);
```

### Variables
The `ListAllWorkers` query has an optional argument of type `ListAllWorkersVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllWorkersVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllWorkers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllWorkersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllWorkers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllWorkers, ListAllWorkersVariables } from '@dataconnect/generated';

// The `ListAllWorkers` query has an optional argument of type `ListAllWorkersVariables`:
const listAllWorkersVars: ListAllWorkersVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllWorkers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllWorkers(listAllWorkersVars);
// Variables can be defined inline as well.
const { data } = await listAllWorkers({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllWorkersVariables` argument.
const { data } = await listAllWorkers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllWorkers(dataConnect, listAllWorkersVars);

console.log(data.workers);

// Or, you can use the `Promise` API.
listAllWorkers(listAllWorkersVars).then((response) => {
  const data = response.data;
  console.log(data.workers);
});
```

### Using `ListAllWorkers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllWorkersRef, ListAllWorkersVariables } from '@dataconnect/generated';

// The `ListAllWorkers` query has an optional argument of type `ListAllWorkersVariables`:
const listAllWorkersVars: ListAllWorkersVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllWorkersRef()` function to get a reference to the query.
const ref = listAllWorkersRef(listAllWorkersVars);
// Variables can be defined inline as well.
const ref = listAllWorkersRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllWorkersVariables` argument.
const ref = listAllWorkersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllWorkersRef(dataConnect, listAllWorkersVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.workers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.workers);
});
```

## ListAllPositions
You can execute the `ListAllPositions` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllPositions(vars?: ListAllPositionsVariables): QueryPromise<ListAllPositionsData, ListAllPositionsVariables>;

interface ListAllPositionsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllPositionsVariables): QueryRef<ListAllPositionsData, ListAllPositionsVariables>;
}
export const listAllPositionsRef: ListAllPositionsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllPositions(dc: DataConnect, vars?: ListAllPositionsVariables): QueryPromise<ListAllPositionsData, ListAllPositionsVariables>;

interface ListAllPositionsRef {
  ...
  (dc: DataConnect, vars?: ListAllPositionsVariables): QueryRef<ListAllPositionsData, ListAllPositionsVariables>;
}
export const listAllPositionsRef: ListAllPositionsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllPositionsRef:
```typescript
const name = listAllPositionsRef.operationName;
console.log(name);
```

### Variables
The `ListAllPositions` query has an optional argument of type `ListAllPositionsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllPositionsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllPositions` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllPositionsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllPositions`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllPositions, ListAllPositionsVariables } from '@dataconnect/generated';

// The `ListAllPositions` query has an optional argument of type `ListAllPositionsVariables`:
const listAllPositionsVars: ListAllPositionsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllPositions()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllPositions(listAllPositionsVars);
// Variables can be defined inline as well.
const { data } = await listAllPositions({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllPositionsVariables` argument.
const { data } = await listAllPositions();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllPositions(dataConnect, listAllPositionsVars);

console.log(data.positions);

// Or, you can use the `Promise` API.
listAllPositions(listAllPositionsVars).then((response) => {
  const data = response.data;
  console.log(data.positions);
});
```

### Using `ListAllPositions`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllPositionsRef, ListAllPositionsVariables } from '@dataconnect/generated';

// The `ListAllPositions` query has an optional argument of type `ListAllPositionsVariables`:
const listAllPositionsVars: ListAllPositionsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllPositionsRef()` function to get a reference to the query.
const ref = listAllPositionsRef(listAllPositionsVars);
// Variables can be defined inline as well.
const ref = listAllPositionsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllPositionsVariables` argument.
const ref = listAllPositionsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllPositionsRef(dataConnect, listAllPositionsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.positions);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.positions);
});
```

## ListAllSites
You can execute the `ListAllSites` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllSites(vars?: ListAllSitesVariables): QueryPromise<ListAllSitesData, ListAllSitesVariables>;

interface ListAllSitesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSitesVariables): QueryRef<ListAllSitesData, ListAllSitesVariables>;
}
export const listAllSitesRef: ListAllSitesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllSites(dc: DataConnect, vars?: ListAllSitesVariables): QueryPromise<ListAllSitesData, ListAllSitesVariables>;

interface ListAllSitesRef {
  ...
  (dc: DataConnect, vars?: ListAllSitesVariables): QueryRef<ListAllSitesData, ListAllSitesVariables>;
}
export const listAllSitesRef: ListAllSitesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllSitesRef:
```typescript
const name = listAllSitesRef.operationName;
console.log(name);
```

### Variables
The `ListAllSites` query has an optional argument of type `ListAllSitesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllSitesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllSites` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllSitesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllSites`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllSites, ListAllSitesVariables } from '@dataconnect/generated';

// The `ListAllSites` query has an optional argument of type `ListAllSitesVariables`:
const listAllSitesVars: ListAllSitesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSites()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllSites(listAllSitesVars);
// Variables can be defined inline as well.
const { data } = await listAllSites({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSitesVariables` argument.
const { data } = await listAllSites();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllSites(dataConnect, listAllSitesVars);

console.log(data.sites);

// Or, you can use the `Promise` API.
listAllSites(listAllSitesVars).then((response) => {
  const data = response.data;
  console.log(data.sites);
});
```

### Using `ListAllSites`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllSitesRef, ListAllSitesVariables } from '@dataconnect/generated';

// The `ListAllSites` query has an optional argument of type `ListAllSitesVariables`:
const listAllSitesVars: ListAllSitesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSitesRef()` function to get a reference to the query.
const ref = listAllSitesRef(listAllSitesVars);
// Variables can be defined inline as well.
const ref = listAllSitesRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSitesVariables` argument.
const ref = listAllSitesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllSitesRef(dataConnect, listAllSitesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.sites);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.sites);
});
```

## ListAllDailyReports
You can execute the `ListAllDailyReports` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllDailyReports(vars?: ListAllDailyReportsVariables): QueryPromise<ListAllDailyReportsData, ListAllDailyReportsVariables>;

interface ListAllDailyReportsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllDailyReportsVariables): QueryRef<ListAllDailyReportsData, ListAllDailyReportsVariables>;
}
export const listAllDailyReportsRef: ListAllDailyReportsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllDailyReports(dc: DataConnect, vars?: ListAllDailyReportsVariables): QueryPromise<ListAllDailyReportsData, ListAllDailyReportsVariables>;

interface ListAllDailyReportsRef {
  ...
  (dc: DataConnect, vars?: ListAllDailyReportsVariables): QueryRef<ListAllDailyReportsData, ListAllDailyReportsVariables>;
}
export const listAllDailyReportsRef: ListAllDailyReportsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllDailyReportsRef:
```typescript
const name = listAllDailyReportsRef.operationName;
console.log(name);
```

### Variables
The `ListAllDailyReports` query has an optional argument of type `ListAllDailyReportsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllDailyReportsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllDailyReports` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllDailyReportsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllDailyReports`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllDailyReports, ListAllDailyReportsVariables } from '@dataconnect/generated';

// The `ListAllDailyReports` query has an optional argument of type `ListAllDailyReportsVariables`:
const listAllDailyReportsVars: ListAllDailyReportsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllDailyReports()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllDailyReports(listAllDailyReportsVars);
// Variables can be defined inline as well.
const { data } = await listAllDailyReports({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllDailyReportsVariables` argument.
const { data } = await listAllDailyReports();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllDailyReports(dataConnect, listAllDailyReportsVars);

console.log(data.dailyReports);

// Or, you can use the `Promise` API.
listAllDailyReports(listAllDailyReportsVars).then((response) => {
  const data = response.data;
  console.log(data.dailyReports);
});
```

### Using `ListAllDailyReports`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllDailyReportsRef, ListAllDailyReportsVariables } from '@dataconnect/generated';

// The `ListAllDailyReports` query has an optional argument of type `ListAllDailyReportsVariables`:
const listAllDailyReportsVars: ListAllDailyReportsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllDailyReportsRef()` function to get a reference to the query.
const ref = listAllDailyReportsRef(listAllDailyReportsVars);
// Variables can be defined inline as well.
const ref = listAllDailyReportsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllDailyReportsVariables` argument.
const ref = listAllDailyReportsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllDailyReportsRef(dataConnect, listAllDailyReportsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.dailyReports);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyReports);
});
```

## ListAllDailyReportWorkers
You can execute the `ListAllDailyReportWorkers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllDailyReportWorkers(vars?: ListAllDailyReportWorkersVariables): QueryPromise<ListAllDailyReportWorkersData, ListAllDailyReportWorkersVariables>;

interface ListAllDailyReportWorkersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllDailyReportWorkersVariables): QueryRef<ListAllDailyReportWorkersData, ListAllDailyReportWorkersVariables>;
}
export const listAllDailyReportWorkersRef: ListAllDailyReportWorkersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllDailyReportWorkers(dc: DataConnect, vars?: ListAllDailyReportWorkersVariables): QueryPromise<ListAllDailyReportWorkersData, ListAllDailyReportWorkersVariables>;

interface ListAllDailyReportWorkersRef {
  ...
  (dc: DataConnect, vars?: ListAllDailyReportWorkersVariables): QueryRef<ListAllDailyReportWorkersData, ListAllDailyReportWorkersVariables>;
}
export const listAllDailyReportWorkersRef: ListAllDailyReportWorkersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllDailyReportWorkersRef:
```typescript
const name = listAllDailyReportWorkersRef.operationName;
console.log(name);
```

### Variables
The `ListAllDailyReportWorkers` query has an optional argument of type `ListAllDailyReportWorkersVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllDailyReportWorkersVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllDailyReportWorkers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllDailyReportWorkersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllDailyReportWorkers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllDailyReportWorkers, ListAllDailyReportWorkersVariables } from '@dataconnect/generated';

// The `ListAllDailyReportWorkers` query has an optional argument of type `ListAllDailyReportWorkersVariables`:
const listAllDailyReportWorkersVars: ListAllDailyReportWorkersVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllDailyReportWorkers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllDailyReportWorkers(listAllDailyReportWorkersVars);
// Variables can be defined inline as well.
const { data } = await listAllDailyReportWorkers({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllDailyReportWorkersVariables` argument.
const { data } = await listAllDailyReportWorkers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllDailyReportWorkers(dataConnect, listAllDailyReportWorkersVars);

console.log(data.dailyReportWorkers);

// Or, you can use the `Promise` API.
listAllDailyReportWorkers(listAllDailyReportWorkersVars).then((response) => {
  const data = response.data;
  console.log(data.dailyReportWorkers);
});
```

### Using `ListAllDailyReportWorkers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllDailyReportWorkersRef, ListAllDailyReportWorkersVariables } from '@dataconnect/generated';

// The `ListAllDailyReportWorkers` query has an optional argument of type `ListAllDailyReportWorkersVariables`:
const listAllDailyReportWorkersVars: ListAllDailyReportWorkersVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllDailyReportWorkersRef()` function to get a reference to the query.
const ref = listAllDailyReportWorkersRef(listAllDailyReportWorkersVars);
// Variables can be defined inline as well.
const ref = listAllDailyReportWorkersRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllDailyReportWorkersVariables` argument.
const ref = listAllDailyReportWorkersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllDailyReportWorkersRef(dataConnect, listAllDailyReportWorkersVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.dailyReportWorkers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyReportWorkers);
});
```

## ListAllAppUsers
You can execute the `ListAllAppUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllAppUsers(vars?: ListAllAppUsersVariables): QueryPromise<ListAllAppUsersData, ListAllAppUsersVariables>;

interface ListAllAppUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAppUsersVariables): QueryRef<ListAllAppUsersData, ListAllAppUsersVariables>;
}
export const listAllAppUsersRef: ListAllAppUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllAppUsers(dc: DataConnect, vars?: ListAllAppUsersVariables): QueryPromise<ListAllAppUsersData, ListAllAppUsersVariables>;

interface ListAllAppUsersRef {
  ...
  (dc: DataConnect, vars?: ListAllAppUsersVariables): QueryRef<ListAllAppUsersData, ListAllAppUsersVariables>;
}
export const listAllAppUsersRef: ListAllAppUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllAppUsersRef:
```typescript
const name = listAllAppUsersRef.operationName;
console.log(name);
```

### Variables
The `ListAllAppUsers` query has an optional argument of type `ListAllAppUsersVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllAppUsersVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllAppUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllAppUsersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllAppUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllAppUsers, ListAllAppUsersVariables } from '@dataconnect/generated';

// The `ListAllAppUsers` query has an optional argument of type `ListAllAppUsersVariables`:
const listAllAppUsersVars: ListAllAppUsersVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAppUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllAppUsers(listAllAppUsersVars);
// Variables can be defined inline as well.
const { data } = await listAllAppUsers({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAppUsersVariables` argument.
const { data } = await listAllAppUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllAppUsers(dataConnect, listAllAppUsersVars);

console.log(data.appUsers);

// Or, you can use the `Promise` API.
listAllAppUsers(listAllAppUsersVars).then((response) => {
  const data = response.data;
  console.log(data.appUsers);
});
```

### Using `ListAllAppUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllAppUsersRef, ListAllAppUsersVariables } from '@dataconnect/generated';

// The `ListAllAppUsers` query has an optional argument of type `ListAllAppUsersVariables`:
const listAllAppUsersVars: ListAllAppUsersVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAppUsersRef()` function to get a reference to the query.
const ref = listAllAppUsersRef(listAllAppUsersVars);
// Variables can be defined inline as well.
const ref = listAllAppUsersRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAppUsersVariables` argument.
const ref = listAllAppUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllAppUsersRef(dataConnect, listAllAppUsersVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.appUsers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.appUsers);
});
```

## ListAllMenuConfigs
You can execute the `ListAllMenuConfigs` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllMenuConfigs(vars?: ListAllMenuConfigsVariables): QueryPromise<ListAllMenuConfigsData, ListAllMenuConfigsVariables>;

interface ListAllMenuConfigsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllMenuConfigsVariables): QueryRef<ListAllMenuConfigsData, ListAllMenuConfigsVariables>;
}
export const listAllMenuConfigsRef: ListAllMenuConfigsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllMenuConfigs(dc: DataConnect, vars?: ListAllMenuConfigsVariables): QueryPromise<ListAllMenuConfigsData, ListAllMenuConfigsVariables>;

interface ListAllMenuConfigsRef {
  ...
  (dc: DataConnect, vars?: ListAllMenuConfigsVariables): QueryRef<ListAllMenuConfigsData, ListAllMenuConfigsVariables>;
}
export const listAllMenuConfigsRef: ListAllMenuConfigsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllMenuConfigsRef:
```typescript
const name = listAllMenuConfigsRef.operationName;
console.log(name);
```

### Variables
The `ListAllMenuConfigs` query has an optional argument of type `ListAllMenuConfigsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllMenuConfigsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllMenuConfigs` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllMenuConfigsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllMenuConfigsData {
  menuConfigs: ({
    id: string;
    config: string;
    updatedAt: TimestampString;
  } & MenuConfig_Key)[];
}
```
### Using `ListAllMenuConfigs`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllMenuConfigs, ListAllMenuConfigsVariables } from '@dataconnect/generated';

// The `ListAllMenuConfigs` query has an optional argument of type `ListAllMenuConfigsVariables`:
const listAllMenuConfigsVars: ListAllMenuConfigsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllMenuConfigs()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllMenuConfigs(listAllMenuConfigsVars);
// Variables can be defined inline as well.
const { data } = await listAllMenuConfigs({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllMenuConfigsVariables` argument.
const { data } = await listAllMenuConfigs();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllMenuConfigs(dataConnect, listAllMenuConfigsVars);

console.log(data.menuConfigs);

// Or, you can use the `Promise` API.
listAllMenuConfigs(listAllMenuConfigsVars).then((response) => {
  const data = response.data;
  console.log(data.menuConfigs);
});
```

### Using `ListAllMenuConfigs`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllMenuConfigsRef, ListAllMenuConfigsVariables } from '@dataconnect/generated';

// The `ListAllMenuConfigs` query has an optional argument of type `ListAllMenuConfigsVariables`:
const listAllMenuConfigsVars: ListAllMenuConfigsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllMenuConfigsRef()` function to get a reference to the query.
const ref = listAllMenuConfigsRef(listAllMenuConfigsVars);
// Variables can be defined inline as well.
const ref = listAllMenuConfigsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllMenuConfigsVariables` argument.
const ref = listAllMenuConfigsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllMenuConfigsRef(dataConnect, listAllMenuConfigsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.menuConfigs);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.menuConfigs);
});
```

## ListAllSystemLogs
You can execute the `ListAllSystemLogs` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllSystemLogs(vars?: ListAllSystemLogsVariables): QueryPromise<ListAllSystemLogsData, ListAllSystemLogsVariables>;

interface ListAllSystemLogsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSystemLogsVariables): QueryRef<ListAllSystemLogsData, ListAllSystemLogsVariables>;
}
export const listAllSystemLogsRef: ListAllSystemLogsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllSystemLogs(dc: DataConnect, vars?: ListAllSystemLogsVariables): QueryPromise<ListAllSystemLogsData, ListAllSystemLogsVariables>;

interface ListAllSystemLogsRef {
  ...
  (dc: DataConnect, vars?: ListAllSystemLogsVariables): QueryRef<ListAllSystemLogsData, ListAllSystemLogsVariables>;
}
export const listAllSystemLogsRef: ListAllSystemLogsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllSystemLogsRef:
```typescript
const name = listAllSystemLogsRef.operationName;
console.log(name);
```

### Variables
The `ListAllSystemLogs` query has an optional argument of type `ListAllSystemLogsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllSystemLogsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllSystemLogs` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllSystemLogsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllSystemLogs`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllSystemLogs, ListAllSystemLogsVariables } from '@dataconnect/generated';

// The `ListAllSystemLogs` query has an optional argument of type `ListAllSystemLogsVariables`:
const listAllSystemLogsVars: ListAllSystemLogsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSystemLogs()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllSystemLogs(listAllSystemLogsVars);
// Variables can be defined inline as well.
const { data } = await listAllSystemLogs({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSystemLogsVariables` argument.
const { data } = await listAllSystemLogs();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllSystemLogs(dataConnect, listAllSystemLogsVars);

console.log(data.systemLogs);

// Or, you can use the `Promise` API.
listAllSystemLogs(listAllSystemLogsVars).then((response) => {
  const data = response.data;
  console.log(data.systemLogs);
});
```

### Using `ListAllSystemLogs`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllSystemLogsRef, ListAllSystemLogsVariables } from '@dataconnect/generated';

// The `ListAllSystemLogs` query has an optional argument of type `ListAllSystemLogsVariables`:
const listAllSystemLogsVars: ListAllSystemLogsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSystemLogsRef()` function to get a reference to the query.
const ref = listAllSystemLogsRef(listAllSystemLogsVars);
// Variables can be defined inline as well.
const ref = listAllSystemLogsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSystemLogsVariables` argument.
const ref = listAllSystemLogsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllSystemLogsRef(dataConnect, listAllSystemLogsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.systemLogs);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.systemLogs);
});
```

## ListAllAuditLogs
You can execute the `ListAllAuditLogs` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllAuditLogs(vars?: ListAllAuditLogsVariables): QueryPromise<ListAllAuditLogsData, ListAllAuditLogsVariables>;

interface ListAllAuditLogsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAuditLogsVariables): QueryRef<ListAllAuditLogsData, ListAllAuditLogsVariables>;
}
export const listAllAuditLogsRef: ListAllAuditLogsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllAuditLogs(dc: DataConnect, vars?: ListAllAuditLogsVariables): QueryPromise<ListAllAuditLogsData, ListAllAuditLogsVariables>;

interface ListAllAuditLogsRef {
  ...
  (dc: DataConnect, vars?: ListAllAuditLogsVariables): QueryRef<ListAllAuditLogsData, ListAllAuditLogsVariables>;
}
export const listAllAuditLogsRef: ListAllAuditLogsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllAuditLogsRef:
```typescript
const name = listAllAuditLogsRef.operationName;
console.log(name);
```

### Variables
The `ListAllAuditLogs` query has an optional argument of type `ListAllAuditLogsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllAuditLogsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllAuditLogs` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllAuditLogsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllAuditLogs`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllAuditLogs, ListAllAuditLogsVariables } from '@dataconnect/generated';

// The `ListAllAuditLogs` query has an optional argument of type `ListAllAuditLogsVariables`:
const listAllAuditLogsVars: ListAllAuditLogsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAuditLogs()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllAuditLogs(listAllAuditLogsVars);
// Variables can be defined inline as well.
const { data } = await listAllAuditLogs({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAuditLogsVariables` argument.
const { data } = await listAllAuditLogs();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllAuditLogs(dataConnect, listAllAuditLogsVars);

console.log(data.auditLogs);

// Or, you can use the `Promise` API.
listAllAuditLogs(listAllAuditLogsVars).then((response) => {
  const data = response.data;
  console.log(data.auditLogs);
});
```

### Using `ListAllAuditLogs`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllAuditLogsRef, ListAllAuditLogsVariables } from '@dataconnect/generated';

// The `ListAllAuditLogs` query has an optional argument of type `ListAllAuditLogsVariables`:
const listAllAuditLogsVars: ListAllAuditLogsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAuditLogsRef()` function to get a reference to the query.
const ref = listAllAuditLogsRef(listAllAuditLogsVars);
// Variables can be defined inline as well.
const ref = listAllAuditLogsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAuditLogsVariables` argument.
const ref = listAllAuditLogsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllAuditLogsRef(dataConnect, listAllAuditLogsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.auditLogs);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.auditLogs);
});
```

## ListAllAgents
You can execute the `ListAllAgents` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllAgents(vars?: ListAllAgentsVariables): QueryPromise<ListAllAgentsData, ListAllAgentsVariables>;

interface ListAllAgentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAgentsVariables): QueryRef<ListAllAgentsData, ListAllAgentsVariables>;
}
export const listAllAgentsRef: ListAllAgentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllAgents(dc: DataConnect, vars?: ListAllAgentsVariables): QueryPromise<ListAllAgentsData, ListAllAgentsVariables>;

interface ListAllAgentsRef {
  ...
  (dc: DataConnect, vars?: ListAllAgentsVariables): QueryRef<ListAllAgentsData, ListAllAgentsVariables>;
}
export const listAllAgentsRef: ListAllAgentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllAgentsRef:
```typescript
const name = listAllAgentsRef.operationName;
console.log(name);
```

### Variables
The `ListAllAgents` query has an optional argument of type `ListAllAgentsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllAgentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllAgents` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllAgentsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllAgents`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllAgents, ListAllAgentsVariables } from '@dataconnect/generated';

// The `ListAllAgents` query has an optional argument of type `ListAllAgentsVariables`:
const listAllAgentsVars: ListAllAgentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAgents()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllAgents(listAllAgentsVars);
// Variables can be defined inline as well.
const { data } = await listAllAgents({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAgentsVariables` argument.
const { data } = await listAllAgents();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllAgents(dataConnect, listAllAgentsVars);

console.log(data.agents);

// Or, you can use the `Promise` API.
listAllAgents(listAllAgentsVars).then((response) => {
  const data = response.data;
  console.log(data.agents);
});
```

### Using `ListAllAgents`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllAgentsRef, ListAllAgentsVariables } from '@dataconnect/generated';

// The `ListAllAgents` query has an optional argument of type `ListAllAgentsVariables`:
const listAllAgentsVars: ListAllAgentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAgentsRef()` function to get a reference to the query.
const ref = listAllAgentsRef(listAllAgentsVars);
// Variables can be defined inline as well.
const ref = listAllAgentsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAgentsVariables` argument.
const ref = listAllAgentsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllAgentsRef(dataConnect, listAllAgentsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.agents);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.agents);
});
```

## ListAllAgentConversations
You can execute the `ListAllAgentConversations` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllAgentConversations(vars?: ListAllAgentConversationsVariables): QueryPromise<ListAllAgentConversationsData, ListAllAgentConversationsVariables>;

interface ListAllAgentConversationsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAgentConversationsVariables): QueryRef<ListAllAgentConversationsData, ListAllAgentConversationsVariables>;
}
export const listAllAgentConversationsRef: ListAllAgentConversationsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllAgentConversations(dc: DataConnect, vars?: ListAllAgentConversationsVariables): QueryPromise<ListAllAgentConversationsData, ListAllAgentConversationsVariables>;

interface ListAllAgentConversationsRef {
  ...
  (dc: DataConnect, vars?: ListAllAgentConversationsVariables): QueryRef<ListAllAgentConversationsData, ListAllAgentConversationsVariables>;
}
export const listAllAgentConversationsRef: ListAllAgentConversationsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllAgentConversationsRef:
```typescript
const name = listAllAgentConversationsRef.operationName;
console.log(name);
```

### Variables
The `ListAllAgentConversations` query has an optional argument of type `ListAllAgentConversationsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllAgentConversationsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllAgentConversations` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllAgentConversationsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
### Using `ListAllAgentConversations`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllAgentConversations, ListAllAgentConversationsVariables } from '@dataconnect/generated';

// The `ListAllAgentConversations` query has an optional argument of type `ListAllAgentConversationsVariables`:
const listAllAgentConversationsVars: ListAllAgentConversationsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAgentConversations()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllAgentConversations(listAllAgentConversationsVars);
// Variables can be defined inline as well.
const { data } = await listAllAgentConversations({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAgentConversationsVariables` argument.
const { data } = await listAllAgentConversations();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllAgentConversations(dataConnect, listAllAgentConversationsVars);

console.log(data.agentConversations);

// Or, you can use the `Promise` API.
listAllAgentConversations(listAllAgentConversationsVars).then((response) => {
  const data = response.data;
  console.log(data.agentConversations);
});
```

### Using `ListAllAgentConversations`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllAgentConversationsRef, ListAllAgentConversationsVariables } from '@dataconnect/generated';

// The `ListAllAgentConversations` query has an optional argument of type `ListAllAgentConversationsVariables`:
const listAllAgentConversationsVars: ListAllAgentConversationsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAgentConversationsRef()` function to get a reference to the query.
const ref = listAllAgentConversationsRef(listAllAgentConversationsVars);
// Variables can be defined inline as well.
const ref = listAllAgentConversationsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAgentConversationsVariables` argument.
const ref = listAllAgentConversationsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllAgentConversationsRef(dataConnect, listAllAgentConversationsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.agentConversations);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.agentConversations);
});
```

## ListAllSettings
You can execute the `ListAllSettings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllSettings(vars?: ListAllSettingsVariables): QueryPromise<ListAllSettingsData, ListAllSettingsVariables>;

interface ListAllSettingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSettingsVariables): QueryRef<ListAllSettingsData, ListAllSettingsVariables>;
}
export const listAllSettingsRef: ListAllSettingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllSettings(dc: DataConnect, vars?: ListAllSettingsVariables): QueryPromise<ListAllSettingsData, ListAllSettingsVariables>;

interface ListAllSettingsRef {
  ...
  (dc: DataConnect, vars?: ListAllSettingsVariables): QueryRef<ListAllSettingsData, ListAllSettingsVariables>;
}
export const listAllSettingsRef: ListAllSettingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllSettingsRef:
```typescript
const name = listAllSettingsRef.operationName;
console.log(name);
```

### Variables
The `ListAllSettings` query has an optional argument of type `ListAllSettingsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllSettingsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllSettings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllSettingsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllSettingsData {
  settings: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & Setting_Key)[];
}
```
### Using `ListAllSettings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllSettings, ListAllSettingsVariables } from '@dataconnect/generated';

// The `ListAllSettings` query has an optional argument of type `ListAllSettingsVariables`:
const listAllSettingsVars: ListAllSettingsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSettings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllSettings(listAllSettingsVars);
// Variables can be defined inline as well.
const { data } = await listAllSettings({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSettingsVariables` argument.
const { data } = await listAllSettings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllSettings(dataConnect, listAllSettingsVars);

console.log(data.settings);

// Or, you can use the `Promise` API.
listAllSettings(listAllSettingsVars).then((response) => {
  const data = response.data;
  console.log(data.settings);
});
```

### Using `ListAllSettings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllSettingsRef, ListAllSettingsVariables } from '@dataconnect/generated';

// The `ListAllSettings` query has an optional argument of type `ListAllSettingsVariables`:
const listAllSettingsVars: ListAllSettingsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSettingsRef()` function to get a reference to the query.
const ref = listAllSettingsRef(listAllSettingsVars);
// Variables can be defined inline as well.
const ref = listAllSettingsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSettingsVariables` argument.
const ref = listAllSettingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllSettingsRef(dataConnect, listAllSettingsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.settings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.settings);
});
```

## ListAllSystemConfigs
You can execute the `ListAllSystemConfigs` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllSystemConfigs(vars?: ListAllSystemConfigsVariables): QueryPromise<ListAllSystemConfigsData, ListAllSystemConfigsVariables>;

interface ListAllSystemConfigsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSystemConfigsVariables): QueryRef<ListAllSystemConfigsData, ListAllSystemConfigsVariables>;
}
export const listAllSystemConfigsRef: ListAllSystemConfigsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllSystemConfigs(dc: DataConnect, vars?: ListAllSystemConfigsVariables): QueryPromise<ListAllSystemConfigsData, ListAllSystemConfigsVariables>;

interface ListAllSystemConfigsRef {
  ...
  (dc: DataConnect, vars?: ListAllSystemConfigsVariables): QueryRef<ListAllSystemConfigsData, ListAllSystemConfigsVariables>;
}
export const listAllSystemConfigsRef: ListAllSystemConfigsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllSystemConfigsRef:
```typescript
const name = listAllSystemConfigsRef.operationName;
console.log(name);
```

### Variables
The `ListAllSystemConfigs` query has an optional argument of type `ListAllSystemConfigsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllSystemConfigsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllSystemConfigs` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllSystemConfigsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllSystemConfigsData {
  systemConfigs: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & SystemConfig_Key)[];
}
```
### Using `ListAllSystemConfigs`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllSystemConfigs, ListAllSystemConfigsVariables } from '@dataconnect/generated';

// The `ListAllSystemConfigs` query has an optional argument of type `ListAllSystemConfigsVariables`:
const listAllSystemConfigsVars: ListAllSystemConfigsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSystemConfigs()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllSystemConfigs(listAllSystemConfigsVars);
// Variables can be defined inline as well.
const { data } = await listAllSystemConfigs({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSystemConfigsVariables` argument.
const { data } = await listAllSystemConfigs();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllSystemConfigs(dataConnect, listAllSystemConfigsVars);

console.log(data.systemConfigs);

// Or, you can use the `Promise` API.
listAllSystemConfigs(listAllSystemConfigsVars).then((response) => {
  const data = response.data;
  console.log(data.systemConfigs);
});
```

### Using `ListAllSystemConfigs`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllSystemConfigsRef, ListAllSystemConfigsVariables } from '@dataconnect/generated';

// The `ListAllSystemConfigs` query has an optional argument of type `ListAllSystemConfigsVariables`:
const listAllSystemConfigsVars: ListAllSystemConfigsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSystemConfigsRef()` function to get a reference to the query.
const ref = listAllSystemConfigsRef(listAllSystemConfigsVars);
// Variables can be defined inline as well.
const ref = listAllSystemConfigsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSystemConfigsVariables` argument.
const ref = listAllSystemConfigsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllSystemConfigsRef(dataConnect, listAllSystemConfigsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.systemConfigs);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.systemConfigs);
});
```

## ListAllAccommodations
You can execute the `ListAllAccommodations` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllAccommodations(vars?: ListAllAccommodationsVariables): QueryPromise<ListAllAccommodationsData, ListAllAccommodationsVariables>;

interface ListAllAccommodationsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAccommodationsVariables): QueryRef<ListAllAccommodationsData, ListAllAccommodationsVariables>;
}
export const listAllAccommodationsRef: ListAllAccommodationsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllAccommodations(dc: DataConnect, vars?: ListAllAccommodationsVariables): QueryPromise<ListAllAccommodationsData, ListAllAccommodationsVariables>;

interface ListAllAccommodationsRef {
  ...
  (dc: DataConnect, vars?: ListAllAccommodationsVariables): QueryRef<ListAllAccommodationsData, ListAllAccommodationsVariables>;
}
export const listAllAccommodationsRef: ListAllAccommodationsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllAccommodationsRef:
```typescript
const name = listAllAccommodationsRef.operationName;
console.log(name);
```

### Variables
The `ListAllAccommodations` query has an optional argument of type `ListAllAccommodationsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllAccommodationsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllAccommodations` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllAccommodationsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllAccommodationsData {
  accommodations: ({
    id: UUIDString;
  } & Accommodation_Key)[];
}
```
### Using `ListAllAccommodations`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllAccommodations, ListAllAccommodationsVariables } from '@dataconnect/generated';

// The `ListAllAccommodations` query has an optional argument of type `ListAllAccommodationsVariables`:
const listAllAccommodationsVars: ListAllAccommodationsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAccommodations()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllAccommodations(listAllAccommodationsVars);
// Variables can be defined inline as well.
const { data } = await listAllAccommodations({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAccommodationsVariables` argument.
const { data } = await listAllAccommodations();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllAccommodations(dataConnect, listAllAccommodationsVars);

console.log(data.accommodations);

// Or, you can use the `Promise` API.
listAllAccommodations(listAllAccommodationsVars).then((response) => {
  const data = response.data;
  console.log(data.accommodations);
});
```

### Using `ListAllAccommodations`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllAccommodationsRef, ListAllAccommodationsVariables } from '@dataconnect/generated';

// The `ListAllAccommodations` query has an optional argument of type `ListAllAccommodationsVariables`:
const listAllAccommodationsVars: ListAllAccommodationsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAccommodationsRef()` function to get a reference to the query.
const ref = listAllAccommodationsRef(listAllAccommodationsVars);
// Variables can be defined inline as well.
const ref = listAllAccommodationsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAccommodationsVariables` argument.
const ref = listAllAccommodationsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllAccommodationsRef(dataConnect, listAllAccommodationsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.accommodations);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodations);
});
```

## ListAllAccommodationAssignments
You can execute the `ListAllAccommodationAssignments` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllAccommodationAssignments(vars?: ListAllAccommodationAssignmentsVariables): QueryPromise<ListAllAccommodationAssignmentsData, ListAllAccommodationAssignmentsVariables>;

interface ListAllAccommodationAssignmentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAccommodationAssignmentsVariables): QueryRef<ListAllAccommodationAssignmentsData, ListAllAccommodationAssignmentsVariables>;
}
export const listAllAccommodationAssignmentsRef: ListAllAccommodationAssignmentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllAccommodationAssignments(dc: DataConnect, vars?: ListAllAccommodationAssignmentsVariables): QueryPromise<ListAllAccommodationAssignmentsData, ListAllAccommodationAssignmentsVariables>;

interface ListAllAccommodationAssignmentsRef {
  ...
  (dc: DataConnect, vars?: ListAllAccommodationAssignmentsVariables): QueryRef<ListAllAccommodationAssignmentsData, ListAllAccommodationAssignmentsVariables>;
}
export const listAllAccommodationAssignmentsRef: ListAllAccommodationAssignmentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllAccommodationAssignmentsRef:
```typescript
const name = listAllAccommodationAssignmentsRef.operationName;
console.log(name);
```

### Variables
The `ListAllAccommodationAssignments` query has an optional argument of type `ListAllAccommodationAssignmentsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllAccommodationAssignmentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllAccommodationAssignments` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllAccommodationAssignmentsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllAccommodationAssignmentsData {
  accommodationAssignments: ({
    id: UUIDString;
  } & AccommodationAssignment_Key)[];
}
```
### Using `ListAllAccommodationAssignments`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllAccommodationAssignments, ListAllAccommodationAssignmentsVariables } from '@dataconnect/generated';

// The `ListAllAccommodationAssignments` query has an optional argument of type `ListAllAccommodationAssignmentsVariables`:
const listAllAccommodationAssignmentsVars: ListAllAccommodationAssignmentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAccommodationAssignments()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllAccommodationAssignments(listAllAccommodationAssignmentsVars);
// Variables can be defined inline as well.
const { data } = await listAllAccommodationAssignments({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAccommodationAssignmentsVariables` argument.
const { data } = await listAllAccommodationAssignments();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllAccommodationAssignments(dataConnect, listAllAccommodationAssignmentsVars);

console.log(data.accommodationAssignments);

// Or, you can use the `Promise` API.
listAllAccommodationAssignments(listAllAccommodationAssignmentsVars).then((response) => {
  const data = response.data;
  console.log(data.accommodationAssignments);
});
```

### Using `ListAllAccommodationAssignments`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllAccommodationAssignmentsRef, ListAllAccommodationAssignmentsVariables } from '@dataconnect/generated';

// The `ListAllAccommodationAssignments` query has an optional argument of type `ListAllAccommodationAssignmentsVariables`:
const listAllAccommodationAssignmentsVars: ListAllAccommodationAssignmentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAccommodationAssignmentsRef()` function to get a reference to the query.
const ref = listAllAccommodationAssignmentsRef(listAllAccommodationAssignmentsVars);
// Variables can be defined inline as well.
const ref = listAllAccommodationAssignmentsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAccommodationAssignmentsVariables` argument.
const ref = listAllAccommodationAssignmentsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllAccommodationAssignmentsRef(dataConnect, listAllAccommodationAssignmentsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.accommodationAssignments);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodationAssignments);
});
```

## ListAllUtilityRecords
You can execute the `ListAllUtilityRecords` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllUtilityRecords(vars?: ListAllUtilityRecordsVariables): QueryPromise<ListAllUtilityRecordsData, ListAllUtilityRecordsVariables>;

interface ListAllUtilityRecordsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllUtilityRecordsVariables): QueryRef<ListAllUtilityRecordsData, ListAllUtilityRecordsVariables>;
}
export const listAllUtilityRecordsRef: ListAllUtilityRecordsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllUtilityRecords(dc: DataConnect, vars?: ListAllUtilityRecordsVariables): QueryPromise<ListAllUtilityRecordsData, ListAllUtilityRecordsVariables>;

interface ListAllUtilityRecordsRef {
  ...
  (dc: DataConnect, vars?: ListAllUtilityRecordsVariables): QueryRef<ListAllUtilityRecordsData, ListAllUtilityRecordsVariables>;
}
export const listAllUtilityRecordsRef: ListAllUtilityRecordsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllUtilityRecordsRef:
```typescript
const name = listAllUtilityRecordsRef.operationName;
console.log(name);
```

### Variables
The `ListAllUtilityRecords` query has an optional argument of type `ListAllUtilityRecordsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllUtilityRecordsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllUtilityRecords` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllUtilityRecordsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllUtilityRecordsData {
  utilityRecords: ({
    id: UUIDString;
  })[];
}
```
### Using `ListAllUtilityRecords`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllUtilityRecords, ListAllUtilityRecordsVariables } from '@dataconnect/generated';

// The `ListAllUtilityRecords` query has an optional argument of type `ListAllUtilityRecordsVariables`:
const listAllUtilityRecordsVars: ListAllUtilityRecordsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllUtilityRecords()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllUtilityRecords(listAllUtilityRecordsVars);
// Variables can be defined inline as well.
const { data } = await listAllUtilityRecords({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllUtilityRecordsVariables` argument.
const { data } = await listAllUtilityRecords();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllUtilityRecords(dataConnect, listAllUtilityRecordsVars);

console.log(data.utilityRecords);

// Or, you can use the `Promise` API.
listAllUtilityRecords(listAllUtilityRecordsVars).then((response) => {
  const data = response.data;
  console.log(data.utilityRecords);
});
```

### Using `ListAllUtilityRecords`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllUtilityRecordsRef, ListAllUtilityRecordsVariables } from '@dataconnect/generated';

// The `ListAllUtilityRecords` query has an optional argument of type `ListAllUtilityRecordsVariables`:
const listAllUtilityRecordsVars: ListAllUtilityRecordsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllUtilityRecordsRef()` function to get a reference to the query.
const ref = listAllUtilityRecordsRef(listAllUtilityRecordsVars);
// Variables can be defined inline as well.
const ref = listAllUtilityRecordsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllUtilityRecordsVariables` argument.
const ref = listAllUtilityRecordsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllUtilityRecordsRef(dataConnect, listAllUtilityRecordsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.utilityRecords);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.utilityRecords);
});
```

## ListAllAccommodationBillingDocuments
You can execute the `ListAllAccommodationBillingDocuments` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllAccommodationBillingDocuments(vars?: ListAllAccommodationBillingDocumentsVariables): QueryPromise<ListAllAccommodationBillingDocumentsData, ListAllAccommodationBillingDocumentsVariables>;

interface ListAllAccommodationBillingDocumentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAccommodationBillingDocumentsVariables): QueryRef<ListAllAccommodationBillingDocumentsData, ListAllAccommodationBillingDocumentsVariables>;
}
export const listAllAccommodationBillingDocumentsRef: ListAllAccommodationBillingDocumentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllAccommodationBillingDocuments(dc: DataConnect, vars?: ListAllAccommodationBillingDocumentsVariables): QueryPromise<ListAllAccommodationBillingDocumentsData, ListAllAccommodationBillingDocumentsVariables>;

interface ListAllAccommodationBillingDocumentsRef {
  ...
  (dc: DataConnect, vars?: ListAllAccommodationBillingDocumentsVariables): QueryRef<ListAllAccommodationBillingDocumentsData, ListAllAccommodationBillingDocumentsVariables>;
}
export const listAllAccommodationBillingDocumentsRef: ListAllAccommodationBillingDocumentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllAccommodationBillingDocumentsRef:
```typescript
const name = listAllAccommodationBillingDocumentsRef.operationName;
console.log(name);
```

### Variables
The `ListAllAccommodationBillingDocuments` query has an optional argument of type `ListAllAccommodationBillingDocumentsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllAccommodationBillingDocumentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllAccommodationBillingDocuments` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllAccommodationBillingDocumentsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllAccommodationBillingDocumentsData {
  accommodationBillingDocuments: ({
    id: UUIDString;
  } & AccommodationBillingDocument_Key)[];
}
```
### Using `ListAllAccommodationBillingDocuments`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllAccommodationBillingDocuments, ListAllAccommodationBillingDocumentsVariables } from '@dataconnect/generated';

// The `ListAllAccommodationBillingDocuments` query has an optional argument of type `ListAllAccommodationBillingDocumentsVariables`:
const listAllAccommodationBillingDocumentsVars: ListAllAccommodationBillingDocumentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAccommodationBillingDocuments()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllAccommodationBillingDocuments(listAllAccommodationBillingDocumentsVars);
// Variables can be defined inline as well.
const { data } = await listAllAccommodationBillingDocuments({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAccommodationBillingDocumentsVariables` argument.
const { data } = await listAllAccommodationBillingDocuments();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllAccommodationBillingDocuments(dataConnect, listAllAccommodationBillingDocumentsVars);

console.log(data.accommodationBillingDocuments);

// Or, you can use the `Promise` API.
listAllAccommodationBillingDocuments(listAllAccommodationBillingDocumentsVars).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingDocuments);
});
```

### Using `ListAllAccommodationBillingDocuments`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllAccommodationBillingDocumentsRef, ListAllAccommodationBillingDocumentsVariables } from '@dataconnect/generated';

// The `ListAllAccommodationBillingDocuments` query has an optional argument of type `ListAllAccommodationBillingDocumentsVariables`:
const listAllAccommodationBillingDocumentsVars: ListAllAccommodationBillingDocumentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAccommodationBillingDocumentsRef()` function to get a reference to the query.
const ref = listAllAccommodationBillingDocumentsRef(listAllAccommodationBillingDocumentsVars);
// Variables can be defined inline as well.
const ref = listAllAccommodationBillingDocumentsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAccommodationBillingDocumentsVariables` argument.
const ref = listAllAccommodationBillingDocumentsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllAccommodationBillingDocumentsRef(dataConnect, listAllAccommodationBillingDocumentsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.accommodationBillingDocuments);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingDocuments);
});
```

## ListAllAccommodationBillingLineItems
You can execute the `ListAllAccommodationBillingLineItems` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllAccommodationBillingLineItems(vars?: ListAllAccommodationBillingLineItemsVariables): QueryPromise<ListAllAccommodationBillingLineItemsData, ListAllAccommodationBillingLineItemsVariables>;

interface ListAllAccommodationBillingLineItemsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAccommodationBillingLineItemsVariables): QueryRef<ListAllAccommodationBillingLineItemsData, ListAllAccommodationBillingLineItemsVariables>;
}
export const listAllAccommodationBillingLineItemsRef: ListAllAccommodationBillingLineItemsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllAccommodationBillingLineItems(dc: DataConnect, vars?: ListAllAccommodationBillingLineItemsVariables): QueryPromise<ListAllAccommodationBillingLineItemsData, ListAllAccommodationBillingLineItemsVariables>;

interface ListAllAccommodationBillingLineItemsRef {
  ...
  (dc: DataConnect, vars?: ListAllAccommodationBillingLineItemsVariables): QueryRef<ListAllAccommodationBillingLineItemsData, ListAllAccommodationBillingLineItemsVariables>;
}
export const listAllAccommodationBillingLineItemsRef: ListAllAccommodationBillingLineItemsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllAccommodationBillingLineItemsRef:
```typescript
const name = listAllAccommodationBillingLineItemsRef.operationName;
console.log(name);
```

### Variables
The `ListAllAccommodationBillingLineItems` query has an optional argument of type `ListAllAccommodationBillingLineItemsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllAccommodationBillingLineItemsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllAccommodationBillingLineItems` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllAccommodationBillingLineItemsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllAccommodationBillingLineItemsData {
  accommodationBillingLineItems: ({
    id: UUIDString;
  } & AccommodationBillingLineItem_Key)[];
}
```
### Using `ListAllAccommodationBillingLineItems`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllAccommodationBillingLineItems, ListAllAccommodationBillingLineItemsVariables } from '@dataconnect/generated';

// The `ListAllAccommodationBillingLineItems` query has an optional argument of type `ListAllAccommodationBillingLineItemsVariables`:
const listAllAccommodationBillingLineItemsVars: ListAllAccommodationBillingLineItemsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAccommodationBillingLineItems()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllAccommodationBillingLineItems(listAllAccommodationBillingLineItemsVars);
// Variables can be defined inline as well.
const { data } = await listAllAccommodationBillingLineItems({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAccommodationBillingLineItemsVariables` argument.
const { data } = await listAllAccommodationBillingLineItems();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllAccommodationBillingLineItems(dataConnect, listAllAccommodationBillingLineItemsVars);

console.log(data.accommodationBillingLineItems);

// Or, you can use the `Promise` API.
listAllAccommodationBillingLineItems(listAllAccommodationBillingLineItemsVars).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingLineItems);
});
```

### Using `ListAllAccommodationBillingLineItems`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllAccommodationBillingLineItemsRef, ListAllAccommodationBillingLineItemsVariables } from '@dataconnect/generated';

// The `ListAllAccommodationBillingLineItems` query has an optional argument of type `ListAllAccommodationBillingLineItemsVariables`:
const listAllAccommodationBillingLineItemsVars: ListAllAccommodationBillingLineItemsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAccommodationBillingLineItemsRef()` function to get a reference to the query.
const ref = listAllAccommodationBillingLineItemsRef(listAllAccommodationBillingLineItemsVars);
// Variables can be defined inline as well.
const ref = listAllAccommodationBillingLineItemsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAccommodationBillingLineItemsVariables` argument.
const ref = listAllAccommodationBillingLineItemsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllAccommodationBillingLineItemsRef(dataConnect, listAllAccommodationBillingLineItemsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.accommodationBillingLineItems);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingLineItems);
});
```

## ListAllAdvancePayments
You can execute the `ListAllAdvancePayments` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllAdvancePayments(vars?: ListAllAdvancePaymentsVariables): QueryPromise<ListAllAdvancePaymentsData, ListAllAdvancePaymentsVariables>;

interface ListAllAdvancePaymentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAdvancePaymentsVariables): QueryRef<ListAllAdvancePaymentsData, ListAllAdvancePaymentsVariables>;
}
export const listAllAdvancePaymentsRef: ListAllAdvancePaymentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllAdvancePayments(dc: DataConnect, vars?: ListAllAdvancePaymentsVariables): QueryPromise<ListAllAdvancePaymentsData, ListAllAdvancePaymentsVariables>;

interface ListAllAdvancePaymentsRef {
  ...
  (dc: DataConnect, vars?: ListAllAdvancePaymentsVariables): QueryRef<ListAllAdvancePaymentsData, ListAllAdvancePaymentsVariables>;
}
export const listAllAdvancePaymentsRef: ListAllAdvancePaymentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllAdvancePaymentsRef:
```typescript
const name = listAllAdvancePaymentsRef.operationName;
console.log(name);
```

### Variables
The `ListAllAdvancePayments` query has an optional argument of type `ListAllAdvancePaymentsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllAdvancePaymentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllAdvancePayments` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllAdvancePaymentsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllAdvancePaymentsData {
  advancePayments: ({
    id: string;
  } & AdvancePayment_Key)[];
}
```
### Using `ListAllAdvancePayments`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllAdvancePayments, ListAllAdvancePaymentsVariables } from '@dataconnect/generated';

// The `ListAllAdvancePayments` query has an optional argument of type `ListAllAdvancePaymentsVariables`:
const listAllAdvancePaymentsVars: ListAllAdvancePaymentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAdvancePayments()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllAdvancePayments(listAllAdvancePaymentsVars);
// Variables can be defined inline as well.
const { data } = await listAllAdvancePayments({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAdvancePaymentsVariables` argument.
const { data } = await listAllAdvancePayments();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllAdvancePayments(dataConnect, listAllAdvancePaymentsVars);

console.log(data.advancePayments);

// Or, you can use the `Promise` API.
listAllAdvancePayments(listAllAdvancePaymentsVars).then((response) => {
  const data = response.data;
  console.log(data.advancePayments);
});
```

### Using `ListAllAdvancePayments`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllAdvancePaymentsRef, ListAllAdvancePaymentsVariables } from '@dataconnect/generated';

// The `ListAllAdvancePayments` query has an optional argument of type `ListAllAdvancePaymentsVariables`:
const listAllAdvancePaymentsVars: ListAllAdvancePaymentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllAdvancePaymentsRef()` function to get a reference to the query.
const ref = listAllAdvancePaymentsRef(listAllAdvancePaymentsVars);
// Variables can be defined inline as well.
const ref = listAllAdvancePaymentsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllAdvancePaymentsVariables` argument.
const ref = listAllAdvancePaymentsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllAdvancePaymentsRef(dataConnect, listAllAdvancePaymentsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.advancePayments);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.advancePayments);
});
```

## ListAllSmartMemoCategories
You can execute the `ListAllSmartMemoCategories` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllSmartMemoCategories(vars?: ListAllSmartMemoCategoriesVariables): QueryPromise<ListAllSmartMemoCategoriesData, ListAllSmartMemoCategoriesVariables>;

interface ListAllSmartMemoCategoriesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSmartMemoCategoriesVariables): QueryRef<ListAllSmartMemoCategoriesData, ListAllSmartMemoCategoriesVariables>;
}
export const listAllSmartMemoCategoriesRef: ListAllSmartMemoCategoriesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllSmartMemoCategories(dc: DataConnect, vars?: ListAllSmartMemoCategoriesVariables): QueryPromise<ListAllSmartMemoCategoriesData, ListAllSmartMemoCategoriesVariables>;

interface ListAllSmartMemoCategoriesRef {
  ...
  (dc: DataConnect, vars?: ListAllSmartMemoCategoriesVariables): QueryRef<ListAllSmartMemoCategoriesData, ListAllSmartMemoCategoriesVariables>;
}
export const listAllSmartMemoCategoriesRef: ListAllSmartMemoCategoriesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllSmartMemoCategoriesRef:
```typescript
const name = listAllSmartMemoCategoriesRef.operationName;
console.log(name);
```

### Variables
The `ListAllSmartMemoCategories` query has an optional argument of type `ListAllSmartMemoCategoriesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllSmartMemoCategoriesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllSmartMemoCategories` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllSmartMemoCategoriesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllSmartMemoCategoriesData {
  smartMemoCategories: ({
    id: UUIDString;
  } & SmartMemoCategory_Key)[];
}
```
### Using `ListAllSmartMemoCategories`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllSmartMemoCategories, ListAllSmartMemoCategoriesVariables } from '@dataconnect/generated';

// The `ListAllSmartMemoCategories` query has an optional argument of type `ListAllSmartMemoCategoriesVariables`:
const listAllSmartMemoCategoriesVars: ListAllSmartMemoCategoriesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSmartMemoCategories()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllSmartMemoCategories(listAllSmartMemoCategoriesVars);
// Variables can be defined inline as well.
const { data } = await listAllSmartMemoCategories({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSmartMemoCategoriesVariables` argument.
const { data } = await listAllSmartMemoCategories();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllSmartMemoCategories(dataConnect, listAllSmartMemoCategoriesVars);

console.log(data.smartMemoCategories);

// Or, you can use the `Promise` API.
listAllSmartMemoCategories(listAllSmartMemoCategoriesVars).then((response) => {
  const data = response.data;
  console.log(data.smartMemoCategories);
});
```

### Using `ListAllSmartMemoCategories`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllSmartMemoCategoriesRef, ListAllSmartMemoCategoriesVariables } from '@dataconnect/generated';

// The `ListAllSmartMemoCategories` query has an optional argument of type `ListAllSmartMemoCategoriesVariables`:
const listAllSmartMemoCategoriesVars: ListAllSmartMemoCategoriesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSmartMemoCategoriesRef()` function to get a reference to the query.
const ref = listAllSmartMemoCategoriesRef(listAllSmartMemoCategoriesVars);
// Variables can be defined inline as well.
const ref = listAllSmartMemoCategoriesRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSmartMemoCategoriesVariables` argument.
const ref = listAllSmartMemoCategoriesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllSmartMemoCategoriesRef(dataConnect, listAllSmartMemoCategoriesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.smartMemoCategories);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.smartMemoCategories);
});
```

## ListAllSmartMemos
You can execute the `ListAllSmartMemos` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllSmartMemos(vars?: ListAllSmartMemosVariables): QueryPromise<ListAllSmartMemosData, ListAllSmartMemosVariables>;

interface ListAllSmartMemosRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSmartMemosVariables): QueryRef<ListAllSmartMemosData, ListAllSmartMemosVariables>;
}
export const listAllSmartMemosRef: ListAllSmartMemosRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllSmartMemos(dc: DataConnect, vars?: ListAllSmartMemosVariables): QueryPromise<ListAllSmartMemosData, ListAllSmartMemosVariables>;

interface ListAllSmartMemosRef {
  ...
  (dc: DataConnect, vars?: ListAllSmartMemosVariables): QueryRef<ListAllSmartMemosData, ListAllSmartMemosVariables>;
}
export const listAllSmartMemosRef: ListAllSmartMemosRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllSmartMemosRef:
```typescript
const name = listAllSmartMemosRef.operationName;
console.log(name);
```

### Variables
The `ListAllSmartMemos` query has an optional argument of type `ListAllSmartMemosVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllSmartMemosVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllSmartMemos` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllSmartMemosData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllSmartMemosData {
  smartMemos: ({
    id: UUIDString;
  } & SmartMemo_Key)[];
}
```
### Using `ListAllSmartMemos`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllSmartMemos, ListAllSmartMemosVariables } from '@dataconnect/generated';

// The `ListAllSmartMemos` query has an optional argument of type `ListAllSmartMemosVariables`:
const listAllSmartMemosVars: ListAllSmartMemosVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSmartMemos()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllSmartMemos(listAllSmartMemosVars);
// Variables can be defined inline as well.
const { data } = await listAllSmartMemos({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSmartMemosVariables` argument.
const { data } = await listAllSmartMemos();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllSmartMemos(dataConnect, listAllSmartMemosVars);

console.log(data.smartMemos);

// Or, you can use the `Promise` API.
listAllSmartMemos(listAllSmartMemosVars).then((response) => {
  const data = response.data;
  console.log(data.smartMemos);
});
```

### Using `ListAllSmartMemos`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllSmartMemosRef, ListAllSmartMemosVariables } from '@dataconnect/generated';

// The `ListAllSmartMemos` query has an optional argument of type `ListAllSmartMemosVariables`:
const listAllSmartMemosVars: ListAllSmartMemosVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllSmartMemosRef()` function to get a reference to the query.
const ref = listAllSmartMemosRef(listAllSmartMemosVars);
// Variables can be defined inline as well.
const ref = listAllSmartMemosRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllSmartMemosVariables` argument.
const ref = listAllSmartMemosRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllSmartMemosRef(dataConnect, listAllSmartMemosVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.smartMemos);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.smartMemos);
});
```

## ListAllVehicles
You can execute the `ListAllVehicles` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllVehicles(vars?: ListAllVehiclesVariables): QueryPromise<ListAllVehiclesData, ListAllVehiclesVariables>;

interface ListAllVehiclesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllVehiclesVariables): QueryRef<ListAllVehiclesData, ListAllVehiclesVariables>;
}
export const listAllVehiclesRef: ListAllVehiclesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllVehicles(dc: DataConnect, vars?: ListAllVehiclesVariables): QueryPromise<ListAllVehiclesData, ListAllVehiclesVariables>;

interface ListAllVehiclesRef {
  ...
  (dc: DataConnect, vars?: ListAllVehiclesVariables): QueryRef<ListAllVehiclesData, ListAllVehiclesVariables>;
}
export const listAllVehiclesRef: ListAllVehiclesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllVehiclesRef:
```typescript
const name = listAllVehiclesRef.operationName;
console.log(name);
```

### Variables
The `ListAllVehicles` query has an optional argument of type `ListAllVehiclesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllVehiclesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllVehicles` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllVehiclesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllVehiclesData {
  vehicles: ({
    id: UUIDString;
  } & Vehicle_Key)[];
}
```
### Using `ListAllVehicles`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllVehicles, ListAllVehiclesVariables } from '@dataconnect/generated';

// The `ListAllVehicles` query has an optional argument of type `ListAllVehiclesVariables`:
const listAllVehiclesVars: ListAllVehiclesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllVehicles()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllVehicles(listAllVehiclesVars);
// Variables can be defined inline as well.
const { data } = await listAllVehicles({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllVehiclesVariables` argument.
const { data } = await listAllVehicles();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllVehicles(dataConnect, listAllVehiclesVars);

console.log(data.vehicles);

// Or, you can use the `Promise` API.
listAllVehicles(listAllVehiclesVars).then((response) => {
  const data = response.data;
  console.log(data.vehicles);
});
```

### Using `ListAllVehicles`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllVehiclesRef, ListAllVehiclesVariables } from '@dataconnect/generated';

// The `ListAllVehicles` query has an optional argument of type `ListAllVehiclesVariables`:
const listAllVehiclesVars: ListAllVehiclesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllVehiclesRef()` function to get a reference to the query.
const ref = listAllVehiclesRef(listAllVehiclesVars);
// Variables can be defined inline as well.
const ref = listAllVehiclesRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllVehiclesVariables` argument.
const ref = listAllVehiclesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllVehiclesRef(dataConnect, listAllVehiclesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.vehicles);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicles);
});
```

## ListAllVehicleAssignments
You can execute the `ListAllVehicleAssignments` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllVehicleAssignments(vars?: ListAllVehicleAssignmentsVariables): QueryPromise<ListAllVehicleAssignmentsData, ListAllVehicleAssignmentsVariables>;

interface ListAllVehicleAssignmentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllVehicleAssignmentsVariables): QueryRef<ListAllVehicleAssignmentsData, ListAllVehicleAssignmentsVariables>;
}
export const listAllVehicleAssignmentsRef: ListAllVehicleAssignmentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllVehicleAssignments(dc: DataConnect, vars?: ListAllVehicleAssignmentsVariables): QueryPromise<ListAllVehicleAssignmentsData, ListAllVehicleAssignmentsVariables>;

interface ListAllVehicleAssignmentsRef {
  ...
  (dc: DataConnect, vars?: ListAllVehicleAssignmentsVariables): QueryRef<ListAllVehicleAssignmentsData, ListAllVehicleAssignmentsVariables>;
}
export const listAllVehicleAssignmentsRef: ListAllVehicleAssignmentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllVehicleAssignmentsRef:
```typescript
const name = listAllVehicleAssignmentsRef.operationName;
console.log(name);
```

### Variables
The `ListAllVehicleAssignments` query has an optional argument of type `ListAllVehicleAssignmentsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllVehicleAssignmentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllVehicleAssignments` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllVehicleAssignmentsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllVehicleAssignmentsData {
  vehicleAssignments: ({
    id: UUIDString;
  } & VehicleAssignment_Key)[];
}
```
### Using `ListAllVehicleAssignments`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllVehicleAssignments, ListAllVehicleAssignmentsVariables } from '@dataconnect/generated';

// The `ListAllVehicleAssignments` query has an optional argument of type `ListAllVehicleAssignmentsVariables`:
const listAllVehicleAssignmentsVars: ListAllVehicleAssignmentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllVehicleAssignments()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllVehicleAssignments(listAllVehicleAssignmentsVars);
// Variables can be defined inline as well.
const { data } = await listAllVehicleAssignments({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllVehicleAssignmentsVariables` argument.
const { data } = await listAllVehicleAssignments();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllVehicleAssignments(dataConnect, listAllVehicleAssignmentsVars);

console.log(data.vehicleAssignments);

// Or, you can use the `Promise` API.
listAllVehicleAssignments(listAllVehicleAssignmentsVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleAssignments);
});
```

### Using `ListAllVehicleAssignments`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllVehicleAssignmentsRef, ListAllVehicleAssignmentsVariables } from '@dataconnect/generated';

// The `ListAllVehicleAssignments` query has an optional argument of type `ListAllVehicleAssignmentsVariables`:
const listAllVehicleAssignmentsVars: ListAllVehicleAssignmentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllVehicleAssignmentsRef()` function to get a reference to the query.
const ref = listAllVehicleAssignmentsRef(listAllVehicleAssignmentsVars);
// Variables can be defined inline as well.
const ref = listAllVehicleAssignmentsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllVehicleAssignmentsVariables` argument.
const ref = listAllVehicleAssignmentsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllVehicleAssignmentsRef(dataConnect, listAllVehicleAssignmentsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.vehicleAssignments);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleAssignments);
});
```

## ListAllVehicleExpenses
You can execute the `ListAllVehicleExpenses` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllVehicleExpenses(vars?: ListAllVehicleExpensesVariables): QueryPromise<ListAllVehicleExpensesData, ListAllVehicleExpensesVariables>;

interface ListAllVehicleExpensesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllVehicleExpensesVariables): QueryRef<ListAllVehicleExpensesData, ListAllVehicleExpensesVariables>;
}
export const listAllVehicleExpensesRef: ListAllVehicleExpensesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllVehicleExpenses(dc: DataConnect, vars?: ListAllVehicleExpensesVariables): QueryPromise<ListAllVehicleExpensesData, ListAllVehicleExpensesVariables>;

interface ListAllVehicleExpensesRef {
  ...
  (dc: DataConnect, vars?: ListAllVehicleExpensesVariables): QueryRef<ListAllVehicleExpensesData, ListAllVehicleExpensesVariables>;
}
export const listAllVehicleExpensesRef: ListAllVehicleExpensesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllVehicleExpensesRef:
```typescript
const name = listAllVehicleExpensesRef.operationName;
console.log(name);
```

### Variables
The `ListAllVehicleExpenses` query has an optional argument of type `ListAllVehicleExpensesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllVehicleExpensesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllVehicleExpenses` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllVehicleExpensesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllVehicleExpensesData {
  vehicleExpenses: ({
    id: UUIDString;
  } & VehicleExpense_Key)[];
}
```
### Using `ListAllVehicleExpenses`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllVehicleExpenses, ListAllVehicleExpensesVariables } from '@dataconnect/generated';

// The `ListAllVehicleExpenses` query has an optional argument of type `ListAllVehicleExpensesVariables`:
const listAllVehicleExpensesVars: ListAllVehicleExpensesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllVehicleExpenses()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllVehicleExpenses(listAllVehicleExpensesVars);
// Variables can be defined inline as well.
const { data } = await listAllVehicleExpenses({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllVehicleExpensesVariables` argument.
const { data } = await listAllVehicleExpenses();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllVehicleExpenses(dataConnect, listAllVehicleExpensesVars);

console.log(data.vehicleExpenses);

// Or, you can use the `Promise` API.
listAllVehicleExpenses(listAllVehicleExpensesVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleExpenses);
});
```

### Using `ListAllVehicleExpenses`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllVehicleExpensesRef, ListAllVehicleExpensesVariables } from '@dataconnect/generated';

// The `ListAllVehicleExpenses` query has an optional argument of type `ListAllVehicleExpensesVariables`:
const listAllVehicleExpensesVars: ListAllVehicleExpensesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllVehicleExpensesRef()` function to get a reference to the query.
const ref = listAllVehicleExpensesRef(listAllVehicleExpensesVars);
// Variables can be defined inline as well.
const ref = listAllVehicleExpensesRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllVehicleExpensesVariables` argument.
const ref = listAllVehicleExpensesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllVehicleExpensesRef(dataConnect, listAllVehicleExpensesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.vehicleExpenses);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleExpenses);
});
```

## ListAllVehicleBillingDocuments
You can execute the `ListAllVehicleBillingDocuments` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllVehicleBillingDocuments(vars?: ListAllVehicleBillingDocumentsVariables): QueryPromise<ListAllVehicleBillingDocumentsData, ListAllVehicleBillingDocumentsVariables>;

interface ListAllVehicleBillingDocumentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllVehicleBillingDocumentsVariables): QueryRef<ListAllVehicleBillingDocumentsData, ListAllVehicleBillingDocumentsVariables>;
}
export const listAllVehicleBillingDocumentsRef: ListAllVehicleBillingDocumentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllVehicleBillingDocuments(dc: DataConnect, vars?: ListAllVehicleBillingDocumentsVariables): QueryPromise<ListAllVehicleBillingDocumentsData, ListAllVehicleBillingDocumentsVariables>;

interface ListAllVehicleBillingDocumentsRef {
  ...
  (dc: DataConnect, vars?: ListAllVehicleBillingDocumentsVariables): QueryRef<ListAllVehicleBillingDocumentsData, ListAllVehicleBillingDocumentsVariables>;
}
export const listAllVehicleBillingDocumentsRef: ListAllVehicleBillingDocumentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllVehicleBillingDocumentsRef:
```typescript
const name = listAllVehicleBillingDocumentsRef.operationName;
console.log(name);
```

### Variables
The `ListAllVehicleBillingDocuments` query has an optional argument of type `ListAllVehicleBillingDocumentsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllVehicleBillingDocumentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllVehicleBillingDocuments` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllVehicleBillingDocumentsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllVehicleBillingDocumentsData {
  vehicleBillingDocuments: ({
    id: UUIDString;
  } & VehicleBillingDocument_Key)[];
}
```
### Using `ListAllVehicleBillingDocuments`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllVehicleBillingDocuments, ListAllVehicleBillingDocumentsVariables } from '@dataconnect/generated';

// The `ListAllVehicleBillingDocuments` query has an optional argument of type `ListAllVehicleBillingDocumentsVariables`:
const listAllVehicleBillingDocumentsVars: ListAllVehicleBillingDocumentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllVehicleBillingDocuments()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllVehicleBillingDocuments(listAllVehicleBillingDocumentsVars);
// Variables can be defined inline as well.
const { data } = await listAllVehicleBillingDocuments({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllVehicleBillingDocumentsVariables` argument.
const { data } = await listAllVehicleBillingDocuments();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllVehicleBillingDocuments(dataConnect, listAllVehicleBillingDocumentsVars);

console.log(data.vehicleBillingDocuments);

// Or, you can use the `Promise` API.
listAllVehicleBillingDocuments(listAllVehicleBillingDocumentsVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleBillingDocuments);
});
```

### Using `ListAllVehicleBillingDocuments`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllVehicleBillingDocumentsRef, ListAllVehicleBillingDocumentsVariables } from '@dataconnect/generated';

// The `ListAllVehicleBillingDocuments` query has an optional argument of type `ListAllVehicleBillingDocumentsVariables`:
const listAllVehicleBillingDocumentsVars: ListAllVehicleBillingDocumentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllVehicleBillingDocumentsRef()` function to get a reference to the query.
const ref = listAllVehicleBillingDocumentsRef(listAllVehicleBillingDocumentsVars);
// Variables can be defined inline as well.
const ref = listAllVehicleBillingDocumentsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllVehicleBillingDocumentsVariables` argument.
const ref = listAllVehicleBillingDocumentsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllVehicleBillingDocumentsRef(dataConnect, listAllVehicleBillingDocumentsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.vehicleBillingDocuments);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleBillingDocuments);
});
```

## ListAllDailyDispatches
You can execute the `ListAllDailyDispatches` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllDailyDispatches(vars?: ListAllDailyDispatchesVariables): QueryPromise<ListAllDailyDispatchesData, ListAllDailyDispatchesVariables>;

interface ListAllDailyDispatchesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllDailyDispatchesVariables): QueryRef<ListAllDailyDispatchesData, ListAllDailyDispatchesVariables>;
}
export const listAllDailyDispatchesRef: ListAllDailyDispatchesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllDailyDispatches(dc: DataConnect, vars?: ListAllDailyDispatchesVariables): QueryPromise<ListAllDailyDispatchesData, ListAllDailyDispatchesVariables>;

interface ListAllDailyDispatchesRef {
  ...
  (dc: DataConnect, vars?: ListAllDailyDispatchesVariables): QueryRef<ListAllDailyDispatchesData, ListAllDailyDispatchesVariables>;
}
export const listAllDailyDispatchesRef: ListAllDailyDispatchesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllDailyDispatchesRef:
```typescript
const name = listAllDailyDispatchesRef.operationName;
console.log(name);
```

### Variables
The `ListAllDailyDispatches` query has an optional argument of type `ListAllDailyDispatchesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllDailyDispatchesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllDailyDispatches` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllDailyDispatchesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllDailyDispatchesData {
  dailyDispatches: ({
    id: UUIDString;
  } & DailyDispatch_Key)[];
}
```
### Using `ListAllDailyDispatches`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllDailyDispatches, ListAllDailyDispatchesVariables } from '@dataconnect/generated';

// The `ListAllDailyDispatches` query has an optional argument of type `ListAllDailyDispatchesVariables`:
const listAllDailyDispatchesVars: ListAllDailyDispatchesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllDailyDispatches()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllDailyDispatches(listAllDailyDispatchesVars);
// Variables can be defined inline as well.
const { data } = await listAllDailyDispatches({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllDailyDispatchesVariables` argument.
const { data } = await listAllDailyDispatches();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllDailyDispatches(dataConnect, listAllDailyDispatchesVars);

console.log(data.dailyDispatches);

// Or, you can use the `Promise` API.
listAllDailyDispatches(listAllDailyDispatchesVars).then((response) => {
  const data = response.data;
  console.log(data.dailyDispatches);
});
```

### Using `ListAllDailyDispatches`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllDailyDispatchesRef, ListAllDailyDispatchesVariables } from '@dataconnect/generated';

// The `ListAllDailyDispatches` query has an optional argument of type `ListAllDailyDispatchesVariables`:
const listAllDailyDispatchesVars: ListAllDailyDispatchesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllDailyDispatchesRef()` function to get a reference to the query.
const ref = listAllDailyDispatchesRef(listAllDailyDispatchesVars);
// Variables can be defined inline as well.
const ref = listAllDailyDispatchesRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllDailyDispatchesVariables` argument.
const ref = listAllDailyDispatchesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllDailyDispatchesRef(dataConnect, listAllDailyDispatchesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.dailyDispatches);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyDispatches);
});
```

## ListAllPayments
You can execute the `ListAllPayments` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllPayments(vars?: ListAllPaymentsVariables): QueryPromise<ListAllPaymentsData, ListAllPaymentsVariables>;

interface ListAllPaymentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllPaymentsVariables): QueryRef<ListAllPaymentsData, ListAllPaymentsVariables>;
}
export const listAllPaymentsRef: ListAllPaymentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllPayments(dc: DataConnect, vars?: ListAllPaymentsVariables): QueryPromise<ListAllPaymentsData, ListAllPaymentsVariables>;

interface ListAllPaymentsRef {
  ...
  (dc: DataConnect, vars?: ListAllPaymentsVariables): QueryRef<ListAllPaymentsData, ListAllPaymentsVariables>;
}
export const listAllPaymentsRef: ListAllPaymentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllPaymentsRef:
```typescript
const name = listAllPaymentsRef.operationName;
console.log(name);
```

### Variables
The `ListAllPayments` query has an optional argument of type `ListAllPaymentsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllPaymentsVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllPayments` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllPaymentsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllPaymentsData {
  payments: ({
    id: UUIDString;
  } & Payment_Key)[];
}
```
### Using `ListAllPayments`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllPayments, ListAllPaymentsVariables } from '@dataconnect/generated';

// The `ListAllPayments` query has an optional argument of type `ListAllPaymentsVariables`:
const listAllPaymentsVars: ListAllPaymentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllPayments()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllPayments(listAllPaymentsVars);
// Variables can be defined inline as well.
const { data } = await listAllPayments({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllPaymentsVariables` argument.
const { data } = await listAllPayments();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllPayments(dataConnect, listAllPaymentsVars);

console.log(data.payments);

// Or, you can use the `Promise` API.
listAllPayments(listAllPaymentsVars).then((response) => {
  const data = response.data;
  console.log(data.payments);
});
```

### Using `ListAllPayments`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllPaymentsRef, ListAllPaymentsVariables } from '@dataconnect/generated';

// The `ListAllPayments` query has an optional argument of type `ListAllPaymentsVariables`:
const listAllPaymentsVars: ListAllPaymentsVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllPaymentsRef()` function to get a reference to the query.
const ref = listAllPaymentsRef(listAllPaymentsVars);
// Variables can be defined inline as well.
const ref = listAllPaymentsRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllPaymentsVariables` argument.
const ref = listAllPaymentsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllPaymentsRef(dataConnect, listAllPaymentsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.payments);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.payments);
});
```

## ListAllTaxInvoices
You can execute the `ListAllTaxInvoices` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllTaxInvoices(vars?: ListAllTaxInvoicesVariables): QueryPromise<ListAllTaxInvoicesData, ListAllTaxInvoicesVariables>;

interface ListAllTaxInvoicesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllTaxInvoicesVariables): QueryRef<ListAllTaxInvoicesData, ListAllTaxInvoicesVariables>;
}
export const listAllTaxInvoicesRef: ListAllTaxInvoicesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllTaxInvoices(dc: DataConnect, vars?: ListAllTaxInvoicesVariables): QueryPromise<ListAllTaxInvoicesData, ListAllTaxInvoicesVariables>;

interface ListAllTaxInvoicesRef {
  ...
  (dc: DataConnect, vars?: ListAllTaxInvoicesVariables): QueryRef<ListAllTaxInvoicesData, ListAllTaxInvoicesVariables>;
}
export const listAllTaxInvoicesRef: ListAllTaxInvoicesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllTaxInvoicesRef:
```typescript
const name = listAllTaxInvoicesRef.operationName;
console.log(name);
```

### Variables
The `ListAllTaxInvoices` query has an optional argument of type `ListAllTaxInvoicesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllTaxInvoicesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllTaxInvoices` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllTaxInvoicesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllTaxInvoicesData {
  taxInvoices: ({
    id: UUIDString;
  } & TaxInvoice_Key)[];
}
```
### Using `ListAllTaxInvoices`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllTaxInvoices, ListAllTaxInvoicesVariables } from '@dataconnect/generated';

// The `ListAllTaxInvoices` query has an optional argument of type `ListAllTaxInvoicesVariables`:
const listAllTaxInvoicesVars: ListAllTaxInvoicesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllTaxInvoices()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllTaxInvoices(listAllTaxInvoicesVars);
// Variables can be defined inline as well.
const { data } = await listAllTaxInvoices({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllTaxInvoicesVariables` argument.
const { data } = await listAllTaxInvoices();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllTaxInvoices(dataConnect, listAllTaxInvoicesVars);

console.log(data.taxInvoices);

// Or, you can use the `Promise` API.
listAllTaxInvoices(listAllTaxInvoicesVars).then((response) => {
  const data = response.data;
  console.log(data.taxInvoices);
});
```

### Using `ListAllTaxInvoices`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllTaxInvoicesRef, ListAllTaxInvoicesVariables } from '@dataconnect/generated';

// The `ListAllTaxInvoices` query has an optional argument of type `ListAllTaxInvoicesVariables`:
const listAllTaxInvoicesVars: ListAllTaxInvoicesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllTaxInvoicesRef()` function to get a reference to the query.
const ref = listAllTaxInvoicesRef(listAllTaxInvoicesVars);
// Variables can be defined inline as well.
const ref = listAllTaxInvoicesRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllTaxInvoicesVariables` argument.
const ref = listAllTaxInvoicesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllTaxInvoicesRef(dataConnect, listAllTaxInvoicesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.taxInvoices);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.taxInvoices);
});
```

## ListAllReceivables
You can execute the `ListAllReceivables` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllReceivables(vars?: ListAllReceivablesVariables): QueryPromise<ListAllReceivablesData, ListAllReceivablesVariables>;

interface ListAllReceivablesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllReceivablesVariables): QueryRef<ListAllReceivablesData, ListAllReceivablesVariables>;
}
export const listAllReceivablesRef: ListAllReceivablesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllReceivables(dc: DataConnect, vars?: ListAllReceivablesVariables): QueryPromise<ListAllReceivablesData, ListAllReceivablesVariables>;

interface ListAllReceivablesRef {
  ...
  (dc: DataConnect, vars?: ListAllReceivablesVariables): QueryRef<ListAllReceivablesData, ListAllReceivablesVariables>;
}
export const listAllReceivablesRef: ListAllReceivablesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllReceivablesRef:
```typescript
const name = listAllReceivablesRef.operationName;
console.log(name);
```

### Variables
The `ListAllReceivables` query has an optional argument of type `ListAllReceivablesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListAllReceivablesVariables {
  limit?: number | null;
  offset?: number | null;
}
```
### Return Type
Recall that executing the `ListAllReceivables` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllReceivablesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllReceivablesData {
  receivables: ({
    id: UUIDString;
  } & Receivable_Key)[];
}
```
### Using `ListAllReceivables`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllReceivables, ListAllReceivablesVariables } from '@dataconnect/generated';

// The `ListAllReceivables` query has an optional argument of type `ListAllReceivablesVariables`:
const listAllReceivablesVars: ListAllReceivablesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllReceivables()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllReceivables(listAllReceivablesVars);
// Variables can be defined inline as well.
const { data } = await listAllReceivables({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllReceivablesVariables` argument.
const { data } = await listAllReceivables();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllReceivables(dataConnect, listAllReceivablesVars);

console.log(data.receivables);

// Or, you can use the `Promise` API.
listAllReceivables(listAllReceivablesVars).then((response) => {
  const data = response.data;
  console.log(data.receivables);
});
```

### Using `ListAllReceivables`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllReceivablesRef, ListAllReceivablesVariables } from '@dataconnect/generated';

// The `ListAllReceivables` query has an optional argument of type `ListAllReceivablesVariables`:
const listAllReceivablesVars: ListAllReceivablesVariables = {
  limit: ..., // optional
  offset: ..., // optional
};

// Call the `listAllReceivablesRef()` function to get a reference to the query.
const ref = listAllReceivablesRef(listAllReceivablesVars);
// Variables can be defined inline as well.
const ref = listAllReceivablesRef({ limit: ..., offset: ..., });
// Since all variables are optional for this query, you can omit the `ListAllReceivablesVariables` argument.
const ref = listAllReceivablesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllReceivablesRef(dataConnect, listAllReceivablesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.receivables);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.receivables);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateCompany
You can execute the `CreateCompany` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createCompany(vars: CreateCompanyVariables): MutationPromise<CreateCompanyData, CreateCompanyVariables>;

interface CreateCompanyRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCompanyVariables): MutationRef<CreateCompanyData, CreateCompanyVariables>;
}
export const createCompanyRef: CreateCompanyRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createCompany(dc: DataConnect, vars: CreateCompanyVariables): MutationPromise<CreateCompanyData, CreateCompanyVariables>;

interface CreateCompanyRef {
  ...
  (dc: DataConnect, vars: CreateCompanyVariables): MutationRef<CreateCompanyData, CreateCompanyVariables>;
}
export const createCompanyRef: CreateCompanyRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createCompanyRef:
```typescript
const name = createCompanyRef.operationName;
console.log(name);
```

### Variables
The `CreateCompany` mutation requires an argument of type `CreateCompanyVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateCompany` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateCompanyData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateCompanyData {
  company_insert: Company_Key;
}
```
### Using `CreateCompany`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createCompany, CreateCompanyVariables } from '@dataconnect/generated';

// The `CreateCompany` mutation requires an argument of type `CreateCompanyVariables`:
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

// Call the `createCompany()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createCompany(createCompanyVars);
// Variables can be defined inline as well.
const { data } = await createCompany({ name: ..., code: ..., legacyId: ..., businessNumber: ..., ceoName: ..., type: ..., status: ..., address: ..., phone: ..., email: ..., bankName: ..., accountNumber: ..., accountHolder: ..., ceoResidentNumber: ..., color: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createCompany(dataConnect, createCompanyVars);

console.log(data.company_insert);

// Or, you can use the `Promise` API.
createCompany(createCompanyVars).then((response) => {
  const data = response.data;
  console.log(data.company_insert);
});
```

### Using `CreateCompany`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createCompanyRef, CreateCompanyVariables } from '@dataconnect/generated';

// The `CreateCompany` mutation requires an argument of type `CreateCompanyVariables`:
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

// Call the `createCompanyRef()` function to get a reference to the mutation.
const ref = createCompanyRef(createCompanyVars);
// Variables can be defined inline as well.
const ref = createCompanyRef({ name: ..., code: ..., legacyId: ..., businessNumber: ..., ceoName: ..., type: ..., status: ..., address: ..., phone: ..., email: ..., bankName: ..., accountNumber: ..., accountHolder: ..., ceoResidentNumber: ..., color: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createCompanyRef(dataConnect, createCompanyVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.company_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.company_insert);
});
```

## CreateTeam
You can execute the `CreateTeam` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createTeam(vars: CreateTeamVariables): MutationPromise<CreateTeamData, CreateTeamVariables>;

interface CreateTeamRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateTeamVariables): MutationRef<CreateTeamData, CreateTeamVariables>;
}
export const createTeamRef: CreateTeamRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createTeam(dc: DataConnect, vars: CreateTeamVariables): MutationPromise<CreateTeamData, CreateTeamVariables>;

interface CreateTeamRef {
  ...
  (dc: DataConnect, vars: CreateTeamVariables): MutationRef<CreateTeamData, CreateTeamVariables>;
}
export const createTeamRef: CreateTeamRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createTeamRef:
```typescript
const name = createTeamRef.operationName;
console.log(name);
```

### Variables
The `CreateTeam` mutation requires an argument of type `CreateTeamVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateTeam` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateTeamData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateTeamData {
  team_insert: Team_Key;
}
```
### Using `CreateTeam`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createTeam, CreateTeamVariables } from '@dataconnect/generated';

// The `CreateTeam` mutation requires an argument of type `CreateTeamVariables`:
const createTeamVars: CreateTeamVariables = {
  name: ..., 
  legacyId: ..., // optional
  companyId: ..., // optional
  leaderId: ..., // optional
  type: ..., // optional
  status: ..., // optional
  totalManDay: ..., // optional
};

// Call the `createTeam()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createTeam(createTeamVars);
// Variables can be defined inline as well.
const { data } = await createTeam({ name: ..., legacyId: ..., companyId: ..., leaderId: ..., type: ..., status: ..., totalManDay: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createTeam(dataConnect, createTeamVars);

console.log(data.team_insert);

// Or, you can use the `Promise` API.
createTeam(createTeamVars).then((response) => {
  const data = response.data;
  console.log(data.team_insert);
});
```

### Using `CreateTeam`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createTeamRef, CreateTeamVariables } from '@dataconnect/generated';

// The `CreateTeam` mutation requires an argument of type `CreateTeamVariables`:
const createTeamVars: CreateTeamVariables = {
  name: ..., 
  legacyId: ..., // optional
  companyId: ..., // optional
  leaderId: ..., // optional
  type: ..., // optional
  status: ..., // optional
  totalManDay: ..., // optional
};

// Call the `createTeamRef()` function to get a reference to the mutation.
const ref = createTeamRef(createTeamVars);
// Variables can be defined inline as well.
const ref = createTeamRef({ name: ..., legacyId: ..., companyId: ..., leaderId: ..., type: ..., status: ..., totalManDay: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createTeamRef(dataConnect, createTeamVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.team_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.team_insert);
});
```

## CreateWorker
You can execute the `CreateWorker` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createWorker(vars: CreateWorkerVariables): MutationPromise<CreateWorkerData, CreateWorkerVariables>;

interface CreateWorkerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateWorkerVariables): MutationRef<CreateWorkerData, CreateWorkerVariables>;
}
export const createWorkerRef: CreateWorkerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createWorker(dc: DataConnect, vars: CreateWorkerVariables): MutationPromise<CreateWorkerData, CreateWorkerVariables>;

interface CreateWorkerRef {
  ...
  (dc: DataConnect, vars: CreateWorkerVariables): MutationRef<CreateWorkerData, CreateWorkerVariables>;
}
export const createWorkerRef: CreateWorkerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createWorkerRef:
```typescript
const name = createWorkerRef.operationName;
console.log(name);
```

### Variables
The `CreateWorker` mutation requires an argument of type `CreateWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateWorker` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateWorkerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateWorkerData {
  worker_insert: Worker_Key;
}
```
### Using `CreateWorker`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createWorker, CreateWorkerVariables } from '@dataconnect/generated';

// The `CreateWorker` mutation requires an argument of type `CreateWorkerVariables`:
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

// Call the `createWorker()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createWorker(createWorkerVars);
// Variables can be defined inline as well.
const { data } = await createWorker({ name: ..., legacyId: ..., teamId: ..., role: ..., payType: ..., unitPrice: ..., residentNumber: ..., phone: ..., address: ..., bankAccount: ..., bankName: ..., isActive: ..., joinDate: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createWorker(dataConnect, createWorkerVars);

console.log(data.worker_insert);

// Or, you can use the `Promise` API.
createWorker(createWorkerVars).then((response) => {
  const data = response.data;
  console.log(data.worker_insert);
});
```

### Using `CreateWorker`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createWorkerRef, CreateWorkerVariables } from '@dataconnect/generated';

// The `CreateWorker` mutation requires an argument of type `CreateWorkerVariables`:
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

// Call the `createWorkerRef()` function to get a reference to the mutation.
const ref = createWorkerRef(createWorkerVars);
// Variables can be defined inline as well.
const ref = createWorkerRef({ name: ..., legacyId: ..., teamId: ..., role: ..., payType: ..., unitPrice: ..., residentNumber: ..., phone: ..., address: ..., bankAccount: ..., bankName: ..., isActive: ..., joinDate: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createWorkerRef(dataConnect, createWorkerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.worker_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.worker_insert);
});
```

## CreateSite
You can execute the `CreateSite` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createSite(vars: CreateSiteVariables): MutationPromise<CreateSiteData, CreateSiteVariables>;

interface CreateSiteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSiteVariables): MutationRef<CreateSiteData, CreateSiteVariables>;
}
export const createSiteRef: CreateSiteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createSite(dc: DataConnect, vars: CreateSiteVariables): MutationPromise<CreateSiteData, CreateSiteVariables>;

interface CreateSiteRef {
  ...
  (dc: DataConnect, vars: CreateSiteVariables): MutationRef<CreateSiteData, CreateSiteVariables>;
}
export const createSiteRef: CreateSiteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createSiteRef:
```typescript
const name = createSiteRef.operationName;
console.log(name);
```

### Variables
The `CreateSite` mutation requires an argument of type `CreateSiteVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateSite` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateSiteData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateSiteData {
  site_insert: Site_Key;
}
```
### Using `CreateSite`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSite, CreateSiteVariables } from '@dataconnect/generated';

// The `CreateSite` mutation requires an argument of type `CreateSiteVariables`:
const createSiteVars: CreateSiteVariables = {
  name: ..., 
  legacyId: ..., // optional
  code: ..., // optional
  address: ..., // optional
  startDate: ..., // optional
  endDate: ..., // optional
  status: ..., // optional
};

// Call the `createSite()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createSite(createSiteVars);
// Variables can be defined inline as well.
const { data } = await createSite({ name: ..., legacyId: ..., code: ..., address: ..., startDate: ..., endDate: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createSite(dataConnect, createSiteVars);

console.log(data.site_insert);

// Or, you can use the `Promise` API.
createSite(createSiteVars).then((response) => {
  const data = response.data;
  console.log(data.site_insert);
});
```

### Using `CreateSite`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createSiteRef, CreateSiteVariables } from '@dataconnect/generated';

// The `CreateSite` mutation requires an argument of type `CreateSiteVariables`:
const createSiteVars: CreateSiteVariables = {
  name: ..., 
  legacyId: ..., // optional
  code: ..., // optional
  address: ..., // optional
  startDate: ..., // optional
  endDate: ..., // optional
  status: ..., // optional
};

// Call the `createSiteRef()` function to get a reference to the mutation.
const ref = createSiteRef(createSiteVars);
// Variables can be defined inline as well.
const ref = createSiteRef({ name: ..., legacyId: ..., code: ..., address: ..., startDate: ..., endDate: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createSiteRef(dataConnect, createSiteVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.site_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.site_insert);
});
```

## CreateDailyReport
You can execute the `CreateDailyReport` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createDailyReport(vars: CreateDailyReportVariables): MutationPromise<CreateDailyReportData, CreateDailyReportVariables>;

interface CreateDailyReportRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDailyReportVariables): MutationRef<CreateDailyReportData, CreateDailyReportVariables>;
}
export const createDailyReportRef: CreateDailyReportRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createDailyReport(dc: DataConnect, vars: CreateDailyReportVariables): MutationPromise<CreateDailyReportData, CreateDailyReportVariables>;

interface CreateDailyReportRef {
  ...
  (dc: DataConnect, vars: CreateDailyReportVariables): MutationRef<CreateDailyReportData, CreateDailyReportVariables>;
}
export const createDailyReportRef: CreateDailyReportRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createDailyReportRef:
```typescript
const name = createDailyReportRef.operationName;
console.log(name);
```

### Variables
The `CreateDailyReport` mutation requires an argument of type `CreateDailyReportVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateDailyReport` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateDailyReportData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateDailyReportData {
  dailyReport_insert: DailyReport_Key;
}
```
### Using `CreateDailyReport`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createDailyReport, CreateDailyReportVariables } from '@dataconnect/generated';

// The `CreateDailyReport` mutation requires an argument of type `CreateDailyReportVariables`:
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

// Call the `createDailyReport()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createDailyReport(createDailyReportVars);
// Variables can be defined inline as well.
const { data } = await createDailyReport({ date: ..., legacyId: ..., teamId: ..., siteId: ..., siteName: ..., status: ..., totalManDay: ..., totalAmount: ..., weather: ..., writerUid: ..., companyName: ..., responsibleTeamName: ..., responsibleTeamLegacyId: ..., workContent: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createDailyReport(dataConnect, createDailyReportVars);

console.log(data.dailyReport_insert);

// Or, you can use the `Promise` API.
createDailyReport(createDailyReportVars).then((response) => {
  const data = response.data;
  console.log(data.dailyReport_insert);
});
```

### Using `CreateDailyReport`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createDailyReportRef, CreateDailyReportVariables } from '@dataconnect/generated';

// The `CreateDailyReport` mutation requires an argument of type `CreateDailyReportVariables`:
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

// Call the `createDailyReportRef()` function to get a reference to the mutation.
const ref = createDailyReportRef(createDailyReportVars);
// Variables can be defined inline as well.
const ref = createDailyReportRef({ date: ..., legacyId: ..., teamId: ..., siteId: ..., siteName: ..., status: ..., totalManDay: ..., totalAmount: ..., weather: ..., writerUid: ..., companyName: ..., responsibleTeamName: ..., responsibleTeamLegacyId: ..., workContent: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createDailyReportRef(dataConnect, createDailyReportVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.dailyReport_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyReport_insert);
});
```

## CreateDailyReportWorker
You can execute the `CreateDailyReportWorker` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createDailyReportWorker(vars: CreateDailyReportWorkerVariables): MutationPromise<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;

interface CreateDailyReportWorkerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDailyReportWorkerVariables): MutationRef<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;
}
export const createDailyReportWorkerRef: CreateDailyReportWorkerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createDailyReportWorker(dc: DataConnect, vars: CreateDailyReportWorkerVariables): MutationPromise<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;

interface CreateDailyReportWorkerRef {
  ...
  (dc: DataConnect, vars: CreateDailyReportWorkerVariables): MutationRef<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;
}
export const createDailyReportWorkerRef: CreateDailyReportWorkerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createDailyReportWorkerRef:
```typescript
const name = createDailyReportWorkerRef.operationName;
console.log(name);
```

### Variables
The `CreateDailyReportWorker` mutation requires an argument of type `CreateDailyReportWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateDailyReportWorker` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateDailyReportWorkerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateDailyReportWorkerData {
  dailyReportWorker_insert: DailyReportWorker_Key;
}
```
### Using `CreateDailyReportWorker`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createDailyReportWorker, CreateDailyReportWorkerVariables } from '@dataconnect/generated';

// The `CreateDailyReportWorker` mutation requires an argument of type `CreateDailyReportWorkerVariables`:
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

// Call the `createDailyReportWorker()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createDailyReportWorker(createDailyReportWorkerVars);
// Variables can be defined inline as well.
const { data } = await createDailyReportWorker({ dailyReportId: ..., workerId: ..., gongsu: ..., unitPrice: ..., amount: ..., workDescription: ..., legacyWorkerId: ..., legacyTeamId: ..., workerName: ..., role: ..., status: ..., manDay: ..., payType: ..., salaryModel: ..., workContent: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createDailyReportWorker(dataConnect, createDailyReportWorkerVars);

console.log(data.dailyReportWorker_insert);

// Or, you can use the `Promise` API.
createDailyReportWorker(createDailyReportWorkerVars).then((response) => {
  const data = response.data;
  console.log(data.dailyReportWorker_insert);
});
```

### Using `CreateDailyReportWorker`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createDailyReportWorkerRef, CreateDailyReportWorkerVariables } from '@dataconnect/generated';

// The `CreateDailyReportWorker` mutation requires an argument of type `CreateDailyReportWorkerVariables`:
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

// Call the `createDailyReportWorkerRef()` function to get a reference to the mutation.
const ref = createDailyReportWorkerRef(createDailyReportWorkerVars);
// Variables can be defined inline as well.
const ref = createDailyReportWorkerRef({ dailyReportId: ..., workerId: ..., gongsu: ..., unitPrice: ..., amount: ..., workDescription: ..., legacyWorkerId: ..., legacyTeamId: ..., workerName: ..., role: ..., status: ..., manDay: ..., payType: ..., salaryModel: ..., workContent: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createDailyReportWorkerRef(dataConnect, createDailyReportWorkerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.dailyReportWorker_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyReportWorker_insert);
});
```

## UpdateDailyReportWorker
You can execute the `UpdateDailyReportWorker` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateDailyReportWorker(vars: UpdateDailyReportWorkerVariables): MutationPromise<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;

interface UpdateDailyReportWorkerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateDailyReportWorkerVariables): MutationRef<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;
}
export const updateDailyReportWorkerRef: UpdateDailyReportWorkerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateDailyReportWorker(dc: DataConnect, vars: UpdateDailyReportWorkerVariables): MutationPromise<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;

interface UpdateDailyReportWorkerRef {
  ...
  (dc: DataConnect, vars: UpdateDailyReportWorkerVariables): MutationRef<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;
}
export const updateDailyReportWorkerRef: UpdateDailyReportWorkerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateDailyReportWorkerRef:
```typescript
const name = updateDailyReportWorkerRef.operationName;
console.log(name);
```

### Variables
The `UpdateDailyReportWorker` mutation requires an argument of type `UpdateDailyReportWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateDailyReportWorker` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateDailyReportWorkerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateDailyReportWorkerData {
  dailyReportWorker_update?: DailyReportWorker_Key | null;
}
```
### Using `UpdateDailyReportWorker`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateDailyReportWorker, UpdateDailyReportWorkerVariables } from '@dataconnect/generated';

// The `UpdateDailyReportWorker` mutation requires an argument of type `UpdateDailyReportWorkerVariables`:
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

// Call the `updateDailyReportWorker()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateDailyReportWorker(updateDailyReportWorkerVars);
// Variables can be defined inline as well.
const { data } = await updateDailyReportWorker({ dailyReportId: ..., workerId: ..., gongsu: ..., unitPrice: ..., amount: ..., workDescription: ..., legacyWorkerId: ..., legacyTeamId: ..., workerName: ..., role: ..., status: ..., manDay: ..., payType: ..., salaryModel: ..., workContent: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateDailyReportWorker(dataConnect, updateDailyReportWorkerVars);

console.log(data.dailyReportWorker_update);

// Or, you can use the `Promise` API.
updateDailyReportWorker(updateDailyReportWorkerVars).then((response) => {
  const data = response.data;
  console.log(data.dailyReportWorker_update);
});
```

### Using `UpdateDailyReportWorker`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateDailyReportWorkerRef, UpdateDailyReportWorkerVariables } from '@dataconnect/generated';

// The `UpdateDailyReportWorker` mutation requires an argument of type `UpdateDailyReportWorkerVariables`:
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

// Call the `updateDailyReportWorkerRef()` function to get a reference to the mutation.
const ref = updateDailyReportWorkerRef(updateDailyReportWorkerVars);
// Variables can be defined inline as well.
const ref = updateDailyReportWorkerRef({ dailyReportId: ..., workerId: ..., gongsu: ..., unitPrice: ..., amount: ..., workDescription: ..., legacyWorkerId: ..., legacyTeamId: ..., workerName: ..., role: ..., status: ..., manDay: ..., payType: ..., salaryModel: ..., workContent: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateDailyReportWorkerRef(dataConnect, updateDailyReportWorkerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.dailyReportWorker_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyReportWorker_update);
});
```

## DeleteDailyReportWorker
You can execute the `DeleteDailyReportWorker` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteDailyReportWorker(vars: DeleteDailyReportWorkerVariables): MutationPromise<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;

interface DeleteDailyReportWorkerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteDailyReportWorkerVariables): MutationRef<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;
}
export const deleteDailyReportWorkerRef: DeleteDailyReportWorkerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteDailyReportWorker(dc: DataConnect, vars: DeleteDailyReportWorkerVariables): MutationPromise<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;

interface DeleteDailyReportWorkerRef {
  ...
  (dc: DataConnect, vars: DeleteDailyReportWorkerVariables): MutationRef<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;
}
export const deleteDailyReportWorkerRef: DeleteDailyReportWorkerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteDailyReportWorkerRef:
```typescript
const name = deleteDailyReportWorkerRef.operationName;
console.log(name);
```

### Variables
The `DeleteDailyReportWorker` mutation requires an argument of type `DeleteDailyReportWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteDailyReportWorkerVariables {
  dailyReportId: UUIDString;
  workerId: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteDailyReportWorker` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteDailyReportWorkerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteDailyReportWorkerData {
  dailyReportWorker_delete?: DailyReportWorker_Key | null;
}
```
### Using `DeleteDailyReportWorker`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteDailyReportWorker, DeleteDailyReportWorkerVariables } from '@dataconnect/generated';

// The `DeleteDailyReportWorker` mutation requires an argument of type `DeleteDailyReportWorkerVariables`:
const deleteDailyReportWorkerVars: DeleteDailyReportWorkerVariables = {
  dailyReportId: ..., 
  workerId: ..., 
};

// Call the `deleteDailyReportWorker()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteDailyReportWorker(deleteDailyReportWorkerVars);
// Variables can be defined inline as well.
const { data } = await deleteDailyReportWorker({ dailyReportId: ..., workerId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteDailyReportWorker(dataConnect, deleteDailyReportWorkerVars);

console.log(data.dailyReportWorker_delete);

// Or, you can use the `Promise` API.
deleteDailyReportWorker(deleteDailyReportWorkerVars).then((response) => {
  const data = response.data;
  console.log(data.dailyReportWorker_delete);
});
```

### Using `DeleteDailyReportWorker`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteDailyReportWorkerRef, DeleteDailyReportWorkerVariables } from '@dataconnect/generated';

// The `DeleteDailyReportWorker` mutation requires an argument of type `DeleteDailyReportWorkerVariables`:
const deleteDailyReportWorkerVars: DeleteDailyReportWorkerVariables = {
  dailyReportId: ..., 
  workerId: ..., 
};

// Call the `deleteDailyReportWorkerRef()` function to get a reference to the mutation.
const ref = deleteDailyReportWorkerRef(deleteDailyReportWorkerVars);
// Variables can be defined inline as well.
const ref = deleteDailyReportWorkerRef({ dailyReportId: ..., workerId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteDailyReportWorkerRef(dataConnect, deleteDailyReportWorkerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.dailyReportWorker_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyReportWorker_delete);
});
```

## CreatePosition
You can execute the `CreatePosition` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createPosition(vars: CreatePositionVariables): MutationPromise<CreatePositionData, CreatePositionVariables>;

interface CreatePositionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePositionVariables): MutationRef<CreatePositionData, CreatePositionVariables>;
}
export const createPositionRef: CreatePositionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createPosition(dc: DataConnect, vars: CreatePositionVariables): MutationPromise<CreatePositionData, CreatePositionVariables>;

interface CreatePositionRef {
  ...
  (dc: DataConnect, vars: CreatePositionVariables): MutationRef<CreatePositionData, CreatePositionVariables>;
}
export const createPositionRef: CreatePositionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createPositionRef:
```typescript
const name = createPositionRef.operationName;
console.log(name);
```

### Variables
The `CreatePosition` mutation requires an argument of type `CreatePositionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreatePosition` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreatePositionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreatePositionData {
  position_insert: Position_Key;
}
```
### Using `CreatePosition`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createPosition, CreatePositionVariables } from '@dataconnect/generated';

// The `CreatePosition` mutation requires an argument of type `CreatePositionVariables`:
const createPositionVars: CreatePositionVariables = {
  name: ..., 
  legacyId: ..., // optional
  rank: ..., // optional
  color: ..., // optional
  icon: ..., // optional
  isDefault: ..., // optional
};

// Call the `createPosition()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createPosition(createPositionVars);
// Variables can be defined inline as well.
const { data } = await createPosition({ name: ..., legacyId: ..., rank: ..., color: ..., icon: ..., isDefault: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createPosition(dataConnect, createPositionVars);

console.log(data.position_insert);

// Or, you can use the `Promise` API.
createPosition(createPositionVars).then((response) => {
  const data = response.data;
  console.log(data.position_insert);
});
```

### Using `CreatePosition`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createPositionRef, CreatePositionVariables } from '@dataconnect/generated';

// The `CreatePosition` mutation requires an argument of type `CreatePositionVariables`:
const createPositionVars: CreatePositionVariables = {
  name: ..., 
  legacyId: ..., // optional
  rank: ..., // optional
  color: ..., // optional
  icon: ..., // optional
  isDefault: ..., // optional
};

// Call the `createPositionRef()` function to get a reference to the mutation.
const ref = createPositionRef(createPositionVars);
// Variables can be defined inline as well.
const ref = createPositionRef({ name: ..., legacyId: ..., rank: ..., color: ..., icon: ..., isDefault: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createPositionRef(dataConnect, createPositionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.position_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.position_insert);
});
```

## CreateAuditLog
You can execute the `CreateAuditLog` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAuditLog(vars: CreateAuditLogVariables): MutationPromise<CreateAuditLogData, CreateAuditLogVariables>;

interface CreateAuditLogRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAuditLogVariables): MutationRef<CreateAuditLogData, CreateAuditLogVariables>;
}
export const createAuditLogRef: CreateAuditLogRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAuditLog(dc: DataConnect, vars: CreateAuditLogVariables): MutationPromise<CreateAuditLogData, CreateAuditLogVariables>;

interface CreateAuditLogRef {
  ...
  (dc: DataConnect, vars: CreateAuditLogVariables): MutationRef<CreateAuditLogData, CreateAuditLogVariables>;
}
export const createAuditLogRef: CreateAuditLogRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAuditLogRef:
```typescript
const name = createAuditLogRef.operationName;
console.log(name);
```

### Variables
The `CreateAuditLog` mutation requires an argument of type `CreateAuditLogVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateAuditLog` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAuditLogData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAuditLogData {
  auditLog_insert: AuditLog_Key;
}
```
### Using `CreateAuditLog`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAuditLog, CreateAuditLogVariables } from '@dataconnect/generated';

// The `CreateAuditLog` mutation requires an argument of type `CreateAuditLogVariables`:
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

// Call the `createAuditLog()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAuditLog(createAuditLogVars);
// Variables can be defined inline as well.
const { data } = await createAuditLog({ id: ..., action: ..., category: ..., actorId: ..., actorEmail: ..., targetId: ..., details: ..., timestamp: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAuditLog(dataConnect, createAuditLogVars);

console.log(data.auditLog_insert);

// Or, you can use the `Promise` API.
createAuditLog(createAuditLogVars).then((response) => {
  const data = response.data;
  console.log(data.auditLog_insert);
});
```

### Using `CreateAuditLog`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAuditLogRef, CreateAuditLogVariables } from '@dataconnect/generated';

// The `CreateAuditLog` mutation requires an argument of type `CreateAuditLogVariables`:
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

// Call the `createAuditLogRef()` function to get a reference to the mutation.
const ref = createAuditLogRef(createAuditLogVars);
// Variables can be defined inline as well.
const ref = createAuditLogRef({ id: ..., action: ..., category: ..., actorId: ..., actorEmail: ..., targetId: ..., details: ..., timestamp: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAuditLogRef(dataConnect, createAuditLogVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.auditLog_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.auditLog_insert);
});
```

## CreateAgent
You can execute the `CreateAgent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAgent(vars: CreateAgentVariables): MutationPromise<CreateAgentData, CreateAgentVariables>;

interface CreateAgentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAgentVariables): MutationRef<CreateAgentData, CreateAgentVariables>;
}
export const createAgentRef: CreateAgentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAgent(dc: DataConnect, vars: CreateAgentVariables): MutationPromise<CreateAgentData, CreateAgentVariables>;

interface CreateAgentRef {
  ...
  (dc: DataConnect, vars: CreateAgentVariables): MutationRef<CreateAgentData, CreateAgentVariables>;
}
export const createAgentRef: CreateAgentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAgentRef:
```typescript
const name = createAgentRef.operationName;
console.log(name);
```

### Variables
The `CreateAgent` mutation requires an argument of type `CreateAgentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateAgent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAgentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAgentData {
  agent_insert: Agent_Key;
}
```
### Using `CreateAgent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAgent, CreateAgentVariables } from '@dataconnect/generated';

// The `CreateAgent` mutation requires an argument of type `CreateAgentVariables`:
const createAgentVars: CreateAgentVariables = {
  id: ..., 
  name: ..., // optional
  type: ..., // optional
  role: ..., // optional
  capabilities: ..., // optional
  systemPrompt: ..., // optional
  status: ..., // optional
};

// Call the `createAgent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAgent(createAgentVars);
// Variables can be defined inline as well.
const { data } = await createAgent({ id: ..., name: ..., type: ..., role: ..., capabilities: ..., systemPrompt: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAgent(dataConnect, createAgentVars);

console.log(data.agent_insert);

// Or, you can use the `Promise` API.
createAgent(createAgentVars).then((response) => {
  const data = response.data;
  console.log(data.agent_insert);
});
```

### Using `CreateAgent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAgentRef, CreateAgentVariables } from '@dataconnect/generated';

// The `CreateAgent` mutation requires an argument of type `CreateAgentVariables`:
const createAgentVars: CreateAgentVariables = {
  id: ..., 
  name: ..., // optional
  type: ..., // optional
  role: ..., // optional
  capabilities: ..., // optional
  systemPrompt: ..., // optional
  status: ..., // optional
};

// Call the `createAgentRef()` function to get a reference to the mutation.
const ref = createAgentRef(createAgentVars);
// Variables can be defined inline as well.
const ref = createAgentRef({ id: ..., name: ..., type: ..., role: ..., capabilities: ..., systemPrompt: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAgentRef(dataConnect, createAgentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.agent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.agent_insert);
});
```

## CreateAgentConversation
You can execute the `CreateAgentConversation` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAgentConversation(vars: CreateAgentConversationVariables): MutationPromise<CreateAgentConversationData, CreateAgentConversationVariables>;

interface CreateAgentConversationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAgentConversationVariables): MutationRef<CreateAgentConversationData, CreateAgentConversationVariables>;
}
export const createAgentConversationRef: CreateAgentConversationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAgentConversation(dc: DataConnect, vars: CreateAgentConversationVariables): MutationPromise<CreateAgentConversationData, CreateAgentConversationVariables>;

interface CreateAgentConversationRef {
  ...
  (dc: DataConnect, vars: CreateAgentConversationVariables): MutationRef<CreateAgentConversationData, CreateAgentConversationVariables>;
}
export const createAgentConversationRef: CreateAgentConversationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAgentConversationRef:
```typescript
const name = createAgentConversationRef.operationName;
console.log(name);
```

### Variables
The `CreateAgentConversation` mutation requires an argument of type `CreateAgentConversationVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateAgentConversationVariables {
  id: string;
  mainAgentId?: string | null;
  userId?: string | null;
  messages?: string | null;
}
```
### Return Type
Recall that executing the `CreateAgentConversation` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAgentConversationData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAgentConversationData {
  agentConversation_insert: AgentConversation_Key;
}
```
### Using `CreateAgentConversation`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAgentConversation, CreateAgentConversationVariables } from '@dataconnect/generated';

// The `CreateAgentConversation` mutation requires an argument of type `CreateAgentConversationVariables`:
const createAgentConversationVars: CreateAgentConversationVariables = {
  id: ..., 
  mainAgentId: ..., // optional
  userId: ..., // optional
  messages: ..., // optional
};

// Call the `createAgentConversation()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAgentConversation(createAgentConversationVars);
// Variables can be defined inline as well.
const { data } = await createAgentConversation({ id: ..., mainAgentId: ..., userId: ..., messages: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAgentConversation(dataConnect, createAgentConversationVars);

console.log(data.agentConversation_insert);

// Or, you can use the `Promise` API.
createAgentConversation(createAgentConversationVars).then((response) => {
  const data = response.data;
  console.log(data.agentConversation_insert);
});
```

### Using `CreateAgentConversation`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAgentConversationRef, CreateAgentConversationVariables } from '@dataconnect/generated';

// The `CreateAgentConversation` mutation requires an argument of type `CreateAgentConversationVariables`:
const createAgentConversationVars: CreateAgentConversationVariables = {
  id: ..., 
  mainAgentId: ..., // optional
  userId: ..., // optional
  messages: ..., // optional
};

// Call the `createAgentConversationRef()` function to get a reference to the mutation.
const ref = createAgentConversationRef(createAgentConversationVars);
// Variables can be defined inline as well.
const ref = createAgentConversationRef({ id: ..., mainAgentId: ..., userId: ..., messages: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAgentConversationRef(dataConnect, createAgentConversationVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.agentConversation_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.agentConversation_insert);
});
```

## CreateSetting
You can execute the `CreateSetting` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createSetting(vars: CreateSettingVariables): MutationPromise<CreateSettingData, CreateSettingVariables>;

interface CreateSettingRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSettingVariables): MutationRef<CreateSettingData, CreateSettingVariables>;
}
export const createSettingRef: CreateSettingRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createSetting(dc: DataConnect, vars: CreateSettingVariables): MutationPromise<CreateSettingData, CreateSettingVariables>;

interface CreateSettingRef {
  ...
  (dc: DataConnect, vars: CreateSettingVariables): MutationRef<CreateSettingData, CreateSettingVariables>;
}
export const createSettingRef: CreateSettingRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createSettingRef:
```typescript
const name = createSettingRef.operationName;
console.log(name);
```

### Variables
The `CreateSetting` mutation requires an argument of type `CreateSettingVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateSettingVariables {
  id: string;
  data: string;
}
```
### Return Type
Recall that executing the `CreateSetting` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateSettingData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateSettingData {
  setting_insert: Setting_Key;
}
```
### Using `CreateSetting`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSetting, CreateSettingVariables } from '@dataconnect/generated';

// The `CreateSetting` mutation requires an argument of type `CreateSettingVariables`:
const createSettingVars: CreateSettingVariables = {
  id: ..., 
  data: ..., 
};

// Call the `createSetting()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createSetting(createSettingVars);
// Variables can be defined inline as well.
const { data } = await createSetting({ id: ..., data: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createSetting(dataConnect, createSettingVars);

console.log(data.setting_insert);

// Or, you can use the `Promise` API.
createSetting(createSettingVars).then((response) => {
  const data = response.data;
  console.log(data.setting_insert);
});
```

### Using `CreateSetting`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createSettingRef, CreateSettingVariables } from '@dataconnect/generated';

// The `CreateSetting` mutation requires an argument of type `CreateSettingVariables`:
const createSettingVars: CreateSettingVariables = {
  id: ..., 
  data: ..., 
};

// Call the `createSettingRef()` function to get a reference to the mutation.
const ref = createSettingRef(createSettingVars);
// Variables can be defined inline as well.
const ref = createSettingRef({ id: ..., data: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createSettingRef(dataConnect, createSettingVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.setting_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.setting_insert);
});
```

## UpdateSetting
You can execute the `UpdateSetting` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateSetting(vars: UpdateSettingVariables): MutationPromise<UpdateSettingData, UpdateSettingVariables>;

interface UpdateSettingRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSettingVariables): MutationRef<UpdateSettingData, UpdateSettingVariables>;
}
export const updateSettingRef: UpdateSettingRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateSetting(dc: DataConnect, vars: UpdateSettingVariables): MutationPromise<UpdateSettingData, UpdateSettingVariables>;

interface UpdateSettingRef {
  ...
  (dc: DataConnect, vars: UpdateSettingVariables): MutationRef<UpdateSettingData, UpdateSettingVariables>;
}
export const updateSettingRef: UpdateSettingRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateSettingRef:
```typescript
const name = updateSettingRef.operationName;
console.log(name);
```

### Variables
The `UpdateSetting` mutation requires an argument of type `UpdateSettingVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateSettingVariables {
  id: string;
  data: string;
}
```
### Return Type
Recall that executing the `UpdateSetting` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateSettingData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateSettingData {
  setting_update?: Setting_Key | null;
}
```
### Using `UpdateSetting`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateSetting, UpdateSettingVariables } from '@dataconnect/generated';

// The `UpdateSetting` mutation requires an argument of type `UpdateSettingVariables`:
const updateSettingVars: UpdateSettingVariables = {
  id: ..., 
  data: ..., 
};

// Call the `updateSetting()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateSetting(updateSettingVars);
// Variables can be defined inline as well.
const { data } = await updateSetting({ id: ..., data: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateSetting(dataConnect, updateSettingVars);

console.log(data.setting_update);

// Or, you can use the `Promise` API.
updateSetting(updateSettingVars).then((response) => {
  const data = response.data;
  console.log(data.setting_update);
});
```

### Using `UpdateSetting`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateSettingRef, UpdateSettingVariables } from '@dataconnect/generated';

// The `UpdateSetting` mutation requires an argument of type `UpdateSettingVariables`:
const updateSettingVars: UpdateSettingVariables = {
  id: ..., 
  data: ..., 
};

// Call the `updateSettingRef()` function to get a reference to the mutation.
const ref = updateSettingRef(updateSettingVars);
// Variables can be defined inline as well.
const ref = updateSettingRef({ id: ..., data: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateSettingRef(dataConnect, updateSettingVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.setting_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.setting_update);
});
```

## CreateSystemConfig
You can execute the `CreateSystemConfig` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createSystemConfig(vars: CreateSystemConfigVariables): MutationPromise<CreateSystemConfigData, CreateSystemConfigVariables>;

interface CreateSystemConfigRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSystemConfigVariables): MutationRef<CreateSystemConfigData, CreateSystemConfigVariables>;
}
export const createSystemConfigRef: CreateSystemConfigRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createSystemConfig(dc: DataConnect, vars: CreateSystemConfigVariables): MutationPromise<CreateSystemConfigData, CreateSystemConfigVariables>;

interface CreateSystemConfigRef {
  ...
  (dc: DataConnect, vars: CreateSystemConfigVariables): MutationRef<CreateSystemConfigData, CreateSystemConfigVariables>;
}
export const createSystemConfigRef: CreateSystemConfigRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createSystemConfigRef:
```typescript
const name = createSystemConfigRef.operationName;
console.log(name);
```

### Variables
The `CreateSystemConfig` mutation requires an argument of type `CreateSystemConfigVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateSystemConfigVariables {
  id: string;
  data: string;
}
```
### Return Type
Recall that executing the `CreateSystemConfig` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateSystemConfigData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateSystemConfigData {
  systemConfig_insert: SystemConfig_Key;
}
```
### Using `CreateSystemConfig`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSystemConfig, CreateSystemConfigVariables } from '@dataconnect/generated';

// The `CreateSystemConfig` mutation requires an argument of type `CreateSystemConfigVariables`:
const createSystemConfigVars: CreateSystemConfigVariables = {
  id: ..., 
  data: ..., 
};

// Call the `createSystemConfig()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createSystemConfig(createSystemConfigVars);
// Variables can be defined inline as well.
const { data } = await createSystemConfig({ id: ..., data: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createSystemConfig(dataConnect, createSystemConfigVars);

console.log(data.systemConfig_insert);

// Or, you can use the `Promise` API.
createSystemConfig(createSystemConfigVars).then((response) => {
  const data = response.data;
  console.log(data.systemConfig_insert);
});
```

### Using `CreateSystemConfig`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createSystemConfigRef, CreateSystemConfigVariables } from '@dataconnect/generated';

// The `CreateSystemConfig` mutation requires an argument of type `CreateSystemConfigVariables`:
const createSystemConfigVars: CreateSystemConfigVariables = {
  id: ..., 
  data: ..., 
};

// Call the `createSystemConfigRef()` function to get a reference to the mutation.
const ref = createSystemConfigRef(createSystemConfigVars);
// Variables can be defined inline as well.
const ref = createSystemConfigRef({ id: ..., data: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createSystemConfigRef(dataConnect, createSystemConfigVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.systemConfig_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.systemConfig_insert);
});
```

## UpdateSystemConfig
You can execute the `UpdateSystemConfig` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateSystemConfig(vars: UpdateSystemConfigVariables): MutationPromise<UpdateSystemConfigData, UpdateSystemConfigVariables>;

interface UpdateSystemConfigRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSystemConfigVariables): MutationRef<UpdateSystemConfigData, UpdateSystemConfigVariables>;
}
export const updateSystemConfigRef: UpdateSystemConfigRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateSystemConfig(dc: DataConnect, vars: UpdateSystemConfigVariables): MutationPromise<UpdateSystemConfigData, UpdateSystemConfigVariables>;

interface UpdateSystemConfigRef {
  ...
  (dc: DataConnect, vars: UpdateSystemConfigVariables): MutationRef<UpdateSystemConfigData, UpdateSystemConfigVariables>;
}
export const updateSystemConfigRef: UpdateSystemConfigRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateSystemConfigRef:
```typescript
const name = updateSystemConfigRef.operationName;
console.log(name);
```

### Variables
The `UpdateSystemConfig` mutation requires an argument of type `UpdateSystemConfigVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateSystemConfigVariables {
  id: string;
  data: string;
}
```
### Return Type
Recall that executing the `UpdateSystemConfig` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateSystemConfigData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateSystemConfigData {
  systemConfig_update?: SystemConfig_Key | null;
}
```
### Using `UpdateSystemConfig`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateSystemConfig, UpdateSystemConfigVariables } from '@dataconnect/generated';

// The `UpdateSystemConfig` mutation requires an argument of type `UpdateSystemConfigVariables`:
const updateSystemConfigVars: UpdateSystemConfigVariables = {
  id: ..., 
  data: ..., 
};

// Call the `updateSystemConfig()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateSystemConfig(updateSystemConfigVars);
// Variables can be defined inline as well.
const { data } = await updateSystemConfig({ id: ..., data: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateSystemConfig(dataConnect, updateSystemConfigVars);

console.log(data.systemConfig_update);

// Or, you can use the `Promise` API.
updateSystemConfig(updateSystemConfigVars).then((response) => {
  const data = response.data;
  console.log(data.systemConfig_update);
});
```

### Using `UpdateSystemConfig`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateSystemConfigRef, UpdateSystemConfigVariables } from '@dataconnect/generated';

// The `UpdateSystemConfig` mutation requires an argument of type `UpdateSystemConfigVariables`:
const updateSystemConfigVars: UpdateSystemConfigVariables = {
  id: ..., 
  data: ..., 
};

// Call the `updateSystemConfigRef()` function to get a reference to the mutation.
const ref = updateSystemConfigRef(updateSystemConfigVars);
// Variables can be defined inline as well.
const ref = updateSystemConfigRef({ id: ..., data: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateSystemConfigRef(dataConnect, updateSystemConfigVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.systemConfig_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.systemConfig_update);
});
```

## DeletePosition
You can execute the `DeletePosition` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deletePosition(vars: DeletePositionVariables): MutationPromise<DeletePositionData, DeletePositionVariables>;

interface DeletePositionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeletePositionVariables): MutationRef<DeletePositionData, DeletePositionVariables>;
}
export const deletePositionRef: DeletePositionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deletePosition(dc: DataConnect, vars: DeletePositionVariables): MutationPromise<DeletePositionData, DeletePositionVariables>;

interface DeletePositionRef {
  ...
  (dc: DataConnect, vars: DeletePositionVariables): MutationRef<DeletePositionData, DeletePositionVariables>;
}
export const deletePositionRef: DeletePositionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deletePositionRef:
```typescript
const name = deletePositionRef.operationName;
console.log(name);
```

### Variables
The `DeletePosition` mutation requires an argument of type `DeletePositionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeletePositionVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeletePosition` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeletePositionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeletePositionData {
  position_delete?: Position_Key | null;
}
```
### Using `DeletePosition`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deletePosition, DeletePositionVariables } from '@dataconnect/generated';

// The `DeletePosition` mutation requires an argument of type `DeletePositionVariables`:
const deletePositionVars: DeletePositionVariables = {
  id: ..., 
};

// Call the `deletePosition()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deletePosition(deletePositionVars);
// Variables can be defined inline as well.
const { data } = await deletePosition({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deletePosition(dataConnect, deletePositionVars);

console.log(data.position_delete);

// Or, you can use the `Promise` API.
deletePosition(deletePositionVars).then((response) => {
  const data = response.data;
  console.log(data.position_delete);
});
```

### Using `DeletePosition`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deletePositionRef, DeletePositionVariables } from '@dataconnect/generated';

// The `DeletePosition` mutation requires an argument of type `DeletePositionVariables`:
const deletePositionVars: DeletePositionVariables = {
  id: ..., 
};

// Call the `deletePositionRef()` function to get a reference to the mutation.
const ref = deletePositionRef(deletePositionVars);
// Variables can be defined inline as well.
const ref = deletePositionRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deletePositionRef(dataConnect, deletePositionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.position_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.position_delete);
});
```

## UpdateCompany
You can execute the `UpdateCompany` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateCompany(vars: UpdateCompanyVariables): MutationPromise<UpdateCompanyData, UpdateCompanyVariables>;

interface UpdateCompanyRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateCompanyVariables): MutationRef<UpdateCompanyData, UpdateCompanyVariables>;
}
export const updateCompanyRef: UpdateCompanyRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateCompany(dc: DataConnect, vars: UpdateCompanyVariables): MutationPromise<UpdateCompanyData, UpdateCompanyVariables>;

interface UpdateCompanyRef {
  ...
  (dc: DataConnect, vars: UpdateCompanyVariables): MutationRef<UpdateCompanyData, UpdateCompanyVariables>;
}
export const updateCompanyRef: UpdateCompanyRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateCompanyRef:
```typescript
const name = updateCompanyRef.operationName;
console.log(name);
```

### Variables
The `UpdateCompany` mutation requires an argument of type `UpdateCompanyVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateCompany` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateCompanyData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateCompanyData {
  company_update?: Company_Key | null;
}
```
### Using `UpdateCompany`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateCompany, UpdateCompanyVariables } from '@dataconnect/generated';

// The `UpdateCompany` mutation requires an argument of type `UpdateCompanyVariables`:
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

// Call the `updateCompany()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateCompany(updateCompanyVars);
// Variables can be defined inline as well.
const { data } = await updateCompany({ id: ..., name: ..., code: ..., businessNumber: ..., ceoName: ..., type: ..., status: ..., address: ..., phone: ..., email: ..., bankName: ..., accountNumber: ..., accountHolder: ..., ceoResidentNumber: ..., color: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateCompany(dataConnect, updateCompanyVars);

console.log(data.company_update);

// Or, you can use the `Promise` API.
updateCompany(updateCompanyVars).then((response) => {
  const data = response.data;
  console.log(data.company_update);
});
```

### Using `UpdateCompany`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateCompanyRef, UpdateCompanyVariables } from '@dataconnect/generated';

// The `UpdateCompany` mutation requires an argument of type `UpdateCompanyVariables`:
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

// Call the `updateCompanyRef()` function to get a reference to the mutation.
const ref = updateCompanyRef(updateCompanyVars);
// Variables can be defined inline as well.
const ref = updateCompanyRef({ id: ..., name: ..., code: ..., businessNumber: ..., ceoName: ..., type: ..., status: ..., address: ..., phone: ..., email: ..., bankName: ..., accountNumber: ..., accountHolder: ..., ceoResidentNumber: ..., color: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateCompanyRef(dataConnect, updateCompanyVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.company_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.company_update);
});
```

## DeleteCompany
You can execute the `DeleteCompany` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteCompany(vars: DeleteCompanyVariables): MutationPromise<DeleteCompanyData, DeleteCompanyVariables>;

interface DeleteCompanyRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteCompanyVariables): MutationRef<DeleteCompanyData, DeleteCompanyVariables>;
}
export const deleteCompanyRef: DeleteCompanyRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteCompany(dc: DataConnect, vars: DeleteCompanyVariables): MutationPromise<DeleteCompanyData, DeleteCompanyVariables>;

interface DeleteCompanyRef {
  ...
  (dc: DataConnect, vars: DeleteCompanyVariables): MutationRef<DeleteCompanyData, DeleteCompanyVariables>;
}
export const deleteCompanyRef: DeleteCompanyRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteCompanyRef:
```typescript
const name = deleteCompanyRef.operationName;
console.log(name);
```

### Variables
The `DeleteCompany` mutation requires an argument of type `DeleteCompanyVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteCompanyVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteCompany` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteCompanyData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteCompanyData {
  company_delete?: Company_Key | null;
}
```
### Using `DeleteCompany`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteCompany, DeleteCompanyVariables } from '@dataconnect/generated';

// The `DeleteCompany` mutation requires an argument of type `DeleteCompanyVariables`:
const deleteCompanyVars: DeleteCompanyVariables = {
  id: ..., 
};

// Call the `deleteCompany()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteCompany(deleteCompanyVars);
// Variables can be defined inline as well.
const { data } = await deleteCompany({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteCompany(dataConnect, deleteCompanyVars);

console.log(data.company_delete);

// Or, you can use the `Promise` API.
deleteCompany(deleteCompanyVars).then((response) => {
  const data = response.data;
  console.log(data.company_delete);
});
```

### Using `DeleteCompany`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteCompanyRef, DeleteCompanyVariables } from '@dataconnect/generated';

// The `DeleteCompany` mutation requires an argument of type `DeleteCompanyVariables`:
const deleteCompanyVars: DeleteCompanyVariables = {
  id: ..., 
};

// Call the `deleteCompanyRef()` function to get a reference to the mutation.
const ref = deleteCompanyRef(deleteCompanyVars);
// Variables can be defined inline as well.
const ref = deleteCompanyRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteCompanyRef(dataConnect, deleteCompanyVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.company_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.company_delete);
});
```

## UpdateTeam
You can execute the `UpdateTeam` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateTeam(vars: UpdateTeamVariables): MutationPromise<UpdateTeamData, UpdateTeamVariables>;

interface UpdateTeamRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTeamVariables): MutationRef<UpdateTeamData, UpdateTeamVariables>;
}
export const updateTeamRef: UpdateTeamRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateTeam(dc: DataConnect, vars: UpdateTeamVariables): MutationPromise<UpdateTeamData, UpdateTeamVariables>;

interface UpdateTeamRef {
  ...
  (dc: DataConnect, vars: UpdateTeamVariables): MutationRef<UpdateTeamData, UpdateTeamVariables>;
}
export const updateTeamRef: UpdateTeamRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateTeamRef:
```typescript
const name = updateTeamRef.operationName;
console.log(name);
```

### Variables
The `UpdateTeam` mutation requires an argument of type `UpdateTeamVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateTeam` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateTeamData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateTeamData {
  team_update?: Team_Key | null;
}
```
### Using `UpdateTeam`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateTeam, UpdateTeamVariables } from '@dataconnect/generated';

// The `UpdateTeam` mutation requires an argument of type `UpdateTeamVariables`:
const updateTeamVars: UpdateTeamVariables = {
  id: ..., 
  name: ..., // optional
  companyId: ..., // optional
  leaderId: ..., // optional
  type: ..., // optional
  status: ..., // optional
  totalManDay: ..., // optional
};

// Call the `updateTeam()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateTeam(updateTeamVars);
// Variables can be defined inline as well.
const { data } = await updateTeam({ id: ..., name: ..., companyId: ..., leaderId: ..., type: ..., status: ..., totalManDay: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateTeam(dataConnect, updateTeamVars);

console.log(data.team_update);

// Or, you can use the `Promise` API.
updateTeam(updateTeamVars).then((response) => {
  const data = response.data;
  console.log(data.team_update);
});
```

### Using `UpdateTeam`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateTeamRef, UpdateTeamVariables } from '@dataconnect/generated';

// The `UpdateTeam` mutation requires an argument of type `UpdateTeamVariables`:
const updateTeamVars: UpdateTeamVariables = {
  id: ..., 
  name: ..., // optional
  companyId: ..., // optional
  leaderId: ..., // optional
  type: ..., // optional
  status: ..., // optional
  totalManDay: ..., // optional
};

// Call the `updateTeamRef()` function to get a reference to the mutation.
const ref = updateTeamRef(updateTeamVars);
// Variables can be defined inline as well.
const ref = updateTeamRef({ id: ..., name: ..., companyId: ..., leaderId: ..., type: ..., status: ..., totalManDay: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateTeamRef(dataConnect, updateTeamVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.team_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.team_update);
});
```

## DeleteTeam
You can execute the `DeleteTeam` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteTeam(vars: DeleteTeamVariables): MutationPromise<DeleteTeamData, DeleteTeamVariables>;

interface DeleteTeamRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteTeamVariables): MutationRef<DeleteTeamData, DeleteTeamVariables>;
}
export const deleteTeamRef: DeleteTeamRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteTeam(dc: DataConnect, vars: DeleteTeamVariables): MutationPromise<DeleteTeamData, DeleteTeamVariables>;

interface DeleteTeamRef {
  ...
  (dc: DataConnect, vars: DeleteTeamVariables): MutationRef<DeleteTeamData, DeleteTeamVariables>;
}
export const deleteTeamRef: DeleteTeamRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteTeamRef:
```typescript
const name = deleteTeamRef.operationName;
console.log(name);
```

### Variables
The `DeleteTeam` mutation requires an argument of type `DeleteTeamVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteTeamVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteTeam` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteTeamData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteTeamData {
  team_delete?: Team_Key | null;
}
```
### Using `DeleteTeam`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteTeam, DeleteTeamVariables } from '@dataconnect/generated';

// The `DeleteTeam` mutation requires an argument of type `DeleteTeamVariables`:
const deleteTeamVars: DeleteTeamVariables = {
  id: ..., 
};

// Call the `deleteTeam()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteTeam(deleteTeamVars);
// Variables can be defined inline as well.
const { data } = await deleteTeam({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteTeam(dataConnect, deleteTeamVars);

console.log(data.team_delete);

// Or, you can use the `Promise` API.
deleteTeam(deleteTeamVars).then((response) => {
  const data = response.data;
  console.log(data.team_delete);
});
```

### Using `DeleteTeam`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteTeamRef, DeleteTeamVariables } from '@dataconnect/generated';

// The `DeleteTeam` mutation requires an argument of type `DeleteTeamVariables`:
const deleteTeamVars: DeleteTeamVariables = {
  id: ..., 
};

// Call the `deleteTeamRef()` function to get a reference to the mutation.
const ref = deleteTeamRef(deleteTeamVars);
// Variables can be defined inline as well.
const ref = deleteTeamRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteTeamRef(dataConnect, deleteTeamVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.team_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.team_delete);
});
```

## UpdateWorker
You can execute the `UpdateWorker` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateWorker(vars: UpdateWorkerVariables): MutationPromise<UpdateWorkerData, UpdateWorkerVariables>;

interface UpdateWorkerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateWorkerVariables): MutationRef<UpdateWorkerData, UpdateWorkerVariables>;
}
export const updateWorkerRef: UpdateWorkerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateWorker(dc: DataConnect, vars: UpdateWorkerVariables): MutationPromise<UpdateWorkerData, UpdateWorkerVariables>;

interface UpdateWorkerRef {
  ...
  (dc: DataConnect, vars: UpdateWorkerVariables): MutationRef<UpdateWorkerData, UpdateWorkerVariables>;
}
export const updateWorkerRef: UpdateWorkerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateWorkerRef:
```typescript
const name = updateWorkerRef.operationName;
console.log(name);
```

### Variables
The `UpdateWorker` mutation requires an argument of type `UpdateWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateWorker` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateWorkerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateWorkerData {
  worker_update?: Worker_Key | null;
}
```
### Using `UpdateWorker`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateWorker, UpdateWorkerVariables } from '@dataconnect/generated';

// The `UpdateWorker` mutation requires an argument of type `UpdateWorkerVariables`:
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

// Call the `updateWorker()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateWorker(updateWorkerVars);
// Variables can be defined inline as well.
const { data } = await updateWorker({ id: ..., name: ..., teamId: ..., role: ..., payType: ..., unitPrice: ..., phone: ..., residentNumber: ..., address: ..., isActive: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateWorker(dataConnect, updateWorkerVars);

console.log(data.worker_update);

// Or, you can use the `Promise` API.
updateWorker(updateWorkerVars).then((response) => {
  const data = response.data;
  console.log(data.worker_update);
});
```

### Using `UpdateWorker`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateWorkerRef, UpdateWorkerVariables } from '@dataconnect/generated';

// The `UpdateWorker` mutation requires an argument of type `UpdateWorkerVariables`:
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

// Call the `updateWorkerRef()` function to get a reference to the mutation.
const ref = updateWorkerRef(updateWorkerVars);
// Variables can be defined inline as well.
const ref = updateWorkerRef({ id: ..., name: ..., teamId: ..., role: ..., payType: ..., unitPrice: ..., phone: ..., residentNumber: ..., address: ..., isActive: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateWorkerRef(dataConnect, updateWorkerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.worker_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.worker_update);
});
```

## DeleteWorker
You can execute the `DeleteWorker` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteWorker(vars: DeleteWorkerVariables): MutationPromise<DeleteWorkerData, DeleteWorkerVariables>;

interface DeleteWorkerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteWorkerVariables): MutationRef<DeleteWorkerData, DeleteWorkerVariables>;
}
export const deleteWorkerRef: DeleteWorkerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteWorker(dc: DataConnect, vars: DeleteWorkerVariables): MutationPromise<DeleteWorkerData, DeleteWorkerVariables>;

interface DeleteWorkerRef {
  ...
  (dc: DataConnect, vars: DeleteWorkerVariables): MutationRef<DeleteWorkerData, DeleteWorkerVariables>;
}
export const deleteWorkerRef: DeleteWorkerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteWorkerRef:
```typescript
const name = deleteWorkerRef.operationName;
console.log(name);
```

### Variables
The `DeleteWorker` mutation requires an argument of type `DeleteWorkerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteWorkerVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteWorker` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteWorkerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteWorkerData {
  worker_delete?: Worker_Key | null;
}
```
### Using `DeleteWorker`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteWorker, DeleteWorkerVariables } from '@dataconnect/generated';

// The `DeleteWorker` mutation requires an argument of type `DeleteWorkerVariables`:
const deleteWorkerVars: DeleteWorkerVariables = {
  id: ..., 
};

// Call the `deleteWorker()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteWorker(deleteWorkerVars);
// Variables can be defined inline as well.
const { data } = await deleteWorker({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteWorker(dataConnect, deleteWorkerVars);

console.log(data.worker_delete);

// Or, you can use the `Promise` API.
deleteWorker(deleteWorkerVars).then((response) => {
  const data = response.data;
  console.log(data.worker_delete);
});
```

### Using `DeleteWorker`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteWorkerRef, DeleteWorkerVariables } from '@dataconnect/generated';

// The `DeleteWorker` mutation requires an argument of type `DeleteWorkerVariables`:
const deleteWorkerVars: DeleteWorkerVariables = {
  id: ..., 
};

// Call the `deleteWorkerRef()` function to get a reference to the mutation.
const ref = deleteWorkerRef(deleteWorkerVars);
// Variables can be defined inline as well.
const ref = deleteWorkerRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteWorkerRef(dataConnect, deleteWorkerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.worker_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.worker_delete);
});
```

## UpdateSite
You can execute the `UpdateSite` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateSite(vars: UpdateSiteVariables): MutationPromise<UpdateSiteData, UpdateSiteVariables>;

interface UpdateSiteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSiteVariables): MutationRef<UpdateSiteData, UpdateSiteVariables>;
}
export const updateSiteRef: UpdateSiteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateSite(dc: DataConnect, vars: UpdateSiteVariables): MutationPromise<UpdateSiteData, UpdateSiteVariables>;

interface UpdateSiteRef {
  ...
  (dc: DataConnect, vars: UpdateSiteVariables): MutationRef<UpdateSiteData, UpdateSiteVariables>;
}
export const updateSiteRef: UpdateSiteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateSiteRef:
```typescript
const name = updateSiteRef.operationName;
console.log(name);
```

### Variables
The `UpdateSite` mutation requires an argument of type `UpdateSiteVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateSite` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateSiteData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateSiteData {
  site_update?: Site_Key | null;
}
```
### Using `UpdateSite`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateSite, UpdateSiteVariables } from '@dataconnect/generated';

// The `UpdateSite` mutation requires an argument of type `UpdateSiteVariables`:
const updateSiteVars: UpdateSiteVariables = {
  id: ..., 
  name: ..., // optional
  code: ..., // optional
  address: ..., // optional
  startDate: ..., // optional
  endDate: ..., // optional
  status: ..., // optional
};

// Call the `updateSite()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateSite(updateSiteVars);
// Variables can be defined inline as well.
const { data } = await updateSite({ id: ..., name: ..., code: ..., address: ..., startDate: ..., endDate: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateSite(dataConnect, updateSiteVars);

console.log(data.site_update);

// Or, you can use the `Promise` API.
updateSite(updateSiteVars).then((response) => {
  const data = response.data;
  console.log(data.site_update);
});
```

### Using `UpdateSite`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateSiteRef, UpdateSiteVariables } from '@dataconnect/generated';

// The `UpdateSite` mutation requires an argument of type `UpdateSiteVariables`:
const updateSiteVars: UpdateSiteVariables = {
  id: ..., 
  name: ..., // optional
  code: ..., // optional
  address: ..., // optional
  startDate: ..., // optional
  endDate: ..., // optional
  status: ..., // optional
};

// Call the `updateSiteRef()` function to get a reference to the mutation.
const ref = updateSiteRef(updateSiteVars);
// Variables can be defined inline as well.
const ref = updateSiteRef({ id: ..., name: ..., code: ..., address: ..., startDate: ..., endDate: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateSiteRef(dataConnect, updateSiteVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.site_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.site_update);
});
```

## DeleteSite
You can execute the `DeleteSite` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteSite(vars: DeleteSiteVariables): MutationPromise<DeleteSiteData, DeleteSiteVariables>;

interface DeleteSiteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteSiteVariables): MutationRef<DeleteSiteData, DeleteSiteVariables>;
}
export const deleteSiteRef: DeleteSiteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteSite(dc: DataConnect, vars: DeleteSiteVariables): MutationPromise<DeleteSiteData, DeleteSiteVariables>;

interface DeleteSiteRef {
  ...
  (dc: DataConnect, vars: DeleteSiteVariables): MutationRef<DeleteSiteData, DeleteSiteVariables>;
}
export const deleteSiteRef: DeleteSiteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteSiteRef:
```typescript
const name = deleteSiteRef.operationName;
console.log(name);
```

### Variables
The `DeleteSite` mutation requires an argument of type `DeleteSiteVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteSiteVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteSite` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteSiteData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteSiteData {
  site_delete?: Site_Key | null;
}
```
### Using `DeleteSite`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteSite, DeleteSiteVariables } from '@dataconnect/generated';

// The `DeleteSite` mutation requires an argument of type `DeleteSiteVariables`:
const deleteSiteVars: DeleteSiteVariables = {
  id: ..., 
};

// Call the `deleteSite()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteSite(deleteSiteVars);
// Variables can be defined inline as well.
const { data } = await deleteSite({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteSite(dataConnect, deleteSiteVars);

console.log(data.site_delete);

// Or, you can use the `Promise` API.
deleteSite(deleteSiteVars).then((response) => {
  const data = response.data;
  console.log(data.site_delete);
});
```

### Using `DeleteSite`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteSiteRef, DeleteSiteVariables } from '@dataconnect/generated';

// The `DeleteSite` mutation requires an argument of type `DeleteSiteVariables`:
const deleteSiteVars: DeleteSiteVariables = {
  id: ..., 
};

// Call the `deleteSiteRef()` function to get a reference to the mutation.
const ref = deleteSiteRef(deleteSiteVars);
// Variables can be defined inline as well.
const ref = deleteSiteRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteSiteRef(dataConnect, deleteSiteVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.site_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.site_delete);
});
```

## UpdateDailyReport
You can execute the `UpdateDailyReport` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateDailyReport(vars: UpdateDailyReportVariables): MutationPromise<UpdateDailyReportData, UpdateDailyReportVariables>;

interface UpdateDailyReportRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateDailyReportVariables): MutationRef<UpdateDailyReportData, UpdateDailyReportVariables>;
}
export const updateDailyReportRef: UpdateDailyReportRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateDailyReport(dc: DataConnect, vars: UpdateDailyReportVariables): MutationPromise<UpdateDailyReportData, UpdateDailyReportVariables>;

interface UpdateDailyReportRef {
  ...
  (dc: DataConnect, vars: UpdateDailyReportVariables): MutationRef<UpdateDailyReportData, UpdateDailyReportVariables>;
}
export const updateDailyReportRef: UpdateDailyReportRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateDailyReportRef:
```typescript
const name = updateDailyReportRef.operationName;
console.log(name);
```

### Variables
The `UpdateDailyReport` mutation requires an argument of type `UpdateDailyReportVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateDailyReport` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateDailyReportData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateDailyReportData {
  dailyReport_update?: DailyReport_Key | null;
}
```
### Using `UpdateDailyReport`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateDailyReport, UpdateDailyReportVariables } from '@dataconnect/generated';

// The `UpdateDailyReport` mutation requires an argument of type `UpdateDailyReportVariables`:
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

// Call the `updateDailyReport()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateDailyReport(updateDailyReportVars);
// Variables can be defined inline as well.
const { data } = await updateDailyReport({ id: ..., date: ..., teamId: ..., siteId: ..., siteName: ..., status: ..., totalManDay: ..., totalAmount: ..., weather: ..., writerUid: ..., companyName: ..., responsibleTeamName: ..., responsibleTeamLegacyId: ..., workContent: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateDailyReport(dataConnect, updateDailyReportVars);

console.log(data.dailyReport_update);

// Or, you can use the `Promise` API.
updateDailyReport(updateDailyReportVars).then((response) => {
  const data = response.data;
  console.log(data.dailyReport_update);
});
```

### Using `UpdateDailyReport`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateDailyReportRef, UpdateDailyReportVariables } from '@dataconnect/generated';

// The `UpdateDailyReport` mutation requires an argument of type `UpdateDailyReportVariables`:
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

// Call the `updateDailyReportRef()` function to get a reference to the mutation.
const ref = updateDailyReportRef(updateDailyReportVars);
// Variables can be defined inline as well.
const ref = updateDailyReportRef({ id: ..., date: ..., teamId: ..., siteId: ..., siteName: ..., status: ..., totalManDay: ..., totalAmount: ..., weather: ..., writerUid: ..., companyName: ..., responsibleTeamName: ..., responsibleTeamLegacyId: ..., workContent: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateDailyReportRef(dataConnect, updateDailyReportVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.dailyReport_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyReport_update);
});
```

## DeleteDailyReport
You can execute the `DeleteDailyReport` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteDailyReport(vars: DeleteDailyReportVariables): MutationPromise<DeleteDailyReportData, DeleteDailyReportVariables>;

interface DeleteDailyReportRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteDailyReportVariables): MutationRef<DeleteDailyReportData, DeleteDailyReportVariables>;
}
export const deleteDailyReportRef: DeleteDailyReportRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteDailyReport(dc: DataConnect, vars: DeleteDailyReportVariables): MutationPromise<DeleteDailyReportData, DeleteDailyReportVariables>;

interface DeleteDailyReportRef {
  ...
  (dc: DataConnect, vars: DeleteDailyReportVariables): MutationRef<DeleteDailyReportData, DeleteDailyReportVariables>;
}
export const deleteDailyReportRef: DeleteDailyReportRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteDailyReportRef:
```typescript
const name = deleteDailyReportRef.operationName;
console.log(name);
```

### Variables
The `DeleteDailyReport` mutation requires an argument of type `DeleteDailyReportVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteDailyReportVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteDailyReport` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteDailyReportData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteDailyReportData {
  dailyReport_delete?: DailyReport_Key | null;
}
```
### Using `DeleteDailyReport`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteDailyReport, DeleteDailyReportVariables } from '@dataconnect/generated';

// The `DeleteDailyReport` mutation requires an argument of type `DeleteDailyReportVariables`:
const deleteDailyReportVars: DeleteDailyReportVariables = {
  id: ..., 
};

// Call the `deleteDailyReport()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteDailyReport(deleteDailyReportVars);
// Variables can be defined inline as well.
const { data } = await deleteDailyReport({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteDailyReport(dataConnect, deleteDailyReportVars);

console.log(data.dailyReport_delete);

// Or, you can use the `Promise` API.
deleteDailyReport(deleteDailyReportVars).then((response) => {
  const data = response.data;
  console.log(data.dailyReport_delete);
});
```

### Using `DeleteDailyReport`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteDailyReportRef, DeleteDailyReportVariables } from '@dataconnect/generated';

// The `DeleteDailyReport` mutation requires an argument of type `DeleteDailyReportVariables`:
const deleteDailyReportVars: DeleteDailyReportVariables = {
  id: ..., 
};

// Call the `deleteDailyReportRef()` function to get a reference to the mutation.
const ref = deleteDailyReportRef(deleteDailyReportVars);
// Variables can be defined inline as well.
const ref = deleteDailyReportRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteDailyReportRef(dataConnect, deleteDailyReportVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.dailyReport_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyReport_delete);
});
```

## CreateAppUser
You can execute the `CreateAppUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAppUser(vars: CreateAppUserVariables): MutationPromise<CreateAppUserData, CreateAppUserVariables>;

interface CreateAppUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAppUserVariables): MutationRef<CreateAppUserData, CreateAppUserVariables>;
}
export const createAppUserRef: CreateAppUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAppUser(dc: DataConnect, vars: CreateAppUserVariables): MutationPromise<CreateAppUserData, CreateAppUserVariables>;

interface CreateAppUserRef {
  ...
  (dc: DataConnect, vars: CreateAppUserVariables): MutationRef<CreateAppUserData, CreateAppUserVariables>;
}
export const createAppUserRef: CreateAppUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAppUserRef:
```typescript
const name = createAppUserRef.operationName;
console.log(name);
```

### Variables
The `CreateAppUser` mutation requires an argument of type `CreateAppUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateAppUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAppUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAppUserData {
  appUser_insert: AppUser_Key;
}
```
### Using `CreateAppUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAppUser, CreateAppUserVariables } from '@dataconnect/generated';

// The `CreateAppUser` mutation requires an argument of type `CreateAppUserVariables`:
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

// Call the `createAppUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAppUser(createAppUserVars);
// Variables can be defined inline as well.
const { data } = await createAppUser({ id: ..., uid: ..., email: ..., displayName: ..., photoUrl: ..., linkedWorkerIds: ..., role: ..., lastLogin: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAppUser(dataConnect, createAppUserVars);

console.log(data.appUser_insert);

// Or, you can use the `Promise` API.
createAppUser(createAppUserVars).then((response) => {
  const data = response.data;
  console.log(data.appUser_insert);
});
```

### Using `CreateAppUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAppUserRef, CreateAppUserVariables } from '@dataconnect/generated';

// The `CreateAppUser` mutation requires an argument of type `CreateAppUserVariables`:
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

// Call the `createAppUserRef()` function to get a reference to the mutation.
const ref = createAppUserRef(createAppUserVars);
// Variables can be defined inline as well.
const ref = createAppUserRef({ id: ..., uid: ..., email: ..., displayName: ..., photoUrl: ..., linkedWorkerIds: ..., role: ..., lastLogin: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAppUserRef(dataConnect, createAppUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.appUser_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.appUser_insert);
});
```

## UpdateAppUser
You can execute the `UpdateAppUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateAppUser(vars: UpdateAppUserVariables): MutationPromise<UpdateAppUserData, UpdateAppUserVariables>;

interface UpdateAppUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAppUserVariables): MutationRef<UpdateAppUserData, UpdateAppUserVariables>;
}
export const updateAppUserRef: UpdateAppUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateAppUser(dc: DataConnect, vars: UpdateAppUserVariables): MutationPromise<UpdateAppUserData, UpdateAppUserVariables>;

interface UpdateAppUserRef {
  ...
  (dc: DataConnect, vars: UpdateAppUserVariables): MutationRef<UpdateAppUserData, UpdateAppUserVariables>;
}
export const updateAppUserRef: UpdateAppUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateAppUserRef:
```typescript
const name = updateAppUserRef.operationName;
console.log(name);
```

### Variables
The `UpdateAppUser` mutation requires an argument of type `UpdateAppUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateAppUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateAppUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateAppUserData {
  appUser_update?: AppUser_Key | null;
}
```
### Using `UpdateAppUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateAppUser, UpdateAppUserVariables } from '@dataconnect/generated';

// The `UpdateAppUser` mutation requires an argument of type `UpdateAppUserVariables`:
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

// Call the `updateAppUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateAppUser(updateAppUserVars);
// Variables can be defined inline as well.
const { data } = await updateAppUser({ id: ..., uid: ..., email: ..., displayName: ..., photoUrl: ..., linkedWorkerIds: ..., role: ..., lastLogin: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateAppUser(dataConnect, updateAppUserVars);

console.log(data.appUser_update);

// Or, you can use the `Promise` API.
updateAppUser(updateAppUserVars).then((response) => {
  const data = response.data;
  console.log(data.appUser_update);
});
```

### Using `UpdateAppUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateAppUserRef, UpdateAppUserVariables } from '@dataconnect/generated';

// The `UpdateAppUser` mutation requires an argument of type `UpdateAppUserVariables`:
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

// Call the `updateAppUserRef()` function to get a reference to the mutation.
const ref = updateAppUserRef(updateAppUserVars);
// Variables can be defined inline as well.
const ref = updateAppUserRef({ id: ..., uid: ..., email: ..., displayName: ..., photoUrl: ..., linkedWorkerIds: ..., role: ..., lastLogin: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateAppUserRef(dataConnect, updateAppUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.appUser_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.appUser_update);
});
```

## DeleteAppUser
You can execute the `DeleteAppUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteAppUser(vars: DeleteAppUserVariables): MutationPromise<DeleteAppUserData, DeleteAppUserVariables>;

interface DeleteAppUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAppUserVariables): MutationRef<DeleteAppUserData, DeleteAppUserVariables>;
}
export const deleteAppUserRef: DeleteAppUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteAppUser(dc: DataConnect, vars: DeleteAppUserVariables): MutationPromise<DeleteAppUserData, DeleteAppUserVariables>;

interface DeleteAppUserRef {
  ...
  (dc: DataConnect, vars: DeleteAppUserVariables): MutationRef<DeleteAppUserData, DeleteAppUserVariables>;
}
export const deleteAppUserRef: DeleteAppUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteAppUserRef:
```typescript
const name = deleteAppUserRef.operationName;
console.log(name);
```

### Variables
The `DeleteAppUser` mutation requires an argument of type `DeleteAppUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteAppUserVariables {
  id: string;
}
```
### Return Type
Recall that executing the `DeleteAppUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteAppUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteAppUserData {
  appUser_delete?: AppUser_Key | null;
}
```
### Using `DeleteAppUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteAppUser, DeleteAppUserVariables } from '@dataconnect/generated';

// The `DeleteAppUser` mutation requires an argument of type `DeleteAppUserVariables`:
const deleteAppUserVars: DeleteAppUserVariables = {
  id: ..., 
};

// Call the `deleteAppUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteAppUser(deleteAppUserVars);
// Variables can be defined inline as well.
const { data } = await deleteAppUser({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteAppUser(dataConnect, deleteAppUserVars);

console.log(data.appUser_delete);

// Or, you can use the `Promise` API.
deleteAppUser(deleteAppUserVars).then((response) => {
  const data = response.data;
  console.log(data.appUser_delete);
});
```

### Using `DeleteAppUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteAppUserRef, DeleteAppUserVariables } from '@dataconnect/generated';

// The `DeleteAppUser` mutation requires an argument of type `DeleteAppUserVariables`:
const deleteAppUserVars: DeleteAppUserVariables = {
  id: ..., 
};

// Call the `deleteAppUserRef()` function to get a reference to the mutation.
const ref = deleteAppUserRef(deleteAppUserVars);
// Variables can be defined inline as well.
const ref = deleteAppUserRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteAppUserRef(dataConnect, deleteAppUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.appUser_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.appUser_delete);
});
```

## CreateMenuConfig
You can execute the `CreateMenuConfig` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createMenuConfig(vars: CreateMenuConfigVariables): MutationPromise<CreateMenuConfigData, CreateMenuConfigVariables>;

interface CreateMenuConfigRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateMenuConfigVariables): MutationRef<CreateMenuConfigData, CreateMenuConfigVariables>;
}
export const createMenuConfigRef: CreateMenuConfigRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createMenuConfig(dc: DataConnect, vars: CreateMenuConfigVariables): MutationPromise<CreateMenuConfigData, CreateMenuConfigVariables>;

interface CreateMenuConfigRef {
  ...
  (dc: DataConnect, vars: CreateMenuConfigVariables): MutationRef<CreateMenuConfigData, CreateMenuConfigVariables>;
}
export const createMenuConfigRef: CreateMenuConfigRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createMenuConfigRef:
```typescript
const name = createMenuConfigRef.operationName;
console.log(name);
```

### Variables
The `CreateMenuConfig` mutation requires an argument of type `CreateMenuConfigVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateMenuConfigVariables {
  id: string;
  config: string;
}
```
### Return Type
Recall that executing the `CreateMenuConfig` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateMenuConfigData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateMenuConfigData {
  menuConfig_insert: MenuConfig_Key;
}
```
### Using `CreateMenuConfig`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createMenuConfig, CreateMenuConfigVariables } from '@dataconnect/generated';

// The `CreateMenuConfig` mutation requires an argument of type `CreateMenuConfigVariables`:
const createMenuConfigVars: CreateMenuConfigVariables = {
  id: ..., 
  config: ..., 
};

// Call the `createMenuConfig()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createMenuConfig(createMenuConfigVars);
// Variables can be defined inline as well.
const { data } = await createMenuConfig({ id: ..., config: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createMenuConfig(dataConnect, createMenuConfigVars);

console.log(data.menuConfig_insert);

// Or, you can use the `Promise` API.
createMenuConfig(createMenuConfigVars).then((response) => {
  const data = response.data;
  console.log(data.menuConfig_insert);
});
```

### Using `CreateMenuConfig`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createMenuConfigRef, CreateMenuConfigVariables } from '@dataconnect/generated';

// The `CreateMenuConfig` mutation requires an argument of type `CreateMenuConfigVariables`:
const createMenuConfigVars: CreateMenuConfigVariables = {
  id: ..., 
  config: ..., 
};

// Call the `createMenuConfigRef()` function to get a reference to the mutation.
const ref = createMenuConfigRef(createMenuConfigVars);
// Variables can be defined inline as well.
const ref = createMenuConfigRef({ id: ..., config: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createMenuConfigRef(dataConnect, createMenuConfigVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.menuConfig_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.menuConfig_insert);
});
```

## UpdateMenuConfig
You can execute the `UpdateMenuConfig` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateMenuConfig(vars: UpdateMenuConfigVariables): MutationPromise<UpdateMenuConfigData, UpdateMenuConfigVariables>;

interface UpdateMenuConfigRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMenuConfigVariables): MutationRef<UpdateMenuConfigData, UpdateMenuConfigVariables>;
}
export const updateMenuConfigRef: UpdateMenuConfigRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateMenuConfig(dc: DataConnect, vars: UpdateMenuConfigVariables): MutationPromise<UpdateMenuConfigData, UpdateMenuConfigVariables>;

interface UpdateMenuConfigRef {
  ...
  (dc: DataConnect, vars: UpdateMenuConfigVariables): MutationRef<UpdateMenuConfigData, UpdateMenuConfigVariables>;
}
export const updateMenuConfigRef: UpdateMenuConfigRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateMenuConfigRef:
```typescript
const name = updateMenuConfigRef.operationName;
console.log(name);
```

### Variables
The `UpdateMenuConfig` mutation requires an argument of type `UpdateMenuConfigVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateMenuConfigVariables {
  id: string;
  config: string;
}
```
### Return Type
Recall that executing the `UpdateMenuConfig` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateMenuConfigData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateMenuConfigData {
  menuConfig_update?: MenuConfig_Key | null;
}
```
### Using `UpdateMenuConfig`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateMenuConfig, UpdateMenuConfigVariables } from '@dataconnect/generated';

// The `UpdateMenuConfig` mutation requires an argument of type `UpdateMenuConfigVariables`:
const updateMenuConfigVars: UpdateMenuConfigVariables = {
  id: ..., 
  config: ..., 
};

// Call the `updateMenuConfig()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateMenuConfig(updateMenuConfigVars);
// Variables can be defined inline as well.
const { data } = await updateMenuConfig({ id: ..., config: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateMenuConfig(dataConnect, updateMenuConfigVars);

console.log(data.menuConfig_update);

// Or, you can use the `Promise` API.
updateMenuConfig(updateMenuConfigVars).then((response) => {
  const data = response.data;
  console.log(data.menuConfig_update);
});
```

### Using `UpdateMenuConfig`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateMenuConfigRef, UpdateMenuConfigVariables } from '@dataconnect/generated';

// The `UpdateMenuConfig` mutation requires an argument of type `UpdateMenuConfigVariables`:
const updateMenuConfigVars: UpdateMenuConfigVariables = {
  id: ..., 
  config: ..., 
};

// Call the `updateMenuConfigRef()` function to get a reference to the mutation.
const ref = updateMenuConfigRef(updateMenuConfigVars);
// Variables can be defined inline as well.
const ref = updateMenuConfigRef({ id: ..., config: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateMenuConfigRef(dataConnect, updateMenuConfigVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.menuConfig_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.menuConfig_update);
});
```

## DeleteMenuConfig
You can execute the `DeleteMenuConfig` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteMenuConfig(vars: DeleteMenuConfigVariables): MutationPromise<DeleteMenuConfigData, DeleteMenuConfigVariables>;

interface DeleteMenuConfigRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteMenuConfigVariables): MutationRef<DeleteMenuConfigData, DeleteMenuConfigVariables>;
}
export const deleteMenuConfigRef: DeleteMenuConfigRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteMenuConfig(dc: DataConnect, vars: DeleteMenuConfigVariables): MutationPromise<DeleteMenuConfigData, DeleteMenuConfigVariables>;

interface DeleteMenuConfigRef {
  ...
  (dc: DataConnect, vars: DeleteMenuConfigVariables): MutationRef<DeleteMenuConfigData, DeleteMenuConfigVariables>;
}
export const deleteMenuConfigRef: DeleteMenuConfigRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteMenuConfigRef:
```typescript
const name = deleteMenuConfigRef.operationName;
console.log(name);
```

### Variables
The `DeleteMenuConfig` mutation requires an argument of type `DeleteMenuConfigVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteMenuConfigVariables {
  id: string;
}
```
### Return Type
Recall that executing the `DeleteMenuConfig` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteMenuConfigData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteMenuConfigData {
  menuConfig_delete?: MenuConfig_Key | null;
}
```
### Using `DeleteMenuConfig`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteMenuConfig, DeleteMenuConfigVariables } from '@dataconnect/generated';

// The `DeleteMenuConfig` mutation requires an argument of type `DeleteMenuConfigVariables`:
const deleteMenuConfigVars: DeleteMenuConfigVariables = {
  id: ..., 
};

// Call the `deleteMenuConfig()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteMenuConfig(deleteMenuConfigVars);
// Variables can be defined inline as well.
const { data } = await deleteMenuConfig({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteMenuConfig(dataConnect, deleteMenuConfigVars);

console.log(data.menuConfig_delete);

// Or, you can use the `Promise` API.
deleteMenuConfig(deleteMenuConfigVars).then((response) => {
  const data = response.data;
  console.log(data.menuConfig_delete);
});
```

### Using `DeleteMenuConfig`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteMenuConfigRef, DeleteMenuConfigVariables } from '@dataconnect/generated';

// The `DeleteMenuConfig` mutation requires an argument of type `DeleteMenuConfigVariables`:
const deleteMenuConfigVars: DeleteMenuConfigVariables = {
  id: ..., 
};

// Call the `deleteMenuConfigRef()` function to get a reference to the mutation.
const ref = deleteMenuConfigRef(deleteMenuConfigVars);
// Variables can be defined inline as well.
const ref = deleteMenuConfigRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteMenuConfigRef(dataConnect, deleteMenuConfigVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.menuConfig_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.menuConfig_delete);
});
```

## CreateSystemLog
You can execute the `CreateSystemLog` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createSystemLog(vars: CreateSystemLogVariables): MutationPromise<CreateSystemLogData, CreateSystemLogVariables>;

interface CreateSystemLogRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSystemLogVariables): MutationRef<CreateSystemLogData, CreateSystemLogVariables>;
}
export const createSystemLogRef: CreateSystemLogRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createSystemLog(dc: DataConnect, vars: CreateSystemLogVariables): MutationPromise<CreateSystemLogData, CreateSystemLogVariables>;

interface CreateSystemLogRef {
  ...
  (dc: DataConnect, vars: CreateSystemLogVariables): MutationRef<CreateSystemLogData, CreateSystemLogVariables>;
}
export const createSystemLogRef: CreateSystemLogRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createSystemLogRef:
```typescript
const name = createSystemLogRef.operationName;
console.log(name);
```

### Variables
The `CreateSystemLog` mutation requires an argument of type `CreateSystemLogVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateSystemLogVariables {
  category: string;
  action: string;
  userEmail?: string | null;
  details?: string | null;
}
```
### Return Type
Recall that executing the `CreateSystemLog` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateSystemLogData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateSystemLogData {
  systemLog_insert: SystemLog_Key;
}
```
### Using `CreateSystemLog`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSystemLog, CreateSystemLogVariables } from '@dataconnect/generated';

// The `CreateSystemLog` mutation requires an argument of type `CreateSystemLogVariables`:
const createSystemLogVars: CreateSystemLogVariables = {
  category: ..., 
  action: ..., 
  userEmail: ..., // optional
  details: ..., // optional
};

// Call the `createSystemLog()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createSystemLog(createSystemLogVars);
// Variables can be defined inline as well.
const { data } = await createSystemLog({ category: ..., action: ..., userEmail: ..., details: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createSystemLog(dataConnect, createSystemLogVars);

console.log(data.systemLog_insert);

// Or, you can use the `Promise` API.
createSystemLog(createSystemLogVars).then((response) => {
  const data = response.data;
  console.log(data.systemLog_insert);
});
```

### Using `CreateSystemLog`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createSystemLogRef, CreateSystemLogVariables } from '@dataconnect/generated';

// The `CreateSystemLog` mutation requires an argument of type `CreateSystemLogVariables`:
const createSystemLogVars: CreateSystemLogVariables = {
  category: ..., 
  action: ..., 
  userEmail: ..., // optional
  details: ..., // optional
};

// Call the `createSystemLogRef()` function to get a reference to the mutation.
const ref = createSystemLogRef(createSystemLogVars);
// Variables can be defined inline as well.
const ref = createSystemLogRef({ category: ..., action: ..., userEmail: ..., details: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createSystemLogRef(dataConnect, createSystemLogVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.systemLog_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.systemLog_insert);
});
```

## CreateAccommodation
You can execute the `CreateAccommodation` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAccommodation(vars: CreateAccommodationVariables): MutationPromise<CreateAccommodationData, CreateAccommodationVariables>;

interface CreateAccommodationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccommodationVariables): MutationRef<CreateAccommodationData, CreateAccommodationVariables>;
}
export const createAccommodationRef: CreateAccommodationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAccommodation(dc: DataConnect, vars: CreateAccommodationVariables): MutationPromise<CreateAccommodationData, CreateAccommodationVariables>;

interface CreateAccommodationRef {
  ...
  (dc: DataConnect, vars: CreateAccommodationVariables): MutationRef<CreateAccommodationData, CreateAccommodationVariables>;
}
export const createAccommodationRef: CreateAccommodationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAccommodationRef:
```typescript
const name = createAccommodationRef.operationName;
console.log(name);
```

### Variables
The `CreateAccommodation` mutation requires an argument of type `CreateAccommodationVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateAccommodation` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAccommodationData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAccommodationData {
  accommodation_insert: Accommodation_Key;
}
```
### Using `CreateAccommodation`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAccommodation, CreateAccommodationVariables } from '@dataconnect/generated';

// The `CreateAccommodation` mutation requires an argument of type `CreateAccommodationVariables`:
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

// Call the `createAccommodation()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAccommodation(createAccommodationVars);
// Variables can be defined inline as well.
const { data } = await createAccommodation({ id: ..., legacyId: ..., name: ..., address: ..., type: ..., status: ..., ownership: ..., electricityMode: ..., gasMode: ..., waterMode: ..., internetMode: ..., maintenanceMode: ..., fixedElectricity: ..., fixedGas: ..., fixedWater: ..., fixedInternet: ..., fixedMaintenance: ..., contractStartDate: ..., contractEndDate: ..., deposit: ..., monthlyRent: ..., paymentDay: ..., landlordName: ..., landlordContact: ..., isReported: ..., bankName: ..., accountNumber: ..., accountHolder: ..., rentPayDate: ..., isAutoTransfer: ..., transferDay: ..., transferAccountInfo: ..., billingTargetType: ..., billingTargetTeamId: ..., billingTargetTeamName: ..., billingTargetWorkerId: ..., billingTargetWorkerName: ..., currentOccupantName: ..., currentOccupantPhone: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAccommodation(dataConnect, createAccommodationVars);

console.log(data.accommodation_insert);

// Or, you can use the `Promise` API.
createAccommodation(createAccommodationVars).then((response) => {
  const data = response.data;
  console.log(data.accommodation_insert);
});
```

### Using `CreateAccommodation`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAccommodationRef, CreateAccommodationVariables } from '@dataconnect/generated';

// The `CreateAccommodation` mutation requires an argument of type `CreateAccommodationVariables`:
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

// Call the `createAccommodationRef()` function to get a reference to the mutation.
const ref = createAccommodationRef(createAccommodationVars);
// Variables can be defined inline as well.
const ref = createAccommodationRef({ id: ..., legacyId: ..., name: ..., address: ..., type: ..., status: ..., ownership: ..., electricityMode: ..., gasMode: ..., waterMode: ..., internetMode: ..., maintenanceMode: ..., fixedElectricity: ..., fixedGas: ..., fixedWater: ..., fixedInternet: ..., fixedMaintenance: ..., contractStartDate: ..., contractEndDate: ..., deposit: ..., monthlyRent: ..., paymentDay: ..., landlordName: ..., landlordContact: ..., isReported: ..., bankName: ..., accountNumber: ..., accountHolder: ..., rentPayDate: ..., isAutoTransfer: ..., transferDay: ..., transferAccountInfo: ..., billingTargetType: ..., billingTargetTeamId: ..., billingTargetTeamName: ..., billingTargetWorkerId: ..., billingTargetWorkerName: ..., currentOccupantName: ..., currentOccupantPhone: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAccommodationRef(dataConnect, createAccommodationVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accommodation_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodation_insert);
});
```

## UpdateAccommodation
You can execute the `UpdateAccommodation` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateAccommodation(vars: UpdateAccommodationVariables): MutationPromise<UpdateAccommodationData, UpdateAccommodationVariables>;

interface UpdateAccommodationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAccommodationVariables): MutationRef<UpdateAccommodationData, UpdateAccommodationVariables>;
}
export const updateAccommodationRef: UpdateAccommodationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateAccommodation(dc: DataConnect, vars: UpdateAccommodationVariables): MutationPromise<UpdateAccommodationData, UpdateAccommodationVariables>;

interface UpdateAccommodationRef {
  ...
  (dc: DataConnect, vars: UpdateAccommodationVariables): MutationRef<UpdateAccommodationData, UpdateAccommodationVariables>;
}
export const updateAccommodationRef: UpdateAccommodationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateAccommodationRef:
```typescript
const name = updateAccommodationRef.operationName;
console.log(name);
```

### Variables
The `UpdateAccommodation` mutation requires an argument of type `UpdateAccommodationVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateAccommodation` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateAccommodationData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateAccommodationData {
  accommodation_update?: Accommodation_Key | null;
}
```
### Using `UpdateAccommodation`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateAccommodation, UpdateAccommodationVariables } from '@dataconnect/generated';

// The `UpdateAccommodation` mutation requires an argument of type `UpdateAccommodationVariables`:
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

// Call the `updateAccommodation()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateAccommodation(updateAccommodationVars);
// Variables can be defined inline as well.
const { data } = await updateAccommodation({ id: ..., name: ..., address: ..., type: ..., status: ..., ownership: ..., electricityMode: ..., gasMode: ..., waterMode: ..., internetMode: ..., maintenanceMode: ..., fixedElectricity: ..., fixedGas: ..., fixedWater: ..., fixedInternet: ..., fixedMaintenance: ..., contractStartDate: ..., contractEndDate: ..., deposit: ..., monthlyRent: ..., paymentDay: ..., landlordName: ..., landlordContact: ..., isReported: ..., bankName: ..., accountNumber: ..., accountHolder: ..., rentPayDate: ..., isAutoTransfer: ..., transferDay: ..., transferAccountInfo: ..., billingTargetType: ..., billingTargetTeamId: ..., billingTargetTeamName: ..., billingTargetWorkerId: ..., billingTargetWorkerName: ..., currentOccupantName: ..., currentOccupantPhone: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateAccommodation(dataConnect, updateAccommodationVars);

console.log(data.accommodation_update);

// Or, you can use the `Promise` API.
updateAccommodation(updateAccommodationVars).then((response) => {
  const data = response.data;
  console.log(data.accommodation_update);
});
```

### Using `UpdateAccommodation`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateAccommodationRef, UpdateAccommodationVariables } from '@dataconnect/generated';

// The `UpdateAccommodation` mutation requires an argument of type `UpdateAccommodationVariables`:
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

// Call the `updateAccommodationRef()` function to get a reference to the mutation.
const ref = updateAccommodationRef(updateAccommodationVars);
// Variables can be defined inline as well.
const ref = updateAccommodationRef({ id: ..., name: ..., address: ..., type: ..., status: ..., ownership: ..., electricityMode: ..., gasMode: ..., waterMode: ..., internetMode: ..., maintenanceMode: ..., fixedElectricity: ..., fixedGas: ..., fixedWater: ..., fixedInternet: ..., fixedMaintenance: ..., contractStartDate: ..., contractEndDate: ..., deposit: ..., monthlyRent: ..., paymentDay: ..., landlordName: ..., landlordContact: ..., isReported: ..., bankName: ..., accountNumber: ..., accountHolder: ..., rentPayDate: ..., isAutoTransfer: ..., transferDay: ..., transferAccountInfo: ..., billingTargetType: ..., billingTargetTeamId: ..., billingTargetTeamName: ..., billingTargetWorkerId: ..., billingTargetWorkerName: ..., currentOccupantName: ..., currentOccupantPhone: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateAccommodationRef(dataConnect, updateAccommodationVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accommodation_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodation_update);
});
```

## DeleteAccommodation
You can execute the `DeleteAccommodation` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteAccommodation(vars: DeleteAccommodationVariables): MutationPromise<DeleteAccommodationData, DeleteAccommodationVariables>;

interface DeleteAccommodationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAccommodationVariables): MutationRef<DeleteAccommodationData, DeleteAccommodationVariables>;
}
export const deleteAccommodationRef: DeleteAccommodationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteAccommodation(dc: DataConnect, vars: DeleteAccommodationVariables): MutationPromise<DeleteAccommodationData, DeleteAccommodationVariables>;

interface DeleteAccommodationRef {
  ...
  (dc: DataConnect, vars: DeleteAccommodationVariables): MutationRef<DeleteAccommodationData, DeleteAccommodationVariables>;
}
export const deleteAccommodationRef: DeleteAccommodationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteAccommodationRef:
```typescript
const name = deleteAccommodationRef.operationName;
console.log(name);
```

### Variables
The `DeleteAccommodation` mutation requires an argument of type `DeleteAccommodationVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteAccommodationVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteAccommodation` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteAccommodationData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteAccommodationData {
  accommodation_delete?: Accommodation_Key | null;
}
```
### Using `DeleteAccommodation`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteAccommodation, DeleteAccommodationVariables } from '@dataconnect/generated';

// The `DeleteAccommodation` mutation requires an argument of type `DeleteAccommodationVariables`:
const deleteAccommodationVars: DeleteAccommodationVariables = {
  id: ..., 
};

// Call the `deleteAccommodation()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteAccommodation(deleteAccommodationVars);
// Variables can be defined inline as well.
const { data } = await deleteAccommodation({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteAccommodation(dataConnect, deleteAccommodationVars);

console.log(data.accommodation_delete);

// Or, you can use the `Promise` API.
deleteAccommodation(deleteAccommodationVars).then((response) => {
  const data = response.data;
  console.log(data.accommodation_delete);
});
```

### Using `DeleteAccommodation`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteAccommodationRef, DeleteAccommodationVariables } from '@dataconnect/generated';

// The `DeleteAccommodation` mutation requires an argument of type `DeleteAccommodationVariables`:
const deleteAccommodationVars: DeleteAccommodationVariables = {
  id: ..., 
};

// Call the `deleteAccommodationRef()` function to get a reference to the mutation.
const ref = deleteAccommodationRef(deleteAccommodationVars);
// Variables can be defined inline as well.
const ref = deleteAccommodationRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteAccommodationRef(dataConnect, deleteAccommodationVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accommodation_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodation_delete);
});
```

## CreateAccommodationAssignment
You can execute the `CreateAccommodationAssignment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAccommodationAssignment(vars: CreateAccommodationAssignmentVariables): MutationPromise<CreateAccommodationAssignmentData, CreateAccommodationAssignmentVariables>;

interface CreateAccommodationAssignmentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccommodationAssignmentVariables): MutationRef<CreateAccommodationAssignmentData, CreateAccommodationAssignmentVariables>;
}
export const createAccommodationAssignmentRef: CreateAccommodationAssignmentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAccommodationAssignment(dc: DataConnect, vars: CreateAccommodationAssignmentVariables): MutationPromise<CreateAccommodationAssignmentData, CreateAccommodationAssignmentVariables>;

interface CreateAccommodationAssignmentRef {
  ...
  (dc: DataConnect, vars: CreateAccommodationAssignmentVariables): MutationRef<CreateAccommodationAssignmentData, CreateAccommodationAssignmentVariables>;
}
export const createAccommodationAssignmentRef: CreateAccommodationAssignmentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAccommodationAssignmentRef:
```typescript
const name = createAccommodationAssignmentRef.operationName;
console.log(name);
```

### Variables
The `CreateAccommodationAssignment` mutation requires an argument of type `CreateAccommodationAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateAccommodationAssignment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAccommodationAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAccommodationAssignmentData {
  accommodationAssignment_insert: AccommodationAssignment_Key;
}
```
### Using `CreateAccommodationAssignment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAccommodationAssignment, CreateAccommodationAssignmentVariables } from '@dataconnect/generated';

// The `CreateAccommodationAssignment` mutation requires an argument of type `CreateAccommodationAssignmentVariables`:
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

// Call the `createAccommodationAssignment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAccommodationAssignment(createAccommodationAssignmentVars);
// Variables can be defined inline as well.
const { data } = await createAccommodationAssignment({ id: ..., legacyId: ..., accommodationId: ..., teamId: ..., teamName: ..., workerId: ..., workerName: ..., startDate: ..., endDate: ..., status: ..., source: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAccommodationAssignment(dataConnect, createAccommodationAssignmentVars);

console.log(data.accommodationAssignment_insert);

// Or, you can use the `Promise` API.
createAccommodationAssignment(createAccommodationAssignmentVars).then((response) => {
  const data = response.data;
  console.log(data.accommodationAssignment_insert);
});
```

### Using `CreateAccommodationAssignment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAccommodationAssignmentRef, CreateAccommodationAssignmentVariables } from '@dataconnect/generated';

// The `CreateAccommodationAssignment` mutation requires an argument of type `CreateAccommodationAssignmentVariables`:
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

// Call the `createAccommodationAssignmentRef()` function to get a reference to the mutation.
const ref = createAccommodationAssignmentRef(createAccommodationAssignmentVars);
// Variables can be defined inline as well.
const ref = createAccommodationAssignmentRef({ id: ..., legacyId: ..., accommodationId: ..., teamId: ..., teamName: ..., workerId: ..., workerName: ..., startDate: ..., endDate: ..., status: ..., source: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAccommodationAssignmentRef(dataConnect, createAccommodationAssignmentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accommodationAssignment_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodationAssignment_insert);
});
```

## UpdateAccommodationAssignment
You can execute the `UpdateAccommodationAssignment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateAccommodationAssignment(vars: UpdateAccommodationAssignmentVariables): MutationPromise<UpdateAccommodationAssignmentData, UpdateAccommodationAssignmentVariables>;

interface UpdateAccommodationAssignmentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAccommodationAssignmentVariables): MutationRef<UpdateAccommodationAssignmentData, UpdateAccommodationAssignmentVariables>;
}
export const updateAccommodationAssignmentRef: UpdateAccommodationAssignmentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateAccommodationAssignment(dc: DataConnect, vars: UpdateAccommodationAssignmentVariables): MutationPromise<UpdateAccommodationAssignmentData, UpdateAccommodationAssignmentVariables>;

interface UpdateAccommodationAssignmentRef {
  ...
  (dc: DataConnect, vars: UpdateAccommodationAssignmentVariables): MutationRef<UpdateAccommodationAssignmentData, UpdateAccommodationAssignmentVariables>;
}
export const updateAccommodationAssignmentRef: UpdateAccommodationAssignmentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateAccommodationAssignmentRef:
```typescript
const name = updateAccommodationAssignmentRef.operationName;
console.log(name);
```

### Variables
The `UpdateAccommodationAssignment` mutation requires an argument of type `UpdateAccommodationAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateAccommodationAssignment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateAccommodationAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateAccommodationAssignmentData {
  accommodationAssignment_update?: AccommodationAssignment_Key | null;
}
```
### Using `UpdateAccommodationAssignment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateAccommodationAssignment, UpdateAccommodationAssignmentVariables } from '@dataconnect/generated';

// The `UpdateAccommodationAssignment` mutation requires an argument of type `UpdateAccommodationAssignmentVariables`:
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

// Call the `updateAccommodationAssignment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateAccommodationAssignment(updateAccommodationAssignmentVars);
// Variables can be defined inline as well.
const { data } = await updateAccommodationAssignment({ id: ..., accommodationId: ..., teamId: ..., teamName: ..., workerId: ..., workerName: ..., startDate: ..., endDate: ..., status: ..., source: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateAccommodationAssignment(dataConnect, updateAccommodationAssignmentVars);

console.log(data.accommodationAssignment_update);

// Or, you can use the `Promise` API.
updateAccommodationAssignment(updateAccommodationAssignmentVars).then((response) => {
  const data = response.data;
  console.log(data.accommodationAssignment_update);
});
```

### Using `UpdateAccommodationAssignment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateAccommodationAssignmentRef, UpdateAccommodationAssignmentVariables } from '@dataconnect/generated';

// The `UpdateAccommodationAssignment` mutation requires an argument of type `UpdateAccommodationAssignmentVariables`:
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

// Call the `updateAccommodationAssignmentRef()` function to get a reference to the mutation.
const ref = updateAccommodationAssignmentRef(updateAccommodationAssignmentVars);
// Variables can be defined inline as well.
const ref = updateAccommodationAssignmentRef({ id: ..., accommodationId: ..., teamId: ..., teamName: ..., workerId: ..., workerName: ..., startDate: ..., endDate: ..., status: ..., source: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateAccommodationAssignmentRef(dataConnect, updateAccommodationAssignmentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accommodationAssignment_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodationAssignment_update);
});
```

## DeleteAccommodationAssignment
You can execute the `DeleteAccommodationAssignment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteAccommodationAssignment(vars: DeleteAccommodationAssignmentVariables): MutationPromise<DeleteAccommodationAssignmentData, DeleteAccommodationAssignmentVariables>;

interface DeleteAccommodationAssignmentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAccommodationAssignmentVariables): MutationRef<DeleteAccommodationAssignmentData, DeleteAccommodationAssignmentVariables>;
}
export const deleteAccommodationAssignmentRef: DeleteAccommodationAssignmentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteAccommodationAssignment(dc: DataConnect, vars: DeleteAccommodationAssignmentVariables): MutationPromise<DeleteAccommodationAssignmentData, DeleteAccommodationAssignmentVariables>;

interface DeleteAccommodationAssignmentRef {
  ...
  (dc: DataConnect, vars: DeleteAccommodationAssignmentVariables): MutationRef<DeleteAccommodationAssignmentData, DeleteAccommodationAssignmentVariables>;
}
export const deleteAccommodationAssignmentRef: DeleteAccommodationAssignmentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteAccommodationAssignmentRef:
```typescript
const name = deleteAccommodationAssignmentRef.operationName;
console.log(name);
```

### Variables
The `DeleteAccommodationAssignment` mutation requires an argument of type `DeleteAccommodationAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteAccommodationAssignmentVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteAccommodationAssignment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteAccommodationAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteAccommodationAssignmentData {
  accommodationAssignment_delete?: AccommodationAssignment_Key | null;
}
```
### Using `DeleteAccommodationAssignment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteAccommodationAssignment, DeleteAccommodationAssignmentVariables } from '@dataconnect/generated';

// The `DeleteAccommodationAssignment` mutation requires an argument of type `DeleteAccommodationAssignmentVariables`:
const deleteAccommodationAssignmentVars: DeleteAccommodationAssignmentVariables = {
  id: ..., 
};

// Call the `deleteAccommodationAssignment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteAccommodationAssignment(deleteAccommodationAssignmentVars);
// Variables can be defined inline as well.
const { data } = await deleteAccommodationAssignment({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteAccommodationAssignment(dataConnect, deleteAccommodationAssignmentVars);

console.log(data.accommodationAssignment_delete);

// Or, you can use the `Promise` API.
deleteAccommodationAssignment(deleteAccommodationAssignmentVars).then((response) => {
  const data = response.data;
  console.log(data.accommodationAssignment_delete);
});
```

### Using `DeleteAccommodationAssignment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteAccommodationAssignmentRef, DeleteAccommodationAssignmentVariables } from '@dataconnect/generated';

// The `DeleteAccommodationAssignment` mutation requires an argument of type `DeleteAccommodationAssignmentVariables`:
const deleteAccommodationAssignmentVars: DeleteAccommodationAssignmentVariables = {
  id: ..., 
};

// Call the `deleteAccommodationAssignmentRef()` function to get a reference to the mutation.
const ref = deleteAccommodationAssignmentRef(deleteAccommodationAssignmentVars);
// Variables can be defined inline as well.
const ref = deleteAccommodationAssignmentRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteAccommodationAssignmentRef(dataConnect, deleteAccommodationAssignmentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accommodationAssignment_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodationAssignment_delete);
});
```

## CreateUtilityRecord
You can execute the `CreateUtilityRecord` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUtilityRecord(vars: CreateUtilityRecordVariables): MutationPromise<CreateUtilityRecordData, CreateUtilityRecordVariables>;

interface CreateUtilityRecordRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUtilityRecordVariables): MutationRef<CreateUtilityRecordData, CreateUtilityRecordVariables>;
}
export const createUtilityRecordRef: CreateUtilityRecordRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUtilityRecord(dc: DataConnect, vars: CreateUtilityRecordVariables): MutationPromise<CreateUtilityRecordData, CreateUtilityRecordVariables>;

interface CreateUtilityRecordRef {
  ...
  (dc: DataConnect, vars: CreateUtilityRecordVariables): MutationRef<CreateUtilityRecordData, CreateUtilityRecordVariables>;
}
export const createUtilityRecordRef: CreateUtilityRecordRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUtilityRecordRef:
```typescript
const name = createUtilityRecordRef.operationName;
console.log(name);
```

### Variables
The `CreateUtilityRecord` mutation requires an argument of type `CreateUtilityRecordVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateUtilityRecord` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUtilityRecordData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUtilityRecordData {
  utilityRecord_insert: UtilityRecord_Key;
}
```
### Using `CreateUtilityRecord`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUtilityRecord, CreateUtilityRecordVariables } from '@dataconnect/generated';

// The `CreateUtilityRecord` mutation requires an argument of type `CreateUtilityRecordVariables`:
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

// Call the `createUtilityRecord()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUtilityRecord(createUtilityRecordVars);
// Variables can be defined inline as well.
const { data } = await createUtilityRecord({ id: ..., legacyId: ..., accommodationId: ..., yearMonth: ..., accommodationName: ..., costs: ..., paymentDate: ..., paymentStatus: ..., memo: ..., isAnomaly: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUtilityRecord(dataConnect, createUtilityRecordVars);

console.log(data.utilityRecord_insert);

// Or, you can use the `Promise` API.
createUtilityRecord(createUtilityRecordVars).then((response) => {
  const data = response.data;
  console.log(data.utilityRecord_insert);
});
```

### Using `CreateUtilityRecord`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUtilityRecordRef, CreateUtilityRecordVariables } from '@dataconnect/generated';

// The `CreateUtilityRecord` mutation requires an argument of type `CreateUtilityRecordVariables`:
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

// Call the `createUtilityRecordRef()` function to get a reference to the mutation.
const ref = createUtilityRecordRef(createUtilityRecordVars);
// Variables can be defined inline as well.
const ref = createUtilityRecordRef({ id: ..., legacyId: ..., accommodationId: ..., yearMonth: ..., accommodationName: ..., costs: ..., paymentDate: ..., paymentStatus: ..., memo: ..., isAnomaly: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUtilityRecordRef(dataConnect, createUtilityRecordVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.utilityRecord_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.utilityRecord_insert);
});
```

## UpdateUtilityRecord
You can execute the `UpdateUtilityRecord` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateUtilityRecord(vars: UpdateUtilityRecordVariables): MutationPromise<UpdateUtilityRecordData, UpdateUtilityRecordVariables>;

interface UpdateUtilityRecordRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUtilityRecordVariables): MutationRef<UpdateUtilityRecordData, UpdateUtilityRecordVariables>;
}
export const updateUtilityRecordRef: UpdateUtilityRecordRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUtilityRecord(dc: DataConnect, vars: UpdateUtilityRecordVariables): MutationPromise<UpdateUtilityRecordData, UpdateUtilityRecordVariables>;

interface UpdateUtilityRecordRef {
  ...
  (dc: DataConnect, vars: UpdateUtilityRecordVariables): MutationRef<UpdateUtilityRecordData, UpdateUtilityRecordVariables>;
}
export const updateUtilityRecordRef: UpdateUtilityRecordRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUtilityRecordRef:
```typescript
const name = updateUtilityRecordRef.operationName;
console.log(name);
```

### Variables
The `UpdateUtilityRecord` mutation requires an argument of type `UpdateUtilityRecordVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateUtilityRecord` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUtilityRecordData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUtilityRecordData {
  utilityRecord_update?: UtilityRecord_Key | null;
}
```
### Using `UpdateUtilityRecord`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUtilityRecord, UpdateUtilityRecordVariables } from '@dataconnect/generated';

// The `UpdateUtilityRecord` mutation requires an argument of type `UpdateUtilityRecordVariables`:
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

// Call the `updateUtilityRecord()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUtilityRecord(updateUtilityRecordVars);
// Variables can be defined inline as well.
const { data } = await updateUtilityRecord({ accommodationId: ..., yearMonth: ..., accommodationName: ..., costs: ..., paymentDate: ..., paymentStatus: ..., memo: ..., isAnomaly: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUtilityRecord(dataConnect, updateUtilityRecordVars);

console.log(data.utilityRecord_update);

// Or, you can use the `Promise` API.
updateUtilityRecord(updateUtilityRecordVars).then((response) => {
  const data = response.data;
  console.log(data.utilityRecord_update);
});
```

### Using `UpdateUtilityRecord`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUtilityRecordRef, UpdateUtilityRecordVariables } from '@dataconnect/generated';

// The `UpdateUtilityRecord` mutation requires an argument of type `UpdateUtilityRecordVariables`:
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

// Call the `updateUtilityRecordRef()` function to get a reference to the mutation.
const ref = updateUtilityRecordRef(updateUtilityRecordVars);
// Variables can be defined inline as well.
const ref = updateUtilityRecordRef({ accommodationId: ..., yearMonth: ..., accommodationName: ..., costs: ..., paymentDate: ..., paymentStatus: ..., memo: ..., isAnomaly: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUtilityRecordRef(dataConnect, updateUtilityRecordVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.utilityRecord_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.utilityRecord_update);
});
```

## DeleteUtilityRecord
You can execute the `DeleteUtilityRecord` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteUtilityRecord(vars: DeleteUtilityRecordVariables): MutationPromise<DeleteUtilityRecordData, DeleteUtilityRecordVariables>;

interface DeleteUtilityRecordRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteUtilityRecordVariables): MutationRef<DeleteUtilityRecordData, DeleteUtilityRecordVariables>;
}
export const deleteUtilityRecordRef: DeleteUtilityRecordRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteUtilityRecord(dc: DataConnect, vars: DeleteUtilityRecordVariables): MutationPromise<DeleteUtilityRecordData, DeleteUtilityRecordVariables>;

interface DeleteUtilityRecordRef {
  ...
  (dc: DataConnect, vars: DeleteUtilityRecordVariables): MutationRef<DeleteUtilityRecordData, DeleteUtilityRecordVariables>;
}
export const deleteUtilityRecordRef: DeleteUtilityRecordRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteUtilityRecordRef:
```typescript
const name = deleteUtilityRecordRef.operationName;
console.log(name);
```

### Variables
The `DeleteUtilityRecord` mutation requires an argument of type `DeleteUtilityRecordVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteUtilityRecordVariables {
  accommodationId: UUIDString;
  yearMonth: string;
}
```
### Return Type
Recall that executing the `DeleteUtilityRecord` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteUtilityRecordData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteUtilityRecordData {
  utilityRecord_delete?: UtilityRecord_Key | null;
}
```
### Using `DeleteUtilityRecord`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteUtilityRecord, DeleteUtilityRecordVariables } from '@dataconnect/generated';

// The `DeleteUtilityRecord` mutation requires an argument of type `DeleteUtilityRecordVariables`:
const deleteUtilityRecordVars: DeleteUtilityRecordVariables = {
  accommodationId: ..., 
  yearMonth: ..., 
};

// Call the `deleteUtilityRecord()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteUtilityRecord(deleteUtilityRecordVars);
// Variables can be defined inline as well.
const { data } = await deleteUtilityRecord({ accommodationId: ..., yearMonth: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteUtilityRecord(dataConnect, deleteUtilityRecordVars);

console.log(data.utilityRecord_delete);

// Or, you can use the `Promise` API.
deleteUtilityRecord(deleteUtilityRecordVars).then((response) => {
  const data = response.data;
  console.log(data.utilityRecord_delete);
});
```

### Using `DeleteUtilityRecord`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteUtilityRecordRef, DeleteUtilityRecordVariables } from '@dataconnect/generated';

// The `DeleteUtilityRecord` mutation requires an argument of type `DeleteUtilityRecordVariables`:
const deleteUtilityRecordVars: DeleteUtilityRecordVariables = {
  accommodationId: ..., 
  yearMonth: ..., 
};

// Call the `deleteUtilityRecordRef()` function to get a reference to the mutation.
const ref = deleteUtilityRecordRef(deleteUtilityRecordVars);
// Variables can be defined inline as well.
const ref = deleteUtilityRecordRef({ accommodationId: ..., yearMonth: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteUtilityRecordRef(dataConnect, deleteUtilityRecordVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.utilityRecord_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.utilityRecord_delete);
});
```

## CreateAccommodationBillingDocument
You can execute the `CreateAccommodationBillingDocument` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAccommodationBillingDocument(vars: CreateAccommodationBillingDocumentVariables): MutationPromise<CreateAccommodationBillingDocumentData, CreateAccommodationBillingDocumentVariables>;

interface CreateAccommodationBillingDocumentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccommodationBillingDocumentVariables): MutationRef<CreateAccommodationBillingDocumentData, CreateAccommodationBillingDocumentVariables>;
}
export const createAccommodationBillingDocumentRef: CreateAccommodationBillingDocumentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAccommodationBillingDocument(dc: DataConnect, vars: CreateAccommodationBillingDocumentVariables): MutationPromise<CreateAccommodationBillingDocumentData, CreateAccommodationBillingDocumentVariables>;

interface CreateAccommodationBillingDocumentRef {
  ...
  (dc: DataConnect, vars: CreateAccommodationBillingDocumentVariables): MutationRef<CreateAccommodationBillingDocumentData, CreateAccommodationBillingDocumentVariables>;
}
export const createAccommodationBillingDocumentRef: CreateAccommodationBillingDocumentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAccommodationBillingDocumentRef:
```typescript
const name = createAccommodationBillingDocumentRef.operationName;
console.log(name);
```

### Variables
The `CreateAccommodationBillingDocument` mutation requires an argument of type `CreateAccommodationBillingDocumentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateAccommodationBillingDocument` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAccommodationBillingDocumentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAccommodationBillingDocumentData {
  accommodationBillingDocument_insert: AccommodationBillingDocument_Key;
}
```
### Using `CreateAccommodationBillingDocument`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAccommodationBillingDocument, CreateAccommodationBillingDocumentVariables } from '@dataconnect/generated';

// The `CreateAccommodationBillingDocument` mutation requires an argument of type `CreateAccommodationBillingDocumentVariables`:
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

// Call the `createAccommodationBillingDocument()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAccommodationBillingDocument(createAccommodationBillingDocumentVars);
// Variables can be defined inline as well.
const { data } = await createAccommodationBillingDocument({ id: ..., yearMonth: ..., teamId: ..., teamName: ..., issuedToType: ..., issuedToWorkerId: ..., issuedToWorkerName: ..., status: ..., memo: ..., confirmedAt: ..., postedAdvancePaymentId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAccommodationBillingDocument(dataConnect, createAccommodationBillingDocumentVars);

console.log(data.accommodationBillingDocument_insert);

// Or, you can use the `Promise` API.
createAccommodationBillingDocument(createAccommodationBillingDocumentVars).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingDocument_insert);
});
```

### Using `CreateAccommodationBillingDocument`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAccommodationBillingDocumentRef, CreateAccommodationBillingDocumentVariables } from '@dataconnect/generated';

// The `CreateAccommodationBillingDocument` mutation requires an argument of type `CreateAccommodationBillingDocumentVariables`:
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

// Call the `createAccommodationBillingDocumentRef()` function to get a reference to the mutation.
const ref = createAccommodationBillingDocumentRef(createAccommodationBillingDocumentVars);
// Variables can be defined inline as well.
const ref = createAccommodationBillingDocumentRef({ id: ..., yearMonth: ..., teamId: ..., teamName: ..., issuedToType: ..., issuedToWorkerId: ..., issuedToWorkerName: ..., status: ..., memo: ..., confirmedAt: ..., postedAdvancePaymentId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAccommodationBillingDocumentRef(dataConnect, createAccommodationBillingDocumentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accommodationBillingDocument_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingDocument_insert);
});
```

## UpdateAccommodationBillingDocument
You can execute the `UpdateAccommodationBillingDocument` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateAccommodationBillingDocument(vars: UpdateAccommodationBillingDocumentVariables): MutationPromise<UpdateAccommodationBillingDocumentData, UpdateAccommodationBillingDocumentVariables>;

interface UpdateAccommodationBillingDocumentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAccommodationBillingDocumentVariables): MutationRef<UpdateAccommodationBillingDocumentData, UpdateAccommodationBillingDocumentVariables>;
}
export const updateAccommodationBillingDocumentRef: UpdateAccommodationBillingDocumentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateAccommodationBillingDocument(dc: DataConnect, vars: UpdateAccommodationBillingDocumentVariables): MutationPromise<UpdateAccommodationBillingDocumentData, UpdateAccommodationBillingDocumentVariables>;

interface UpdateAccommodationBillingDocumentRef {
  ...
  (dc: DataConnect, vars: UpdateAccommodationBillingDocumentVariables): MutationRef<UpdateAccommodationBillingDocumentData, UpdateAccommodationBillingDocumentVariables>;
}
export const updateAccommodationBillingDocumentRef: UpdateAccommodationBillingDocumentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateAccommodationBillingDocumentRef:
```typescript
const name = updateAccommodationBillingDocumentRef.operationName;
console.log(name);
```

### Variables
The `UpdateAccommodationBillingDocument` mutation requires an argument of type `UpdateAccommodationBillingDocumentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateAccommodationBillingDocument` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateAccommodationBillingDocumentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateAccommodationBillingDocumentData {
  accommodationBillingDocument_update?: AccommodationBillingDocument_Key | null;
}
```
### Using `UpdateAccommodationBillingDocument`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateAccommodationBillingDocument, UpdateAccommodationBillingDocumentVariables } from '@dataconnect/generated';

// The `UpdateAccommodationBillingDocument` mutation requires an argument of type `UpdateAccommodationBillingDocumentVariables`:
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

// Call the `updateAccommodationBillingDocument()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateAccommodationBillingDocument(updateAccommodationBillingDocumentVars);
// Variables can be defined inline as well.
const { data } = await updateAccommodationBillingDocument({ id: ..., yearMonth: ..., teamId: ..., teamName: ..., issuedToType: ..., issuedToWorkerId: ..., issuedToWorkerName: ..., status: ..., memo: ..., confirmedAt: ..., postedAdvancePaymentId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateAccommodationBillingDocument(dataConnect, updateAccommodationBillingDocumentVars);

console.log(data.accommodationBillingDocument_update);

// Or, you can use the `Promise` API.
updateAccommodationBillingDocument(updateAccommodationBillingDocumentVars).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingDocument_update);
});
```

### Using `UpdateAccommodationBillingDocument`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateAccommodationBillingDocumentRef, UpdateAccommodationBillingDocumentVariables } from '@dataconnect/generated';

// The `UpdateAccommodationBillingDocument` mutation requires an argument of type `UpdateAccommodationBillingDocumentVariables`:
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

// Call the `updateAccommodationBillingDocumentRef()` function to get a reference to the mutation.
const ref = updateAccommodationBillingDocumentRef(updateAccommodationBillingDocumentVars);
// Variables can be defined inline as well.
const ref = updateAccommodationBillingDocumentRef({ id: ..., yearMonth: ..., teamId: ..., teamName: ..., issuedToType: ..., issuedToWorkerId: ..., issuedToWorkerName: ..., status: ..., memo: ..., confirmedAt: ..., postedAdvancePaymentId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateAccommodationBillingDocumentRef(dataConnect, updateAccommodationBillingDocumentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accommodationBillingDocument_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingDocument_update);
});
```

## CreateAccommodationBillingLineItem
You can execute the `CreateAccommodationBillingLineItem` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAccommodationBillingLineItem(vars: CreateAccommodationBillingLineItemVariables): MutationPromise<CreateAccommodationBillingLineItemData, CreateAccommodationBillingLineItemVariables>;

interface CreateAccommodationBillingLineItemRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccommodationBillingLineItemVariables): MutationRef<CreateAccommodationBillingLineItemData, CreateAccommodationBillingLineItemVariables>;
}
export const createAccommodationBillingLineItemRef: CreateAccommodationBillingLineItemRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAccommodationBillingLineItem(dc: DataConnect, vars: CreateAccommodationBillingLineItemVariables): MutationPromise<CreateAccommodationBillingLineItemData, CreateAccommodationBillingLineItemVariables>;

interface CreateAccommodationBillingLineItemRef {
  ...
  (dc: DataConnect, vars: CreateAccommodationBillingLineItemVariables): MutationRef<CreateAccommodationBillingLineItemData, CreateAccommodationBillingLineItemVariables>;
}
export const createAccommodationBillingLineItemRef: CreateAccommodationBillingLineItemRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAccommodationBillingLineItemRef:
```typescript
const name = createAccommodationBillingLineItemRef.operationName;
console.log(name);
```

### Variables
The `CreateAccommodationBillingLineItem` mutation requires an argument of type `CreateAccommodationBillingLineItemVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateAccommodationBillingLineItemVariables {
  id?: UUIDString | null;
  billingDocumentId: UUIDString;
  label: string;
  amount: number;
  targetField: string;
}
```
### Return Type
Recall that executing the `CreateAccommodationBillingLineItem` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAccommodationBillingLineItemData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAccommodationBillingLineItemData {
  accommodationBillingLineItem_insert: AccommodationBillingLineItem_Key;
}
```
### Using `CreateAccommodationBillingLineItem`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAccommodationBillingLineItem, CreateAccommodationBillingLineItemVariables } from '@dataconnect/generated';

// The `CreateAccommodationBillingLineItem` mutation requires an argument of type `CreateAccommodationBillingLineItemVariables`:
const createAccommodationBillingLineItemVars: CreateAccommodationBillingLineItemVariables = {
  id: ..., // optional
  billingDocumentId: ..., 
  label: ..., 
  amount: ..., 
  targetField: ..., 
};

// Call the `createAccommodationBillingLineItem()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAccommodationBillingLineItem(createAccommodationBillingLineItemVars);
// Variables can be defined inline as well.
const { data } = await createAccommodationBillingLineItem({ id: ..., billingDocumentId: ..., label: ..., amount: ..., targetField: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAccommodationBillingLineItem(dataConnect, createAccommodationBillingLineItemVars);

console.log(data.accommodationBillingLineItem_insert);

// Or, you can use the `Promise` API.
createAccommodationBillingLineItem(createAccommodationBillingLineItemVars).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingLineItem_insert);
});
```

### Using `CreateAccommodationBillingLineItem`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAccommodationBillingLineItemRef, CreateAccommodationBillingLineItemVariables } from '@dataconnect/generated';

// The `CreateAccommodationBillingLineItem` mutation requires an argument of type `CreateAccommodationBillingLineItemVariables`:
const createAccommodationBillingLineItemVars: CreateAccommodationBillingLineItemVariables = {
  id: ..., // optional
  billingDocumentId: ..., 
  label: ..., 
  amount: ..., 
  targetField: ..., 
};

// Call the `createAccommodationBillingLineItemRef()` function to get a reference to the mutation.
const ref = createAccommodationBillingLineItemRef(createAccommodationBillingLineItemVars);
// Variables can be defined inline as well.
const ref = createAccommodationBillingLineItemRef({ id: ..., billingDocumentId: ..., label: ..., amount: ..., targetField: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAccommodationBillingLineItemRef(dataConnect, createAccommodationBillingLineItemVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accommodationBillingLineItem_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingLineItem_insert);
});
```

## DeleteAccommodationBillingLineItem
You can execute the `DeleteAccommodationBillingLineItem` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteAccommodationBillingLineItem(vars: DeleteAccommodationBillingLineItemVariables): MutationPromise<DeleteAccommodationBillingLineItemData, DeleteAccommodationBillingLineItemVariables>;

interface DeleteAccommodationBillingLineItemRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAccommodationBillingLineItemVariables): MutationRef<DeleteAccommodationBillingLineItemData, DeleteAccommodationBillingLineItemVariables>;
}
export const deleteAccommodationBillingLineItemRef: DeleteAccommodationBillingLineItemRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteAccommodationBillingLineItem(dc: DataConnect, vars: DeleteAccommodationBillingLineItemVariables): MutationPromise<DeleteAccommodationBillingLineItemData, DeleteAccommodationBillingLineItemVariables>;

interface DeleteAccommodationBillingLineItemRef {
  ...
  (dc: DataConnect, vars: DeleteAccommodationBillingLineItemVariables): MutationRef<DeleteAccommodationBillingLineItemData, DeleteAccommodationBillingLineItemVariables>;
}
export const deleteAccommodationBillingLineItemRef: DeleteAccommodationBillingLineItemRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteAccommodationBillingLineItemRef:
```typescript
const name = deleteAccommodationBillingLineItemRef.operationName;
console.log(name);
```

### Variables
The `DeleteAccommodationBillingLineItem` mutation requires an argument of type `DeleteAccommodationBillingLineItemVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteAccommodationBillingLineItemVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteAccommodationBillingLineItem` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteAccommodationBillingLineItemData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteAccommodationBillingLineItemData {
  accommodationBillingLineItem_delete?: AccommodationBillingLineItem_Key | null;
}
```
### Using `DeleteAccommodationBillingLineItem`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteAccommodationBillingLineItem, DeleteAccommodationBillingLineItemVariables } from '@dataconnect/generated';

// The `DeleteAccommodationBillingLineItem` mutation requires an argument of type `DeleteAccommodationBillingLineItemVariables`:
const deleteAccommodationBillingLineItemVars: DeleteAccommodationBillingLineItemVariables = {
  id: ..., 
};

// Call the `deleteAccommodationBillingLineItem()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteAccommodationBillingLineItem(deleteAccommodationBillingLineItemVars);
// Variables can be defined inline as well.
const { data } = await deleteAccommodationBillingLineItem({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteAccommodationBillingLineItem(dataConnect, deleteAccommodationBillingLineItemVars);

console.log(data.accommodationBillingLineItem_delete);

// Or, you can use the `Promise` API.
deleteAccommodationBillingLineItem(deleteAccommodationBillingLineItemVars).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingLineItem_delete);
});
```

### Using `DeleteAccommodationBillingLineItem`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteAccommodationBillingLineItemRef, DeleteAccommodationBillingLineItemVariables } from '@dataconnect/generated';

// The `DeleteAccommodationBillingLineItem` mutation requires an argument of type `DeleteAccommodationBillingLineItemVariables`:
const deleteAccommodationBillingLineItemVars: DeleteAccommodationBillingLineItemVariables = {
  id: ..., 
};

// Call the `deleteAccommodationBillingLineItemRef()` function to get a reference to the mutation.
const ref = deleteAccommodationBillingLineItemRef(deleteAccommodationBillingLineItemVars);
// Variables can be defined inline as well.
const ref = deleteAccommodationBillingLineItemRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteAccommodationBillingLineItemRef(dataConnect, deleteAccommodationBillingLineItemVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.accommodationBillingLineItem_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.accommodationBillingLineItem_delete);
});
```

## CreateAdvancePayment
You can execute the `CreateAdvancePayment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAdvancePayment(vars: CreateAdvancePaymentVariables): MutationPromise<CreateAdvancePaymentData, CreateAdvancePaymentVariables>;

interface CreateAdvancePaymentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAdvancePaymentVariables): MutationRef<CreateAdvancePaymentData, CreateAdvancePaymentVariables>;
}
export const createAdvancePaymentRef: CreateAdvancePaymentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAdvancePayment(dc: DataConnect, vars: CreateAdvancePaymentVariables): MutationPromise<CreateAdvancePaymentData, CreateAdvancePaymentVariables>;

interface CreateAdvancePaymentRef {
  ...
  (dc: DataConnect, vars: CreateAdvancePaymentVariables): MutationRef<CreateAdvancePaymentData, CreateAdvancePaymentVariables>;
}
export const createAdvancePaymentRef: CreateAdvancePaymentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAdvancePaymentRef:
```typescript
const name = createAdvancePaymentRef.operationName;
console.log(name);
```

### Variables
The `CreateAdvancePayment` mutation requires an argument of type `CreateAdvancePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateAdvancePayment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAdvancePaymentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAdvancePaymentData {
  advancePayment_insert: AdvancePayment_Key;
}
```
### Using `CreateAdvancePayment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAdvancePayment, CreateAdvancePaymentVariables } from '@dataconnect/generated';

// The `CreateAdvancePayment` mutation requires an argument of type `CreateAdvancePaymentVariables`:
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

// Call the `createAdvancePayment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAdvancePayment(createAdvancePaymentVars);
// Variables can be defined inline as well.
const { data } = await createAdvancePayment({ id: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., yearMonth: ..., items: ..., prevMonthCarryover: ..., accommodation: ..., privateRoom: ..., gloves: ..., deposit: ..., fines: ..., electricity: ..., gas: ..., internet: ..., water: ..., totalDeduction: ..., memo: ..., updatedAt: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAdvancePayment(dataConnect, createAdvancePaymentVars);

console.log(data.advancePayment_insert);

// Or, you can use the `Promise` API.
createAdvancePayment(createAdvancePaymentVars).then((response) => {
  const data = response.data;
  console.log(data.advancePayment_insert);
});
```

### Using `CreateAdvancePayment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAdvancePaymentRef, CreateAdvancePaymentVariables } from '@dataconnect/generated';

// The `CreateAdvancePayment` mutation requires an argument of type `CreateAdvancePaymentVariables`:
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

// Call the `createAdvancePaymentRef()` function to get a reference to the mutation.
const ref = createAdvancePaymentRef(createAdvancePaymentVars);
// Variables can be defined inline as well.
const ref = createAdvancePaymentRef({ id: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., yearMonth: ..., items: ..., prevMonthCarryover: ..., accommodation: ..., privateRoom: ..., gloves: ..., deposit: ..., fines: ..., electricity: ..., gas: ..., internet: ..., water: ..., totalDeduction: ..., memo: ..., updatedAt: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAdvancePaymentRef(dataConnect, createAdvancePaymentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.advancePayment_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.advancePayment_insert);
});
```

## UpdateAdvancePayment
You can execute the `UpdateAdvancePayment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateAdvancePayment(vars: UpdateAdvancePaymentVariables): MutationPromise<UpdateAdvancePaymentData, UpdateAdvancePaymentVariables>;

interface UpdateAdvancePaymentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAdvancePaymentVariables): MutationRef<UpdateAdvancePaymentData, UpdateAdvancePaymentVariables>;
}
export const updateAdvancePaymentRef: UpdateAdvancePaymentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateAdvancePayment(dc: DataConnect, vars: UpdateAdvancePaymentVariables): MutationPromise<UpdateAdvancePaymentData, UpdateAdvancePaymentVariables>;

interface UpdateAdvancePaymentRef {
  ...
  (dc: DataConnect, vars: UpdateAdvancePaymentVariables): MutationRef<UpdateAdvancePaymentData, UpdateAdvancePaymentVariables>;
}
export const updateAdvancePaymentRef: UpdateAdvancePaymentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateAdvancePaymentRef:
```typescript
const name = updateAdvancePaymentRef.operationName;
console.log(name);
```

### Variables
The `UpdateAdvancePayment` mutation requires an argument of type `UpdateAdvancePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateAdvancePayment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateAdvancePaymentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateAdvancePaymentData {
  advancePayment_update?: AdvancePayment_Key | null;
}
```
### Using `UpdateAdvancePayment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateAdvancePayment, UpdateAdvancePaymentVariables } from '@dataconnect/generated';

// The `UpdateAdvancePayment` mutation requires an argument of type `UpdateAdvancePaymentVariables`:
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

// Call the `updateAdvancePayment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateAdvancePayment(updateAdvancePaymentVars);
// Variables can be defined inline as well.
const { data } = await updateAdvancePayment({ id: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., yearMonth: ..., items: ..., prevMonthCarryover: ..., accommodation: ..., privateRoom: ..., gloves: ..., deposit: ..., fines: ..., electricity: ..., gas: ..., internet: ..., water: ..., totalDeduction: ..., memo: ..., updatedAt: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateAdvancePayment(dataConnect, updateAdvancePaymentVars);

console.log(data.advancePayment_update);

// Or, you can use the `Promise` API.
updateAdvancePayment(updateAdvancePaymentVars).then((response) => {
  const data = response.data;
  console.log(data.advancePayment_update);
});
```

### Using `UpdateAdvancePayment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateAdvancePaymentRef, UpdateAdvancePaymentVariables } from '@dataconnect/generated';

// The `UpdateAdvancePayment` mutation requires an argument of type `UpdateAdvancePaymentVariables`:
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

// Call the `updateAdvancePaymentRef()` function to get a reference to the mutation.
const ref = updateAdvancePaymentRef(updateAdvancePaymentVars);
// Variables can be defined inline as well.
const ref = updateAdvancePaymentRef({ id: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., yearMonth: ..., items: ..., prevMonthCarryover: ..., accommodation: ..., privateRoom: ..., gloves: ..., deposit: ..., fines: ..., electricity: ..., gas: ..., internet: ..., water: ..., totalDeduction: ..., memo: ..., updatedAt: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateAdvancePaymentRef(dataConnect, updateAdvancePaymentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.advancePayment_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.advancePayment_update);
});
```

## DeleteAdvancePayment
You can execute the `DeleteAdvancePayment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteAdvancePayment(vars: DeleteAdvancePaymentVariables): MutationPromise<DeleteAdvancePaymentData, DeleteAdvancePaymentVariables>;

interface DeleteAdvancePaymentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAdvancePaymentVariables): MutationRef<DeleteAdvancePaymentData, DeleteAdvancePaymentVariables>;
}
export const deleteAdvancePaymentRef: DeleteAdvancePaymentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteAdvancePayment(dc: DataConnect, vars: DeleteAdvancePaymentVariables): MutationPromise<DeleteAdvancePaymentData, DeleteAdvancePaymentVariables>;

interface DeleteAdvancePaymentRef {
  ...
  (dc: DataConnect, vars: DeleteAdvancePaymentVariables): MutationRef<DeleteAdvancePaymentData, DeleteAdvancePaymentVariables>;
}
export const deleteAdvancePaymentRef: DeleteAdvancePaymentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteAdvancePaymentRef:
```typescript
const name = deleteAdvancePaymentRef.operationName;
console.log(name);
```

### Variables
The `DeleteAdvancePayment` mutation requires an argument of type `DeleteAdvancePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteAdvancePaymentVariables {
  id: string;
}
```
### Return Type
Recall that executing the `DeleteAdvancePayment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteAdvancePaymentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteAdvancePaymentData {
  advancePayment_delete?: AdvancePayment_Key | null;
}
```
### Using `DeleteAdvancePayment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteAdvancePayment, DeleteAdvancePaymentVariables } from '@dataconnect/generated';

// The `DeleteAdvancePayment` mutation requires an argument of type `DeleteAdvancePaymentVariables`:
const deleteAdvancePaymentVars: DeleteAdvancePaymentVariables = {
  id: ..., 
};

// Call the `deleteAdvancePayment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteAdvancePayment(deleteAdvancePaymentVars);
// Variables can be defined inline as well.
const { data } = await deleteAdvancePayment({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteAdvancePayment(dataConnect, deleteAdvancePaymentVars);

console.log(data.advancePayment_delete);

// Or, you can use the `Promise` API.
deleteAdvancePayment(deleteAdvancePaymentVars).then((response) => {
  const data = response.data;
  console.log(data.advancePayment_delete);
});
```

### Using `DeleteAdvancePayment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteAdvancePaymentRef, DeleteAdvancePaymentVariables } from '@dataconnect/generated';

// The `DeleteAdvancePayment` mutation requires an argument of type `DeleteAdvancePaymentVariables`:
const deleteAdvancePaymentVars: DeleteAdvancePaymentVariables = {
  id: ..., 
};

// Call the `deleteAdvancePaymentRef()` function to get a reference to the mutation.
const ref = deleteAdvancePaymentRef(deleteAdvancePaymentVars);
// Variables can be defined inline as well.
const ref = deleteAdvancePaymentRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteAdvancePaymentRef(dataConnect, deleteAdvancePaymentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.advancePayment_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.advancePayment_delete);
});
```

## CreateSmartMemo
You can execute the `CreateSmartMemo` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createSmartMemo(vars: CreateSmartMemoVariables): MutationPromise<CreateSmartMemoData, CreateSmartMemoVariables>;

interface CreateSmartMemoRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSmartMemoVariables): MutationRef<CreateSmartMemoData, CreateSmartMemoVariables>;
}
export const createSmartMemoRef: CreateSmartMemoRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createSmartMemo(dc: DataConnect, vars: CreateSmartMemoVariables): MutationPromise<CreateSmartMemoData, CreateSmartMemoVariables>;

interface CreateSmartMemoRef {
  ...
  (dc: DataConnect, vars: CreateSmartMemoVariables): MutationRef<CreateSmartMemoData, CreateSmartMemoVariables>;
}
export const createSmartMemoRef: CreateSmartMemoRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createSmartMemoRef:
```typescript
const name = createSmartMemoRef.operationName;
console.log(name);
```

### Variables
The `CreateSmartMemo` mutation requires an argument of type `CreateSmartMemoVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateSmartMemo` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateSmartMemoData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateSmartMemoData {
  smartMemo_insert: SmartMemo_Key;
}
```
### Using `CreateSmartMemo`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSmartMemo, CreateSmartMemoVariables } from '@dataconnect/generated';

// The `CreateSmartMemo` mutation requires an argument of type `CreateSmartMemoVariables`:
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

// Call the `createSmartMemo()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createSmartMemo(createSmartMemoVars);
// Variables can be defined inline as well.
const { data } = await createSmartMemo({ id: ..., legacyId: ..., userId: ..., scope: ..., type: ..., title: ..., content: ..., checklistItems: ..., color: ..., order: ..., isPinned: ..., tags: ..., categoryId: ..., categoryLegacyId: ..., priority: ..., x: ..., y: ..., w: ..., h: ..., isCollapsed: ..., prevW: ..., prevH: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createSmartMemo(dataConnect, createSmartMemoVars);

console.log(data.smartMemo_insert);

// Or, you can use the `Promise` API.
createSmartMemo(createSmartMemoVars).then((response) => {
  const data = response.data;
  console.log(data.smartMemo_insert);
});
```

### Using `CreateSmartMemo`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createSmartMemoRef, CreateSmartMemoVariables } from '@dataconnect/generated';

// The `CreateSmartMemo` mutation requires an argument of type `CreateSmartMemoVariables`:
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

// Call the `createSmartMemoRef()` function to get a reference to the mutation.
const ref = createSmartMemoRef(createSmartMemoVars);
// Variables can be defined inline as well.
const ref = createSmartMemoRef({ id: ..., legacyId: ..., userId: ..., scope: ..., type: ..., title: ..., content: ..., checklistItems: ..., color: ..., order: ..., isPinned: ..., tags: ..., categoryId: ..., categoryLegacyId: ..., priority: ..., x: ..., y: ..., w: ..., h: ..., isCollapsed: ..., prevW: ..., prevH: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createSmartMemoRef(dataConnect, createSmartMemoVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.smartMemo_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.smartMemo_insert);
});
```

## UpdateSmartMemo
You can execute the `UpdateSmartMemo` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateSmartMemo(vars: UpdateSmartMemoVariables): MutationPromise<UpdateSmartMemoData, UpdateSmartMemoVariables>;

interface UpdateSmartMemoRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSmartMemoVariables): MutationRef<UpdateSmartMemoData, UpdateSmartMemoVariables>;
}
export const updateSmartMemoRef: UpdateSmartMemoRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateSmartMemo(dc: DataConnect, vars: UpdateSmartMemoVariables): MutationPromise<UpdateSmartMemoData, UpdateSmartMemoVariables>;

interface UpdateSmartMemoRef {
  ...
  (dc: DataConnect, vars: UpdateSmartMemoVariables): MutationRef<UpdateSmartMemoData, UpdateSmartMemoVariables>;
}
export const updateSmartMemoRef: UpdateSmartMemoRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateSmartMemoRef:
```typescript
const name = updateSmartMemoRef.operationName;
console.log(name);
```

### Variables
The `UpdateSmartMemo` mutation requires an argument of type `UpdateSmartMemoVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateSmartMemo` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateSmartMemoData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateSmartMemoData {
  smartMemo_update?: SmartMemo_Key | null;
}
```
### Using `UpdateSmartMemo`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateSmartMemo, UpdateSmartMemoVariables } from '@dataconnect/generated';

// The `UpdateSmartMemo` mutation requires an argument of type `UpdateSmartMemoVariables`:
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

// Call the `updateSmartMemo()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateSmartMemo(updateSmartMemoVars);
// Variables can be defined inline as well.
const { data } = await updateSmartMemo({ id: ..., scope: ..., type: ..., title: ..., content: ..., checklistItems: ..., color: ..., order: ..., isPinned: ..., tags: ..., categoryId: ..., categoryLegacyId: ..., priority: ..., x: ..., y: ..., w: ..., h: ..., isCollapsed: ..., prevW: ..., prevH: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateSmartMemo(dataConnect, updateSmartMemoVars);

console.log(data.smartMemo_update);

// Or, you can use the `Promise` API.
updateSmartMemo(updateSmartMemoVars).then((response) => {
  const data = response.data;
  console.log(data.smartMemo_update);
});
```

### Using `UpdateSmartMemo`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateSmartMemoRef, UpdateSmartMemoVariables } from '@dataconnect/generated';

// The `UpdateSmartMemo` mutation requires an argument of type `UpdateSmartMemoVariables`:
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

// Call the `updateSmartMemoRef()` function to get a reference to the mutation.
const ref = updateSmartMemoRef(updateSmartMemoVars);
// Variables can be defined inline as well.
const ref = updateSmartMemoRef({ id: ..., scope: ..., type: ..., title: ..., content: ..., checklistItems: ..., color: ..., order: ..., isPinned: ..., tags: ..., categoryId: ..., categoryLegacyId: ..., priority: ..., x: ..., y: ..., w: ..., h: ..., isCollapsed: ..., prevW: ..., prevH: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateSmartMemoRef(dataConnect, updateSmartMemoVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.smartMemo_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.smartMemo_update);
});
```

## DeleteSmartMemo
You can execute the `DeleteSmartMemo` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteSmartMemo(vars: DeleteSmartMemoVariables): MutationPromise<DeleteSmartMemoData, DeleteSmartMemoVariables>;

interface DeleteSmartMemoRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteSmartMemoVariables): MutationRef<DeleteSmartMemoData, DeleteSmartMemoVariables>;
}
export const deleteSmartMemoRef: DeleteSmartMemoRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteSmartMemo(dc: DataConnect, vars: DeleteSmartMemoVariables): MutationPromise<DeleteSmartMemoData, DeleteSmartMemoVariables>;

interface DeleteSmartMemoRef {
  ...
  (dc: DataConnect, vars: DeleteSmartMemoVariables): MutationRef<DeleteSmartMemoData, DeleteSmartMemoVariables>;
}
export const deleteSmartMemoRef: DeleteSmartMemoRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteSmartMemoRef:
```typescript
const name = deleteSmartMemoRef.operationName;
console.log(name);
```

### Variables
The `DeleteSmartMemo` mutation requires an argument of type `DeleteSmartMemoVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteSmartMemoVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteSmartMemo` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteSmartMemoData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteSmartMemoData {
  smartMemo_delete?: SmartMemo_Key | null;
}
```
### Using `DeleteSmartMemo`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteSmartMemo, DeleteSmartMemoVariables } from '@dataconnect/generated';

// The `DeleteSmartMemo` mutation requires an argument of type `DeleteSmartMemoVariables`:
const deleteSmartMemoVars: DeleteSmartMemoVariables = {
  id: ..., 
};

// Call the `deleteSmartMemo()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteSmartMemo(deleteSmartMemoVars);
// Variables can be defined inline as well.
const { data } = await deleteSmartMemo({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteSmartMemo(dataConnect, deleteSmartMemoVars);

console.log(data.smartMemo_delete);

// Or, you can use the `Promise` API.
deleteSmartMemo(deleteSmartMemoVars).then((response) => {
  const data = response.data;
  console.log(data.smartMemo_delete);
});
```

### Using `DeleteSmartMemo`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteSmartMemoRef, DeleteSmartMemoVariables } from '@dataconnect/generated';

// The `DeleteSmartMemo` mutation requires an argument of type `DeleteSmartMemoVariables`:
const deleteSmartMemoVars: DeleteSmartMemoVariables = {
  id: ..., 
};

// Call the `deleteSmartMemoRef()` function to get a reference to the mutation.
const ref = deleteSmartMemoRef(deleteSmartMemoVars);
// Variables can be defined inline as well.
const ref = deleteSmartMemoRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteSmartMemoRef(dataConnect, deleteSmartMemoVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.smartMemo_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.smartMemo_delete);
});
```

## CreateSmartMemoCategory
You can execute the `CreateSmartMemoCategory` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createSmartMemoCategory(vars: CreateSmartMemoCategoryVariables): MutationPromise<CreateSmartMemoCategoryData, CreateSmartMemoCategoryVariables>;

interface CreateSmartMemoCategoryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSmartMemoCategoryVariables): MutationRef<CreateSmartMemoCategoryData, CreateSmartMemoCategoryVariables>;
}
export const createSmartMemoCategoryRef: CreateSmartMemoCategoryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createSmartMemoCategory(dc: DataConnect, vars: CreateSmartMemoCategoryVariables): MutationPromise<CreateSmartMemoCategoryData, CreateSmartMemoCategoryVariables>;

interface CreateSmartMemoCategoryRef {
  ...
  (dc: DataConnect, vars: CreateSmartMemoCategoryVariables): MutationRef<CreateSmartMemoCategoryData, CreateSmartMemoCategoryVariables>;
}
export const createSmartMemoCategoryRef: CreateSmartMemoCategoryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createSmartMemoCategoryRef:
```typescript
const name = createSmartMemoCategoryRef.operationName;
console.log(name);
```

### Variables
The `CreateSmartMemoCategory` mutation requires an argument of type `CreateSmartMemoCategoryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateSmartMemoCategory` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateSmartMemoCategoryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateSmartMemoCategoryData {
  smartMemoCategory_insert: SmartMemoCategory_Key;
}
```
### Using `CreateSmartMemoCategory`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSmartMemoCategory, CreateSmartMemoCategoryVariables } from '@dataconnect/generated';

// The `CreateSmartMemoCategory` mutation requires an argument of type `CreateSmartMemoCategoryVariables`:
const createSmartMemoCategoryVars: CreateSmartMemoCategoryVariables = {
  id: ..., // optional
  legacyId: ..., // optional
  userId: ..., 
  name: ..., 
  color: ..., // optional
  icon: ..., // optional
  order: ..., // optional
};

// Call the `createSmartMemoCategory()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createSmartMemoCategory(createSmartMemoCategoryVars);
// Variables can be defined inline as well.
const { data } = await createSmartMemoCategory({ id: ..., legacyId: ..., userId: ..., name: ..., color: ..., icon: ..., order: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createSmartMemoCategory(dataConnect, createSmartMemoCategoryVars);

console.log(data.smartMemoCategory_insert);

// Or, you can use the `Promise` API.
createSmartMemoCategory(createSmartMemoCategoryVars).then((response) => {
  const data = response.data;
  console.log(data.smartMemoCategory_insert);
});
```

### Using `CreateSmartMemoCategory`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createSmartMemoCategoryRef, CreateSmartMemoCategoryVariables } from '@dataconnect/generated';

// The `CreateSmartMemoCategory` mutation requires an argument of type `CreateSmartMemoCategoryVariables`:
const createSmartMemoCategoryVars: CreateSmartMemoCategoryVariables = {
  id: ..., // optional
  legacyId: ..., // optional
  userId: ..., 
  name: ..., 
  color: ..., // optional
  icon: ..., // optional
  order: ..., // optional
};

// Call the `createSmartMemoCategoryRef()` function to get a reference to the mutation.
const ref = createSmartMemoCategoryRef(createSmartMemoCategoryVars);
// Variables can be defined inline as well.
const ref = createSmartMemoCategoryRef({ id: ..., legacyId: ..., userId: ..., name: ..., color: ..., icon: ..., order: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createSmartMemoCategoryRef(dataConnect, createSmartMemoCategoryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.smartMemoCategory_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.smartMemoCategory_insert);
});
```

## UpdateSmartMemoCategory
You can execute the `UpdateSmartMemoCategory` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateSmartMemoCategory(vars: UpdateSmartMemoCategoryVariables): MutationPromise<UpdateSmartMemoCategoryData, UpdateSmartMemoCategoryVariables>;

interface UpdateSmartMemoCategoryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSmartMemoCategoryVariables): MutationRef<UpdateSmartMemoCategoryData, UpdateSmartMemoCategoryVariables>;
}
export const updateSmartMemoCategoryRef: UpdateSmartMemoCategoryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateSmartMemoCategory(dc: DataConnect, vars: UpdateSmartMemoCategoryVariables): MutationPromise<UpdateSmartMemoCategoryData, UpdateSmartMemoCategoryVariables>;

interface UpdateSmartMemoCategoryRef {
  ...
  (dc: DataConnect, vars: UpdateSmartMemoCategoryVariables): MutationRef<UpdateSmartMemoCategoryData, UpdateSmartMemoCategoryVariables>;
}
export const updateSmartMemoCategoryRef: UpdateSmartMemoCategoryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateSmartMemoCategoryRef:
```typescript
const name = updateSmartMemoCategoryRef.operationName;
console.log(name);
```

### Variables
The `UpdateSmartMemoCategory` mutation requires an argument of type `UpdateSmartMemoCategoryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateSmartMemoCategory` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateSmartMemoCategoryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateSmartMemoCategoryData {
  smartMemoCategory_update?: SmartMemoCategory_Key | null;
}
```
### Using `UpdateSmartMemoCategory`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateSmartMemoCategory, UpdateSmartMemoCategoryVariables } from '@dataconnect/generated';

// The `UpdateSmartMemoCategory` mutation requires an argument of type `UpdateSmartMemoCategoryVariables`:
const updateSmartMemoCategoryVars: UpdateSmartMemoCategoryVariables = {
  id: ..., 
  userId: ..., // optional
  name: ..., // optional
  color: ..., // optional
  icon: ..., // optional
  order: ..., // optional
};

// Call the `updateSmartMemoCategory()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateSmartMemoCategory(updateSmartMemoCategoryVars);
// Variables can be defined inline as well.
const { data } = await updateSmartMemoCategory({ id: ..., userId: ..., name: ..., color: ..., icon: ..., order: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateSmartMemoCategory(dataConnect, updateSmartMemoCategoryVars);

console.log(data.smartMemoCategory_update);

// Or, you can use the `Promise` API.
updateSmartMemoCategory(updateSmartMemoCategoryVars).then((response) => {
  const data = response.data;
  console.log(data.smartMemoCategory_update);
});
```

### Using `UpdateSmartMemoCategory`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateSmartMemoCategoryRef, UpdateSmartMemoCategoryVariables } from '@dataconnect/generated';

// The `UpdateSmartMemoCategory` mutation requires an argument of type `UpdateSmartMemoCategoryVariables`:
const updateSmartMemoCategoryVars: UpdateSmartMemoCategoryVariables = {
  id: ..., 
  userId: ..., // optional
  name: ..., // optional
  color: ..., // optional
  icon: ..., // optional
  order: ..., // optional
};

// Call the `updateSmartMemoCategoryRef()` function to get a reference to the mutation.
const ref = updateSmartMemoCategoryRef(updateSmartMemoCategoryVars);
// Variables can be defined inline as well.
const ref = updateSmartMemoCategoryRef({ id: ..., userId: ..., name: ..., color: ..., icon: ..., order: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateSmartMemoCategoryRef(dataConnect, updateSmartMemoCategoryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.smartMemoCategory_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.smartMemoCategory_update);
});
```

## DeleteSmartMemoCategory
You can execute the `DeleteSmartMemoCategory` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteSmartMemoCategory(vars: DeleteSmartMemoCategoryVariables): MutationPromise<DeleteSmartMemoCategoryData, DeleteSmartMemoCategoryVariables>;

interface DeleteSmartMemoCategoryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteSmartMemoCategoryVariables): MutationRef<DeleteSmartMemoCategoryData, DeleteSmartMemoCategoryVariables>;
}
export const deleteSmartMemoCategoryRef: DeleteSmartMemoCategoryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteSmartMemoCategory(dc: DataConnect, vars: DeleteSmartMemoCategoryVariables): MutationPromise<DeleteSmartMemoCategoryData, DeleteSmartMemoCategoryVariables>;

interface DeleteSmartMemoCategoryRef {
  ...
  (dc: DataConnect, vars: DeleteSmartMemoCategoryVariables): MutationRef<DeleteSmartMemoCategoryData, DeleteSmartMemoCategoryVariables>;
}
export const deleteSmartMemoCategoryRef: DeleteSmartMemoCategoryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteSmartMemoCategoryRef:
```typescript
const name = deleteSmartMemoCategoryRef.operationName;
console.log(name);
```

### Variables
The `DeleteSmartMemoCategory` mutation requires an argument of type `DeleteSmartMemoCategoryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteSmartMemoCategoryVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteSmartMemoCategory` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteSmartMemoCategoryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteSmartMemoCategoryData {
  smartMemoCategory_delete?: SmartMemoCategory_Key | null;
}
```
### Using `DeleteSmartMemoCategory`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteSmartMemoCategory, DeleteSmartMemoCategoryVariables } from '@dataconnect/generated';

// The `DeleteSmartMemoCategory` mutation requires an argument of type `DeleteSmartMemoCategoryVariables`:
const deleteSmartMemoCategoryVars: DeleteSmartMemoCategoryVariables = {
  id: ..., 
};

// Call the `deleteSmartMemoCategory()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteSmartMemoCategory(deleteSmartMemoCategoryVars);
// Variables can be defined inline as well.
const { data } = await deleteSmartMemoCategory({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteSmartMemoCategory(dataConnect, deleteSmartMemoCategoryVars);

console.log(data.smartMemoCategory_delete);

// Or, you can use the `Promise` API.
deleteSmartMemoCategory(deleteSmartMemoCategoryVars).then((response) => {
  const data = response.data;
  console.log(data.smartMemoCategory_delete);
});
```

### Using `DeleteSmartMemoCategory`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteSmartMemoCategoryRef, DeleteSmartMemoCategoryVariables } from '@dataconnect/generated';

// The `DeleteSmartMemoCategory` mutation requires an argument of type `DeleteSmartMemoCategoryVariables`:
const deleteSmartMemoCategoryVars: DeleteSmartMemoCategoryVariables = {
  id: ..., 
};

// Call the `deleteSmartMemoCategoryRef()` function to get a reference to the mutation.
const ref = deleteSmartMemoCategoryRef(deleteSmartMemoCategoryVars);
// Variables can be defined inline as well.
const ref = deleteSmartMemoCategoryRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteSmartMemoCategoryRef(dataConnect, deleteSmartMemoCategoryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.smartMemoCategory_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.smartMemoCategory_delete);
});
```

## CreateVehicle
You can execute the `CreateVehicle` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createVehicle(vars: CreateVehicleVariables): MutationPromise<CreateVehicleData, CreateVehicleVariables>;

interface CreateVehicleRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateVehicleVariables): MutationRef<CreateVehicleData, CreateVehicleVariables>;
}
export const createVehicleRef: CreateVehicleRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createVehicle(dc: DataConnect, vars: CreateVehicleVariables): MutationPromise<CreateVehicleData, CreateVehicleVariables>;

interface CreateVehicleRef {
  ...
  (dc: DataConnect, vars: CreateVehicleVariables): MutationRef<CreateVehicleData, CreateVehicleVariables>;
}
export const createVehicleRef: CreateVehicleRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createVehicleRef:
```typescript
const name = createVehicleRef.operationName;
console.log(name);
```

### Variables
The `CreateVehicle` mutation requires an argument of type `CreateVehicleVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateVehicle` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateVehicleData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateVehicleData {
  vehicle_insert: Vehicle_Key;
}
```
### Using `CreateVehicle`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createVehicle, CreateVehicleVariables } from '@dataconnect/generated';

// The `CreateVehicle` mutation requires an argument of type `CreateVehicleVariables`:
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

// Call the `createVehicle()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createVehicle(createVehicleVars);
// Variables can be defined inline as well.
const { data } = await createVehicle({ id: ..., legacyId: ..., licensePlate: ..., model: ..., type: ..., owner: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createVehicle(dataConnect, createVehicleVars);

console.log(data.vehicle_insert);

// Or, you can use the `Promise` API.
createVehicle(createVehicleVars).then((response) => {
  const data = response.data;
  console.log(data.vehicle_insert);
});
```

### Using `CreateVehicle`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createVehicleRef, CreateVehicleVariables } from '@dataconnect/generated';

// The `CreateVehicle` mutation requires an argument of type `CreateVehicleVariables`:
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

// Call the `createVehicleRef()` function to get a reference to the mutation.
const ref = createVehicleRef(createVehicleVars);
// Variables can be defined inline as well.
const ref = createVehicleRef({ id: ..., legacyId: ..., licensePlate: ..., model: ..., type: ..., owner: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createVehicleRef(dataConnect, createVehicleVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicle_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicle_insert);
});
```

## UpdateVehicle
You can execute the `UpdateVehicle` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateVehicle(vars: UpdateVehicleVariables): MutationPromise<UpdateVehicleData, UpdateVehicleVariables>;

interface UpdateVehicleRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateVehicleVariables): MutationRef<UpdateVehicleData, UpdateVehicleVariables>;
}
export const updateVehicleRef: UpdateVehicleRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateVehicle(dc: DataConnect, vars: UpdateVehicleVariables): MutationPromise<UpdateVehicleData, UpdateVehicleVariables>;

interface UpdateVehicleRef {
  ...
  (dc: DataConnect, vars: UpdateVehicleVariables): MutationRef<UpdateVehicleData, UpdateVehicleVariables>;
}
export const updateVehicleRef: UpdateVehicleRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateVehicleRef:
```typescript
const name = updateVehicleRef.operationName;
console.log(name);
```

### Variables
The `UpdateVehicle` mutation requires an argument of type `UpdateVehicleVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateVehicle` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateVehicleData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateVehicleData {
  vehicle_update?: Vehicle_Key | null;
}
```
### Using `UpdateVehicle`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateVehicle, UpdateVehicleVariables } from '@dataconnect/generated';

// The `UpdateVehicle` mutation requires an argument of type `UpdateVehicleVariables`:
const updateVehicleVars: UpdateVehicleVariables = {
  id: ..., 
  licensePlate: ..., // optional
  model: ..., // optional
  type: ..., // optional
  owner: ..., // optional
  status: ..., // optional
  memo: ..., // optional
};

// Call the `updateVehicle()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateVehicle(updateVehicleVars);
// Variables can be defined inline as well.
const { data } = await updateVehicle({ id: ..., licensePlate: ..., model: ..., type: ..., owner: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateVehicle(dataConnect, updateVehicleVars);

console.log(data.vehicle_update);

// Or, you can use the `Promise` API.
updateVehicle(updateVehicleVars).then((response) => {
  const data = response.data;
  console.log(data.vehicle_update);
});
```

### Using `UpdateVehicle`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateVehicleRef, UpdateVehicleVariables } from '@dataconnect/generated';

// The `UpdateVehicle` mutation requires an argument of type `UpdateVehicleVariables`:
const updateVehicleVars: UpdateVehicleVariables = {
  id: ..., 
  licensePlate: ..., // optional
  model: ..., // optional
  type: ..., // optional
  owner: ..., // optional
  status: ..., // optional
  memo: ..., // optional
};

// Call the `updateVehicleRef()` function to get a reference to the mutation.
const ref = updateVehicleRef(updateVehicleVars);
// Variables can be defined inline as well.
const ref = updateVehicleRef({ id: ..., licensePlate: ..., model: ..., type: ..., owner: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateVehicleRef(dataConnect, updateVehicleVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicle_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicle_update);
});
```

## DeleteVehicle
You can execute the `DeleteVehicle` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteVehicle(vars: DeleteVehicleVariables): MutationPromise<DeleteVehicleData, DeleteVehicleVariables>;

interface DeleteVehicleRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteVehicleVariables): MutationRef<DeleteVehicleData, DeleteVehicleVariables>;
}
export const deleteVehicleRef: DeleteVehicleRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteVehicle(dc: DataConnect, vars: DeleteVehicleVariables): MutationPromise<DeleteVehicleData, DeleteVehicleVariables>;

interface DeleteVehicleRef {
  ...
  (dc: DataConnect, vars: DeleteVehicleVariables): MutationRef<DeleteVehicleData, DeleteVehicleVariables>;
}
export const deleteVehicleRef: DeleteVehicleRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteVehicleRef:
```typescript
const name = deleteVehicleRef.operationName;
console.log(name);
```

### Variables
The `DeleteVehicle` mutation requires an argument of type `DeleteVehicleVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteVehicleVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteVehicle` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteVehicleData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteVehicleData {
  vehicle_delete?: Vehicle_Key | null;
}
```
### Using `DeleteVehicle`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteVehicle, DeleteVehicleVariables } from '@dataconnect/generated';

// The `DeleteVehicle` mutation requires an argument of type `DeleteVehicleVariables`:
const deleteVehicleVars: DeleteVehicleVariables = {
  id: ..., 
};

// Call the `deleteVehicle()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteVehicle(deleteVehicleVars);
// Variables can be defined inline as well.
const { data } = await deleteVehicle({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteVehicle(dataConnect, deleteVehicleVars);

console.log(data.vehicle_delete);

// Or, you can use the `Promise` API.
deleteVehicle(deleteVehicleVars).then((response) => {
  const data = response.data;
  console.log(data.vehicle_delete);
});
```

### Using `DeleteVehicle`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteVehicleRef, DeleteVehicleVariables } from '@dataconnect/generated';

// The `DeleteVehicle` mutation requires an argument of type `DeleteVehicleVariables`:
const deleteVehicleVars: DeleteVehicleVariables = {
  id: ..., 
};

// Call the `deleteVehicleRef()` function to get a reference to the mutation.
const ref = deleteVehicleRef(deleteVehicleVars);
// Variables can be defined inline as well.
const ref = deleteVehicleRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteVehicleRef(dataConnect, deleteVehicleVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicle_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicle_delete);
});
```

## CreateVehicleAssignment
You can execute the `CreateVehicleAssignment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createVehicleAssignment(vars: CreateVehicleAssignmentVariables): MutationPromise<CreateVehicleAssignmentData, CreateVehicleAssignmentVariables>;

interface CreateVehicleAssignmentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateVehicleAssignmentVariables): MutationRef<CreateVehicleAssignmentData, CreateVehicleAssignmentVariables>;
}
export const createVehicleAssignmentRef: CreateVehicleAssignmentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createVehicleAssignment(dc: DataConnect, vars: CreateVehicleAssignmentVariables): MutationPromise<CreateVehicleAssignmentData, CreateVehicleAssignmentVariables>;

interface CreateVehicleAssignmentRef {
  ...
  (dc: DataConnect, vars: CreateVehicleAssignmentVariables): MutationRef<CreateVehicleAssignmentData, CreateVehicleAssignmentVariables>;
}
export const createVehicleAssignmentRef: CreateVehicleAssignmentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createVehicleAssignmentRef:
```typescript
const name = createVehicleAssignmentRef.operationName;
console.log(name);
```

### Variables
The `CreateVehicleAssignment` mutation requires an argument of type `CreateVehicleAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateVehicleAssignment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateVehicleAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateVehicleAssignmentData {
  vehicleAssignment_insert: VehicleAssignment_Key;
}
```
### Using `CreateVehicleAssignment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createVehicleAssignment, CreateVehicleAssignmentVariables } from '@dataconnect/generated';

// The `CreateVehicleAssignment` mutation requires an argument of type `CreateVehicleAssignmentVariables`:
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

// Call the `createVehicleAssignment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createVehicleAssignment(createVehicleAssignmentVars);
// Variables can be defined inline as well.
const { data } = await createVehicleAssignment({ id: ..., legacyId: ..., vehicleId: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., startDate: ..., endDate: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createVehicleAssignment(dataConnect, createVehicleAssignmentVars);

console.log(data.vehicleAssignment_insert);

// Or, you can use the `Promise` API.
createVehicleAssignment(createVehicleAssignmentVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleAssignment_insert);
});
```

### Using `CreateVehicleAssignment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createVehicleAssignmentRef, CreateVehicleAssignmentVariables } from '@dataconnect/generated';

// The `CreateVehicleAssignment` mutation requires an argument of type `CreateVehicleAssignmentVariables`:
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

// Call the `createVehicleAssignmentRef()` function to get a reference to the mutation.
const ref = createVehicleAssignmentRef(createVehicleAssignmentVars);
// Variables can be defined inline as well.
const ref = createVehicleAssignmentRef({ id: ..., legacyId: ..., vehicleId: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., startDate: ..., endDate: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createVehicleAssignmentRef(dataConnect, createVehicleAssignmentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicleAssignment_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleAssignment_insert);
});
```

## UpdateVehicleAssignment
You can execute the `UpdateVehicleAssignment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateVehicleAssignment(vars: UpdateVehicleAssignmentVariables): MutationPromise<UpdateVehicleAssignmentData, UpdateVehicleAssignmentVariables>;

interface UpdateVehicleAssignmentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateVehicleAssignmentVariables): MutationRef<UpdateVehicleAssignmentData, UpdateVehicleAssignmentVariables>;
}
export const updateVehicleAssignmentRef: UpdateVehicleAssignmentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateVehicleAssignment(dc: DataConnect, vars: UpdateVehicleAssignmentVariables): MutationPromise<UpdateVehicleAssignmentData, UpdateVehicleAssignmentVariables>;

interface UpdateVehicleAssignmentRef {
  ...
  (dc: DataConnect, vars: UpdateVehicleAssignmentVariables): MutationRef<UpdateVehicleAssignmentData, UpdateVehicleAssignmentVariables>;
}
export const updateVehicleAssignmentRef: UpdateVehicleAssignmentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateVehicleAssignmentRef:
```typescript
const name = updateVehicleAssignmentRef.operationName;
console.log(name);
```

### Variables
The `UpdateVehicleAssignment` mutation requires an argument of type `UpdateVehicleAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateVehicleAssignment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateVehicleAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateVehicleAssignmentData {
  vehicleAssignment_update?: VehicleAssignment_Key | null;
}
```
### Using `UpdateVehicleAssignment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateVehicleAssignment, UpdateVehicleAssignmentVariables } from '@dataconnect/generated';

// The `UpdateVehicleAssignment` mutation requires an argument of type `UpdateVehicleAssignmentVariables`:
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

// Call the `updateVehicleAssignment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateVehicleAssignment(updateVehicleAssignmentVars);
// Variables can be defined inline as well.
const { data } = await updateVehicleAssignment({ id: ..., vehicleId: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., startDate: ..., endDate: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateVehicleAssignment(dataConnect, updateVehicleAssignmentVars);

console.log(data.vehicleAssignment_update);

// Or, you can use the `Promise` API.
updateVehicleAssignment(updateVehicleAssignmentVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleAssignment_update);
});
```

### Using `UpdateVehicleAssignment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateVehicleAssignmentRef, UpdateVehicleAssignmentVariables } from '@dataconnect/generated';

// The `UpdateVehicleAssignment` mutation requires an argument of type `UpdateVehicleAssignmentVariables`:
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

// Call the `updateVehicleAssignmentRef()` function to get a reference to the mutation.
const ref = updateVehicleAssignmentRef(updateVehicleAssignmentVars);
// Variables can be defined inline as well.
const ref = updateVehicleAssignmentRef({ id: ..., vehicleId: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., startDate: ..., endDate: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateVehicleAssignmentRef(dataConnect, updateVehicleAssignmentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicleAssignment_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleAssignment_update);
});
```

## DeleteVehicleAssignment
You can execute the `DeleteVehicleAssignment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteVehicleAssignment(vars: DeleteVehicleAssignmentVariables): MutationPromise<DeleteVehicleAssignmentData, DeleteVehicleAssignmentVariables>;

interface DeleteVehicleAssignmentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteVehicleAssignmentVariables): MutationRef<DeleteVehicleAssignmentData, DeleteVehicleAssignmentVariables>;
}
export const deleteVehicleAssignmentRef: DeleteVehicleAssignmentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteVehicleAssignment(dc: DataConnect, vars: DeleteVehicleAssignmentVariables): MutationPromise<DeleteVehicleAssignmentData, DeleteVehicleAssignmentVariables>;

interface DeleteVehicleAssignmentRef {
  ...
  (dc: DataConnect, vars: DeleteVehicleAssignmentVariables): MutationRef<DeleteVehicleAssignmentData, DeleteVehicleAssignmentVariables>;
}
export const deleteVehicleAssignmentRef: DeleteVehicleAssignmentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteVehicleAssignmentRef:
```typescript
const name = deleteVehicleAssignmentRef.operationName;
console.log(name);
```

### Variables
The `DeleteVehicleAssignment` mutation requires an argument of type `DeleteVehicleAssignmentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteVehicleAssignmentVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteVehicleAssignment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteVehicleAssignmentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteVehicleAssignmentData {
  vehicleAssignment_delete?: VehicleAssignment_Key | null;
}
```
### Using `DeleteVehicleAssignment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteVehicleAssignment, DeleteVehicleAssignmentVariables } from '@dataconnect/generated';

// The `DeleteVehicleAssignment` mutation requires an argument of type `DeleteVehicleAssignmentVariables`:
const deleteVehicleAssignmentVars: DeleteVehicleAssignmentVariables = {
  id: ..., 
};

// Call the `deleteVehicleAssignment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteVehicleAssignment(deleteVehicleAssignmentVars);
// Variables can be defined inline as well.
const { data } = await deleteVehicleAssignment({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteVehicleAssignment(dataConnect, deleteVehicleAssignmentVars);

console.log(data.vehicleAssignment_delete);

// Or, you can use the `Promise` API.
deleteVehicleAssignment(deleteVehicleAssignmentVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleAssignment_delete);
});
```

### Using `DeleteVehicleAssignment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteVehicleAssignmentRef, DeleteVehicleAssignmentVariables } from '@dataconnect/generated';

// The `DeleteVehicleAssignment` mutation requires an argument of type `DeleteVehicleAssignmentVariables`:
const deleteVehicleAssignmentVars: DeleteVehicleAssignmentVariables = {
  id: ..., 
};

// Call the `deleteVehicleAssignmentRef()` function to get a reference to the mutation.
const ref = deleteVehicleAssignmentRef(deleteVehicleAssignmentVars);
// Variables can be defined inline as well.
const ref = deleteVehicleAssignmentRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteVehicleAssignmentRef(dataConnect, deleteVehicleAssignmentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicleAssignment_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleAssignment_delete);
});
```

## CreateVehicleExpense
You can execute the `CreateVehicleExpense` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createVehicleExpense(vars: CreateVehicleExpenseVariables): MutationPromise<CreateVehicleExpenseData, CreateVehicleExpenseVariables>;

interface CreateVehicleExpenseRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateVehicleExpenseVariables): MutationRef<CreateVehicleExpenseData, CreateVehicleExpenseVariables>;
}
export const createVehicleExpenseRef: CreateVehicleExpenseRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createVehicleExpense(dc: DataConnect, vars: CreateVehicleExpenseVariables): MutationPromise<CreateVehicleExpenseData, CreateVehicleExpenseVariables>;

interface CreateVehicleExpenseRef {
  ...
  (dc: DataConnect, vars: CreateVehicleExpenseVariables): MutationRef<CreateVehicleExpenseData, CreateVehicleExpenseVariables>;
}
export const createVehicleExpenseRef: CreateVehicleExpenseRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createVehicleExpenseRef:
```typescript
const name = createVehicleExpenseRef.operationName;
console.log(name);
```

### Variables
The `CreateVehicleExpense` mutation requires an argument of type `CreateVehicleExpenseVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateVehicleExpense` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateVehicleExpenseData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateVehicleExpenseData {
  vehicleExpense_insert: VehicleExpense_Key;
}
```
### Using `CreateVehicleExpense`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createVehicleExpense, CreateVehicleExpenseVariables } from '@dataconnect/generated';

// The `CreateVehicleExpense` mutation requires an argument of type `CreateVehicleExpenseVariables`:
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

// Call the `createVehicleExpense()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createVehicleExpense(createVehicleExpenseVars);
// Variables can be defined inline as well.
const { data } = await createVehicleExpense({ id: ..., legacyId: ..., vehicleId: ..., date: ..., type: ..., amount: ..., odometer: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createVehicleExpense(dataConnect, createVehicleExpenseVars);

console.log(data.vehicleExpense_insert);

// Or, you can use the `Promise` API.
createVehicleExpense(createVehicleExpenseVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleExpense_insert);
});
```

### Using `CreateVehicleExpense`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createVehicleExpenseRef, CreateVehicleExpenseVariables } from '@dataconnect/generated';

// The `CreateVehicleExpense` mutation requires an argument of type `CreateVehicleExpenseVariables`:
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

// Call the `createVehicleExpenseRef()` function to get a reference to the mutation.
const ref = createVehicleExpenseRef(createVehicleExpenseVars);
// Variables can be defined inline as well.
const ref = createVehicleExpenseRef({ id: ..., legacyId: ..., vehicleId: ..., date: ..., type: ..., amount: ..., odometer: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createVehicleExpenseRef(dataConnect, createVehicleExpenseVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicleExpense_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleExpense_insert);
});
```

## UpdateVehicleExpense
You can execute the `UpdateVehicleExpense` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateVehicleExpense(vars: UpdateVehicleExpenseVariables): MutationPromise<UpdateVehicleExpenseData, UpdateVehicleExpenseVariables>;

interface UpdateVehicleExpenseRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateVehicleExpenseVariables): MutationRef<UpdateVehicleExpenseData, UpdateVehicleExpenseVariables>;
}
export const updateVehicleExpenseRef: UpdateVehicleExpenseRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateVehicleExpense(dc: DataConnect, vars: UpdateVehicleExpenseVariables): MutationPromise<UpdateVehicleExpenseData, UpdateVehicleExpenseVariables>;

interface UpdateVehicleExpenseRef {
  ...
  (dc: DataConnect, vars: UpdateVehicleExpenseVariables): MutationRef<UpdateVehicleExpenseData, UpdateVehicleExpenseVariables>;
}
export const updateVehicleExpenseRef: UpdateVehicleExpenseRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateVehicleExpenseRef:
```typescript
const name = updateVehicleExpenseRef.operationName;
console.log(name);
```

### Variables
The `UpdateVehicleExpense` mutation requires an argument of type `UpdateVehicleExpenseVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateVehicleExpense` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateVehicleExpenseData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateVehicleExpenseData {
  vehicleExpense_update?: VehicleExpense_Key | null;
}
```
### Using `UpdateVehicleExpense`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateVehicleExpense, UpdateVehicleExpenseVariables } from '@dataconnect/generated';

// The `UpdateVehicleExpense` mutation requires an argument of type `UpdateVehicleExpenseVariables`:
const updateVehicleExpenseVars: UpdateVehicleExpenseVariables = {
  id: ..., 
  vehicleId: ..., // optional
  date: ..., // optional
  type: ..., // optional
  amount: ..., // optional
  odometer: ..., // optional
  memo: ..., // optional
};

// Call the `updateVehicleExpense()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateVehicleExpense(updateVehicleExpenseVars);
// Variables can be defined inline as well.
const { data } = await updateVehicleExpense({ id: ..., vehicleId: ..., date: ..., type: ..., amount: ..., odometer: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateVehicleExpense(dataConnect, updateVehicleExpenseVars);

console.log(data.vehicleExpense_update);

// Or, you can use the `Promise` API.
updateVehicleExpense(updateVehicleExpenseVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleExpense_update);
});
```

### Using `UpdateVehicleExpense`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateVehicleExpenseRef, UpdateVehicleExpenseVariables } from '@dataconnect/generated';

// The `UpdateVehicleExpense` mutation requires an argument of type `UpdateVehicleExpenseVariables`:
const updateVehicleExpenseVars: UpdateVehicleExpenseVariables = {
  id: ..., 
  vehicleId: ..., // optional
  date: ..., // optional
  type: ..., // optional
  amount: ..., // optional
  odometer: ..., // optional
  memo: ..., // optional
};

// Call the `updateVehicleExpenseRef()` function to get a reference to the mutation.
const ref = updateVehicleExpenseRef(updateVehicleExpenseVars);
// Variables can be defined inline as well.
const ref = updateVehicleExpenseRef({ id: ..., vehicleId: ..., date: ..., type: ..., amount: ..., odometer: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateVehicleExpenseRef(dataConnect, updateVehicleExpenseVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicleExpense_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleExpense_update);
});
```

## DeleteVehicleExpense
You can execute the `DeleteVehicleExpense` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteVehicleExpense(vars: DeleteVehicleExpenseVariables): MutationPromise<DeleteVehicleExpenseData, DeleteVehicleExpenseVariables>;

interface DeleteVehicleExpenseRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteVehicleExpenseVariables): MutationRef<DeleteVehicleExpenseData, DeleteVehicleExpenseVariables>;
}
export const deleteVehicleExpenseRef: DeleteVehicleExpenseRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteVehicleExpense(dc: DataConnect, vars: DeleteVehicleExpenseVariables): MutationPromise<DeleteVehicleExpenseData, DeleteVehicleExpenseVariables>;

interface DeleteVehicleExpenseRef {
  ...
  (dc: DataConnect, vars: DeleteVehicleExpenseVariables): MutationRef<DeleteVehicleExpenseData, DeleteVehicleExpenseVariables>;
}
export const deleteVehicleExpenseRef: DeleteVehicleExpenseRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteVehicleExpenseRef:
```typescript
const name = deleteVehicleExpenseRef.operationName;
console.log(name);
```

### Variables
The `DeleteVehicleExpense` mutation requires an argument of type `DeleteVehicleExpenseVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteVehicleExpenseVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteVehicleExpense` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteVehicleExpenseData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteVehicleExpenseData {
  vehicleExpense_delete?: VehicleExpense_Key | null;
}
```
### Using `DeleteVehicleExpense`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteVehicleExpense, DeleteVehicleExpenseVariables } from '@dataconnect/generated';

// The `DeleteVehicleExpense` mutation requires an argument of type `DeleteVehicleExpenseVariables`:
const deleteVehicleExpenseVars: DeleteVehicleExpenseVariables = {
  id: ..., 
};

// Call the `deleteVehicleExpense()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteVehicleExpense(deleteVehicleExpenseVars);
// Variables can be defined inline as well.
const { data } = await deleteVehicleExpense({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteVehicleExpense(dataConnect, deleteVehicleExpenseVars);

console.log(data.vehicleExpense_delete);

// Or, you can use the `Promise` API.
deleteVehicleExpense(deleteVehicleExpenseVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleExpense_delete);
});
```

### Using `DeleteVehicleExpense`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteVehicleExpenseRef, DeleteVehicleExpenseVariables } from '@dataconnect/generated';

// The `DeleteVehicleExpense` mutation requires an argument of type `DeleteVehicleExpenseVariables`:
const deleteVehicleExpenseVars: DeleteVehicleExpenseVariables = {
  id: ..., 
};

// Call the `deleteVehicleExpenseRef()` function to get a reference to the mutation.
const ref = deleteVehicleExpenseRef(deleteVehicleExpenseVars);
// Variables can be defined inline as well.
const ref = deleteVehicleExpenseRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteVehicleExpenseRef(dataConnect, deleteVehicleExpenseVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicleExpense_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleExpense_delete);
});
```

## CreateVehicleBillingDocument
You can execute the `CreateVehicleBillingDocument` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createVehicleBillingDocument(vars: CreateVehicleBillingDocumentVariables): MutationPromise<CreateVehicleBillingDocumentData, CreateVehicleBillingDocumentVariables>;

interface CreateVehicleBillingDocumentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateVehicleBillingDocumentVariables): MutationRef<CreateVehicleBillingDocumentData, CreateVehicleBillingDocumentVariables>;
}
export const createVehicleBillingDocumentRef: CreateVehicleBillingDocumentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createVehicleBillingDocument(dc: DataConnect, vars: CreateVehicleBillingDocumentVariables): MutationPromise<CreateVehicleBillingDocumentData, CreateVehicleBillingDocumentVariables>;

interface CreateVehicleBillingDocumentRef {
  ...
  (dc: DataConnect, vars: CreateVehicleBillingDocumentVariables): MutationRef<CreateVehicleBillingDocumentData, CreateVehicleBillingDocumentVariables>;
}
export const createVehicleBillingDocumentRef: CreateVehicleBillingDocumentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createVehicleBillingDocumentRef:
```typescript
const name = createVehicleBillingDocumentRef.operationName;
console.log(name);
```

### Variables
The `CreateVehicleBillingDocument` mutation requires an argument of type `CreateVehicleBillingDocumentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateVehicleBillingDocument` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateVehicleBillingDocumentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateVehicleBillingDocumentData {
  vehicleBillingDocument_insert: VehicleBillingDocument_Key;
}
```
### Using `CreateVehicleBillingDocument`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createVehicleBillingDocument, CreateVehicleBillingDocumentVariables } from '@dataconnect/generated';

// The `CreateVehicleBillingDocument` mutation requires an argument of type `CreateVehicleBillingDocumentVariables`:
const createVehicleBillingDocumentVars: CreateVehicleBillingDocumentVariables = {
  id: ..., // optional
  yearMonth: ..., 
  vehicleId: ..., 
  licensePlate: ..., 
  amount: ..., 
  status: ..., // optional
  memo: ..., // optional
};

// Call the `createVehicleBillingDocument()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createVehicleBillingDocument(createVehicleBillingDocumentVars);
// Variables can be defined inline as well.
const { data } = await createVehicleBillingDocument({ id: ..., yearMonth: ..., vehicleId: ..., licensePlate: ..., amount: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createVehicleBillingDocument(dataConnect, createVehicleBillingDocumentVars);

console.log(data.vehicleBillingDocument_insert);

// Or, you can use the `Promise` API.
createVehicleBillingDocument(createVehicleBillingDocumentVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleBillingDocument_insert);
});
```

### Using `CreateVehicleBillingDocument`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createVehicleBillingDocumentRef, CreateVehicleBillingDocumentVariables } from '@dataconnect/generated';

// The `CreateVehicleBillingDocument` mutation requires an argument of type `CreateVehicleBillingDocumentVariables`:
const createVehicleBillingDocumentVars: CreateVehicleBillingDocumentVariables = {
  id: ..., // optional
  yearMonth: ..., 
  vehicleId: ..., 
  licensePlate: ..., 
  amount: ..., 
  status: ..., // optional
  memo: ..., // optional
};

// Call the `createVehicleBillingDocumentRef()` function to get a reference to the mutation.
const ref = createVehicleBillingDocumentRef(createVehicleBillingDocumentVars);
// Variables can be defined inline as well.
const ref = createVehicleBillingDocumentRef({ id: ..., yearMonth: ..., vehicleId: ..., licensePlate: ..., amount: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createVehicleBillingDocumentRef(dataConnect, createVehicleBillingDocumentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicleBillingDocument_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleBillingDocument_insert);
});
```

## UpdateVehicleBillingDocument
You can execute the `UpdateVehicleBillingDocument` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateVehicleBillingDocument(vars: UpdateVehicleBillingDocumentVariables): MutationPromise<UpdateVehicleBillingDocumentData, UpdateVehicleBillingDocumentVariables>;

interface UpdateVehicleBillingDocumentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateVehicleBillingDocumentVariables): MutationRef<UpdateVehicleBillingDocumentData, UpdateVehicleBillingDocumentVariables>;
}
export const updateVehicleBillingDocumentRef: UpdateVehicleBillingDocumentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateVehicleBillingDocument(dc: DataConnect, vars: UpdateVehicleBillingDocumentVariables): MutationPromise<UpdateVehicleBillingDocumentData, UpdateVehicleBillingDocumentVariables>;

interface UpdateVehicleBillingDocumentRef {
  ...
  (dc: DataConnect, vars: UpdateVehicleBillingDocumentVariables): MutationRef<UpdateVehicleBillingDocumentData, UpdateVehicleBillingDocumentVariables>;
}
export const updateVehicleBillingDocumentRef: UpdateVehicleBillingDocumentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateVehicleBillingDocumentRef:
```typescript
const name = updateVehicleBillingDocumentRef.operationName;
console.log(name);
```

### Variables
The `UpdateVehicleBillingDocument` mutation requires an argument of type `UpdateVehicleBillingDocumentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateVehicleBillingDocument` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateVehicleBillingDocumentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateVehicleBillingDocumentData {
  vehicleBillingDocument_update?: VehicleBillingDocument_Key | null;
}
```
### Using `UpdateVehicleBillingDocument`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateVehicleBillingDocument, UpdateVehicleBillingDocumentVariables } from '@dataconnect/generated';

// The `UpdateVehicleBillingDocument` mutation requires an argument of type `UpdateVehicleBillingDocumentVariables`:
const updateVehicleBillingDocumentVars: UpdateVehicleBillingDocumentVariables = {
  id: ..., 
  yearMonth: ..., // optional
  vehicleId: ..., // optional
  licensePlate: ..., // optional
  amount: ..., // optional
  status: ..., // optional
  memo: ..., // optional
};

// Call the `updateVehicleBillingDocument()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateVehicleBillingDocument(updateVehicleBillingDocumentVars);
// Variables can be defined inline as well.
const { data } = await updateVehicleBillingDocument({ id: ..., yearMonth: ..., vehicleId: ..., licensePlate: ..., amount: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateVehicleBillingDocument(dataConnect, updateVehicleBillingDocumentVars);

console.log(data.vehicleBillingDocument_update);

// Or, you can use the `Promise` API.
updateVehicleBillingDocument(updateVehicleBillingDocumentVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleBillingDocument_update);
});
```

### Using `UpdateVehicleBillingDocument`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateVehicleBillingDocumentRef, UpdateVehicleBillingDocumentVariables } from '@dataconnect/generated';

// The `UpdateVehicleBillingDocument` mutation requires an argument of type `UpdateVehicleBillingDocumentVariables`:
const updateVehicleBillingDocumentVars: UpdateVehicleBillingDocumentVariables = {
  id: ..., 
  yearMonth: ..., // optional
  vehicleId: ..., // optional
  licensePlate: ..., // optional
  amount: ..., // optional
  status: ..., // optional
  memo: ..., // optional
};

// Call the `updateVehicleBillingDocumentRef()` function to get a reference to the mutation.
const ref = updateVehicleBillingDocumentRef(updateVehicleBillingDocumentVars);
// Variables can be defined inline as well.
const ref = updateVehicleBillingDocumentRef({ id: ..., yearMonth: ..., vehicleId: ..., licensePlate: ..., amount: ..., status: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateVehicleBillingDocumentRef(dataConnect, updateVehicleBillingDocumentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicleBillingDocument_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleBillingDocument_update);
});
```

## DeleteVehicleBillingDocument
You can execute the `DeleteVehicleBillingDocument` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteVehicleBillingDocument(vars: DeleteVehicleBillingDocumentVariables): MutationPromise<DeleteVehicleBillingDocumentData, DeleteVehicleBillingDocumentVariables>;

interface DeleteVehicleBillingDocumentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteVehicleBillingDocumentVariables): MutationRef<DeleteVehicleBillingDocumentData, DeleteVehicleBillingDocumentVariables>;
}
export const deleteVehicleBillingDocumentRef: DeleteVehicleBillingDocumentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteVehicleBillingDocument(dc: DataConnect, vars: DeleteVehicleBillingDocumentVariables): MutationPromise<DeleteVehicleBillingDocumentData, DeleteVehicleBillingDocumentVariables>;

interface DeleteVehicleBillingDocumentRef {
  ...
  (dc: DataConnect, vars: DeleteVehicleBillingDocumentVariables): MutationRef<DeleteVehicleBillingDocumentData, DeleteVehicleBillingDocumentVariables>;
}
export const deleteVehicleBillingDocumentRef: DeleteVehicleBillingDocumentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteVehicleBillingDocumentRef:
```typescript
const name = deleteVehicleBillingDocumentRef.operationName;
console.log(name);
```

### Variables
The `DeleteVehicleBillingDocument` mutation requires an argument of type `DeleteVehicleBillingDocumentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteVehicleBillingDocumentVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteVehicleBillingDocument` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteVehicleBillingDocumentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteVehicleBillingDocumentData {
  vehicleBillingDocument_delete?: VehicleBillingDocument_Key | null;
}
```
### Using `DeleteVehicleBillingDocument`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteVehicleBillingDocument, DeleteVehicleBillingDocumentVariables } from '@dataconnect/generated';

// The `DeleteVehicleBillingDocument` mutation requires an argument of type `DeleteVehicleBillingDocumentVariables`:
const deleteVehicleBillingDocumentVars: DeleteVehicleBillingDocumentVariables = {
  id: ..., 
};

// Call the `deleteVehicleBillingDocument()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteVehicleBillingDocument(deleteVehicleBillingDocumentVars);
// Variables can be defined inline as well.
const { data } = await deleteVehicleBillingDocument({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteVehicleBillingDocument(dataConnect, deleteVehicleBillingDocumentVars);

console.log(data.vehicleBillingDocument_delete);

// Or, you can use the `Promise` API.
deleteVehicleBillingDocument(deleteVehicleBillingDocumentVars).then((response) => {
  const data = response.data;
  console.log(data.vehicleBillingDocument_delete);
});
```

### Using `DeleteVehicleBillingDocument`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteVehicleBillingDocumentRef, DeleteVehicleBillingDocumentVariables } from '@dataconnect/generated';

// The `DeleteVehicleBillingDocument` mutation requires an argument of type `DeleteVehicleBillingDocumentVariables`:
const deleteVehicleBillingDocumentVars: DeleteVehicleBillingDocumentVariables = {
  id: ..., 
};

// Call the `deleteVehicleBillingDocumentRef()` function to get a reference to the mutation.
const ref = deleteVehicleBillingDocumentRef(deleteVehicleBillingDocumentVars);
// Variables can be defined inline as well.
const ref = deleteVehicleBillingDocumentRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteVehicleBillingDocumentRef(dataConnect, deleteVehicleBillingDocumentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicleBillingDocument_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicleBillingDocument_delete);
});
```

## UpdateAgent
You can execute the `UpdateAgent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateAgent(vars: UpdateAgentVariables): MutationPromise<UpdateAgentData, UpdateAgentVariables>;

interface UpdateAgentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAgentVariables): MutationRef<UpdateAgentData, UpdateAgentVariables>;
}
export const updateAgentRef: UpdateAgentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateAgent(dc: DataConnect, vars: UpdateAgentVariables): MutationPromise<UpdateAgentData, UpdateAgentVariables>;

interface UpdateAgentRef {
  ...
  (dc: DataConnect, vars: UpdateAgentVariables): MutationRef<UpdateAgentData, UpdateAgentVariables>;
}
export const updateAgentRef: UpdateAgentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateAgentRef:
```typescript
const name = updateAgentRef.operationName;
console.log(name);
```

### Variables
The `UpdateAgent` mutation requires an argument of type `UpdateAgentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateAgentVariables {
  id: string;
  name?: string | null;
  status?: string | null;
}
```
### Return Type
Recall that executing the `UpdateAgent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateAgentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateAgentData {
  agent_update?: Agent_Key | null;
}
```
### Using `UpdateAgent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateAgent, UpdateAgentVariables } from '@dataconnect/generated';

// The `UpdateAgent` mutation requires an argument of type `UpdateAgentVariables`:
const updateAgentVars: UpdateAgentVariables = {
  id: ..., 
  name: ..., // optional
  status: ..., // optional
};

// Call the `updateAgent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateAgent(updateAgentVars);
// Variables can be defined inline as well.
const { data } = await updateAgent({ id: ..., name: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateAgent(dataConnect, updateAgentVars);

console.log(data.agent_update);

// Or, you can use the `Promise` API.
updateAgent(updateAgentVars).then((response) => {
  const data = response.data;
  console.log(data.agent_update);
});
```

### Using `UpdateAgent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateAgentRef, UpdateAgentVariables } from '@dataconnect/generated';

// The `UpdateAgent` mutation requires an argument of type `UpdateAgentVariables`:
const updateAgentVars: UpdateAgentVariables = {
  id: ..., 
  name: ..., // optional
  status: ..., // optional
};

// Call the `updateAgentRef()` function to get a reference to the mutation.
const ref = updateAgentRef(updateAgentVars);
// Variables can be defined inline as well.
const ref = updateAgentRef({ id: ..., name: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateAgentRef(dataConnect, updateAgentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.agent_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.agent_update);
});
```

## UpdateAgentConversation
You can execute the `UpdateAgentConversation` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateAgentConversation(vars: UpdateAgentConversationVariables): MutationPromise<UpdateAgentConversationData, UpdateAgentConversationVariables>;

interface UpdateAgentConversationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAgentConversationVariables): MutationRef<UpdateAgentConversationData, UpdateAgentConversationVariables>;
}
export const updateAgentConversationRef: UpdateAgentConversationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateAgentConversation(dc: DataConnect, vars: UpdateAgentConversationVariables): MutationPromise<UpdateAgentConversationData, UpdateAgentConversationVariables>;

interface UpdateAgentConversationRef {
  ...
  (dc: DataConnect, vars: UpdateAgentConversationVariables): MutationRef<UpdateAgentConversationData, UpdateAgentConversationVariables>;
}
export const updateAgentConversationRef: UpdateAgentConversationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateAgentConversationRef:
```typescript
const name = updateAgentConversationRef.operationName;
console.log(name);
```

### Variables
The `UpdateAgentConversation` mutation requires an argument of type `UpdateAgentConversationVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateAgentConversationVariables {
  id: string;
}
```
### Return Type
Recall that executing the `UpdateAgentConversation` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateAgentConversationData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateAgentConversationData {
  agentConversation_update?: AgentConversation_Key | null;
}
```
### Using `UpdateAgentConversation`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateAgentConversation, UpdateAgentConversationVariables } from '@dataconnect/generated';

// The `UpdateAgentConversation` mutation requires an argument of type `UpdateAgentConversationVariables`:
const updateAgentConversationVars: UpdateAgentConversationVariables = {
  id: ..., 
};

// Call the `updateAgentConversation()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateAgentConversation(updateAgentConversationVars);
// Variables can be defined inline as well.
const { data } = await updateAgentConversation({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateAgentConversation(dataConnect, updateAgentConversationVars);

console.log(data.agentConversation_update);

// Or, you can use the `Promise` API.
updateAgentConversation(updateAgentConversationVars).then((response) => {
  const data = response.data;
  console.log(data.agentConversation_update);
});
```

### Using `UpdateAgentConversation`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateAgentConversationRef, UpdateAgentConversationVariables } from '@dataconnect/generated';

// The `UpdateAgentConversation` mutation requires an argument of type `UpdateAgentConversationVariables`:
const updateAgentConversationVars: UpdateAgentConversationVariables = {
  id: ..., 
};

// Call the `updateAgentConversationRef()` function to get a reference to the mutation.
const ref = updateAgentConversationRef(updateAgentConversationVars);
// Variables can be defined inline as well.
const ref = updateAgentConversationRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateAgentConversationRef(dataConnect, updateAgentConversationVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.agentConversation_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.agentConversation_update);
});
```

## CreateDailyDispatch
You can execute the `CreateDailyDispatch` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createDailyDispatch(vars: CreateDailyDispatchVariables): MutationPromise<CreateDailyDispatchData, CreateDailyDispatchVariables>;

interface CreateDailyDispatchRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDailyDispatchVariables): MutationRef<CreateDailyDispatchData, CreateDailyDispatchVariables>;
}
export const createDailyDispatchRef: CreateDailyDispatchRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createDailyDispatch(dc: DataConnect, vars: CreateDailyDispatchVariables): MutationPromise<CreateDailyDispatchData, CreateDailyDispatchVariables>;

interface CreateDailyDispatchRef {
  ...
  (dc: DataConnect, vars: CreateDailyDispatchVariables): MutationRef<CreateDailyDispatchData, CreateDailyDispatchVariables>;
}
export const createDailyDispatchRef: CreateDailyDispatchRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createDailyDispatchRef:
```typescript
const name = createDailyDispatchRef.operationName;
console.log(name);
```

### Variables
The `CreateDailyDispatch` mutation requires an argument of type `CreateDailyDispatchVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateDailyDispatch` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateDailyDispatchData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateDailyDispatchData {
  dailyDispatch_insert: DailyDispatch_Key;
}
```
### Using `CreateDailyDispatch`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createDailyDispatch, CreateDailyDispatchVariables } from '@dataconnect/generated';

// The `CreateDailyDispatch` mutation requires an argument of type `CreateDailyDispatchVariables`:
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

// Call the `createDailyDispatch()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createDailyDispatch(createDailyDispatchVars);
// Variables can be defined inline as well.
const { data } = await createDailyDispatch({ id: ..., legacyId: ..., date: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., siteId: ..., siteName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createDailyDispatch(dataConnect, createDailyDispatchVars);

console.log(data.dailyDispatch_insert);

// Or, you can use the `Promise` API.
createDailyDispatch(createDailyDispatchVars).then((response) => {
  const data = response.data;
  console.log(data.dailyDispatch_insert);
});
```

### Using `CreateDailyDispatch`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createDailyDispatchRef, CreateDailyDispatchVariables } from '@dataconnect/generated';

// The `CreateDailyDispatch` mutation requires an argument of type `CreateDailyDispatchVariables`:
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

// Call the `createDailyDispatchRef()` function to get a reference to the mutation.
const ref = createDailyDispatchRef(createDailyDispatchVars);
// Variables can be defined inline as well.
const ref = createDailyDispatchRef({ id: ..., legacyId: ..., date: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., siteId: ..., siteName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createDailyDispatchRef(dataConnect, createDailyDispatchVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.dailyDispatch_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyDispatch_insert);
});
```

## UpdateDailyDispatch
You can execute the `UpdateDailyDispatch` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateDailyDispatch(vars: UpdateDailyDispatchVariables): MutationPromise<UpdateDailyDispatchData, UpdateDailyDispatchVariables>;

interface UpdateDailyDispatchRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateDailyDispatchVariables): MutationRef<UpdateDailyDispatchData, UpdateDailyDispatchVariables>;
}
export const updateDailyDispatchRef: UpdateDailyDispatchRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateDailyDispatch(dc: DataConnect, vars: UpdateDailyDispatchVariables): MutationPromise<UpdateDailyDispatchData, UpdateDailyDispatchVariables>;

interface UpdateDailyDispatchRef {
  ...
  (dc: DataConnect, vars: UpdateDailyDispatchVariables): MutationRef<UpdateDailyDispatchData, UpdateDailyDispatchVariables>;
}
export const updateDailyDispatchRef: UpdateDailyDispatchRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateDailyDispatchRef:
```typescript
const name = updateDailyDispatchRef.operationName;
console.log(name);
```

### Variables
The `UpdateDailyDispatch` mutation requires an argument of type `UpdateDailyDispatchVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateDailyDispatch` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateDailyDispatchData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateDailyDispatchData {
  dailyDispatch_update?: DailyDispatch_Key | null;
}
```
### Using `UpdateDailyDispatch`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateDailyDispatch, UpdateDailyDispatchVariables } from '@dataconnect/generated';

// The `UpdateDailyDispatch` mutation requires an argument of type `UpdateDailyDispatchVariables`:
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

// Call the `updateDailyDispatch()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateDailyDispatch(updateDailyDispatchVars);
// Variables can be defined inline as well.
const { data } = await updateDailyDispatch({ id: ..., date: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., siteId: ..., siteName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateDailyDispatch(dataConnect, updateDailyDispatchVars);

console.log(data.dailyDispatch_update);

// Or, you can use the `Promise` API.
updateDailyDispatch(updateDailyDispatchVars).then((response) => {
  const data = response.data;
  console.log(data.dailyDispatch_update);
});
```

### Using `UpdateDailyDispatch`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateDailyDispatchRef, UpdateDailyDispatchVariables } from '@dataconnect/generated';

// The `UpdateDailyDispatch` mutation requires an argument of type `UpdateDailyDispatchVariables`:
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

// Call the `updateDailyDispatchRef()` function to get a reference to the mutation.
const ref = updateDailyDispatchRef(updateDailyDispatchVars);
// Variables can be defined inline as well.
const ref = updateDailyDispatchRef({ id: ..., date: ..., workerId: ..., workerName: ..., teamId: ..., teamName: ..., siteId: ..., siteName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateDailyDispatchRef(dataConnect, updateDailyDispatchVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.dailyDispatch_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyDispatch_update);
});
```

## DeleteDailyDispatch
You can execute the `DeleteDailyDispatch` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteDailyDispatch(vars: DeleteDailyDispatchVariables): MutationPromise<DeleteDailyDispatchData, DeleteDailyDispatchVariables>;

interface DeleteDailyDispatchRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteDailyDispatchVariables): MutationRef<DeleteDailyDispatchData, DeleteDailyDispatchVariables>;
}
export const deleteDailyDispatchRef: DeleteDailyDispatchRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteDailyDispatch(dc: DataConnect, vars: DeleteDailyDispatchVariables): MutationPromise<DeleteDailyDispatchData, DeleteDailyDispatchVariables>;

interface DeleteDailyDispatchRef {
  ...
  (dc: DataConnect, vars: DeleteDailyDispatchVariables): MutationRef<DeleteDailyDispatchData, DeleteDailyDispatchVariables>;
}
export const deleteDailyDispatchRef: DeleteDailyDispatchRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteDailyDispatchRef:
```typescript
const name = deleteDailyDispatchRef.operationName;
console.log(name);
```

### Variables
The `DeleteDailyDispatch` mutation requires an argument of type `DeleteDailyDispatchVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteDailyDispatchVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteDailyDispatch` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteDailyDispatchData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteDailyDispatchData {
  dailyDispatch_delete?: DailyDispatch_Key | null;
}
```
### Using `DeleteDailyDispatch`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteDailyDispatch, DeleteDailyDispatchVariables } from '@dataconnect/generated';

// The `DeleteDailyDispatch` mutation requires an argument of type `DeleteDailyDispatchVariables`:
const deleteDailyDispatchVars: DeleteDailyDispatchVariables = {
  id: ..., 
};

// Call the `deleteDailyDispatch()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteDailyDispatch(deleteDailyDispatchVars);
// Variables can be defined inline as well.
const { data } = await deleteDailyDispatch({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteDailyDispatch(dataConnect, deleteDailyDispatchVars);

console.log(data.dailyDispatch_delete);

// Or, you can use the `Promise` API.
deleteDailyDispatch(deleteDailyDispatchVars).then((response) => {
  const data = response.data;
  console.log(data.dailyDispatch_delete);
});
```

### Using `DeleteDailyDispatch`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteDailyDispatchRef, DeleteDailyDispatchVariables } from '@dataconnect/generated';

// The `DeleteDailyDispatch` mutation requires an argument of type `DeleteDailyDispatchVariables`:
const deleteDailyDispatchVars: DeleteDailyDispatchVariables = {
  id: ..., 
};

// Call the `deleteDailyDispatchRef()` function to get a reference to the mutation.
const ref = deleteDailyDispatchRef(deleteDailyDispatchVars);
// Variables can be defined inline as well.
const ref = deleteDailyDispatchRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteDailyDispatchRef(dataConnect, deleteDailyDispatchVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.dailyDispatch_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.dailyDispatch_delete);
});
```

## CreatePayment
You can execute the `CreatePayment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createPayment(vars: CreatePaymentVariables): MutationPromise<CreatePaymentData, CreatePaymentVariables>;

interface CreatePaymentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePaymentVariables): MutationRef<CreatePaymentData, CreatePaymentVariables>;
}
export const createPaymentRef: CreatePaymentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createPayment(dc: DataConnect, vars: CreatePaymentVariables): MutationPromise<CreatePaymentData, CreatePaymentVariables>;

interface CreatePaymentRef {
  ...
  (dc: DataConnect, vars: CreatePaymentVariables): MutationRef<CreatePaymentData, CreatePaymentVariables>;
}
export const createPaymentRef: CreatePaymentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createPaymentRef:
```typescript
const name = createPaymentRef.operationName;
console.log(name);
```

### Variables
The `CreatePayment` mutation requires an argument of type `CreatePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreatePayment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreatePaymentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreatePaymentData {
  payment_insert: Payment_Key;
}
```
### Using `CreatePayment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createPayment, CreatePaymentVariables } from '@dataconnect/generated';

// The `CreatePayment` mutation requires an argument of type `CreatePaymentVariables`:
const createPaymentVars: CreatePaymentVariables = {
  id: ..., // optional
  legacyId: ..., // optional
  date: ..., 
  amount: ..., 
  type: ..., // optional
  method: ..., // optional
  memo: ..., // optional
};

// Call the `createPayment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createPayment(createPaymentVars);
// Variables can be defined inline as well.
const { data } = await createPayment({ id: ..., legacyId: ..., date: ..., amount: ..., type: ..., method: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createPayment(dataConnect, createPaymentVars);

console.log(data.payment_insert);

// Or, you can use the `Promise` API.
createPayment(createPaymentVars).then((response) => {
  const data = response.data;
  console.log(data.payment_insert);
});
```

### Using `CreatePayment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createPaymentRef, CreatePaymentVariables } from '@dataconnect/generated';

// The `CreatePayment` mutation requires an argument of type `CreatePaymentVariables`:
const createPaymentVars: CreatePaymentVariables = {
  id: ..., // optional
  legacyId: ..., // optional
  date: ..., 
  amount: ..., 
  type: ..., // optional
  method: ..., // optional
  memo: ..., // optional
};

// Call the `createPaymentRef()` function to get a reference to the mutation.
const ref = createPaymentRef(createPaymentVars);
// Variables can be defined inline as well.
const ref = createPaymentRef({ id: ..., legacyId: ..., date: ..., amount: ..., type: ..., method: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createPaymentRef(dataConnect, createPaymentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.payment_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.payment_insert);
});
```

## UpdatePayment
You can execute the `UpdatePayment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updatePayment(vars: UpdatePaymentVariables): MutationPromise<UpdatePaymentData, UpdatePaymentVariables>;

interface UpdatePaymentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdatePaymentVariables): MutationRef<UpdatePaymentData, UpdatePaymentVariables>;
}
export const updatePaymentRef: UpdatePaymentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updatePayment(dc: DataConnect, vars: UpdatePaymentVariables): MutationPromise<UpdatePaymentData, UpdatePaymentVariables>;

interface UpdatePaymentRef {
  ...
  (dc: DataConnect, vars: UpdatePaymentVariables): MutationRef<UpdatePaymentData, UpdatePaymentVariables>;
}
export const updatePaymentRef: UpdatePaymentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updatePaymentRef:
```typescript
const name = updatePaymentRef.operationName;
console.log(name);
```

### Variables
The `UpdatePayment` mutation requires an argument of type `UpdatePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdatePayment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdatePaymentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdatePaymentData {
  payment_update?: Payment_Key | null;
}
```
### Using `UpdatePayment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updatePayment, UpdatePaymentVariables } from '@dataconnect/generated';

// The `UpdatePayment` mutation requires an argument of type `UpdatePaymentVariables`:
const updatePaymentVars: UpdatePaymentVariables = {
  id: ..., 
  date: ..., // optional
  amount: ..., // optional
  type: ..., // optional
  method: ..., // optional
  memo: ..., // optional
};

// Call the `updatePayment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updatePayment(updatePaymentVars);
// Variables can be defined inline as well.
const { data } = await updatePayment({ id: ..., date: ..., amount: ..., type: ..., method: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updatePayment(dataConnect, updatePaymentVars);

console.log(data.payment_update);

// Or, you can use the `Promise` API.
updatePayment(updatePaymentVars).then((response) => {
  const data = response.data;
  console.log(data.payment_update);
});
```

### Using `UpdatePayment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updatePaymentRef, UpdatePaymentVariables } from '@dataconnect/generated';

// The `UpdatePayment` mutation requires an argument of type `UpdatePaymentVariables`:
const updatePaymentVars: UpdatePaymentVariables = {
  id: ..., 
  date: ..., // optional
  amount: ..., // optional
  type: ..., // optional
  method: ..., // optional
  memo: ..., // optional
};

// Call the `updatePaymentRef()` function to get a reference to the mutation.
const ref = updatePaymentRef(updatePaymentVars);
// Variables can be defined inline as well.
const ref = updatePaymentRef({ id: ..., date: ..., amount: ..., type: ..., method: ..., memo: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updatePaymentRef(dataConnect, updatePaymentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.payment_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.payment_update);
});
```

## DeletePayment
You can execute the `DeletePayment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deletePayment(vars: DeletePaymentVariables): MutationPromise<DeletePaymentData, DeletePaymentVariables>;

interface DeletePaymentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeletePaymentVariables): MutationRef<DeletePaymentData, DeletePaymentVariables>;
}
export const deletePaymentRef: DeletePaymentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deletePayment(dc: DataConnect, vars: DeletePaymentVariables): MutationPromise<DeletePaymentData, DeletePaymentVariables>;

interface DeletePaymentRef {
  ...
  (dc: DataConnect, vars: DeletePaymentVariables): MutationRef<DeletePaymentData, DeletePaymentVariables>;
}
export const deletePaymentRef: DeletePaymentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deletePaymentRef:
```typescript
const name = deletePaymentRef.operationName;
console.log(name);
```

### Variables
The `DeletePayment` mutation requires an argument of type `DeletePaymentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeletePaymentVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeletePayment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeletePaymentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeletePaymentData {
  payment_delete?: Payment_Key | null;
}
```
### Using `DeletePayment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deletePayment, DeletePaymentVariables } from '@dataconnect/generated';

// The `DeletePayment` mutation requires an argument of type `DeletePaymentVariables`:
const deletePaymentVars: DeletePaymentVariables = {
  id: ..., 
};

// Call the `deletePayment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deletePayment(deletePaymentVars);
// Variables can be defined inline as well.
const { data } = await deletePayment({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deletePayment(dataConnect, deletePaymentVars);

console.log(data.payment_delete);

// Or, you can use the `Promise` API.
deletePayment(deletePaymentVars).then((response) => {
  const data = response.data;
  console.log(data.payment_delete);
});
```

### Using `DeletePayment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deletePaymentRef, DeletePaymentVariables } from '@dataconnect/generated';

// The `DeletePayment` mutation requires an argument of type `DeletePaymentVariables`:
const deletePaymentVars: DeletePaymentVariables = {
  id: ..., 
};

// Call the `deletePaymentRef()` function to get a reference to the mutation.
const ref = deletePaymentRef(deletePaymentVars);
// Variables can be defined inline as well.
const ref = deletePaymentRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deletePaymentRef(dataConnect, deletePaymentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.payment_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.payment_delete);
});
```

## CreateTaxInvoice
You can execute the `CreateTaxInvoice` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createTaxInvoice(vars: CreateTaxInvoiceVariables): MutationPromise<CreateTaxInvoiceData, CreateTaxInvoiceVariables>;

interface CreateTaxInvoiceRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateTaxInvoiceVariables): MutationRef<CreateTaxInvoiceData, CreateTaxInvoiceVariables>;
}
export const createTaxInvoiceRef: CreateTaxInvoiceRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createTaxInvoice(dc: DataConnect, vars: CreateTaxInvoiceVariables): MutationPromise<CreateTaxInvoiceData, CreateTaxInvoiceVariables>;

interface CreateTaxInvoiceRef {
  ...
  (dc: DataConnect, vars: CreateTaxInvoiceVariables): MutationRef<CreateTaxInvoiceData, CreateTaxInvoiceVariables>;
}
export const createTaxInvoiceRef: CreateTaxInvoiceRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createTaxInvoiceRef:
```typescript
const name = createTaxInvoiceRef.operationName;
console.log(name);
```

### Variables
The `CreateTaxInvoice` mutation requires an argument of type `CreateTaxInvoiceVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateTaxInvoice` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateTaxInvoiceData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateTaxInvoiceData {
  taxInvoice_insert: TaxInvoice_Key;
}
```
### Using `CreateTaxInvoice`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createTaxInvoice, CreateTaxInvoiceVariables } from '@dataconnect/generated';

// The `CreateTaxInvoice` mutation requires an argument of type `CreateTaxInvoiceVariables`:
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

// Call the `createTaxInvoice()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createTaxInvoice(createTaxInvoiceVars);
// Variables can be defined inline as well.
const { data } = await createTaxInvoice({ id: ..., legacyId: ..., date: ..., amount: ..., tax: ..., total: ..., companyName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createTaxInvoice(dataConnect, createTaxInvoiceVars);

console.log(data.taxInvoice_insert);

// Or, you can use the `Promise` API.
createTaxInvoice(createTaxInvoiceVars).then((response) => {
  const data = response.data;
  console.log(data.taxInvoice_insert);
});
```

### Using `CreateTaxInvoice`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createTaxInvoiceRef, CreateTaxInvoiceVariables } from '@dataconnect/generated';

// The `CreateTaxInvoice` mutation requires an argument of type `CreateTaxInvoiceVariables`:
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

// Call the `createTaxInvoiceRef()` function to get a reference to the mutation.
const ref = createTaxInvoiceRef(createTaxInvoiceVars);
// Variables can be defined inline as well.
const ref = createTaxInvoiceRef({ id: ..., legacyId: ..., date: ..., amount: ..., tax: ..., total: ..., companyName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createTaxInvoiceRef(dataConnect, createTaxInvoiceVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.taxInvoice_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.taxInvoice_insert);
});
```

## UpdateTaxInvoice
You can execute the `UpdateTaxInvoice` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateTaxInvoice(vars: UpdateTaxInvoiceVariables): MutationPromise<UpdateTaxInvoiceData, UpdateTaxInvoiceVariables>;

interface UpdateTaxInvoiceRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTaxInvoiceVariables): MutationRef<UpdateTaxInvoiceData, UpdateTaxInvoiceVariables>;
}
export const updateTaxInvoiceRef: UpdateTaxInvoiceRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateTaxInvoice(dc: DataConnect, vars: UpdateTaxInvoiceVariables): MutationPromise<UpdateTaxInvoiceData, UpdateTaxInvoiceVariables>;

interface UpdateTaxInvoiceRef {
  ...
  (dc: DataConnect, vars: UpdateTaxInvoiceVariables): MutationRef<UpdateTaxInvoiceData, UpdateTaxInvoiceVariables>;
}
export const updateTaxInvoiceRef: UpdateTaxInvoiceRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateTaxInvoiceRef:
```typescript
const name = updateTaxInvoiceRef.operationName;
console.log(name);
```

### Variables
The `UpdateTaxInvoice` mutation requires an argument of type `UpdateTaxInvoiceVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `UpdateTaxInvoice` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateTaxInvoiceData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateTaxInvoiceData {
  taxInvoice_update?: TaxInvoice_Key | null;
}
```
### Using `UpdateTaxInvoice`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateTaxInvoice, UpdateTaxInvoiceVariables } from '@dataconnect/generated';

// The `UpdateTaxInvoice` mutation requires an argument of type `UpdateTaxInvoiceVariables`:
const updateTaxInvoiceVars: UpdateTaxInvoiceVariables = {
  id: ..., 
  date: ..., // optional
  amount: ..., // optional
  tax: ..., // optional
  total: ..., // optional
  companyName: ..., // optional
  status: ..., // optional
};

// Call the `updateTaxInvoice()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateTaxInvoice(updateTaxInvoiceVars);
// Variables can be defined inline as well.
const { data } = await updateTaxInvoice({ id: ..., date: ..., amount: ..., tax: ..., total: ..., companyName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateTaxInvoice(dataConnect, updateTaxInvoiceVars);

console.log(data.taxInvoice_update);

// Or, you can use the `Promise` API.
updateTaxInvoice(updateTaxInvoiceVars).then((response) => {
  const data = response.data;
  console.log(data.taxInvoice_update);
});
```

### Using `UpdateTaxInvoice`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateTaxInvoiceRef, UpdateTaxInvoiceVariables } from '@dataconnect/generated';

// The `UpdateTaxInvoice` mutation requires an argument of type `UpdateTaxInvoiceVariables`:
const updateTaxInvoiceVars: UpdateTaxInvoiceVariables = {
  id: ..., 
  date: ..., // optional
  amount: ..., // optional
  tax: ..., // optional
  total: ..., // optional
  companyName: ..., // optional
  status: ..., // optional
};

// Call the `updateTaxInvoiceRef()` function to get a reference to the mutation.
const ref = updateTaxInvoiceRef(updateTaxInvoiceVars);
// Variables can be defined inline as well.
const ref = updateTaxInvoiceRef({ id: ..., date: ..., amount: ..., tax: ..., total: ..., companyName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateTaxInvoiceRef(dataConnect, updateTaxInvoiceVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.taxInvoice_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.taxInvoice_update);
});
```

## DeleteTaxInvoice
You can execute the `DeleteTaxInvoice` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteTaxInvoice(vars: DeleteTaxInvoiceVariables): MutationPromise<DeleteTaxInvoiceData, DeleteTaxInvoiceVariables>;

interface DeleteTaxInvoiceRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteTaxInvoiceVariables): MutationRef<DeleteTaxInvoiceData, DeleteTaxInvoiceVariables>;
}
export const deleteTaxInvoiceRef: DeleteTaxInvoiceRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteTaxInvoice(dc: DataConnect, vars: DeleteTaxInvoiceVariables): MutationPromise<DeleteTaxInvoiceData, DeleteTaxInvoiceVariables>;

interface DeleteTaxInvoiceRef {
  ...
  (dc: DataConnect, vars: DeleteTaxInvoiceVariables): MutationRef<DeleteTaxInvoiceData, DeleteTaxInvoiceVariables>;
}
export const deleteTaxInvoiceRef: DeleteTaxInvoiceRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteTaxInvoiceRef:
```typescript
const name = deleteTaxInvoiceRef.operationName;
console.log(name);
```

### Variables
The `DeleteTaxInvoice` mutation requires an argument of type `DeleteTaxInvoiceVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteTaxInvoiceVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteTaxInvoice` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteTaxInvoiceData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteTaxInvoiceData {
  taxInvoice_delete?: TaxInvoice_Key | null;
}
```
### Using `DeleteTaxInvoice`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteTaxInvoice, DeleteTaxInvoiceVariables } from '@dataconnect/generated';

// The `DeleteTaxInvoice` mutation requires an argument of type `DeleteTaxInvoiceVariables`:
const deleteTaxInvoiceVars: DeleteTaxInvoiceVariables = {
  id: ..., 
};

// Call the `deleteTaxInvoice()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteTaxInvoice(deleteTaxInvoiceVars);
// Variables can be defined inline as well.
const { data } = await deleteTaxInvoice({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteTaxInvoice(dataConnect, deleteTaxInvoiceVars);

console.log(data.taxInvoice_delete);

// Or, you can use the `Promise` API.
deleteTaxInvoice(deleteTaxInvoiceVars).then((response) => {
  const data = response.data;
  console.log(data.taxInvoice_delete);
});
```

### Using `DeleteTaxInvoice`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteTaxInvoiceRef, DeleteTaxInvoiceVariables } from '@dataconnect/generated';

// The `DeleteTaxInvoice` mutation requires an argument of type `DeleteTaxInvoiceVariables`:
const deleteTaxInvoiceVars: DeleteTaxInvoiceVariables = {
  id: ..., 
};

// Call the `deleteTaxInvoiceRef()` function to get a reference to the mutation.
const ref = deleteTaxInvoiceRef(deleteTaxInvoiceVars);
// Variables can be defined inline as well.
const ref = deleteTaxInvoiceRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteTaxInvoiceRef(dataConnect, deleteTaxInvoiceVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.taxInvoice_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.taxInvoice_delete);
});
```

## CreateReceivable
You can execute the `CreateReceivable` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createReceivable(vars: CreateReceivableVariables): MutationPromise<CreateReceivableData, CreateReceivableVariables>;

interface CreateReceivableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateReceivableVariables): MutationRef<CreateReceivableData, CreateReceivableVariables>;
}
export const createReceivableRef: CreateReceivableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createReceivable(dc: DataConnect, vars: CreateReceivableVariables): MutationPromise<CreateReceivableData, CreateReceivableVariables>;

interface CreateReceivableRef {
  ...
  (dc: DataConnect, vars: CreateReceivableVariables): MutationRef<CreateReceivableData, CreateReceivableVariables>;
}
export const createReceivableRef: CreateReceivableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createReceivableRef:
```typescript
const name = createReceivableRef.operationName;
console.log(name);
```

### Variables
The `CreateReceivable` mutation requires an argument of type `CreateReceivableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
Recall that executing the `CreateReceivable` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateReceivableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateReceivableData {
  receivable_insert: Receivable_Key;
}
```
### Using `CreateReceivable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createReceivable, CreateReceivableVariables } from '@dataconnect/generated';

// The `CreateReceivable` mutation requires an argument of type `CreateReceivableVariables`:
const createReceivableVars: CreateReceivableVariables = {
  id: ..., // optional
  legacyId: ..., // optional
  date: ..., 
  amount: ..., 
  companyName: ..., // optional
  status: ..., // optional
};

// Call the `createReceivable()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createReceivable(createReceivableVars);
// Variables can be defined inline as well.
const { data } = await createReceivable({ id: ..., legacyId: ..., date: ..., amount: ..., companyName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createReceivable(dataConnect, createReceivableVars);

console.log(data.receivable_insert);

// Or, you can use the `Promise` API.
createReceivable(createReceivableVars).then((response) => {
  const data = response.data;
  console.log(data.receivable_insert);
});
```

### Using `CreateReceivable`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createReceivableRef, CreateReceivableVariables } from '@dataconnect/generated';

// The `CreateReceivable` mutation requires an argument of type `CreateReceivableVariables`:
const createReceivableVars: CreateReceivableVariables = {
  id: ..., // optional
  legacyId: ..., // optional
  date: ..., 
  amount: ..., 
  companyName: ..., // optional
  status: ..., // optional
};

// Call the `createReceivableRef()` function to get a reference to the mutation.
const ref = createReceivableRef(createReceivableVars);
// Variables can be defined inline as well.
const ref = createReceivableRef({ id: ..., legacyId: ..., date: ..., amount: ..., companyName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createReceivableRef(dataConnect, createReceivableVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.receivable_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.receivable_insert);
});
```

## UpdateReceivable
You can execute the `UpdateReceivable` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateReceivable(vars: UpdateReceivableVariables): MutationPromise<UpdateReceivableData, UpdateReceivableVariables>;

interface UpdateReceivableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateReceivableVariables): MutationRef<UpdateReceivableData, UpdateReceivableVariables>;
}
export const updateReceivableRef: UpdateReceivableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateReceivable(dc: DataConnect, vars: UpdateReceivableVariables): MutationPromise<UpdateReceivableData, UpdateReceivableVariables>;

interface UpdateReceivableRef {
  ...
  (dc: DataConnect, vars: UpdateReceivableVariables): MutationRef<UpdateReceivableData, UpdateReceivableVariables>;
}
export const updateReceivableRef: UpdateReceivableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateReceivableRef:
```typescript
const name = updateReceivableRef.operationName;
console.log(name);
```

### Variables
The `UpdateReceivable` mutation requires an argument of type `UpdateReceivableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateReceivableVariables {
  id: UUIDString;
  date?: string | null;
  amount?: number | null;
  companyName?: string | null;
  status?: string | null;
}
```
### Return Type
Recall that executing the `UpdateReceivable` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateReceivableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateReceivableData {
  receivable_update?: Receivable_Key | null;
}
```
### Using `UpdateReceivable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateReceivable, UpdateReceivableVariables } from '@dataconnect/generated';

// The `UpdateReceivable` mutation requires an argument of type `UpdateReceivableVariables`:
const updateReceivableVars: UpdateReceivableVariables = {
  id: ..., 
  date: ..., // optional
  amount: ..., // optional
  companyName: ..., // optional
  status: ..., // optional
};

// Call the `updateReceivable()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateReceivable(updateReceivableVars);
// Variables can be defined inline as well.
const { data } = await updateReceivable({ id: ..., date: ..., amount: ..., companyName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateReceivable(dataConnect, updateReceivableVars);

console.log(data.receivable_update);

// Or, you can use the `Promise` API.
updateReceivable(updateReceivableVars).then((response) => {
  const data = response.data;
  console.log(data.receivable_update);
});
```

### Using `UpdateReceivable`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateReceivableRef, UpdateReceivableVariables } from '@dataconnect/generated';

// The `UpdateReceivable` mutation requires an argument of type `UpdateReceivableVariables`:
const updateReceivableVars: UpdateReceivableVariables = {
  id: ..., 
  date: ..., // optional
  amount: ..., // optional
  companyName: ..., // optional
  status: ..., // optional
};

// Call the `updateReceivableRef()` function to get a reference to the mutation.
const ref = updateReceivableRef(updateReceivableVars);
// Variables can be defined inline as well.
const ref = updateReceivableRef({ id: ..., date: ..., amount: ..., companyName: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateReceivableRef(dataConnect, updateReceivableVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.receivable_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.receivable_update);
});
```

## DeleteReceivable
You can execute the `DeleteReceivable` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteReceivable(vars: DeleteReceivableVariables): MutationPromise<DeleteReceivableData, DeleteReceivableVariables>;

interface DeleteReceivableRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteReceivableVariables): MutationRef<DeleteReceivableData, DeleteReceivableVariables>;
}
export const deleteReceivableRef: DeleteReceivableRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteReceivable(dc: DataConnect, vars: DeleteReceivableVariables): MutationPromise<DeleteReceivableData, DeleteReceivableVariables>;

interface DeleteReceivableRef {
  ...
  (dc: DataConnect, vars: DeleteReceivableVariables): MutationRef<DeleteReceivableData, DeleteReceivableVariables>;
}
export const deleteReceivableRef: DeleteReceivableRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteReceivableRef:
```typescript
const name = deleteReceivableRef.operationName;
console.log(name);
```

### Variables
The `DeleteReceivable` mutation requires an argument of type `DeleteReceivableVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteReceivableVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteReceivable` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteReceivableData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteReceivableData {
  receivable_delete?: Receivable_Key | null;
}
```
### Using `DeleteReceivable`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteReceivable, DeleteReceivableVariables } from '@dataconnect/generated';

// The `DeleteReceivable` mutation requires an argument of type `DeleteReceivableVariables`:
const deleteReceivableVars: DeleteReceivableVariables = {
  id: ..., 
};

// Call the `deleteReceivable()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteReceivable(deleteReceivableVars);
// Variables can be defined inline as well.
const { data } = await deleteReceivable({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteReceivable(dataConnect, deleteReceivableVars);

console.log(data.receivable_delete);

// Or, you can use the `Promise` API.
deleteReceivable(deleteReceivableVars).then((response) => {
  const data = response.data;
  console.log(data.receivable_delete);
});
```

### Using `DeleteReceivable`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteReceivableRef, DeleteReceivableVariables } from '@dataconnect/generated';

// The `DeleteReceivable` mutation requires an argument of type `DeleteReceivableVariables`:
const deleteReceivableVars: DeleteReceivableVariables = {
  id: ..., 
};

// Call the `deleteReceivableRef()` function to get a reference to the mutation.
const ref = deleteReceivableRef(deleteReceivableVars);
// Variables can be defined inline as well.
const ref = deleteReceivableRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteReceivableRef(dataConnect, deleteReceivableVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.receivable_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.receivable_delete);
});
```

