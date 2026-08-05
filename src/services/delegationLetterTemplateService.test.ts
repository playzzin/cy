import { getDoc } from 'firebase/firestore';
import {
    DEFAULT_DELEGATION_BODY_TEXT,
    LEGACY_DELEGATION_BODY_TEXT,
    PREVIOUS_DELEGATION_BODY_TEXT,
} from '../constants/delegationLetter';
import { delegationLetterTemplateService } from './delegationLetterTemplateService';

jest.mock('../config/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(() => ({ path: 'settings/delegation_letter_v2_public' })),
    getDoc: jest.fn(),
    serverTimestamp: jest.fn(),
    setDoc: jest.fn(),
}));

const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;

describe('delegationLetterTemplateService', () => {
    it('migrates the previous default wording even when line breaks were normalized', async () => {
        mockGetDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({ bodyText: LEGACY_DELEGATION_BODY_TEXT.replace('\n', ' ') }),
        } as any);

        await expect(delegationLetterTemplateService.getPublicTemplate()).resolves.toEqual({
            bodyText: DEFAULT_DELEGATION_BODY_TEXT,
        });
    });

    it('migrates the short prepayment wording to the protected settlement wording', async () => {
        mockGetDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({ bodyText: PREVIOUS_DELEGATION_BODY_TEXT }),
        } as any);

        await expect(delegationLetterTemplateService.getPublicTemplate()).resolves.toEqual({
            bodyText: DEFAULT_DELEGATION_BODY_TEXT,
        });
    });
});
