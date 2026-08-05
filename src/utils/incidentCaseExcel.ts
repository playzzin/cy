import type {
  IncidentCase,
  IncidentCaseCategory,
  UpsertIncidentCaseInput,
} from "../types/incidentCase";

export const INCIDENT_CASE_UPLOAD_SHEET_NAME = "사건사고 업로드";
export const INCIDENT_CASE_UPLOAD_HEADERS = [
  "이름",
  "생년월일",
  "기록",
  "카테고리",
  "발생일",
] as const;

const MAX_UPLOAD_ROWS = 200;

type UploadContext = { categories: IncidentCaseCategory[] };

export type IncidentCaseUploadParseResult = {
  records: UpsertIncidentCaseInput[];
  errors: string[];
  skippedRows: number;
  previewRows: IncidentCaseUploadPreviewRow[];
};

export type IncidentCaseUploadPreviewRow = {
  sourceRow: number;
  personName: string;
  birthDate: string;
  category: string;
  incidentDate: string;
  record: string;
  errors: string[];
};

const normalizeText = (value: unknown): string => String(value ?? "").trim();
const normalizeLookup = (value: unknown): string =>
  normalizeText(value).toLocaleLowerCase("ko-KR");

const isValidDate = (value: string): boolean => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

const normalizeDate = (value: unknown): string | null | undefined => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const excelDate = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    const normalized = excelDate.toISOString().slice(0, 10);
    return isValidDate(normalized) ? normalized : undefined;
  }
  const text = normalizeText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text))
    return isValidDate(text) ? text : undefined;
  const match = text.match(/^(\d{4})[./]\s?(\d{1,2})[./]\s?(\d{1,2})\.?$/);
  if (!match) return undefined;
  const normalized = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return isValidDate(normalized) ? normalized : undefined;
};

const normalizeBirthDate = (value: unknown): string => {
  const normalizedDate = normalizeDate(value);
  return normalizedDate ?? normalizeText(value);
};

const headerIndex = (headers: unknown[], label: string): number =>
  headers.findIndex(
    (header) =>
      normalizeLookup(header).replace(/\s/g, "") ===
      normalizeLookup(label).replace(/\s/g, ""),
  );

export const parseIncidentCaseUploadRows = (
  rows: unknown[][],
  { categories }: UploadContext,
): IncidentCaseUploadParseResult => {
  if (rows.length === 0)
    return {
      records: [],
      errors: ["업로드 시트에 헤더가 없습니다."],
      skippedRows: 0,
      previewRows: [],
    };

  const headers = rows[0] || [];
  const columnIndexes = new Map(
    INCIDENT_CASE_UPLOAD_HEADERS.map((header) => [
      header,
      headerIndex(headers, header),
    ]),
  );
  const missingHeaders = INCIDENT_CASE_UPLOAD_HEADERS.filter(
    (header) => (columnIndexes.get(header) ?? -1) < 0,
  );
  if (missingHeaders.length > 0)
    return {
      records: [],
      errors: [`필수 헤더가 없습니다: ${missingHeaders.join(", ")}`],
      skippedRows: 0,
      previewRows: [],
    };

  const categoryByValue = new Map<string, string>();
  categories
    .filter((category) => category.active)
    .forEach((category) => {
      categoryByValue.set(normalizeLookup(category.id), category.id);
      categoryByValue.set(normalizeLookup(category.name), category.id);
    });
  const records: UpsertIncidentCaseInput[] = [];
  const errors: string[] = [];
  const previewRows: IncidentCaseUploadPreviewRow[] = [];
  let skippedRows = 0;
  const maxRow = Math.min(rows.length - 1, MAX_UPLOAD_ROWS);

  for (let rowIndex = 1; rowIndex <= maxRow; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const values = INCIDENT_CASE_UPLOAD_HEADERS.map(
      (header) => row[columnIndexes.get(header) ?? -1],
    );
    if (values.every((value) => normalizeText(value) === "")) {
      skippedRows += 1;
      continue;
    }

    const sourceRow = rowIndex + 1;
    const [
      personNameValue,
      birthDateValue,
      recordValue,
      categoryValue,
      incidentDateValue,
    ] = values;
    const personName = normalizeText(personNameValue);
    const birthDate = normalizeBirthDate(birthDateValue);
    const categoryId = categoryByValue.get(normalizeLookup(categoryValue));
    const incidentDate = normalizeDate(incidentDateValue);
    const record = normalizeText(recordValue);

    const rowErrors: string[] = [];
    if (!personName) rowErrors.push("이름이 비어 있습니다.");
    else if (personName.length > 40)
      rowErrors.push("이름은 40자 이하여야 합니다.");
    if (!birthDate) rowErrors.push("생년월일을 입력하세요.");
    else if (birthDate.length > 20)
      rowErrors.push("생년월일은 20자 이하여야 합니다.");
    if (!record) rowErrors.push("기록이 비어 있습니다.");
    else if (record.length > 120)
      rowErrors.push("기록은 120자 이하여야 합니다.");
    if (!categoryId) rowErrors.push("카테고리 코드 또는 이름을 입력하세요.");
    if (incidentDate === undefined)
      rowErrors.push("발생일은 YYYY-MM-DD 형식이어야 합니다.");

    previewRows.push({
      sourceRow,
      personName,
      birthDate,
      category: normalizeText(categoryValue),
      incidentDate: normalizeText(incidentDateValue),
      record,
      errors: rowErrors,
    });
    errors.push(...rowErrors.map((message) => `${sourceRow}행: ${message}`));

    if (rowErrors.length === 0 && categoryId && incidentDate !== undefined) {
      records.push({
        personName,
        birthDate,
        title: record,
        caseType: "incident",
        categoryId,
        incidentDate,
        record,
      });
    }
  }

  if (rows.length - 1 > MAX_UPLOAD_ROWS)
    errors.push(`한 번에 최대 ${MAX_UPLOAD_ROWS}행까지 업로드할 수 있습니다.`);
  return { records, errors, skippedRows, previewRows };
};

