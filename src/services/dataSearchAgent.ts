/**
 * 데이터 검색 전문 에이전트
 * 
 * 작업자, 팀, 현장, 회사 등의 상세 정보 및 관계 데이터 조회
 */

import { db } from '../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, limit, orderBy } from 'firebase/firestore';

// ===========================
// Types
// ===========================

export interface WorkerDetails {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    bloodType?: string;
    bankAccount?: {
        bank: string;
        accountNumber: string;
        accountHolder: string;
    };
    team?: {
        id: string;
        name: string;
    };
    company?: {
        id: string;
        name: string;
    };
    role?: string;
    unitPrice?: number;
    payType?: string;
}

export interface TeamDetails {
    id: string;
    name: string;
    leader?: string;
    memberCount: number;
    members: Array<{
        id: string;
        name: string;
        role: string;
    }>;
    sites: Array<{
        id: string;
        name: string;
    }>;
    company?: {
        id: string;
        name: string;
    };
}

export interface SiteDetails {
    id: string;
    name: string;
    code?: string;
    address?: string;
    manager?: {
        id: string;
        name: string;
        phone?: string;
    };
    type: '직영' | '도급' | '기타';
    company?: {
        id: string;
        name: string;
    };
    teams: Array<{
        id: string;
        name: string;
    }>;
    startDate?: string;
    endDate?: string;
}

export interface CompanyDetails {
    id: string;
    name: string;
    type?: string;
    representative?: string;
    businessNumber?: string;
    address?: string;
    phone?: string;
    workers: Array<{
        id: string;
        name: string;
        role: string;
    }>;
    sites: Array<{
        id: string;
        name: string;
    }>;
}

interface SearchRequest {
    query: string;
    entityType?: 'worker' | 'team' | 'site' | 'company';
}

interface SearchResponse {
    markdown: string;
    data: any;
}

// ===========================
// Helper Functions
// ===========================

/**
 * 전화번호 마스킹
 */
function maskPhone(phone?: string): string {
    if (!phone) return '-';
    // 010-1234-5678 -> 010-****-5678
    const parts = phone.split('-');
    if (parts.length === 3) {
        return `${parts[0]}-****-${parts[2]}`;
    }
    return phone;
}

/**
 * 주민번호/계좌번호 마스킹
 */
function maskSensitive(value?: string): string {
    if (!value) return '-';
    if (value.length > 6) {
        return value.substring(0, 3) + '***' + value.substring(value.length - 2);
    }
    return '***';
}

// ===========================
// Main Data Search Agent
// ===========================

export class DataSearchAgent {
    /**
     * 자연어 검색 처리
     */
    async search(request: SearchRequest): Promise<SearchResponse> {
        const { query } = request;
        const lowerQuery = query.toLowerCase();

        try {
            // 복합 검색: "현장에서 일하는 팀" 형태
            if (this.isComplexQuery(lowerQuery)) {
                return await this.handleComplexQuery(query);
            }

            // 통계 검색: "가장 많이", "상위", "평균" 등
            if (this.isStatisticalQuery(lowerQuery)) {
                return await this.handleStatisticalQuery(query);
            }

            // 날짜 범위 검색
            if (this.isDateRangeQuery(lowerQuery)) {
                return await this.handleDateRangeQuery(query);
            }

            // 상태 기반 검색: "미배정", "재직", "진행중" 등
            if (this.isStatusQuery(lowerQuery)) {
                return await this.handleStatusQuery(query);
            }

            // 부분 일치 검색: "~포함", "~있는" 등
            if (this.isPartialMatchQuery(lowerQuery)) {
                return await this.handlePartialMatchQuery(query);
            }

            // 기본 엔티티 검색
            if (lowerQuery.includes('작업자') || lowerQuery.includes('근로자') || lowerQuery.match(/([가-힣]{2,4})(씨|님)?/)) {
                return await this.searchWorker(query);
            }

            if (lowerQuery.includes('팀')) {
                return await this.searchTeam(query);
            }

            if (lowerQuery.includes('현장')) {
                return await this.searchSite(query);
            }

            if (lowerQuery.includes('회사') || lowerQuery.includes('협력사')) {
                return await this.searchCompany(query);
            }

            // 퍼지 검색: 유사한 이름 찾기
            if (lowerQuery.includes('비슷한') || lowerQuery.includes('유사')) {
                return await this.fuzzySearch(query);
            }

            return {
                markdown: this.getHelpMessage(),
                data: null
            };

        } catch (error: any) {
            return {
                markdown: `⚠️ **오류 발생**\n\n${error.message}`,
                data: null
            };
        }
    }

    /**
     * 도움말 메시지
     */
    private getHelpMessage(): string {
        return `💡 **검색 가능한 질문 예시:**

### 기본 검색
- "홍길동 작업자 정보"
- "철근팀 인원"
- "강남현장 담당자"
- "삼성엔지니어링 협력사"

### 복합 검색
- "강남현장에서 일하는 팀들"
- "철근팀이 투입된 현장들"
- "청연ENG 소속 작업자들"

### 통계 검색
- "가장 많이 투입된 작업자 10명"
- "인원이 가장 많은 팀"
- "최근 7일간 작업한 작업자들"

### 상태 검색
- "미배정 작업자 목록"
- "진행중인 현장들"
- "비활성 팀 목록"

### 부분 일치 검색
- "이름에 '김' 포함된 작업자"
- "'현대' 포함된 회사들"`;
    }

    // ===========================
    // Query Type Detection
    // ===========================

    private isComplexQuery(query: string): boolean {
        return (query.includes('에서') && query.includes('일하는')) ||
            (query.includes('투입된') && query.includes('현장')) ||
            (query.includes('소속') && query.includes('작업자'));
    }

    private isStatisticalQuery(query: string): boolean {
        return query.includes('가장') || query.includes('상위') ||
            query.includes('최근') || query.includes('평균') ||
            query.includes('합계') || query.includes('순위');
    }

    private isDateRangeQuery(query: string): boolean {
        return query.includes('최근') || query.includes('이번') ||
            query.includes('지난') || query.includes('오늘') ||
            query.includes('어제') || query.includes('이달');
    }

