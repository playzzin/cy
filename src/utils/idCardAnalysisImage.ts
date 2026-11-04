import { prepareGeminiDocumentImage } from './geminiDocumentImage';

export { GEMINI_DOCUMENT_IMAGE_MAX_BYTES as ID_CARD_ANALYSIS_MAX_BYTES } from './geminiDocumentImage';
export const prepareIdCardAnalysisImage = (file: File): Promise<File> => prepareGeminiDocumentImage(file, 'identity-card');
