const fs = require('fs');
let text = fs.readFileSync('dataconnect/example/queries.gql', 'utf8');
const index = text.indexOf('query ListAllDailyReportWorkers');
if (index !== -1) {
  text = text.substring(0, index);
}
text += `query ListAllDailyReportWorkers($limit: Int, $offset: Int) @auth(level: USER, insecureReason: "Auth handled at application level") {
  dailyReportWorkers(limit: $limit, offset: $offset) {
    id
    dailyReport { id }
    worker { id }
    gongsu
    unitPrice
    amount
    workDescription
    legacyWorkerId
    legacyTeamId
    workerName
    role
    status
    manDay
    payType
    salaryModel
    workContent
    createdAt
  }
}

query ListSystemConfigs($limit: Int, $offset: Int) @auth(level: USER, insecureReason: "Auth handled at application level") {
  systemConfigs(limit: $limit, offset: $offset) {
    id
    data
    updatedAt
  }
}

query ListAllSystemConfigs($limit: Int, $offset: Int) @auth(level: USER, insecureReason: "Auth handled at application level") {
  systemConfigs(limit: $limit, offset: $offset) {
    id
    data
    updatedAt
  }
}

query ListAllAuditLogs($limit: Int, $offset: Int) @auth(level: USER, insecureReason: "Auth handled at application level") {
  auditLogs(limit: $limit, offset: $offset) {
    id
    action
    category
    actorId
    actorEmail
    targetId
    details
    timestamp
  }
}
`;
fs.writeFileSync('dataconnect/example/queries.gql', text, 'utf8');
