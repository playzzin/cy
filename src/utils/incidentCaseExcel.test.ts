import type { IncidentCaseCategory } from "../types/incidentCase";
import { parseIncidentCaseUploadRows } from "./incidentCaseExcel";

const categories = [
  {
    id: "traffic_accident",
    name: "교통 사고",
    color: "#ea580c",
    active: true,
    createdAt: null,
    updatedAt: null,
  },
] as IncidentCaseCategory[];

describe("parseIncidentCaseUploadRows", () => {
  it("이름·생년월일·기록·카테고리를 사건사고 기록으로 변환한다", () => {
    const result = parseIncidentCaseUploadRows(
      [
        ["이름", "생년월일", "기록", "카테고리", "발생일"],
        ["홍길동", "1990-01-02", "주차장 접촉 사고", "교통 사고", "2026-07-13"],
      ],
      { categories },
    );

    expect(result.errors).toEqual([]);
    expect(result.records).toEqual([
      {
        personName: "홍길동",
        birthDate: "1990-01-02",
        title: "주차장 접촉 사고",
        caseType: "incident",
        categoryId: "traffic_accident",
        incidentDate: "2026-07-13",
        record: "주차장 접촉 사고",
      },
    ]);
  });

  it("오류가 있는 생년월일도 원문 그대로 미리보기와 등록 데이터에 포함한다", () => {
    const result = parseIncidentCaseUploadRows(
      [
        ["이름", "생년월일", "기록", "카테고리", "발생일"],
        ["홍길동", "1990-02-30", "생년월일 확인 필요", "traffic_accident", ""],
      ],
      { categories },
    );

    expect(result.errors).toEqual([]);
    expect(result.records[0]).toMatchObject({
      birthDate: "1990-02-30",
      title: "생년월일 확인 필요",
    });
    expect(result.previewRows[0]).toMatchObject({
      birthDate: "1990-02-30",
      errors: [],
    });
  });

  it("미리보기 행에 등록을 막는 오류를 표시한다", () => {
    const result = parseIncidentCaseUploadRows(
      [
        ["이름", "생년월일", "기록", "카테고리", "발생일"],
        ["", "", "", "traffic_accident", ""],
      ],
      { categories },
    );

    expect(result.records).toEqual([]);
    expect(result.previewRows[0].errors.join(" ")).toContain(
      "이름이 비어 있습니다",
    );
    expect(result.previewRows[0].errors.join(" ")).toContain(
      "생년월일을 입력하세요",
    );
    expect(result.previewRows[0].errors.join(" ")).toContain(
      "기록이 비어 있습니다",
    );
  });
});