    private isStatusQuery(query: string): boolean {
        return query.includes('미배정') || query.includes('배정') ||
            query.includes('재직') || query.includes('퇴사') ||
            query.includes('진행') || query.includes('완료') ||
            query.includes('비활성');
    }

    private isPartialMatchQuery(query: string): boolean {
        return query.includes('포함') || query.includes('있는') ||
            query.includes('~') || query.includes('비슷한');
    }

    // ===========================
    // Advanced Search Handlers
    // ===========================

    /**
     * 복합 쿼리 처리
     */
    private async handleComplexQuery(query: string): Promise<SearchResponse> {
        const lowerQuery = query.toLowerCase();

        // "현장에서 일하는 팀"
        if (lowerQuery.includes('현장') && lowerQuery.includes('팀')) {
            const siteMatch = query.match(/([가-힣0-9]+현장)/);
            if (!siteMatch) {
                return { markdown: '현장 이름을 명확히 입력해주세요.', data: null };
            }

            const siteName = siteMatch[1];
            const teams = await this.getTeamsBySite(siteName);

            let md = `## 🏗️ ${siteName} 투입 팀\n\n`;

            if (teams.length === 0) {
                md += '*투입된 팀이 없습니다.*';
            } else {
                md += '| 순위 | 팀명 | 인원 | 팀장 |\n';
                md += '|------|------|------|------|\n';
                teams.forEach((team, idx) => {
                    md += `| ${idx + 1} | ${team.name} | ${team.memberCount}명 | ${team.leader || '-'} |\n`;
                });
            }

            return { markdown: md, data: teams };
        }

        // "팀이 투입된 현장들"
        if (lowerQuery.includes('팀') && lowerQuery.includes('현장')) {
            const teamMatch = query.match(/([가-힣0-9]+팀)/);
            if (!teamMatch) {
                return { markdown: '팀 이름을 명확히 입력해주세요.', data: null };
            }

            const teamName = teamMatch[1];
            const sites = await this.getSitesByTeam(teamName);

            let md = `## 👥 ${teamName} 투입 현장\n\n`;

            if (sites.length === 0) {
                md += '*투입된 현장이 없습니다.*';
            } else {
                md += '| 순위 | 현장명 | 구분 | 주소 |\n';
                md += '|------|--------|------|------|\n';
                sites.forEach((site, idx) => {
                    md += `| ${idx + 1} | ${site.name} | ${site.type} | ${site.address || '-'} |\n`;
                });
            }

            return { markdown: md, data: sites };
        }

        // "회사 소속 작업자들"
        if (lowerQuery.includes('소속') && lowerQuery.includes('작업자')) {
            const companyMatch = query.match(/([가-힣0-9()（）]+)/);
            if (!companyMatch) {
                return { markdown: '회사 이름을 입력해주세요.', data: null };
            }

            const companyName = companyMatch[1].replace('소속', '').replace('작업자', '').trim();
            const workers = await this.getWorkersByCompany(companyName);

            let md = `## 🏢 ${companyName} 소속 작업자\n\n`;

            if (workers.length === 0) {
                md += '*소속 작업자가 없습니다.*';
            } else {
                md += `**총 ${workers.length}명**\n\n`;
                md += '| 순위 | 이름 | 직종 | 팀 |\n';
                md += '|------|------|------|------|\n';
                workers.slice(0, 50).forEach((worker, idx) => {
                    md += `| ${idx + 1} | ${worker.name} | ${worker.role || '-'} | ${worker.teamName || '-'} |\n`;
                });
                if (workers.length > 50) {
                    md += `\n*상위 50명만 표시 (전체 ${workers.length}명)*\n`;
                }
            }

            return { markdown: md, data: workers };
        }

        return { markdown: '복합 검색을 이해하지 못했습니다.', data: null };
    }

    /**
     * 통계 검색 처리
     */
    private async handleStatisticalQuery(query: string): Promise<SearchResponse> {
        const lowerQuery = query.toLowerCase();

        // "가장 많이 투입된 작업자"
        if (lowerQuery.includes('작업자') && (lowerQuery.includes('많이') || lowerQuery.includes('상위'))) {
            const limitMatch = query.match(/(\d+)/);
            const limit = limitMatch ? parseInt(limitMatch[1]) : 10;

            const topWorkers = await this.getTopWorkersByManpower(limit);

            let md = `## 🏆 투입 공수 상위 작업자 (${limit}명)\n\n`;
            md += '| 순위 | 이름 | 출근일 | 총 공수 | 소속팀 |\n';
            md += '|------|------|--------|---------|--------|\n';

            topWorkers.forEach((w, idx) => {
                md += `| ${idx + 1} | ${w.name} | ${w.workDays}일 | ${w.totalManDay.toFixed(1)} | ${w.teamName || '-'} |\n`;
            });

            return { markdown: md, data: topWorkers };
        }

        // "인원이 가장 많은 팀"
        if (lowerQuery.includes('팀') && (lowerQuery.includes('많은') || lowerQuery.includes('큰'))) {
            const teams = await this.getTeamsBySize();

            let md = `## 📊 팀별 인원 현황 (인원 많은 순)\n\n`;
            md += '| 순위 | 팀명 | 인원 | 팀장 |\n';
            md += '|------|------|------|------|\n';

            teams.slice(0, 20).forEach((team, idx) => {
                md += `| ${idx + 1} | ${team.name} | ${team.memberCount}명 | ${team.leader || '-'} |\n`;
            });

            return { markdown: md, data: teams };
        }

        return { markdown: '통계 검색을 이해하지 못했습니다.', data: null };
    }

