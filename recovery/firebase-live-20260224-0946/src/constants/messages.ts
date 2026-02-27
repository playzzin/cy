export interface MessageRule {
    id: string;
    key: string;      // e.g., "SUCCESS.SAVE"
    template: string; // e.g., "관리자님, 처리 완료!"
    conditions: {
        page?: string;  // e.g., "/daily-report" (exact match or partial)
        role?: string;  // e.g., "admin"
        uid?: string;   // specific user
    };
    priority: number; // Higher wins
    style?: {
        color?: string; // Hex code or preset name
        sound?: string; // 'success', 'error', 'bloop', 'none'
    };
}

export interface MessageResult {
    text: string;
    style?: {
        color?: string;
        sound?: string;
    };
}

export interface MessageContext {
    role?: string;
    uid?: string;
    page?: string; // Current pathname
}

const STORAGE_KEY = 'smart_construction_message_rules';

class MessageManagerClass {
    private rules: MessageRule[] = [];
    private context: MessageContext = {};

    constructor() {
        this.loadRules();
    }

    private loadRules() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            this.rules = stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Failed to load message rules", e);
            this.rules = [];
        }
    }

    public saveRules(rules: MessageRule[]) {
        this.rules = rules;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    }

    public getRules() {
        return this.rules;
    }

    public setContext(context: Partial<MessageContext>) {
        this.context = { ...this.context, ...context };
        // Update page context automatically if not provided, but usually we resolve at call time
    }

    public get(key: string, defaultTemplate: string, variables: Record<string, any> = {}): MessageResult {
        // 1. Current Context
        const currentContext = {
            page: window.location.pathname, // Default to current location
            ...this.context // Allow context to override (e.g., for testing or specific routing)
        };

        // 2. Find matching rules
        const matches = this.rules.filter(rule => {
            if (rule.key !== key) return false;

            // Condition Checks
            if (rule.conditions.uid && rule.conditions.uid !== currentContext.uid) return false;
            if (rule.conditions.role && rule.conditions.role !== currentContext.role) return false;
            if (rule.conditions.page && !currentContext.page?.includes(rule.conditions.page)) return false;

            return true;
        });

        // 3. Sort by Priority (Higher first) -> Specificity (Uid > Role > Page) is effectively handled by user setting priority
        // Or we can auto-weight: Uid(100) > Role(10) > Page(1)
        matches.sort((a, b) => b.priority - a.priority);

        // 4. Select winner or default
        // 4. Select winner or default
        const matchedRule = matches.length > 0 ? matches[0] : null;
        const template = matchedRule ? matchedRule.template : defaultTemplate;

        // 5. Interpolate variables
        const text = this.interpolate(template, variables);

        return {
            text,
            style: matchedRule?.style
        };
    }

    private interpolate(template: string, variables: Record<string, any>): string {
        return template.replace(/\{(\w+)\}/g, (_, k) => {
            return variables[k] !== undefined ? String(variables[k]) : `{${k}}`;
        });
    }
}

export const MessageManager = new MessageManagerClass();

// Helper for backward compatibility and easy usage
const resolve = (key: string, defaultTemplate: string, params: any) => {
    return MessageManager.get(key, defaultTemplate, params);
};

export const MESSAGES = {
    SUCCESS: {
        SAVE: (target: string, count: number = 1) => resolve('SUCCESS.SAVE', `✔ {target} {count}건이 안전하게 저장되었습니다.`, { target, count }),
        DELETE: (target: string, count: number = 1) => resolve('SUCCESS.DELETE', `🗑 {target} {count}건이 삭제되었습니다.`, { target, count }),
        UPDATE: (target: string) => resolve('SUCCESS.UPDATE', `✔ {target} 정보가 수정되었습니다.`, { target }),
        PROCESS: (action: string) => resolve('SUCCESS.PROCESS', `✔ {action} 처리가 완료되었습니다.`, { action }),
        CUSTOM: (message: string) => resolve('SUCCESS.CUSTOM', `✔ {message}`, { message })
    },
    ERROR: {
        SAVE: () => resolve('ERROR.SAVE', '❌ 저장 중 오류가 발생했습니다.', {}),
        DELETE: () => resolve('ERROR.DELETE', '❌ 삭제 중 오류가 발생했습니다.', {}),
        FETCH: () => resolve('ERROR.FETCH', '❌ 데이터를 불러오는데 실패했습니다.', {}),
        VALIDATION: () => resolve('ERROR.VALIDATION', '❌ 입력값을 확인해주세요.', {}),
        AUTH: () => resolve('ERROR.AUTH', '❌ 권한이 없습니다.', {}),
        UNKNOWN: () => resolve('ERROR.UNKNOWN', '❌ 알 수 없는 오류가 발생했습니다.', {})
    }, // Errors are static strings for now, can be upgraded if needed
    CONFIRM: {
        SAVE: () => resolve('CONFIRM.SAVE', '정말 저장하시겠습니까?', {}),
        DELETE: () => resolve('CONFIRM.DELETE', '정말 삭제하시겠습니까? 복구할 수 없습니다.', {}),
        ACTION: (action: string) => resolve('CONFIRM.ACTION', `정말 {action} 하시겠습니까?`, { action }),
        BATCH: (target: string, count: number) => resolve('CONFIRM.BATCH', `선택한 {count}명의 {target} 정보를 일괄 수정하시겠습니까?`, { target, count }),
        OVERWRITE: (target: string) => resolve('CONFIRM.OVERWRITE', `이미 {target} 데이터가 존재합니다. 덮어쓰시겠습니까?`, { target }),
    },
    INFO: {
        NO_DATA: '데이터가 없습니다.',
        LOADING: '잠시만 기다려주세요...'
    }
};
