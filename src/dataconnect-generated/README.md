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
};

// Call the `createCompany()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createCompany(createCompanyVars);
// Variables can be defined inline as well.
const { data } = await createCompany({ name: ..., code: ..., legacyId: ..., businessNumber: ..., ceoName: ..., type: ..., status: ..., });

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
};

// Call the `createCompanyRef()` function to get a reference to the mutation.
const ref = createCompanyRef(createCompanyVars);
// Variables can be defined inline as well.
const ref = createCompanyRef({ name: ..., code: ..., legacyId: ..., businessNumber: ..., ceoName: ..., type: ..., status: ..., });

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
};

// Call the `updateCompany()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateCompany(updateCompanyVars);
// Variables can be defined inline as well.
const { data } = await updateCompany({ id: ..., name: ..., code: ..., businessNumber: ..., ceoName: ..., type: ..., status: ..., });

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
};

// Call the `updateCompanyRef()` function to get a reference to the mutation.
const ref = updateCompanyRef(updateCompanyVars);
// Variables can be defined inline as well.
const ref = updateCompanyRef({ id: ..., name: ..., code: ..., businessNumber: ..., ceoName: ..., type: ..., status: ..., });

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