    /**
     * 날짜 범위 검색 처리
     */
    private async handleDateRangeQuery(query: string): Promise<SearchResponse> {
        const lowerQuery = query.toLowerCase();

        let days = 7; // 기본 7일
        if (lowerQuery.includes('오늘')) days = 1;
        else if (lowerQuery.includes('어제')) days = 1;
        else if (lowerQuery.includes('3일')) days = 3;
        else if (lowerQuery.includes('7일') || lowerQuery.includes('일주일')) days = 7;
        else if (lowerQuery.includes('30일') || lowerQuery.includes('한달') || lowerQuery.includes('이달')) days = 30;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const workers = await this.getWorkersWithinDateRange(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );

        let md = `## 📅 최근 ${days}일간 작업 이력\n\n`;
        md += `**기간:** ${startDate.toLocaleDateString('ko-KR')} ~ ${endDate.toLocaleDateString('ko-KR')}\n\n`;
        md += `**작업 인원:** ${workers.length}명\n\n`;

        if (workers.length > 0) {
            md += '| 이름 | 출근일 | 평균 공수 | 소속팀 |\n';
            md += '|------|--------|-----------|--------|\n';
            workers.slice(0, 30).forEach(w => {
                md += `| ${w.name} | ${w.workDays}일 | ${w.avgManDay.toFixed(2)} | ${w.teamName || '-'} |\n`;
            });
            if (workers.length > 30) {
                md += `\n*상위 30명만 표시 (전체 ${workers.length}명)*\n`;
            }
        }

        return { markdown: md, data: workers };
    }

    /**
     * 상태 검색 처리
     */
    private async handleStatusQuery(query: string): Promise<SearchResponse> {
        const lowerQuery = query.toLowerCase();

        // 미배정 작업자
        if (lowerQuery.includes('미배정') && lowerQuery.includes('작업자')) {
            const unassignedWorkers = await this.getUnassignedWorkers();

            let md = `## 👤 미배정 작업자 목록\n\n`;
            md += `**총 ${unassignedWorkers.length}명**\n\n`;

            if (unassignedWorkers.length > 0) {
                md += '| 이름 | 직종 | 전화번호 |\n';
                md += '|------|------|----------|\n';
                unassignedWorkers.forEach(w => {
                    md += `| ${w.name} | ${w.role || '-'} | ${maskPhone(w.phone)} |\n`;
                });
            } else {
                md += '*모든 작업자가 팀에 배정되어 있습니다.* ✅';
            }

            return { markdown: md, data: unassignedWorkers };
        }

        // 재직 작업자
        if (lowerQuery.includes('재직') && lowerQuery.includes('작업자')) {
            const activeWorkers = await this.getActiveWorkers();

            let md = `## 👥 재직 작업자 현황\n\n`;
            md += `**총 ${activeWorkers.length}명**\n\n`;

            const byTeam = this.groupWorkersByTeam(activeWorkers);

            md += '### 팀별 현황\n\n';
            md += '| 팀명 | 인원 |\n';
            md += '|------|------|\n';

            Object.entries(byTeam).forEach(([team, workers]) => {
                md += `| ${team} | ${workers.length}명 |\n`;
            });

            return { markdown: md, data: activeWorkers };
        }

        return { markdown: '상태 검색을 이해하지 못했습니다.', data: null };
    }

    /**
     * 부분 일치 검색 처리
     */
    private async handlePartialMatchQuery(query: string): Promise<SearchResponse> {
        const lowerQuery = query.toLowerCase();

        const searchTermMatch = query.match(/['"]([^'"]+)['"]/);
        if (!searchTermMatch) {
            return { markdown: '검색어를 작은따옴표나 큰따옴표로 감싸주세요. (예: "김")', data: null };
        }

        const searchTerm = searchTermMatch[1];

        // 작업자 이름 검색
        if (lowerQuery.includes('작업자') || lowerQuery.includes('이름')) {
            const workers = await this.searchWorkersByPartialName(searchTerm);

            let md = `## 🔍 '${searchTerm}' 포함 작업자 검색 결과\n\n`;
            md += `**검색 결과:** ${workers.length}명\n\n`;

            if (workers.length > 0) {
                md += '| 이름 | 직종 | 팀 | 회사 |\n';
                md += '|------|------|-----|------|\n';
                workers.slice(0, 50).forEach(w => {
                    md += `| ${w.name} | ${w.role || '-'} | ${w.teamName || '-'} | ${w.companyName || '-'} |\n`;
                });
                if (workers.length > 50) {
                    md += `\n*상위 50명만 표시 (전체 ${workers.length}명)*\n`;
                }
            }

            return { markdown: md, data: workers };
        }

        // 회사명 검색
        if (lowerQuery.includes('회사') || lowerQuery.includes('협력사')) {
            const companies = await this.searchCompaniesByPartialName(searchTerm);

            let md = `## 🔍 '${searchTerm}' 포함 회사 검색 결과\n\n`;
            md += `**검색 결과:** ${companies.length}개\n\n`;

            if (companies.length > 0) {
                companies.forEach(c => {
                    md += `### ${c.name}\n`;
                    md += `- 소속 작업자: ${c.workerCount}명\n`;
                    md += `- 참여 현장: ${c.siteCount}개\n\n`;
                });
            }

            return { markdown: md, data: companies };
        }

        return { markdown: '부분 일치 검색을 이해하지 못했습니다.', data: null };
    }

    /**
     * 퍼지 검색 (유사 이름)
     */
    private async fuzzySearch(query: string): Promise<SearchResponse> {
        const nameMatch = query.match(/([가-힣]{2,4})/);
        if (!nameMatch) {
            return { markdown: '검색할 이름을 입력해주세요.', data: null };
        }

        const searchName = nameMatch[1];
        const similarWorkers = await this.findSimilarWorkers(searchName);

        let md = `## 🔎 '${searchName}'와 유사한 작업자\n\n`;

        if (similarWorkers.length === 0) {
            md += '*유사한 이름의 작업자를 찾을 수 없습니다.*';
        } else {
            md += '| 이름 | 유사도 | 팀 | 전화번호 |\n';
            md += '|------|--------|-----|----------|\n';
            similarWorkers.forEach(w => {
                md += `| ${w.name} | ${w.similarity}% | ${w.teamName || '-'} | ${maskPhone(w.phone)} |\n`;
            });
        }

        return { markdown: md, data: similarWorkers };
    }

