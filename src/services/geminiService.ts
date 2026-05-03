import { aiSettingsService } from './aiSettingsService';

export interface AnalyzedIdCard {
    name?: string;
    idNumber?: string;
    address?: string;
}

export interface AnalyzedBankBook {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
}

export interface AnalyzedDailyReport {
    teamName?: string;
    siteName?: string;
    date?: string;
    workContent?: string;
    workers: {
        name: string;
        teamName?: string;
        role?: string;
        manDay: number;
        workContent?: string;
    }[];
}

export interface AnalyzedWorkerRegistration {
    name?: string;
    idNumber?: string;
    contact?: string;
    address?: string;
    role?: string;
    teamName?: string;
    companyName?: string;
    unitPrice?: number;
    salaryModel?: string;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
}

export interface KakaoAnalyzeContext {
    sites?: string[];
    teams?: string[];
    workers?: string[];
    today?: string;
}

type GeminiPart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } };

const getApiKeyOrThrow = (): string => {
    aiSettingsService.assertCurrentPageEnabled('AI 분석 기능');
    const apiKey = aiSettingsService.getApiKey();
    if (!apiKey) throw new Error('Google API 키가 설정되지 않았습니다. (/settings/ai 또는 .env.local REACT_APP_GOOGLE_API_KEY)');
    return apiKey;
};

