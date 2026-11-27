import './firebaseAdmin';
import { guardDevPreviewEndpoint } from './devPreviewEndpoint';

// A deployed instance serves one target. Discovery and other functions need
// the complete export list, including all trigger metadata.
function loadEndpoints(target: string | undefined): Record<string, unknown> {
    switch (target) {
        case 'teamExpenseRequests': return { teamExpenseRequests: require('./teamExpenseRequests').teamExpenseRequests };
        case 'teamWorkerRequests': return { teamWorkerRequests: require('./teamWorkerRequests').teamWorkerRequests };
        case 'getTeamScopedData': return { getTeamScopedData: require('./teamScopedRead').getTeamScopedData };
        default: return require('./index');
    }
}
const endpoints = loadEndpoints(process.env.FUNCTION_TARGET || process.env.FUNCTION_NAME);

// All callable exports pass through the read-only preview boundary.
for (const [name, endpoint] of Object.entries(endpoints)) {
    exports[name] = guardDevPreviewEndpoint(name, endpoint);
}
