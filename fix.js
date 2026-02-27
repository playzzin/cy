const fs = require('fs');
let text = fs.readFileSync('dataconnect/example/queries.gql', 'utf8');

// Find all queries starting with 'query List' and not 'ListAll'
const queryRegex = /query\s+(List[a-zA-Z0-9_]+)\s*(?:\([^)]*\))?\s*@auth\([^)]+\)\s*\{[\s\S]*?\n\}/g;

let additions = '';

let match;
while ((match = queryRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const queryName = match[1];
    
    if (queryName.startsWith('ListAll')) continue;
    
    const newQueryName = queryName.replace('List', 'ListAll');
    
    // Check if newQueryName already exists
    if (text.includes('query ' + newQueryName)) continue;
    
    let newQuery = fullMatch;
    
    // Replace the name and arguments
    newQuery = newQuery.replace(
        new RegExp('query\\s+' + queryName + '\\s*(?:\\([^)]*\\))?\\s*@auth'),
        'query ' + newQueryName + '($limit: Int, $offset: Int) @auth'
    );
    
    // Replace limit: 5000 with limit: $limit, offset: $offset
    newQuery = newQuery.replace(/limit:\s*\d+/g, 'limit: $limit, offset: $offset');

    additions += '\n\n' + newQuery;
}

fs.writeFileSync('dataconnect/example/queries.gql', text + additions, 'utf8');
