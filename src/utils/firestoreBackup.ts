import { db } from '../config/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

export const backupCollection = async (sourceColl: string, targetColl: string): Promise<number> => {
    try {
        console.log(`Starting backup from ${sourceColl} to ${targetColl}...`);
        const sourceRef = collection(db, sourceColl);
        const snapshot = await getDocs(sourceRef);

        if (snapshot.empty) {
            console.log('Source collection is empty.');
            return 0;
        }

        const totalDocs = snapshot.size;
        let processed = 0;
        const batches = [];
        let currentBatch = writeBatch(db);
        let operationCount = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const targetDocRef = doc(db, targetColl, docSnap.id);
            currentBatch.set(targetDocRef, data);

            operationCount++;
            processed++;

            // Firestore batch limit is 500
            if (operationCount === 450) {
                batches.push(currentBatch.commit());
                currentBatch = writeBatch(db);
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            batches.push(currentBatch.commit());
        }

        await Promise.all(batches);
        console.log(`Backup completed. Copied ${processed} documents.`);
        return processed;
    } catch (error) {
        console.error('Backup failed:', error);
        throw error;
    }
};
