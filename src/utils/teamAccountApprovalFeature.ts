// Enable only in a frontend build released after the callable and rules are verified.
export const teamAccountApprovalEnabled = () => process.env.REACT_APP_TEAM_ACCOUNT_APPROVALS_ENABLED === 'true';
