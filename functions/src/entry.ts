import * as endpoints from './index';
import { guardDevPreviewEndpoint } from './devPreviewEndpoint';

// All callable exports pass through the read-only preview boundary.
for (const [name, endpoint] of Object.entries(endpoints)) {
    exports[name] = guardDevPreviewEndpoint(name, endpoint);
}