    /**
     * 작업자 검색
     */
    /**
     * 작업자 검색
     */
    private async searchWorker(query: string): Promise<SearchResponse> {
        // 검색어 전처리: 불필요한 키워드 제거
        const stopWords = [
            '작업자', '근로자', '직원', '정보', '검색', '찾아', '알려', '보여',
            '전화번호', '연락처', '주소', '계좌', '은행', '예금주', '혈액형',
            '단가', '급여', '공수', '주민', '번호', '어디', '누구'
        ];

        let cleanQuery = query;
        stopWords.forEach(word => {
            cleanQuery = cleanQuery.replace(word, '');
        });

        // 이름 추출 (키워드 제거 후 남은 문자열에서 2-4글자 한글 추출)
        const nameMatch = cleanQuery.match(/([가-힣]{2,4})/);
        const searchName = nameMatch ? nameMatch[1] : '';

        if (!searchName) {
            return {
                markdown: '작업자 이름을 명확히 입력해주세요.',
                data: null
            };
        }

        // 1. 정확히 일치하는 작업자 조회
        const workerDetails = await this.getWorkerDetails(searchName);

        if (workerDetails) {
            return {
                markdown: this.formatWorkerDetails(workerDetails),
                data: workerDetails
            };
        }

        // 2. 검색 실패 시 유사한 이름 검색 (Fuzzy Search)
        const similarWorkers = await this.findSimilarWorkers(searchName);

        if (similarWorkers.length > 0) {
            // 가장 유사한 작업자 (유사도 70% 이상이면 바로 보여주기?)
            // 여기서는 목록으로 제안
            let md = `**'${searchName}'** 작업자를 찾을 수 없습니다.\n\n`;
            md += `혹시 다음 작업자를 찾으시나요?\n\n`;

            md += '| 이름 | 유사도 | 팀 | 상세정보 |\n';
            md += '|------|--------|-----|----------|\n';
            similarWorkers.slice(0, 5).forEach(w => {
                md += `| ${w.name} | ${w.similarity}% | ${w.teamName || '-'} | *${w.name} 정보* 라고 입력 |\n`;
            });

            return { markdown: md, data: similarWorkers };
        }

        return {
            markdown: `**${searchName}** 작업자를 찾을 수 없습니다. 이름이 정확한지 확인해주세요.`,
            data: null
        };
    }

    /**
     * 팀 검색
     */
    /**
     * 팀 검색
     */
    private async searchTeam(query: string): Promise<SearchResponse> {
        // 검색어 전처리
        let cleanQuery = query;
        ['검색', '찾아', '알려', '보여', '정보', '인원', '팀장', '목록'].forEach(word => {
            cleanQuery = cleanQuery.replace(word, '');
        });

        const teamNameMatch = cleanQuery.match(/([가-힣0-9]+팀)/);
        const searchTeam = teamNameMatch ? teamNameMatch[1] : '';

        // "팀" 단독으로 매칭된 경우 제외 (예: "팀 정보 알려줘" -> "팀")
        if (!searchTeam || searchTeam === '팀') {
            return {
                markdown: '팀 이름을 입력해주세요. (예: 철근팀, 1공구팀)',
                data: null
            };
        }

        const teamDetails = await this.getTeamDetails(searchTeam);

        if (!teamDetails) {
            return {
                markdown: `**${searchTeam}**을(를) 찾을 수 없습니다.`,
                data: null
            };
        }

        const markdown = this.formatTeamDetails(teamDetails);
        return { markdown, data: teamDetails };
    }

    /**
     * 현장 검색
     */
    /**
     * 현장 검색
     */
    private async searchSite(query: string): Promise<SearchResponse> {
        // 검색어 전처리
        let cleanQuery = query;
        ['검색', '찾아', '알려', '보여', '정보', '주소', '담당자', '목록'].forEach(word => {
            cleanQuery = cleanQuery.replace(word, '');
        });

        // 현장명 추출 (간단한 패턴)
        const siteNameMatch = cleanQuery.match(/([가-힣0-9]+현장)/);
        const searchSite = siteNameMatch ? siteNameMatch[1] : '';

        // "현장" 단독으로 매칭된 경우 제외
        if (!searchSite || searchSite === '현장') {
            return {
                markdown: '현장 이름을 입력해주세요. (예: 강남현장, 판교현장)',
                data: null
            };
        }

        const siteDetails = await this.getSiteDetails(searchSite);

        if (!siteDetails) {
            return {
                markdown: `**${searchSite}**을(를) 찾을 수 없습니다.`,
                data: null
            };
        }

        const markdown = this.formatSiteDetails(siteDetails);
        return { markdown, data: siteDetails };
    }

    /**
     * 회사 검색
     */
    /**
     * 회사 검색
     */
    private async searchCompany(query: string): Promise<SearchResponse> {
        // 검색어 전처리
        const stopWords = [
            '회사', '협력사', '업체', '정보', '검색', '찾아', '알려', '보여',
            '주소', '전화번호', '연락처', '대표', '사업자', '번호'
        ];

        let cleanQuery = query;
        stopWords.forEach(word => {
            cleanQuery = cleanQuery.replace(word, '');
        });

        const companyNameMatch = cleanQuery.match(/([가-힣0-9()（）]+)/);
        const searchCompany = companyNameMatch ? companyNameMatch[1] : '';

        if (!searchCompany || searchCompany.length < 2) {
            return {
                markdown: '회사 이름을 입력해주세요.',
                data: null
            };
        }

        const companyDetails = await this.getCompanyDetails(searchCompany);

        if (!companyDetails) {
            // 2. 검색 실패 시 퍼지 검색 시도
            // (현재 회사 퍼지 검색 메서드는 없으므로 향후 추가 가능)
            return {
                markdown: `**${searchCompany}**을(를) 찾을 수 없습니다.`,
                data: null
            };
        }

        const markdown = this.formatCompanyDetails(companyDetails);
        return { markdown, data: companyDetails };
    }

    // ===========================
    // Firestore Query Methods
    // ===========================

