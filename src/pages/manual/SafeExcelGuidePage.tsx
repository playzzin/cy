import React from 'react';

const SafeExcelGuidePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-10 bg-white shadow-sm min-h-screen">
      <h1 className="text-3xl font-bold text-slate-800 mb-6">📊 대용량 엑셀 안전 업로드 가이드</h1>

      <p className="mb-8 text-slate-600">
        이 가이드는 <strong>작업자, 팀, 현장, 회사</strong> 데이터를 엑셀로 한 번에 안전하게 등록하는 방법을 설명합니다.<br />
        시스템은 <strong>데이터베이스와 자동 비교</strong>하여 중복을 방지하고, 오류가 있는 데이터는 건너뛰도록 설계되었습니다.
      </p>

      <hr className="my-8 border-slate-200" />

      <h2 className="text-2xl font-bold text-slate-800 mb-4">1. 공통 사용법 (4단계 마법사)</h2>
      <p className="mb-4 text-slate-600">모든 업로드 기능은 동일한 4단계 과정을 거칩니다.</p>

      <div className="space-y-6 mb-12">
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex-shrink-0 flex items-center justify-center font-bold">1</div>
          <div>
            <h3 className="font-bold text-lg text-slate-700">파일 업로드</h3>
            <ul className="list-disc pl-5 text-slate-600 mt-2 space-y-1">
              <li><strong>.xlsx 또는 .xls 형식</strong>의 엑셀 파일만 지원합니다.</li>
              <li>파일을 화면의 점선 영역으로 <strong>드래그</strong>하거나 버튼을 클릭하여 선택하세요.</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex-shrink-0 flex items-center justify-center font-bold">2</div>
          <div>
            <h3 className="font-bold text-lg text-slate-700">컬럼 연결 (매핑)</h3>
            <ul className="list-disc pl-5 text-slate-600 mt-2 space-y-1">
              <li>엑셀의 헤더(첫 번째 줄)를 시스템이 자동으로 인식합니다.</li>
              <li><strong>예:</strong> 엑셀에 `성명`이라고 적혀있으면 시스템의 `이름` 필드와 자동으로 연결됩니다.</li>
              <li>자동 연결이 안 된 경우, 드롭다운 메뉴에서 직접 선택해 주세요.</li>
              <li><strong>필수 항목(*표시)</strong>은 반드시 연결되어야 다음으로 넘어갈 수 있습니다.</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex-shrink-0 flex items-center justify-center font-bold">3</div>
          <div>
            <h3 className="font-bold text-lg text-slate-700">데이터 확인 (프리뷰)</h3>
            <ul className="list-disc pl-5 text-slate-600 mt-2 space-y-1">
              <li>업로드 전, 데이터의 정합성을 검사합니다.</li>
              <li><span className="text-green-600 font-bold">초록색 체크</span>: 정상 데이터 (등록 가능)</li>
              <li><span className="text-red-500 font-bold">빨간색 느낌표</span>: 오류 데이터 (등록 불가 - 필수값 누락 등)</li>
              <li><span className="text-orange-500 font-bold">주황색 경고</span>: 중복 데이터 (이미 DB에 존재함 - 등록 시 건너뜀)</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex-shrink-0 flex items-center justify-center font-bold">4</div>
          <div>
            <h3 className="font-bold text-lg text-slate-700">일괄 저장</h3>
            <ul className="list-disc pl-5 text-slate-600 mt-2 space-y-1">
              <li><strong>[업로드 시작]</strong> 버튼을 누르면 저장이 시작됩니다.</li>
              <li>50건씩 나누어 처리되므로 멈추지 말고 기다려주세요.</li>
            </ul>
          </div>
        </div>
      </div>

      <hr className="my-8 border-slate-200" />

      <h2 className="text-2xl font-bold text-slate-800 mb-4">2. 데이터별 상세 가이드</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
          <h3 className="font-bold text-brand-600 mb-2">👷 작업자 (Worker)</h3>
          <ul className="text-sm space-y-2 text-slate-700">
            <li><strong>필수:</strong> 이름</li>
            <li><strong>권장:</strong> 연락처, 생년월일, 주소, 직종, 소속팀, 단가</li>
            <li><strong>중복:</strong> 이름+연락처 일치 시 <span className="text-orange-600 font-bold">건너뜀(Skip)</span></li>
          </ul>
        </div>

        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
          <h3 className="font-bold text-brand-600 mb-2">🏗️ 팀 (Team)</h3>
          <ul className="text-sm space-y-2 text-slate-700">
            <li><strong>필수:</strong> 팀명</li>
            <li><strong>권장:</strong> 팀장명, 연락처, 직종</li>
            <li><strong>중복:</strong> 팀명 일치 시 <span className="text-red-600 font-bold">오류(Error)</span></li>
          </ul>
        </div>

        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
          <h3 className="font-bold text-brand-600 mb-2">🏢 현장 (Site)</h3>
          <ul className="text-sm space-y-2 text-slate-700">
            <li><strong>필수:</strong> 현장명</li>
            <li><strong>권장:</strong> 주소, 착공일, 준공일</li>
            <li><strong>중복:</strong> 현장명 일치 시 <span className="text-red-600 font-bold">오류(Error)</span></li>
          </ul>
        </div>

        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
          <h3 className="font-bold text-brand-600 mb-2">🤝 협력업체 (Company)</h3>
          <ul className="text-sm space-y-2 text-slate-700">
            <li><strong>필수:</strong> 회사명</li>
            <li><strong>권장:</strong> 사업자번호, 대표자, 주소</li>
            <li><strong>중복:</strong> 회사명 일치 시 <span className="text-orange-600 font-bold">경고(Warning)</span></li>
          </ul>
        </div>

        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 border-indigo-200 bg-indigo-50">
          <h3 className="font-bold text-indigo-700 mb-2">📅 출력일보 (Daily Report)</h3>
          <ul className="text-sm space-y-2 text-slate-700">
            <li><strong>필수:</strong> 날짜, 현장명, 팀명, 작업자명, 공수</li>
            <li><strong>권장:</strong> 직종, 작업내용</li>
            <li><strong>주의:</strong> <strong className="text-red-600">등록된 현장/팀만 가능</strong></li>
            <li><strong>중복:</strong> 같은 날/현장/팀이 있으면 기존 기록에 <span className="text-green-600 font-bold">병합(Merge)</span></li>
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-800 mb-4">3. 권장 업로드 순서 (중요!)</h2>
      <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200 text-slate-700 mb-12">
        <p className="mb-4">데이터 간의 연결(Relation)을 위해 <strong>아래 순서대로 업로드하는 것을 강력히 권장</strong>합니다.</p>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-white px-4 py-2 rounded shadow text-center">
            <div className="text-xs text-slate-500">1단계</div>
            <div className="font-bold">🏢 현장 / 🤝 회사</div>
          </div>
          <div className="text-slate-400">→</div>
          <div className="bg-white px-4 py-2 rounded shadow text-center">
            <div className="text-xs text-slate-500">2단계</div>
            <div className="font-bold">🏗️ 팀</div>
          </div>
          <div className="text-slate-400">→</div>
          <div className="bg-white px-4 py-2 rounded shadow text-center">
            <div className="text-xs text-slate-500">3단계</div>
            <div className="font-bold">👷 작업자</div>
          </div>
          <div className="text-slate-400">→</div>
          <div className="bg-white px-4 py-2 rounded shadow text-center border-2 border-indigo-200">
            <div className="text-xs text-indigo-500">4단계</div>
            <div className="font-bold text-indigo-700">📅 출력일보</div>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          ※ <strong>출력일보</strong>를 먼저 올리면, 해당 <strong>팀이나 현장이 DB에 없을 경우 에러가 발생</strong>하여 등록되지 않습니다.<br />
          ※ <strong>작업자</strong>는 일보 등록 시 자동으로 생성될 수도 있지만(임시), 정확한 관리를 위해 미리 등록하는 것이 좋습니다.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-slate-800 mb-4">4. 엑셀 파일 작성 팁</h2>
      <ul className="list-disc pl-5 text-slate-600 mt-2 space-y-2">
        <li><strong>첫 줄은 반드시 헤더(제목)</strong>여야 합니다. (예: 이름, 전화번호...)</li>
        <li><strong>빈 행</strong>이 중간에 없도록 해주세요.</li>
        <li>날짜는 `2025-01-01` 또는 `2025.01.01` 형식을 권장합니다.</li>
        <li>숫자가 들어갈 곳에 `150,000`처럼 콤마는 괜찮지만, `15만원` 같은 글자는 피해주세요.</li>
      </ul>
    </div>
  );
};

export default SafeExcelGuidePage;
