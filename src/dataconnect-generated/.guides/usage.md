# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useCreateCompany, useCreateTeam, useCreateWorker, useCreateSite, useCreateDailyReport, useCreateDailyReportWorker, useUpdateDailyReportWorker, useDeleteDailyReportWorker, useCreatePosition, useCreateAuditLog } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useCreateCompany(createCompanyVars);

const { data, isPending, isSuccess, isError, error } = useCreateTeam(createTeamVars);

const { data, isPending, isSuccess, isError, error } = useCreateWorker(createWorkerVars);

const { data, isPending, isSuccess, isError, error } = useCreateSite(createSiteVars);

const { data, isPending, isSuccess, isError, error } = useCreateDailyReport(createDailyReportVars);

const { data, isPending, isSuccess, isError, error } = useCreateDailyReportWorker(createDailyReportWorkerVars);

const { data, isPending, isSuccess, isError, error } = useUpdateDailyReportWorker(updateDailyReportWorkerVars);

const { data, isPending, isSuccess, isError, error } = useDeleteDailyReportWorker(deleteDailyReportWorkerVars);

const { data, isPending, isSuccess, isError, error } = useCreatePosition(createPositionVars);

const { data, isPending, isSuccess, isError, error } = useCreateAuditLog(createAuditLogVars);

```

Here's an example from a different generated SDK:

```ts
import { useListAllMovies } from '@dataconnect/generated/react';

function MyComponent() {
  const { isLoading, data, error } = useListAllMovies();
  if(isLoading) {
    return <div>Loading...</div>
  }
  if(error) {
    return <div> An Error Occurred: {error} </div>
  }
}

// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyComponent from './my-component';

function App() {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>
    <MyComponent />
  </QueryClientProvider>
}
```



## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createCompany, createTeam, createWorker, createSite, createDailyReport, createDailyReportWorker, updateDailyReportWorker, deleteDailyReportWorker, createPosition, createAuditLog } from '@dataconnect/generated';


// Operation CreateCompany:  For variables, look at type CreateCompanyVars in ../index.d.ts
const { data } = await CreateCompany(dataConnect, createCompanyVars);

// Operation CreateTeam:  For variables, look at type CreateTeamVars in ../index.d.ts
const { data } = await CreateTeam(dataConnect, createTeamVars);

// Operation CreateWorker:  For variables, look at type CreateWorkerVars in ../index.d.ts
const { data } = await CreateWorker(dataConnect, createWorkerVars);

// Operation CreateSite:  For variables, look at type CreateSiteVars in ../index.d.ts
const { data } = await CreateSite(dataConnect, createSiteVars);

// Operation CreateDailyReport:  For variables, look at type CreateDailyReportVars in ../index.d.ts
const { data } = await CreateDailyReport(dataConnect, createDailyReportVars);

// Operation CreateDailyReportWorker:  For variables, look at type CreateDailyReportWorkerVars in ../index.d.ts
const { data } = await CreateDailyReportWorker(dataConnect, createDailyReportWorkerVars);

// Operation UpdateDailyReportWorker:  For variables, look at type UpdateDailyReportWorkerVars in ../index.d.ts
const { data } = await UpdateDailyReportWorker(dataConnect, updateDailyReportWorkerVars);

// Operation DeleteDailyReportWorker:  For variables, look at type DeleteDailyReportWorkerVars in ../index.d.ts
const { data } = await DeleteDailyReportWorker(dataConnect, deleteDailyReportWorkerVars);

// Operation CreatePosition:  For variables, look at type CreatePositionVars in ../index.d.ts
const { data } = await CreatePosition(dataConnect, createPositionVars);

// Operation CreateAuditLog:  For variables, look at type CreateAuditLogVars in ../index.d.ts
const { data } = await CreateAuditLog(dataConnect, createAuditLogVars);


```