    /**
     * 작업자 상세 정보 조회
     */
    private async getWorkerDetails(name: string): Promise<WorkerDetails | null> {
        const workersRef = collection(db, 'workers');
        const q = query(workersRef, where('name', '==', name), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const workerDoc = snapshot.docs[0];
        const data = workerDoc.data();

        // 팀 정보 조회
        let teamInfo = undefined;
        if (data.teamId) {
            const teamDoc = await getDoc(doc(db, 'teams', data.teamId));
            if (teamDoc.exists()) {
                teamInfo = {
                    id: teamDoc.id,
                    name: teamDoc.data().name
                };
            }
        }

        // 회사 정보 조회
        let companyInfo = undefined;
        if (data.companyId) {
            const companyDoc = await getDoc(doc(db, 'companies', data.companyId));
            if (companyDoc.exists()) {
                companyInfo = {
                    id: companyDoc.id,
                    name: companyDoc.data().name
                };
            }
        }

        return {
            id: workerDoc.id,
            name: data.name,
            phone: data.phone,
            address: data.address,
            bloodType: data.bloodType,
            bankAccount: data.bankName && data.accountNumber ? {
                bank: data.bankName,
                accountNumber: data.accountNumber,
                accountHolder: data.accountHolder || data.name
            } : undefined,
            team: teamInfo,
            company: companyInfo,
            role: data.role,
            unitPrice: data.unitPrice,
            payType: data.payType
        };
    }

    /**
     * 팀 상세 정보 조회
     */
    private async getTeamDetails(teamName: string): Promise<TeamDetails | null> {
        const teamsRef = collection(db, 'teams');
        const q = query(teamsRef, where('name', '==', teamName), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const teamDoc = snapshot.docs[0];
        const data = teamDoc.data();

        // 팀 소속 작업자 조회
        const workersRef = collection(db, 'workers');
        const workersQ = query(workersRef, where('teamId', '==', teamDoc.id));
        const workersSnapshot = await getDocs(workersQ);

        const members = workersSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            role: doc.data().role || ''
        }));

        // 팀이 투입된 현장 조회
        const sitesRef = collection(db, 'sites');
        const sitesQ = query(sitesRef, where('teamId', '==', teamDoc.id));
        const sitesSnapshot = await getDocs(sitesQ);

