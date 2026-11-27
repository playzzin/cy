export type HostedReadFunction = 'getTeamScopedData' | 'getNoticeBoard' | 'teamWorkerRequests' | 'teamExpenseRequests';

export const hostedReadUrl = ({ hostname, origin, protocol }: Pick<Location, 'hostname' | 'origin' | 'protocol'>, name: HostedReadFunction) => {
    if (protocol !== 'https:' || !['cyee-9c1e4.web.app', 'cyee-9c1e4.firebaseapp.com'].includes(hostname)) return undefined;
    return `${origin}/api/${name}`;
};
