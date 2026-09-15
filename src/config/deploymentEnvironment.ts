export const isStaging = process.env.REACT_APP_DEPLOYMENT_ENV === 'staging';
export function assertDeploymentEnvironment(projectId: string, hostname: string) {
    const stagingProject = 'cy-erp-staging-9c1e4';
    if ((isStaging && projectId !== stagingProject) || (!isStaging && projectId === stagingProject)
        || (hostname === `${stagingProject}.web.app` && !isStaging)
        || (hostname === 'cyee-9c1e4.web.app' && isStaging)) {
        throw new Error('서버 주소와 데이터 연결이 일치하지 않아 접속을 중단했습니다.');
    }
}