        const sites = sitesSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));

        // 회사 정보
        let companyInfo = undefined;
        if (data.companyId) {
            const companyDoc = await getDoc(doc(db, 'companies', data.companyId));
            if (companyDoc.exists()) {
                companyInfo = {
                    id: companyDoc.id,
                    name: companyDoc.data().name
                };
            }
        }

        return {
            id: teamDoc.id,
            name: data.name,
            leader: data.leader,
            memberCount: members.length,
            members,
            sites,
            company: companyInfo
        };
    }

    /**
     * 현장 상세 정보 조회
     */
    private async getSiteDetails(siteName: string): Promise<SiteDetails | null> {
        const sitesRef = collection(db, 'sites');
        const q = query(sitesRef, where('name', '==', siteName), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const siteDoc = snapshot.docs[0];
        const data = siteDoc.data();

        // 담당자 정보
        let managerInfo = undefined;
        if (data.managerId) {
            const managerDoc = await getDoc(doc(db, 'workers', data.managerId));
            if (managerDoc.exists()) {
                managerInfo = {
                    id: managerDoc.id,
                    name: managerDoc.data().name,
                    phone: managerDoc.data().phone
                };
            }
        }

        // 투입된 팀 조회
        const teamsRef = collection(db, 'teams');
        const teamsQ = query(teamsRef, where('siteId', '==', siteDoc.id));
        const teamsSnapshot = await getDocs(teamsQ);

        const teams = teamsSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));

        // 회사 정보
        let companyInfo = undefined;
        if (data.companyId) {
            const companyDoc = await getDoc(doc(db, 'companies', data.companyId));
            if (companyDoc.exists()) {
                companyInfo = {
                    id: companyDoc.id,
                    name: companyDoc.data().name
                };
            }
        }

        return {
            id: siteDoc.id,
            name: data.name,
            code: data.code,
            address: data.address,
            manager: managerInfo,
            type: data.type || '기타',
            company: companyInfo,
            teams,
            startDate: data.startDate,
            endDate: data.endDate
        };
    }

    /**
     * 회사 상세 정보 조회
     */
    private async getCompanyDetails(companyName: string): Promise<CompanyDetails | null> {
        const companiesRef = collection(db, 'companies');
        const q = query(companiesRef, where('name', '==', companyName), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const companyDoc = snapshot.docs[0];
        const data = companyDoc.data();

        // 소속 작업자 조회
        const workersRef = collection(db, 'workers');
        const workersQ = query(workersRef, where('companyId', '==', companyDoc.id));
        const workersSnapshot = await getDocs(workersQ);

        const workers = workersSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            role: doc.data().role || ''
        }));

        // 회사가 참여한 현장 조회
        const sitesRef = collection(db, 'sites');
        const sitesQ = query(sitesRef, where('companyId', '==', companyDoc.id));
        const sitesSnapshot = await getDocs(sitesQ);

        const sites = sitesSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));

        return {
            id: companyDoc.id,
            name: data.name,
            type: data.type,
            representative: data.representative,
            businessNumber: data.businessNumber,
            address: data.address,
            phone: data.phone,
            workers,
            sites
        };
    }

    // ===========================
    // Formatting Methods
    // ===========================

    /**
     * 작업자 정보 Markdown 포맷
     */
    private formatWorkerDetails(worker: WorkerDetails): string {
        let md = `## 👤 ${worker.name} 작업자 정보\n\n`;

        md += '### 📋 기본 정보\n\n';
        md += '| 항목 | 내용 |\n';
        md += '|------|------|\n';
        md += `| 이름 | ${worker.name} |\n`;
        md += `| 전화번호 | ${maskPhone(worker.phone)} |\n`;
        md += `| 주소 | ${worker.address || '-'} |\n`;
        md += `| 혈액형 | ${worker.bloodType || '-'} |\n`;
        md += `| 직종 | ${worker.role || '-'} |\n`;
        md += `| 단가 | ${worker.unitPrice ? `₩${worker.unitPrice.toLocaleString()}` : '-'} |\n`;
        md += `| 급여방식 | ${worker.payType || '-'} |\n\n`;

        if (worker.bankAccount) {
            md += '### 💳 계좌 정보\n\n';
            md += '| 항목 | 내용 |\n';
            md += '|------|------|\n';
            md += `| 은행 | ${worker.bankAccount.bank} |\n`;
            md += `| 계좌번호 | ${maskSensitive(worker.bankAccount.accountNumber)} |\n`;
            md += `| 예금주 | ${worker.bankAccount.accountHolder} |\n\n`;
        }

        if (worker.team) {
            md += `### 🏢 소속 정보\n\n`;
            md += `- **팀:** ${worker.team.name}\n`;
        }

        if (worker.company) {
            md += `- **회사:** ${worker.company.name}\n`;
        }

        return md;
    }

    /**
     * 팀 정보 Markdown 포맷
     */
    private formatTeamDetails(team: TeamDetails): string {
        let md = `## 👥 ${team.name} 정보\n\n`;

        md += '### 📊 팀 개요\n\n';
        md += '| 항목 | 내용 |\n';
        md += '|------|------|\n';
        md += `| 팀명 | ${team.name} |\n`;
        md += `| 팀장 | ${team.leader || '-'} |\n`;
        md += `| 인원 | ${team.memberCount}명 |\n`;
        if (team.company) {
            md += `| 소속회사 | ${team.company.name} |\n`;
        }
        md += '\n';

        if (team.members.length > 0) {
            md += '### 👤 팀원 목록\n\n';
            md += '| 이름 | 직종 |\n';
            md += '|------|------|\n';
            team.members.slice(0, 20).forEach(member => {
                md += `| ${member.name} | ${member.role || '-'} |\n`;
            });
            if (team.members.length > 20) {
                md += `\n*상위 20명만 표시 (전체 ${team.members.length}명)*\n`;
            }
            md += '\n';
        }

        if (team.sites.length > 0) {
            md += '### 🏗️ 투입 현장\n\n';
            team.sites.forEach(site => {
                md += `- ${site.name}\n`;
            });
            md += '\n';
        }

        return md;
    }

    /**
     * 현장 정보 Markdown 포맷
     */
    private formatSiteDetails(site: SiteDetails): string {
        let md = `## 🏗️ ${site.name} 정보\n\n`;

        md += '### 📋 현장 개요\n\n';
        md += '| 항목 | 내용 |\n';
        md += '|------|------|\n';
        md += `| 현장명 | ${site.name} |\n`;
        md += `| 현장코드 | ${site.code || '-'} |\n`;
        md += `| 주소 | ${site.address || '-'} |\n`;
        md += `| 구분 | ${site.type} |\n`;
        if (site.company) {
            md += `| 발주처 | ${site.company.name} |\n`;
        }
        if (site.startDate) {
            md += `| 착공일 | ${site.startDate} |\n`;
        }
        if (site.endDate) {
            md += `| 준공일 | ${site.endDate} |\n`;
        }
        md += '\n';

        if (site.manager) {
            md += '### 👔 현장 담당자\n\n';
            md += `- **이름:** ${site.manager.name}\n`;
            md += `- **연락처:** ${maskPhone(site.manager.phone)}\n\n`;
        }

        if (site.teams.length > 0) {
            md += '### 👥 투입 팀\n\n';
            site.teams.forEach(team => {
                md += `- ${team.name}\n`;
            });
            md += '\n';
        }

        return md;
    }

    /**
     * 회사 정보 Markdown 포맷
     */
    private formatCompanyDetails(company: CompanyDetails): string {
        let md = `## 🏢 ${company.name} 정보\n\n`;

        md += '### 📋 회사 개요\n\n';
        md += '| 항목 | 내용 |\n';
        md += '|------|------|\n';
        md += `| 회사명 | ${company.name} |\n`;
        md += `| 구분 | ${company.type || '-'} |\n`;
        md += `| 대표자 | ${company.representative || '-'} |\n`;
        md += `| 사업자번호 | ${company.businessNumber || '-'} |\n`;
        md += `| 주소 | ${company.address || '-'} |\n`;
        md += `| 연락처 | ${company.phone || '-'} |\n\n`;

        if (company.workers.length > 0) {
            md += `### 👤 소속 작업자 (${company.workers.length}명)\n\n`;
            md += '| 이름 | 직종 |\n';
            md += '|------|------|\n';
            company.workers.slice(0, 20).forEach(worker => {
                md += `| ${worker.name} | ${worker.role || '-'} |\n`;
            });
            if (company.workers.length > 20) {
                md += `\n*상위 20명만 표시 (전체 ${company.workers.length}명)*\n`;
            }
            md += '\n';
        }

        if (company.sites.length > 0) {
            md += `### 🏗️ 참여 현장 (${company.sites.length}개)\n\n`;
            company.sites.forEach(site => {
                md += `- ${site.name}\n`;
            });
            md += '\n';
        }

        return md;
    }

    // ===========================
    // Advanced Query Helper Methods
    // ===========================

    /**
     * 현장별 팀 목록 조회
     */
    private async getTeamsBySite(siteName: string): Promise<Array<{ name: string; memberCount: number; leader?: string }>> {
        // 현장 찾기
        const sitesRef = collection(db, 'sites');
        const siteQ = query(sitesRef, where('name', '==', siteName), limit(1));
        const siteSnap = await getDocs(siteQ);

        if (siteSnap.empty) return [];

        const siteId = siteSnap.docs[0].id;

        // 해당 현장의 일보에서 팀 추출
        const reportsRef = collection(db, 'dailyReports');
        const reportsQ = query(reportsRef, where('siteId', '==', siteId));
        const reportsSnap = await getDocs(reportsQ);

        const teamIds = new Set<string>();
        reportsSnap.docs.forEach(doc => {
            const teamId = doc.data().teamId;
            if (teamId) teamIds.add(teamId);
        });

        // 팀 정보 조회
        const teams = [];
        for (const teamId of Array.from(teamIds)) {
            const teamDoc = await getDoc(doc(db, 'teams', teamId));
            if (teamDoc.exists()) {
                const teamData = teamDoc.data();

                // 팀 인원 수 계산
                const workersRef = collection(db, 'workers');
                const workersQ = query(workersRef, where('teamId', '==', teamId));
                const workersSnap = await getDocs(workersQ);

                teams.push({
                    name: teamData.name,
                    memberCount: workersSnap.size,
                    leader: teamData.leader
                });
            }
        }

        return teams.sort((a, b) => b.memberCount - a.memberCount);
    }

    /**
     * 팀별 현장 목록 조회
     */
    private async getSitesByTeam(teamName: string): Promise<Array<{ name: string; type: string; address?: string }>> {
        // 팀 찾기
        const teamsRef = collection(db, 'teams');
        const teamQ = query(teamsRef, where('name', '==', teamName), limit(1));
        const teamSnap = await getDocs(teamQ);

        if (teamSnap.empty) return [];

        const teamId = teamSnap.docs[0].id;

        // 해당 팀의 일보에서 현장 추출
        const reportsRef = collection(db, 'dailyReports');
        const reportsQ = query(reportsRef, where('teamId', '==', teamId));
        const reportsSnap = await getDocs(reportsQ);

        const siteIds = new Set<string>();
        reportsSnap.docs.forEach(doc => {
            const siteId = doc.data().siteId;
            if (siteId) siteIds.add(siteId);
        });

        // 현장 정보 조회
        const sites = [];
        for (const siteId of Array.from(siteIds)) {
            const siteDoc = await getDoc(doc(db, 'sites', siteId));
            if (siteDoc.exists()) {
                const siteData = siteDoc.data();
                sites.push({
                    name: siteData.name,
                    type: siteData.type || '기타',
                    address: siteData.address
                });
            }
        }

        return sites;
    }

    /**
     * 회사별 작업자 목록 조회
     */
    private async getWorkersByCompany(companyName: string): Promise<Array<{ name: string; role: string; teamName?: string }>> {
        // 회사 찾기
        const companiesRef = collection(db, 'companies');
        const companyQ = query(companiesRef, where('name', '==', companyName), limit(1));
        const companySnap = await getDocs(companyQ);

        if (companySnap.empty) return [];

        const companyId = companySnap.docs[0].id;

        // 소속 작업자 조회
        const workersRef = collection(db, 'workers');
        const workersQ = query(workersRef, where('companyId', '==', companyId));
        const workersSnap = await getDocs(workersQ);

        const workers = [];
        for (const workerDoc of workersSnap.docs) {
            const workerData = workerDoc.data();
            let teamName = undefined;

            if (workerData.teamId) {
                const teamDoc = await getDoc(doc(db, 'teams', workerData.teamId));
                if (teamDoc.exists()) {
                    teamName = teamDoc.data().name;
                }
            }

            workers.push({
                name: workerData.name,
                role: workerData.role || '',
                teamName
            });
        }

        return workers;
    }

    /**
     * 공수 기준 상위 작업자 조회
     */
    private async getTopWorkersByManpower(limit: number): Promise<Array<{ name: string; workDays: number; totalManDay: number; teamName?: string }>> {
        const reportsRef = collection(db, 'dailyReports');
        const reportsSnap = await getDocs(reportsRef);

        // 작업자별 공수 집계
        const workerStats = new Map<string, { workDays: number; totalManDay: number; workerId: string }>();

        reportsSnap.docs.forEach(doc => {
            const data = doc.data();
            const workerId = data.workerId;
            const manDay = data.manDay || 0;

            if (workerId) {
                const stats = workerStats.get(workerId) || { workDays: 0, totalManDay: 0, workerId };
                stats.workDays++;
                stats.totalManDay += manDay;
                workerStats.set(workerId, stats);
            }
        });

        // 정렬
        const sortedWorkers = Array.from(workerStats.entries())
            .sort((a, b) => b[1].totalManDay - a[1].totalManDay)
            .slice(0, limit);

        // 작업자 정보 조회
        const results = [];
        for (const [workerId, stats] of sortedWorkers) {
            const workerDoc = await getDoc(doc(db, 'workers', workerId));
            if (workerDoc.exists()) {
                const workerData = workerDoc.data();
                let teamName = undefined;

                if (workerData.teamId) {
                    const teamDoc = await getDoc(doc(db, 'teams', workerData.teamId));
                    if (teamDoc.exists()) {
                        teamName = teamDoc.data().name;
                    }
                }

                results.push({
                    name: workerData.name,
                    workDays: stats.workDays,
                    totalManDay: stats.totalManDay,
                    teamName
                });
            }
        }

        return results;
    }

    /**
     * 인원 순 팀 목록 조회
     */
    private async getTeamsBySize(): Promise<Array<{ name: string; memberCount: number; leader?: string }>> {
        const workersRef = collection(db, 'workers');
        const workersSnap = await getDocs(workersRef);

        // 팀별 인원 집계
        const teamCounts = new Map<string, number>();
        workersSnap.docs.forEach(doc => {
            const teamId = doc.data().teamId;
            if (teamId) {
                teamCounts.set(teamId, (teamCounts.get(teamId) || 0) + 1);
            }
        });

        // 팀 정보 조회
        const teams = [];
        for (const [teamId, count] of teamCounts.entries()) {
            const teamDoc = await getDoc(doc(db, 'teams', teamId));
            if (teamDoc.exists()) {
                const teamData = teamDoc.data();
                teams.push({
                    name: teamData.name,
                    memberCount: count,
                    leader: teamData.leader
                });
            }
        }

        return teams.sort((a, b) => b.memberCount - a.memberCount);
    }

    /**
     * 기간 내 작업자 조회
     */
    private async getWorkersWithinDateRange(startDate: string, endDate: string): Promise<Array<{ name: string; workDays: number; avgManDay: number; teamName?: string }>> {
        const reportsRef = collection(db, 'dailyReports');
        const reportsQ = query(
            reportsRef,
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        );
        const reportsSnap = await getDocs(reportsQ);

        // 작업자별 집계
        const workerStats = new Map<string, { workDays: number; totalManDay: number; workerId: string }>();

        reportsSnap.docs.forEach(doc => {
            const data = doc.data();
            const workerId = data.workerId;
            const manDay = data.manDay || 0;

            if (workerId) {
                const stats = workerStats.get(workerId) || { workDays: 0, totalManDay: 0, workerId };
                stats.workDays++;
                stats.totalManDay += manDay;
                workerStats.set(workerId, stats);
            }
        });

        // 작업자 정보 조회
        const results = [];
        for (const [workerId, stats] of workerStats.entries()) {
            const workerDoc = await getDoc(doc(db, 'workers', workerId));
            if (workerDoc.exists()) {
                const workerData = workerDoc.data();
                let teamName = undefined;

                if (workerData.teamId) {
                    const teamDoc = await getDoc(doc(db, 'teams', workerData.teamId));
                    if (teamDoc.exists()) {
                        teamName = teamDoc.data().name;
                    }
                }

                results.push({
                    name: workerData.name,
                    workDays: stats.workDays,
                    avgManDay: stats.totalManDay / stats.workDays,
                    teamName
                });
            }
        }

        return results.sort((a, b) => b.workDays - a.workDays);
    }

    /**
     * 미배정 작업자 조회
     */
    private async getUnassignedWorkers(): Promise<Array<{ name: string; role: string; phone?: string }>> {
        const workersRef = collection(db, 'workers');
        const workersQ = query(workersRef, where('teamId', '==', null));
        const workersSnap = await getDocs(workersQ);

        return workersSnap.docs.map(doc => {
            const data = doc.data();
            return {
                name: data.name,
                role: data.role || '',
                phone: data.phone
            };
        });
    }

    /**
     * 재직 작업자 조회
     */
    private async getActiveWorkers(): Promise<Array<{ name: string; role: string; teamName?: string }>> {
        const workersRef = collection(db, 'workers');
        const workersSnap = await getDocs(workersRef);

        const workers = [];
        for (const workerDoc of workersSnap.docs) {
            const workerData = workerDoc.data();
            let teamName = undefined;

            if (workerData.teamId) {
                const teamDoc = await getDoc(doc(db, 'teams', workerData.teamId));
                if (teamDoc.exists()) {
                    teamName = teamDoc.data().name;
                }
            }

            workers.push({
                name: workerData.name,
                role: workerData.role || '',
                teamName
            });
        }

        return workers;
    }

    /**
     * 작업자를 팀별로 그룹화
     */
    private groupWorkersByTeam(workers: Array<{ teamName?: string }>): { [teamName: string]: Array<{ teamName?: string }> } {
        const grouped: { [teamName: string]: Array<{ teamName?: string }> } = {};

        workers.forEach(worker => {
            const teamName = worker.teamName || '미배정';
            if (!grouped[teamName]) {
                grouped[teamName] = [];
            }
            grouped[teamName].push(worker);
        });

        return grouped;
    }

    /**
     * 부분 일치 작업자 검색
     */
    private async searchWorkersByPartialName(searchTerm: string): Promise<Array<{ name: string; role: string; teamName?: string; companyName?: string }>> {
        const workersRef = collection(db, 'workers');
        const workersSnap = await getDocs(workersRef);

        const results = [];
        for (const workerDoc of workersSnap.docs) {
            const workerData = workerDoc.data();

            if (workerData.name.includes(searchTerm)) {
                let teamName = undefined;
                let companyName = undefined;

                if (workerData.teamId) {
                    const teamDoc = await getDoc(doc(db, 'teams', workerData.teamId));
                    if (teamDoc.exists()) {
                        teamName = teamDoc.data().name;
                    }
                }

                if (workerData.companyId) {
                    const companyDoc = await getDoc(doc(db, 'companies', workerData.companyId));
                    if (companyDoc.exists()) {
                        companyName = companyDoc.data().name;
                    }
                }

                results.push({
                    name: workerData.name,
                    role: workerData.role || '',
                    teamName,
                    companyName
                });
            }
        }

        return results;
    }

    /**
     * 부분 일치 회사 검색
     */
    private async searchCompaniesByPartialName(searchTerm: string): Promise<Array<{ name: string; workerCount: number; siteCount: number }>> {
        const companiesRef = collection(db, 'companies');
        const companiesSnap = await getDocs(companiesRef);

        const results = [];
        for (const companyDoc of companiesSnap.docs) {
            const companyData = companyDoc.data();

            if (companyData.name.includes(searchTerm)) {
                // 소속 작업자 수
                const workersRef = collection(db, 'workers');
                const workersQ = query(workersRef, where('companyId', '==', companyDoc.id));
                const workersSnap = await getDocs(workersQ);

                // 참여 현장 수
                const sitesRef = collection(db, 'sites');
                const sitesQ = query(sitesRef, where('companyId', '==', companyDoc.id));
                const sitesSnap = await getDocs(sitesQ);

                results.push({
                    name: companyData.name,
                    workerCount: workersSnap.size,
                    siteCount: sitesSnap.size
                });
            }
        }

        return results;
    }

    /**
     * 유사한 이름의 작업자 검색
     */
    private async findSimilarWorkers(searchName: string): Promise<Array<{ name: string; similarity: number; teamName?: string; phone?: string }>> {
        const workersRef = collection(db, 'workers');
        const workersSnap = await getDocs(workersRef);

        const results = [];
        for (const workerDoc of workersSnap.docs) {
            const workerData = workerDoc.data();
            const similarity = this.calculateSimilarity(searchName, workerData.name);

            if (similarity >= 50) { // 50% 이상 유사도
                let teamName = undefined;

                if (workerData.teamId) {
                    const teamDoc = await getDoc(doc(db, 'teams', workerData.teamId));
                    if (teamDoc.exists()) {
                        teamName = teamDoc.data().name;
                    }
                }

                results.push({
                    name: workerData.name,
                    similarity,
                    teamName,
                    phone: workerData.phone
                });
            }
        }

        return results.sort((a, b) => b.similarity - a.similarity);
    }

    /**
     * 문자열 유사도 계산 (간단한 Jaro-Winkler 유사)
     */
    private calculateSimilarity(str1: string, str2: string): number {
        if (str1 === str2) return 100;

        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 100;

        let matches = 0;
        for (let i = 0; i < shorter.length; i++) {
            if (longer.includes(shorter[i])) {
                matches++;
            }
        }

        return Math.round((matches / longer.length) * 100);
    }
}

// Singleton instance
export const dataSearchAgent = new DataSearchAgent();
