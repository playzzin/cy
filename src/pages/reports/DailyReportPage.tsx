import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const ReportContainer = styled.div`
  padding: 2rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  
  input, textarea, select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
`;

const DailyReportPage: React.FC = () => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    site: '',
    workContent: '',
    workerCount: 0,
    weather: '맑음',
    note: ''
  });

  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 제출 로직 구현
    console.log('일일 보고서 제출:', formData);
    alert('일일 보고서가 제출되었습니다.');
    navigate('/reports');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'workerCount' ? parseInt(value) || 0 : value
    }));
  };

  return (
    <ReportContainer>
      <h1 className="text-2xl font-bold mb-6">일일 작업 보고서</h1>
      
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <FormGroup>
          <label htmlFor="date">작성일</label>
          <input 
            type="date" 
            id="date" 
            name="date" 
            value={formData.date}
            onChange={handleChange}
            required 
          />
        </FormGroup>
        
        <FormGroup>
          <label htmlFor="site">현장명</label>
          <input 
            type="text" 
            id="site" 
            name="site" 
            value={formData.site}
            onChange={handleChange}
            required 
            placeholder="현장명을 입력하세요"
          />
        </FormGroup>
        
        <FormGroup>
          <label htmlFor="workContent">작업 내용</label>
          <textarea 
            id="workContent" 
            name="workContent" 
            rows={4}
            value={formData.workContent}
            onChange={handleChange}
            required
            placeholder="오늘의 작업 내용을 상세히 입력하세요"
          />
        </FormGroup>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormGroup>
            <label htmlFor="workerCount">작업 인원</label>
            <input 
              type="number" 
              id="workerCount" 
              name="workerCount" 
              min="0"
              value={formData.workerCount}
              onChange={handleChange}
              required
            />
          </FormGroup>
          
          <FormGroup>
            <label htmlFor="weather">날씨</label>
            <select 
              id="weather" 
              name="weather" 
              value={formData.weather}
              onChange={handleChange}
              required
            >
              <option value="맑음">맑음</option>
              <option value="흐림">흐림</option>
              <option value="비">비</option>
              <option value="눈">눈</option>
              <option value="폭우">폭우</option>
              <option value="폭설">폭설</option>
            </select>
          </FormGroup>
        </div>
        
        <FormGroup>
          <label htmlFor="note">특이사항</label>
          <textarea 
            id="note" 
            name="note" 
            rows={3}
            value={formData.note}
            onChange={handleChange}
            placeholder="특이사항이나 참고사항을 입력하세요"
          />
        </FormGroup>
        
        <div className="flex justify-end gap-4 mt-8">
          <button 
            type="button" 
            className="px-4 py-2 border border-gray-300 rounded-md"
            onClick={() => navigate(-1)}
          >
            취소
          </button>
          <button 
            type="submit" 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            저장하기
          </button>
        </div>
      </form>
    </ReportContainer>
  );
};

export default DailyReportPage;
