import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// --- Export & Backup ---
export const exportCollectionToExcel = async (collectionName: string) => {
    try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (data.length === 0) {
            alert('데이터가 없습니다.');
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, collectionName);

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });

        const dateStr = new Date().toISOString().split('T')[0];
        saveAs(dataBlob, `${collectionName}_backup_${dateStr}.xlsx`);
    } catch (error) {
        console.error("Export failed:", error);
        throw error;
    }
};

// --- Reset & Delete ---
export const resetCollection = async (collectionName: string) => {
    try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const total = querySnapshot.size;

        if (total === 0) return 0;

        // Batch delete (limit 500 per batch)
        const batchSize = 500;
        let batch = writeBatch(db);
        let count = 0;
        let batchCount = 0;

        for (const document of querySnapshot.docs) {
            batch.delete(doc(db, collectionName, document.id));
            count++;
            batchCount++;

            if (batchCount >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        return count;
    } catch (error) {
        console.error("Reset failed:", error);
        throw error;
    }
};

// --- Import & Restore ---

// Korean to English Field Mapping
const KOREAN_TO_ENGLISH_MAP: { [key: string]: string } = {
    // Common
    '아이디': 'id',
    '이름': 'name',
    '전화번호': 'phone',
    '연락처': 'phone',
    '생년월일': 'birthDate',
    '주소': 'address',
    '메모': 'memo',
    '상태': 'status',

    // Worker
    '혈액형': 'bloodType',
    '직종': 'jobType',
    '직책': 'role',
    '시스템권한': 'systemRole',
    '계좌번호': 'bankAccount',
    '은행명': 'bankName',

    // Team
    '팀명': 'name',
    '팀장': 'leaderName',
    '팀장ID': 'leaderId',

    // Site
    '현장명': 'name',
    '공사기간': 'period',
    '담당자': 'manager',

    // Company
    '회사명': 'name',
    '대표자': 'ownerName',
    '사업자번호': 'businessNumber',

    // Generic
    '생성일': 'createdAt',
    '수정일': 'updatedAt'
};

const mapKoreanKeysToEnglish = (item: any): any => {
    const newItem: any = {};
    Object.keys(item).forEach(key => {
        const trimmedKey = key.trim();
        const englishKey = KOREAN_TO_ENGLISH_MAP[trimmedKey] || trimmedKey;
        newItem[englishKey] = item[key];
    });
    return newItem;
};

export const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0]; // Read first sheet
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);

                // Apply Mapping
                const mappedData = jsonData.map(item => mapKoreanKeysToEnglish(item));
                resolve(mappedData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

export const restoreBatchData = async (collectionName: string, data: any[]) => {
    try {
        if (data.length === 0) return 0;

        const batchSize = 500;
        let batch = writeBatch(db);
        let batchCount = 0;
        let totalCount = 0;

        for (const item of data) {
            // ID handling: If 'id' exists, use it. If not, autogenerate? 
            // Better to require ID for restore to prevent duplicates, or generate if missing.
            const docRef = item.id
                ? doc(db, collectionName, String(item.id))
                : doc(collection(db, collectionName)); // Auto-ID if missing

            // Sanitize undefined values (Firestore doesn't like undefined)
            const safeItem = JSON.parse(JSON.stringify(item));

            batch.set(docRef, safeItem, { merge: true });
            batchCount++;
            totalCount++;

            if (batchCount >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        return totalCount;
    } catch (error) {
        console.error("Restore failed:", error);
        throw error;
    }
};
