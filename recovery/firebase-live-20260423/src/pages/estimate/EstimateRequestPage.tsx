import React, { useEffect, useState, useRef } from 'react';
import styled from 'styled-components';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCloudUploadAlt, 
  faPaperPlane, 
  faTimes, 
  faFileAlt, 
  faBuilding, 
  faUser, 
  faPhone, 
  faEnvelope,
  faCircleCheck,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { db, storage } from '../../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const MySwal = withReactContent(Swal);

// Zod 검증 스키마
const estimateSchema = z.object({
  inquiryType: z.enum(['시스템동바리', '시스템비계', '기타'], { required_error: '견적 종류를 선택해주세요.' }),
  companyName: z.string().min(1, '회사명 또는 현장명을 입력해주세요.'),
  requesterName: z.string().min(1, '담당자(신청자) 성함을 입력해주세요.'),
  phone: z.string().min(9, '올바른 연락처를 입력해주세요.'),
  email: z.string().email('유효한 이메일 주소를 입력해주세요.').optional().or(z.literal('')),
  details: z.string().min(5, '요청 상세내용을 최소 5자 이상 입력해주세요.'),
});

type EstimateFormValues = z.infer<typeof estimateSchema>;

const EstimateRequestPage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => localStorage.getItem('cy-cheongyeon-theme') !== 'light');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncTheme = () => {
      setIsDarkMode(localStorage.getItem('cy-cheongyeon-theme') !== 'light');
    };

    syncTheme();
    window.addEventListener('storage', syncTheme);
    window.addEventListener('focus', syncTheme);
    return () => {
      window.removeEventListener('storage', syncTheme);
      window.removeEventListener('focus', syncTheme);
    };
  }, []);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors }
  } = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateSchema),
    defaultValues: {
      inquiryType: '시스템동바리',
      companyName: '',
      requesterName: '',
      phone: '',
      email: '',
      details: '',
    }
  });

  // 다중 파일 선택 처리
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
    // 동일 파일 재선택 가능하도록 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 선택된 파일 제거
  const handleRemoveFile = (indexToRemove: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // 파일 업로드 (병렬 처리)
  const uploadFiles = async (files: File[]): Promise<{ name: string; url: string; size: number }[]> => {
    if (files.length === 0) return [];
    
    const uploadPromises = files.map(async (file) => {
      const timestamp = Date.now();
      const uniqueName = `estimate_files/${timestamp}_${file.name}`;
      const fileRef = storageRef(storage, uniqueName);
      
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return {
        name: file.name,
        url: downloadURL,
        size: file.size
      };
    });

    return Promise.all(uploadPromises);
  };

  // 폼 제출 핸들러
  const onSubmit = async (data: EstimateFormValues) => {
    try {
      setIsSubmitting(true);

      // 1. 파일 업로드 실행
      let uploadedFileUrls: { name: string; url: string; size: number }[] = [];
      if (selectedFiles.length > 0) {
        uploadedFileUrls = await uploadFiles(selectedFiles);
      }

      // 2. 파이어스토어 데이터 저장
      const estimateData = {
        ...data,
        attachedFiles: uploadedFileUrls,
        status: '접수대기',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'estimate_inquiries'), estimateData);

      // 3. 성공 알림 및 초기화
      await MySwal.fire({
        icon: 'success',
        title: '접수 완료',
        html: `견적 문의가 성공적으로 접수되었습니다.<br/>빠른 시일 내에 연락 드리겠습니다.`,
        background: isDarkMode ? '#111827' : '#ffffff',
        color: isDarkMode ? '#e5e7eb' : '#1e293b',
        confirmButtonColor: '#2563eb'
      });

      reset();
      setSelectedFiles([]);

    } catch (error) {
      console.error('견적 저장 에러:', error);
      MySwal.fire({
        icon: 'error',
        title: '오류 발생',
        text: '접수 중 문제가 발생했습니다. 관리자에게 문의해주세요.',
        background: isDarkMode ? '#111827' : '#ffffff',
        color: isDarkMode ? '#e5e7eb' : '#1e293b',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container $isDarkMode={isDarkMode}>
      <PageHeader>
        <HeaderTitle>초간편 견적 상담</HeaderTitle>
        <HeaderSubtitle>시스템동바리 및 시스템비계 시공/임대 단가, 즉시 산출해 드립니다.</HeaderSubtitle>
      </PageHeader>

      <FormCard onSubmit={handleSubmit(onSubmit)}>
        {/* --- 1. 기본 정보 --- */}
        <SectionTitle>
          <FontAwesomeIcon icon={faBuilding} className="mr-2 text-blue-500" />
          기본 정보 입력
        </SectionTitle>
        
        <GridContainer>
          {/* 견적 유형 */}
          <FormGroup className="col-span-1 md:col-span-2">
            <Label>문의 유형 <Required>*</Required></Label>
            <RadioGroup>
              {['시스템동바리', '시스템비계', '기타'].map((type) => (
                <RadioLabel key={type}>
                  <input
                    type="radio"
                    value={type}
                    {...register('inquiryType')}
                    disabled={isSubmitting}
                  />
                  <span className="radio-text">{type}</span>
                </RadioLabel>
              ))}
            </RadioGroup>
            {errors.inquiryType && <ErrorText>{errors.inquiryType.message}</ErrorText>}
          </FormGroup>

          {/* 회사명/현장명 */}
          <FormGroup className="col-span-1 md:col-span-2">
            <Label>회사명 / 현장명 <Required>*</Required></Label>
            <InputWrapper>
              <InputIcon>
                <FontAwesomeIcon icon={faBuilding} />
              </InputIcon>
              <Input
                type="text"
                placeholder="(주)청연건설 / 송도 랜드마크 현장"
                {...register('companyName')}
                disabled={isSubmitting}
                $hasError={!!errors.companyName}
              />
            </InputWrapper>
            {errors.companyName && <ErrorText>{errors.companyName.message}</ErrorText>}
          </FormGroup>

          {/* 담당자명 */}
          <FormGroup>
            <Label>담당자 성함 <Required>*</Required></Label>
            <InputWrapper>
              <InputIcon>
                <FontAwesomeIcon icon={faUser} />
              </InputIcon>
              <Input
                type="text"
                placeholder="홍길동 과장"
                {...register('requesterName')}
                disabled={isSubmitting}
                $hasError={!!errors.requesterName}
              />
            </InputWrapper>
            {errors.requesterName && <ErrorText>{errors.requesterName.message}</ErrorText>}
          </FormGroup>

          {/* 연락처 */}
          <FormGroup>
            <Label>연락처 <Required>*</Required></Label>
            <InputWrapper>
              <InputIcon>
                <FontAwesomeIcon icon={faPhone} />
              </InputIcon>
              <Input
                type="text"
                placeholder="010-0000-0000"
                {...register('phone')}
                disabled={isSubmitting}
                $hasError={!!errors.phone}
              />
            </InputWrapper>
            {errors.phone && <ErrorText>{errors.phone.message}</ErrorText>}
          </FormGroup>

          {/* 이메일 */}
          <FormGroup className="col-span-1 md:col-span-2">
            <Label>이메일 (선택)</Label>
            <InputWrapper>
              <InputIcon>
                <FontAwesomeIcon icon={faEnvelope} />
              </InputIcon>
              <Input
                type="email"
                placeholder="example@cy-enc.com (견적서를 이메일로 받아보실 수 있습니다)"
                {...register('email')}
                disabled={isSubmitting}
                $hasError={!!errors.email}
              />
            </InputWrapper>
            {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
          </FormGroup>
        </GridContainer>

        <Divider />

        {/* --- 2. 상세 요청 및 도면 첨부 --- */}
        <SectionTitle>
          <FontAwesomeIcon icon={faFileAlt} className="mr-2 text-indigo-500" />
          상세 요청 & 도면 첨부
        </SectionTitle>

        <FormGroup>
          <Label>현장 상황 및 상세 요청 <Required>*</Required></Label>
          <TextArea
            placeholder="설치 시공 기간, 예상 물량, 현장 특이사항 등을 자세히 적어주시면 더욱 정확한 견적이 가능합니다."
            rows={5}
            {...register('details')}
            disabled={isSubmitting}
            $hasError={!!errors.details}
          />
          {errors.details && <ErrorText>{errors.details.message}</ErrorText>}
        </FormGroup>

        <FormGroup>
          <Label>도면 및 첨부 문서 (선택)</Label>
          <FileUploadZone 
            onClick={() => !isSubmitting && fileInputRef.current?.click()}
            $isSubmitting={isSubmitting}
          >
            <FontAwesomeIcon icon={faCloudUploadAlt} className="upload-icon" />
            <div className="upload-text">
              <span className="upload-highlight">클릭하여 파일 추가</span> 또는 이 영역으로 드래그
            </div>
            <div className="upload-subtext">지원 파일: PDF, CAD(dwg), JPG, PNG, Excel 등 (최대 50MB)</div>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={isSubmitting}
            />
          </FileUploadZone>

          {/* 선택된 파일 목록 */}
          {selectedFiles.length > 0 && (
            <FileList>
              {selectedFiles.map((file, idx) => (
                <FileItem key={`${file.name}-${idx}`}>
                  <div className="file-info">
                    <FontAwesomeIcon icon={faFileAlt} className="file-icon" />
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  <RemoveButton 
                    type="button" 
                    onClick={() => handleRemoveFile(idx)}
                    disabled={isSubmitting}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </RemoveButton>
                </FileItem>
              ))}
            </FileList>
          )}
        </FormGroup>

        <SubmitButton type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
              업로드 및 전송 중...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
              견적 문의 접수하기
            </>
          )}
        </SubmitButton>
      </FormCard>
    </Container>
  );
};

export default EstimateRequestPage;

// --- Styled Components ---

const Container = styled.div<{ $isDarkMode: boolean }>`
  --bg-start: ${({ $isDarkMode }) => ($isDarkMode ? '#0b1220' : '#f3f6fb')};
  --bg-end: ${({ $isDarkMode }) => ($isDarkMode ? '#121b2f' : '#e8eef8')};
  --surface: ${({ $isDarkMode }) => ($isDarkMode ? '#111a2b' : '#ffffff')};
  --surface-border: ${({ $isDarkMode }) => ($isDarkMode ? '#25324a' : '#d6dfec')};
  --surface-elevated: ${({ $isDarkMode }) => ($isDarkMode ? '#0f172a' : '#ffffff')};
  --text-strong: ${({ $isDarkMode }) => ($isDarkMode ? '#f8fafc' : '#0f172a')};
  --text: ${({ $isDarkMode }) => ($isDarkMode ? '#e2e8f0' : '#1e293b')};
  --text-muted: ${({ $isDarkMode }) => ($isDarkMode ? '#94a3b8' : '#475569')};
  --input-bg: ${({ $isDarkMode }) => ($isDarkMode ? '#0f172a' : '#ffffff')};
  --input-border: ${({ $isDarkMode }) => ($isDarkMode ? '#334155' : '#cbd5e1')};
  --input-disabled: ${({ $isDarkMode }) => ($isDarkMode ? '#1e293b' : '#e2e8f0')};
  --input-focus: ${({ $isDarkMode }) => ($isDarkMode ? '#22d3ee' : '#2563eb')};
  --danger: #ef4444;
  --icon-color: ${({ $isDarkMode }) => ($isDarkMode ? '#7dd3fc' : '#2563eb')};
  --chip-bg: ${({ $isDarkMode }) => ($isDarkMode ? '#111827' : '#f8fafc')};
  --chip-border: ${({ $isDarkMode }) => ($isDarkMode ? '#334155' : '#cbd5e1')};
  --chip-text: ${({ $isDarkMode }) => ($isDarkMode ? '#dbeafe' : '#334155')};
  --radio-active-bg: ${({ $isDarkMode }) => ($isDarkMode ? 'rgba(34, 211, 238, 0.18)' : 'rgba(37, 99, 235, 0.1)')};
  --radio-active-text: ${({ $isDarkMode }) => ($isDarkMode ? '#e0f2fe' : '#1d4ed8')};
  --divider: ${({ $isDarkMode }) => ($isDarkMode ? '#334155' : '#e2e8f0')};

  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem 2.5rem;
  min-height: calc(100vh - 48px);
  background:
    radial-gradient(circle at 12% 12%, rgba(56, 189, 248, 0.08), transparent 38%),
    radial-gradient(circle at 88% 0%, rgba(37, 99, 235, 0.08), transparent 36%),
    linear-gradient(180deg, var(--bg-start), var(--bg-end));
  font-family: 'Pretendard', -apple-system, sans-serif;
`;

const PageHeader = styled.div`
  text-align: center;
  margin-bottom: 2.5rem;
`;

const HeaderTitle = styled.h1`
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-strong);
  margin-bottom: 0.75rem;
  letter-spacing: -0.025em;
`;

const HeaderSubtitle = styled.p`
  font-size: 1.05rem;
  color: var(--text-muted);
  font-weight: 400;
`;

const FormCard = styled.form`
  background: var(--surface);
  border-radius: 16px;
  box-shadow: 0 18px 40px -20px rgba(2, 6, 23, 0.75);
  border: 1px solid var(--surface-border);
  backdrop-filter: blur(4px);
  padding: 2.5rem;
  
  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const SectionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-strong);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
`;

const Required = styled.span`
  color: #ef4444;
  margin-left: 0.25rem;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const InputIcon = styled.div`
  position: absolute;
  left: 1rem;
  color: var(--icon-color);
  font-size: 0.9rem;
`;

const Input = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  padding: 0.85rem 1rem 0.85rem 2.8rem;
  font-size: 0.95rem;
  color: var(--text);
  background-color: var(--input-bg);
  border: 1px solid ${({ $hasError }) => ($hasError ? 'var(--danger)' : 'var(--input-border)')};
  border-radius: 8px;
  transition: all 0.2s ease;
  outline: none;

  &:focus {
    background-color: var(--surface-elevated);
    border-color: ${({ $hasError }) => ($hasError ? 'var(--danger)' : 'var(--input-focus)')};
    box-shadow: 0 0 0 3px ${({ $hasError }) => ($hasError ? 'rgba(239, 68, 68, 0.18)' : 'rgba(56, 189, 248, 0.22)')};
  }

  &::placeholder {
    color: var(--text-muted);
  }

  &:disabled {
    background-color: var(--input-disabled);
    cursor: not-allowed;
    color: var(--text-muted);
  }
`;

const TextArea = styled.textarea<{ $hasError?: boolean }>`
  width: 100%;
  padding: 1rem;
  font-size: 0.95rem;
  color: var(--text);
  background-color: var(--input-bg);
  border: 1px solid ${({ $hasError }) => ($hasError ? 'var(--danger)' : 'var(--input-border)')};
  border-radius: 8px;
  resize: vertical;
  min-height: 120px;
  transition: all 0.2s ease;
  outline: none;

  &:focus {
    background-color: var(--surface-elevated);
    border-color: ${({ $hasError }) => ($hasError ? 'var(--danger)' : 'var(--input-focus)')};
    box-shadow: 0 0 0 3px ${({ $hasError }) => ($hasError ? 'rgba(239, 68, 68, 0.18)' : 'rgba(56, 189, 248, 0.22)')};
  }

  &::placeholder {
    color: var(--text-muted);
  }

  &:disabled {
    background-color: var(--input-disabled);
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const RadioGroup = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  
  input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
  }

  .radio-text {
    padding: 0.6rem 1.25rem;
    background-color: var(--chip-bg);
    border: 1px solid var(--chip-border);
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--chip-text);
    transition: all 0.2s;
  }

  input:checked ~ .radio-text {
    background: var(--radio-active-bg);
    border-color: #38bdf8;
    color: var(--radio-active-text);
    font-weight: 600;
    box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.65) inset;
  }

  input:focus-visible ~ .radio-text {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  input:disabled ~ .radio-text {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ErrorText = styled.span`
  color: #ef4444;
  font-size: 0.8rem;
  font-weight: 500;
  margin-top: 0.25rem;
`;

const Divider = styled.hr`
  border: 0;
  border-top: 1px solid var(--divider);
  margin: 2.5rem 0;
`;

const FileUploadZone = styled.div<{ $isSubmitting: boolean }>`
  border: 2px dashed var(--input-border);
  border-radius: 12px;
  padding: 2.5rem 1rem;
  text-align: center;
  background-color: color-mix(in srgb, var(--surface-elevated) 82%, transparent);
  cursor: ${({ $isSubmitting }) => ($isSubmitting ? 'not-allowed' : 'pointer')};
  transition: all 0.2s ease;
  opacity: ${({ $isSubmitting }) => ($isSubmitting ? 0.6 : 1)};

  &:hover {
    border-color: ${({ $isSubmitting }) => ($isSubmitting ? 'var(--input-border)' : '#38bdf8')};
    background-color: ${({ $isSubmitting }) => ($isSubmitting ? 'color-mix(in srgb, var(--surface-elevated) 82%, transparent)' : 'rgba(14, 165, 233, 0.12)')};
  }

  .upload-icon {
    font-size: 2.5rem;
    color: var(--icon-color);
    margin-bottom: 1rem;
  }

  .upload-text {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text);
    margin-bottom: 0.5rem;
  }

  .upload-highlight {
    color: #38bdf8;
    font-weight: 600;
  }

  .upload-subtext {
    font-size: 0.8rem;
    color: var(--text-muted);
  }
`;

const FileList = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: color-mix(in srgb, var(--surface-elevated) 90%, transparent);
  border-radius: 8px;
  border: 1px solid var(--input-border);

  .file-info {
    display: flex;
    align-items: center;
    overflow: hidden;
  }

  .file-icon {
    color: var(--icon-color);
    margin-right: 0.75rem;
  }

  .file-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 0.5rem;
  }

  .file-size {
    font-size: 0.8rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;

  &:hover:not(:disabled) {
    color: #ef4444;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 1.25rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  margin-top: 2rem;
  transition: all 0.2s ease;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.32);

  &:hover:not(:disabled) {
    background: #1d4ed8;
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(37, 99, 235, 0.36);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: #334155;
    box-shadow: none;
    cursor: not-allowed;
  }
`;
