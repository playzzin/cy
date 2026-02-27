const fs = require('fs');
const schema = fs.readFileSync('dataconnect/schema/schema.gql', 'utf8');
const queries = fs.readFileSync('dataconnect/example/queries.gql', 'utf8');

const tableRegex = /type\s+([A-Za-z0-9_]+)\s+@table/g;
let newQueries = '';

let match;
while ((match = tableRegex.exec(schema)) !== null) {
    const typeName = match[1];
    
    // Pluralize type name naively (add 's', 'es', or replace 'y' with 'ies')
    let plural = typeName + 's';
    if (typeName.endsWith('y')) plural = typeName.slice(0, -1) + 'ies';
    else if (typeName.endsWith('s') || typeName.endsWith('ch')) plural = typeName + 'es';
    
    // Some manual overrides if needed
    if (typeName === 'DailyReportWorker') plural = 'DailyReportWorkers';
    if (typeName === 'Company') plural = 'Companies';
    if (typeName === 'VehicleBillingDocument') plural = 'VehicleBillingDocuments';
    
    // Lowercase first letter for the query field
    const fieldName = plural.charAt(0).toLowerCase() + plural.slice(1);
    
    const queryName = 'ListAll' + plural;
    
    if (!queries.includes('query ' + queryName) && !newQueries.includes('query ' + queryName)) {
        newQueries += `\n\nquery ${queryName}($limit: Int, $offset: Int) @auth(level: USER, insecureReason: "Auth handled at application level") {\n  ${fieldName}(limit: $limit, offset: $offset) {\n    id\n  }\n}`;
    }
}

fs.writeFileSync('dataconnect/example/queries.gql', queries + newQueries, 'utf8');