export const readIncidentCaseUploadFile = async (
  file: File,
  context: UploadContext,
): Promise<IncidentCaseUploadParseResult> => {
  if (!/\.(xlsx|xls)$/i.test(file.name))
    throw new Error("Excel 파일(.xlsx 또는 .xls)만 업로드할 수 있습니다.");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const sheetName = workbook.SheetNames.includes(
    INCIDENT_CASE_UPLOAD_SHEET_NAME,
  )
    ? INCIDENT_CASE_UPLOAD_SHEET_NAME
    : workbook.SheetNames[0];
  if (!sheetName) throw new Error("업로드 파일에서 시트를 찾을 수 없습니다.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: "",
  });
  return parseIncidentCaseUploadRows(rows, context);
};

const makeWorkbook = async () => import("xlsx");

export const downloadIncidentCaseUploadTemplate = async ({
  categories,
}: UploadContext): Promise<void> => {
  const XLSX = await makeWorkbook();
  const workbook = XLSX.utils.book_new();
  const uploadSheet = XLSX.utils.aoa_to_sheet([
    [...INCIDENT_CASE_UPLOAD_HEADERS],
  ]);
  uploadSheet["!cols"] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 52 },
    { wch: 24 },
    { wch: 14 },
  ];
  uploadSheet["!autofilter"] = { ref: "A1:E1" };
  XLSX.utils.book_append_sheet(
    workbook,
    uploadSheet,
    INCIDENT_CASE_UPLOAD_SHEET_NAME,
  );
  const guideSheet = XLSX.utils.aoa_to_sheet([
    ["사건·사고 업로드 작성 안내"],
    [
      "1. 생년월일은 입력값을 그대로 저장합니다. 발생일은 YYYY-MM-DD 형식으로 입력하며, 비워 둘 수 있습니다.",
    ],
    ["2. 카테고리는 코드 또는 표시 이름으로 입력할 수 있습니다."],
    [`3. 한 번에 최대 ${MAX_UPLOAD_ROWS}행까지 업로드할 수 있습니다.`],
  ]);
  guideSheet["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, "작성 안내");
  const categorySheet = XLSX.utils.aoa_to_sheet([
    ["카테고리 코드", "카테고리 이름"],
    ...categories
      .filter((category) => category.active)
      .map((category) => [category.id, category.name]),
  ]);
  categorySheet["!cols"] = [{ wch: 24 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, categorySheet, "입력값 목록");
  XLSX.writeFile(workbook, "사건사고기록_업로드양식.xlsx", {
    compression: true,
  });
};

export const downloadIncidentCaseExport = async (
  cases: IncidentCase[],
  categories: IncidentCaseCategory[],
): Promise<void> => {
  const XLSX = await makeWorkbook();
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const rows = [
    [
      "기록번호",
      "이름",
      "생년월일",
      "기록",
      "카테고리 코드",
      "카테고리",
      "발생일",
      "수정 시각",
    ],
    ...cases.map((item) => [
      item.caseNumber,
      item.personName,
      item.birthDate,
      item.title,
      item.categoryId,
      String(categoryById.get(item.categoryId)?.name || ""),
      item.incidentDate || "",
      item.updatedAt?.toDate ? item.updatedAt.toDate().toISOString() : "",
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 52 },
    { wch: 24 },
    { wch: 24 },
    { wch: 14 },
    { wch: 24 },
  ];
  sheet["!autofilter"] = { ref: `A1:H${Math.max(rows.length, 1)}` };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "사건사고 기록");
  XLSX.writeFile(
    workbook,
    `사건사고기록_${new Date().toISOString().slice(0, 10)}.xlsx`,
    { compression: true },
  );
};
