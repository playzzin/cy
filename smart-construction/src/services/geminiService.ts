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

export const geminiService = {
    saveKey: (key: string) => {
        if (key) {
            localStorage.setItem('gemini_api_key', key);
        }
    },

    getKey: (): string | null => {
        return localStorage.getItem('gemini_api_key');
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
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) throw new Error('API Key Missing');

        const base64Data = await geminiService.fileToBase64(file);
        const base64Content = base64Data.split(',')[1];

        const prompt = `
      Analyze this image which may contain multiple cards.
      Focus specifically on the "Resident Registration Card (주민등록증)" or "Driver's License (운전면허증)".
      Ignore other cards like "Safety Training Certificate" if they don't contain a residential address.
      
      Extract the following:
      1. Name (이름)
      2. Resident Registration Number (주민등록번호 13 digits, format: 000000-0000000)
      3. Address (주소) - Must come from the ID card, not the training center address.
      
      Return ONLY a valid JSON object with keys: "name", "idNumber", "address".
      Do not include markdown or explanations.
    `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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

    analyzeDailyReportText: async (text: string): Promise<AnalyzedDailyReport> => {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) throw new Error('API Key Missing');

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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) throw new Error('API Key Missing');

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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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

    analyzeKakaoImage: async (file: File): Promise<AnalyzedDailyReport[]> => {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) throw new Error('API Key Missing');

        const base64Data = await geminiService.fileToBase64(file);
        const base64Content = base64Data.split(',')[1];

        const prompt = `
            Analyze this image of a KakaoTalk chat containing construction daily reports.
            The image may contain multiple messages from different people or a single long message.
            Each message or block of text usually represents a report for a specific team at a specific site.

            Extract ALL reports found in the image. Return a JSON ARRAY of objects.
            
            For each report, extract:
            1. Site Name (현장명): Look for keywords like '현장', '아파트', or specific site names (e.g., '반포', '개포'). If inferred from context, use it.
            2. Team Name (팀명): Look for '팀', '반장' or the sender's name if it implies a team.
            3. Date (날짜): YYYY-MM-DD format. If not present, use today's date.
            4. Workers (작업자 목록):
               - Name (이름): The person's name.
               - Man Day (공수): e.g., 1.0, 0.5, 1. Default to 1.0 if only name is listed.
               - Work Content (작업내용): e.g., '조적', '운반'.
               - Team Name (팀명): If specific to the worker.

            Example Output Structure:
            [
              {
                "siteName": "Banpo Site",
                "teamName": "Brick Team A",
                "date": "2023-11-29",
                "workers": [
                  { "name": "Kim", "manDay": 1.0, "workContent": "Laying bricks" },
                  { "name": "Lee", "manDay": 0.5, "workContent": "Transport" }
                ]
              },
              ...
            ]

            Return ONLY the valid JSON array. Do not include markdown formatting or explanations.
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API Error:", errorText);
            throw new Error(`API Request Failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const textResult = data.candidates[0].content.parts[0].text;
        return geminiService.parseJSON(textResult);
    },

    analyzeKakaoText: async (text: string): Promise<AnalyzedDailyReport[]> => {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) throw new Error('API Key Missing');

        const prompt = `
            Analyze the following text from a KakaoTalk chat containing construction daily reports.
            The text may contain multiple messages from different people or a single long message.
            Each message or block of text usually represents a report for a specific team at a specific site.

            Text to Analyze:
            ${text}

            Extract ALL reports found in the text. Return a JSON ARRAY of objects.
            
            For each report, extract:
            1. Site Name (현장명): Look for keywords like '현장', '아파트', or specific site names.
            2. Team Name (팀명): Look for '팀', '반장'.
            3. Date (날짜): YYYY-MM-DD format. If not present, use today's date.
            4. Workers (작업자 목록):
               - Name (이름)
               - Man Day (공수): e.g., 1.0, 0.5, 1. Default to 1.0 if not specified.
               - Work Content (작업내용)
               - Team Name (팀명): If specific to the worker.

            Return ONLY the valid JSON array. Do not include markdown formatting or explanations.
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API Request Failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const textResult = data.candidates[0].content.parts[0].text;
        return geminiService.parseJSON(textResult);
    },

    analyzeBankBook: async (file: File): Promise<AnalyzedBankBook> => {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) throw new Error('API Key Missing');

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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) throw new Error('API Key Missing');

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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) throw new Error('API Key Missing');

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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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
