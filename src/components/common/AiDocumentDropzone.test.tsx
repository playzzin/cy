import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import AiDocumentDropzone from './AiDocumentDropzone';

const Harness: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    return (
        <AiDocumentDropzone
            files={files}
            title="청구서 업로드"
            description="분석할 파일을 올립니다."
            maxFiles={2}
            onFilesChange={setFiles}
        />
    );
};

describe('AiDocumentDropzone', () => {
    it('드롭한 파일을 중복 없이 추가하고 개별 삭제한다', () => {
        render(<Harness />);
        const first = new File(['first'], 'first.jpg', { type: 'image/jpeg', lastModified: 1 });
        const second = new File(['second'], 'second.pdf', { type: 'application/pdf', lastModified: 2 });

        fireEvent.drop(screen.getByTestId('ai-document-dropzone'), {
            dataTransfer: { files: [first, first, second] },
        });

        expect(screen.getByText('선택 파일 2개')).toBeInTheDocument();
        expect(screen.getByText('first.jpg')).toBeInTheDocument();
        expect(screen.getByText('second.pdf')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'first.jpg 삭제' }));
        expect(screen.getByText('선택 파일 1개')).toBeInTheDocument();
        expect(screen.queryByText('first.jpg')).not.toBeInTheDocument();
    });
});