const buildGeminiGenerateContentUrl = (apiKey: string, model?: string): string => {
    const selectedModel = model || aiSettingsService.getModels().textModel || 'gemini-2.5-flash';
    return `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
};

const getTextModelCandidates = (): string[] => {
    const selectedModel = aiSettingsService.getModels().textModel || 'gemini-2.5-flash';
    return Array.from(new Set([
        selectedModel,
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-2.5-flash'
    ].filter(Boolean)));
};

const shouldRetryWithFallbackModel = (status: number, message: string): boolean => {
    if (![400, 403, 404, 429].includes(status)) return false;
    return /denied|permission|quota|resource_exhausted|not found|not supported|model|access/i.test(message);
};

const ID_CARD_JSON_SCHEMA = {
    type: 'object',
    properties: {
        name: {
            type: 'string',
            description: '신분증에 적힌 이름. 읽을 수 없으면 빈 문자열.'
        },
        idNumber: {
            type: 'string',
            description: '주민등록번호 또는 외국인등록번호. 가능하면 000000-0000000 형식. 읽을 수 없으면 빈 문자열.'
        },
        address: {
            type: 'string',
            description: '신분증에 적힌 거주지 주소. 교육증 주소 등 다른 카드의 주소는 제외. 읽을 수 없으면 빈 문자열.'
        }
    },
    required: ['name', 'idNumber', 'address'],
    propertyOrdering: ['name', 'idNumber', 'address']
};

const DAILY_REPORT_ARRAY_JSON_SCHEMA = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            siteName: {
                type: 'string',
                description: '현장명. 모르면 빈 문자열.'
            },
            teamName: {
                type: 'string',
                description: '보고자, 반장, 팀명 또는 인원 라인의 팀명. 모르면 빈 문자열.'
            },
            date: {
                type: 'string',
                description: 'YYYY-MM-DD 날짜. 메시지에 날짜가 없으면 요청의 오늘 날짜.'
            },
            workContent: {
                type: 'string',
                description: '보고 블록 전체 작업내용 요약. 여러 줄이면 쉼표로 연결.'
            },
            workers: {
                type: 'array',
                description: '읽을 수 있는 작업자 목록. 이름이 보이지 않으면 만들지 않음.',
                items: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            description: '작업자 이름. 팀명, 반장 호칭, 인원 수, 총계는 제외.'
                        },
                        teamName: {
                            type: 'string',
                            description: '해당 작업자의 팀명 또는 소속. 모르면 빈 문자열.'
                        },
                        role: {
                            type: 'string',
                            description: '직종/역할. 모르면 작업자.'
                        },
                        manDay: {
                            type: 'number',
                            description: '공수. 별도 표기가 없으면 1.'
                        },
                        workContent: {
                            type: 'string',
                            description: '해당 작업자의 작업내용. 개별 내용이 없으면 보고 블록 작업내용.'
                        }
                    },
                    required: ['name', 'teamName', 'role', 'manDay', 'workContent'],
                    propertyOrdering: ['name', 'teamName', 'role', 'manDay', 'workContent']
                }
            }
        },
        required: ['siteName', 'teamName', 'date', 'workContent', 'workers'],
        propertyOrdering: ['siteName', 'teamName', 'date', 'workContent', 'workers']
    }
};

const compactList = (values?: string[], limit = 250): string => {
    if (!values || values.length === 0) return '없음';
    const unique = Array.from(new Set(values.map(v => String(v || '').trim()).filter(Boolean)));
    const shown = unique.slice(0, limit).join(', ');
    const hidden = unique.length - limit;
    return hidden > 0 ? `${shown}, 외 ${hidden}개` : shown;
};

const getLocalToday = (): string => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const buildKakaoDailyReportPrompt = (
    sourceType: 'image' | 'text',
    context?: KakaoAnalyzeContext,
    text?: string
): string => {
    const today = context?.today || getLocalToday();
    return `
You extract Korean construction daily reports from KakaoTalk messages.
Today's date is ${today}. If the chat/report has no date, use ${today}.

Known master data for exact spelling:
- Sites: ${compactList(context?.sites)}
- Teams: ${compactList(context?.teams)}
- Workers: ${compactList(context?.workers, 600)}

Only return report blocks that look like daily construction reports.
Ignore ordinary conversation, AI model discussions, jokes, replies, comments, or any KakaoTalk message without daily-report fields.

Daily report blocks commonly contain Korean labels such as:
- 현장, 현 장, 현장명
- 단종, 공종
- 작업내용, 작업 내용
- 인원, 인원:, 총 N명, 총인원, 공수

Extraction rules:
1. Return one report object per KakaoTalk report bubble or report block.
2. If one report has multiple team/personnel lines under "인원", keep them in the same report unless the site changes.
3. Use the master-data spelling when the OCR text is close to a known site, team, or worker name.
4. For lines like "김곳팀-김해용,휴명진,김군희 총13명", the team is "김곳팀"; workers are only the names after "-". Do not output the team label as a worker.
5. For lines like "이재욱팀 - 장정욱 고대호 2명", parse "장정욱", "고대호" as workers and "이재욱팀" as teamName.
6. Remove count words and suffixes from worker names: 총, 총인원, 명, 입니다, 전원, 공수, 야간, 지원, 팀.
7. If a line says "전원 2공수", "전원 1.5공수", or "전원 야간 1.5공수", apply that manDay to all workers in the report unless a worker has a specific value.
8. If worker names are unreadable or only a count is visible, do not invent names. Return only readable names.
9. Preserve Korean text for siteName, teamName, workContent, and worker names.
10. workContent should come from 작업내용/작업 내용 lines. If there are multiple work lines, join them with ", ".

Return only the JSON array matching the provided schema.
${sourceType === 'text' ? `\nKakaoTalk text:\n${text || ''}` : '\nKakaoTalk screenshot image is attached.'}
`;
};

const extractGeminiText = (data: any): string => {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim();
};

const formatGeminiApiError = (message: string, status?: number): string => {
    const cleanMessage = String(message || '').trim();

    if (/project has been denied access|denied access|contact support/i.test(cleanMessage)) {
        return 'Gemini API 접근이 거부된 Google Cloud 프로젝트/API 키입니다. Google AI Studio에서 새 프로젝트로 API 키를 다시 만들거나, 해당 프로젝트의 Gemini API 접근 제한을 Google 지원에 문의해야 합니다.';
    }

    if (/api key not valid|api_key_invalid|invalid api key/i.test(cleanMessage)) {
        return 'Gemini API 키가 유효하지 않습니다. /settings/ai 또는 .env.local의 API 키를 다시 확인해주세요.';
    }

    if (/permission_denied|permission denied/i.test(cleanMessage) || status === 403) {
        return `Gemini API 권한이 거부되었습니다. API 키가 Generative Language API를 사용할 수 있는 프로젝트의 키인지 확인해주세요.${cleanMessage ? ` (${cleanMessage})` : ''}`;
    }

    return cleanMessage || `${status || ''} API 요청 실패`.trim();
};

const fetchGeminiStructuredJson = async <T,>(
    apiKey: string,
    parts: GeminiPart[],
    responseJsonSchema: Record<string, any>,
    errorLabel: string
): Promise<T> => {
    const body = JSON.stringify({
        contents: [{
            role: 'user',
            parts
        }],
        generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseJsonSchema
        }
    });
    const attempts: Array<{ model: string; status: number; message: string }> = [];

    for (const model of getTextModelCandidates()) {
        const response = await fetch(buildGeminiGenerateContentUrl(apiKey, model), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });

        const rawText = await response.text();
        let data: any = null;
        try {
            data = rawText ? JSON.parse(rawText) : null;
        } catch {
            data = null;
        }

        if (!response.ok || data?.error) {
            const status = !response.ok ? response.status : Number(data?.error?.code) || 500;
            const message = data?.error?.message || `${response.status} ${response.statusText}`;
            attempts.push({ model, status, message });
            console.error(`${errorLabel} Gemini API Error (${model}):`, rawText);

            if (shouldRetryWithFallbackModel(status, message)) continue;

            throw new Error(formatGeminiApiError(message, status));
        }

        const textResult = extractGeminiText(data);
        if (!textResult) {
            const finishReason = data?.candidates?.[0]?.finishReason;
            const blockReason = data?.promptFeedback?.blockReason;
            const reason = blockReason || finishReason;
            throw new Error(reason ? `AI 응답이 비어 있습니다. (${reason})` : 'AI 응답이 비어 있습니다.');
        }

        return geminiService.parseJSON(textResult) as T;
    }

    const lastAttempt = attempts[attempts.length - 1];
    const detail = attempts.map(a => `${a.model}: ${a.status}`).join(', ');
    throw new Error(
        `${formatGeminiApiError(lastAttempt?.message || '', lastAttempt?.status)} 시도한 모델: ${detail}`
    );
};

export const geminiService = {
    saveKey: (key: string) => {
        aiSettingsService.setApiKey(key);
    },

    getKey: (): string | null => {
        const key = aiSettingsService.getApiKey();
        return key || null;
    },

    fileToBase64: (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    },

    analyzeImage: async (file: File): Promise<AnalyzedIdCard> => {
        const apiKey = getApiKeyOrThrow();

        const base64Data = await geminiService.fileToBase64(file);
        const base64Content = base64Data.split(',')[1];
        const mimeType = file.type || 'image/jpeg';

        const prompt = `
Analyze this image which may contain multiple cards.
Focus specifically on Korean identity documents such as:
- Resident Registration Card (주민등록증)
- Driver's License (운전면허증)
- Foreigner Registration Card (외국인등록증)

Ignore other cards like safety training certificates if they do not contain the person's legal ID number and residential address.

Extract:
1. Name (이름)
2. Resident/foreigner registration number (주민등록번호/외국인등록번호, 13 digits, format 000000-0000000 when possible)
3. Address (주소) from the identity document

Return empty strings for fields that are not visible.`;

        return fetchGeminiStructuredJson<AnalyzedIdCard>(
            apiKey,
            [
                { text: prompt },
                { inlineData: { mimeType, data: base64Content } }
            ],
            ID_CARD_JSON_SCHEMA,
            'ID card analysis'
        );
    },

    analyzeDailyReportText: async (text: string): Promise<AnalyzedDailyReport> => {
        const apiKey = getApiKeyOrThrow();

        const prompt = `
            Analyze the following construction daily report text and extract structured data.
            The text might be a full report or a single line summary like "2023-11-29 TeamA SiteB WorkerName 1.0 Bricklaying".
            
            Text:
            ${text}

            Extract:
            1. Team Name (팀명) - e.g., A팀, 조적팀. If inferred from context, use it.
            2. Site Name (현장명) - e.g., B현장, 101동.
            3. Date (날짜) - YYYY-MM-DD format. If not present, use today's date.
            4. Workers (작업자 목록):
               - Name (이름)
               - Team Name (팀명) - If specified for this worker.
               - Man Day (공수) - e.g., 1.0, 0.5. Default to 1.0.
               - Work Content (작업내용) - e.g., 벽체 조적, 자재 운반.

            Return ONLY a valid JSON object with keys: "teamName", "siteName", "date", "workers" (array of objects).
            Do not include markdown or explanations.
        `;

        const response = await fetch(buildGeminiGenerateContentUrl(apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }]
                }]
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const textResult = data.candidates[0].content.parts[0].text;
        return geminiService.parseJSON(textResult);
    },

    analyzeDailyReportImage: async (file: File): Promise<AnalyzedDailyReport> => {
        const apiKey = getApiKeyOrThrow();

        const base64Data = await geminiService.fileToBase64(file);
        const base64Content = base64Data.split(',')[1];

        const prompt = `
            Analyze this image of a construction daily report (whiteboard, notebook, or chat screenshot).
            
            Extract:
            1. Team Name (팀명)
            2. Site Name (현장명)
            3. Date (날짜) - YYYY-MM-DD format.
            4. Workers (작업자 목록):
               - Name (이름)
               - Team Name (팀명)
               - Man Day (공수) - Default to 1.0 if not specified.
               - Work Content (작업내용)

            Return ONLY a valid JSON object with keys: "teamName", "siteName", "date", "workers" (array of objects).
            Do not include markdown or explanations.
        `;

        const response = await fetch(buildGeminiGenerateContentUrl(apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: file.type, data: base64Content } }
                    ]
                }]
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const textResult = data.candidates[0].content.parts[0].text;
        return geminiService.parseJSON(textResult);
    },

    analyzeKakaoImage: async (file: File, context?: KakaoAnalyzeContext): Promise<AnalyzedDailyReport[]> => {
        const apiKey = getApiKeyOrThrow();

        const base64Data = await geminiService.fileToBase64(file);
        const base64Content = base64Data.split(',')[1];

        return fetchGeminiStructuredJson<AnalyzedDailyReport[]>(
            apiKey,
            [
                { text: buildKakaoDailyReportPrompt('image', context) },
                { inlineData: { mimeType: file.type, data: base64Content } }
            ],
            DAILY_REPORT_ARRAY_JSON_SCHEMA,
            'Kakao image analysis'
        );
    },

    analyzeKakaoText: async (text: string, context?: KakaoAnalyzeContext): Promise<AnalyzedDailyReport[]> => {
        const apiKey = getApiKeyOrThrow();

        return fetchGeminiStructuredJson<AnalyzedDailyReport[]>(
            apiKey,
            [{ text: buildKakaoDailyReportPrompt('text', context, text) }],
            DAILY_REPORT_ARRAY_JSON_SCHEMA,
            'Kakao text analysis'
        );
    },

    analyzeBankBook: async (file: File): Promise<AnalyzedBankBook> => {
        const apiKey = getApiKeyOrThrow();

        const base64Data = await geminiService.fileToBase64(file);
        const base64Content = base64Data.split(',')[1];

        const prompt = `
            Analyze this image of a bank book (통장사본) or digital bank account details.
            
            Extract:
            1. Bank Name (은행명)
            2. Account Number (계좌번호) - Extract digits and hyphens.
            3. Account Holder (예금주) - Name of the account owner.

            Return ONLY a valid JSON object with keys: "bankName", "accountNumber", "accountHolder".
            Do not include markdown or explanations.
        `;

        const response = await fetch(buildGeminiGenerateContentUrl(apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: file.type, data: base64Content } }
                    ]
                }]
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const textResult = data.candidates[0].content.parts[0].text;
        return geminiService.parseJSON(textResult);
    },

    analyzeWorkerRegistrationText: async (text: string): Promise<AnalyzedWorkerRegistration[]> => {
        const apiKey = getApiKeyOrThrow();

        const prompt = `
            Analyze the following text containing worker registration details.
            The text may come from KakaoTalk, Excel copy-paste, or informal messages.
            
            Text:
            ${text}

            Extract a list of workers.
            Fields to extract:
            - name (Name)
            - idNumber (Resident Registration Number)
            - contact (Phone Number)
            - address (Address)
            - role (Job Role: '기공', '조공', '팀장', '준기공' etc.)
            - teamName (Team Name)
            - companyName (Company Name)
            - unitPrice (Daily Wage/Unit Price - number)
            - salaryModel (Salary Model: '일급제', '주급제', '월급제')
            - bankName (Bank Name)
            - accountNumber (Account Number)
            - accountHolder (Account Holder Name)

            Return ONLY a valid JSON ARRAY of objects.
            Do not include markdown or explanations.
        `;

        const response = await fetch(buildGeminiGenerateContentUrl(apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }]
                }]
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const textResult = data.candidates[0].content.parts[0].text;
        return geminiService.parseJSON(textResult);
    },

    analyzeCommand: async (command: string, context: { sites: any[], teams: any[], workers: any[] }): Promise<{ action: string, targetType?: string, targetKeywords?: string[], destinationKeyword?: string, quantity?: number }[]> => {
        const apiKey = getApiKeyOrThrow();

        const siteNames = context.sites.map(s => `${s.name}(${s.id})`).join(', ');
        const teamNames = context.teams.map(t => `${t.name}(${t.id})`).join(', ');
        // optimizing worker list context (too many workers might exceed token limit, filtering to name only or top 100?)
        // For now, let's assume we pass simplified map or handle it via broad matching
        // Let's rely on name matching.

        const prompt = `
            You are a Construction Dispatch Assistant.
            User Command: "${command}"

            Context:
            - Sites: [${siteNames}]
            - Teams: [${teamNames}]
            
            Interpret the command and return a JSON ARRAY of actions.
            Supported Actions: 'ASSIGN', 'UNASSIGN'.
            
            Logic:
            - If user says "Send Team A to Site B", find Team ID and Site ID.
            - If user says "3 people to Site B", action is ASSIGN, quantity 3, destination Site ID.
            - If user says "Kim, Lee to Site C", targets are names.
            
            Return JSON:
            [
              { 
                "action": "ASSIGN" | "UNASSIGN",
                "targetType": "TEAM" | "WORKER" | "NUMBER",
                "targetKeywords": ["Team A"], // Names or IDs identified
                "destinationKeyword": "Site B", // Name or ID identified
                "quantity": 3 // If numeric
              }
            ]
            Return ONLY JSON.
        `;

        const response = await fetch(buildGeminiGenerateContentUrl(apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }]
                }]
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        const textResult = data.candidates[0].content.parts[0].text;
        return geminiService.parseJSON(textResult);
    },

    parseJSON: (text: string): any => {
        try {
            const jsonStart = text.indexOf('[');
            const jsonEnd = text.lastIndexOf(']');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonString = text.substring(jsonStart, jsonEnd + 1);
                return JSON.parse(jsonString);
            }

            const objStart = text.indexOf('{');
            const objEnd = text.lastIndexOf('}');
            if (objStart !== -1 && objEnd !== -1) {
                const jsonString = text.substring(objStart, objEnd + 1);
                return JSON.parse(jsonString);
            }

            throw new Error("Invalid JSON structure");
        } catch (error) {
            console.error("JSON Parse Error:", error);
            throw new Error("AI 응답을 분석할 수 없습니다.");
        }
    }
};
