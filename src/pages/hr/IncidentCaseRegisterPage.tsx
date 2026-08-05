import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Download,
  Edit3,
  FileText,
  Filter,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { incidentCaseService } from "../../services/incidentCaseService";
import type {
  IncidentCase,
  IncidentCaseCategory,
  UpsertIncidentCaseInput,
} from "../../types/incidentCase";
import {
  downloadIncidentCaseExport,
  downloadIncidentCaseUploadTemplate,
  readIncidentCaseUploadFile,
  type IncidentCaseUploadParseResult,
} from "../../utils/incidentCaseExcel";

type RecordDraft = UpsertIncidentCaseInput;
type UploadPreview = {
  fileName: string;
  result: IncidentCaseUploadParseResult;
};
type DirectRecordField = "personName" | "birthDate" | "title";
type EditingCell = { recordId: string; field: DirectRecordField };

const EMPTY_DRAFT: RecordDraft = {
  personName: "",
  birthDate: "",
  title: "",
  caseType: "incident",
  categoryId: "",
  incidentDate: null,
  record: "",
};

const normalizeSearch = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("ko-KR");

const isDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

const getCategoryColor = (color?: string): string =>
  /^#[0-9a-fA-F]{6}$/.test(color || "") ? color! : "#475569";

const getCategorySurfaceStyle = (
  color?: string,
): React.CSSProperties => {
  const hex = getCategoryColor(color);
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);

  return {
    borderColor: hex,
    backgroundColor: `rgba(${red}, ${green}, ${blue}, 0.1)`,
  };
};

const getCategoryButtonTextColor = (color?: string): string => {
  const hex = getCategoryColor(color);
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const brightness = red * 0.299 + green * 0.587 + blue * 0.114;

  return brightness > 160 ? "#172033" : "#ffffff";
};

const IncidentCaseRegisterPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [records, setRecords] = useState<IncidentCase[]>([]);
  const [customCategories, setCustomCategories] = useState<
    IncidentCaseCategory[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(
    null,
  );
  const [draft, setDraft] = useState<RecordDraft>(EMPTY_DRAFT);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#475569");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribeRecords = incidentCaseService.subscribeCases(
      (nextRecords) => {
        setRecords(nextRecords);
        setIsLoading(false);
      },
      () => {
        setErrorMessage(
          "사건·사고 기록을 불러오지 못했습니다. 접근 권한을 확인하세요.",
        );
        setIsLoading(false);
      },
    );
    const unsubscribeCategories = incidentCaseService.subscribeCategories(
      setCustomCategories,
      () => setErrorMessage("카테고리를 불러오지 못했습니다."),
    );
    return () => {
      unsubscribeRecords();
      unsubscribeCategories();
    };
  }, []);

  const categories = useMemo(
    () =>
      [...customCategories].sort((left, right) =>
        left.name.localeCompare(right.name, "ko-KR"),
      ),
    [customCategories],
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );
  const filteredRecords = useMemo(() => {
    const query = normalizeSearch(search);
    return records.filter((record) => {
      if (categoryFilter !== "all" && record.categoryId !== categoryFilter)
        return false;
      if (!query) return true;
      return [
        record.personName,
        record.birthDate,
        record.title,
        categoryById.get(record.categoryId)?.name,
      ].some((value) => normalizeSearch(value).includes(query));
    });
  }, [categoryById, categoryFilter, records, search]);

  const resetCategoryEditor = () => {
    setEditingCategoryId(null);
    setCategoryName("");
    setCategoryColor("#475569");
  };

  const openCreate = () => {
    if (activeCategories.length === 0) {
      setErrorMessage("기록을 등록하려면 먼저 카테고리를 추가하세요.");
      resetCategoryEditor();
      setIsCategoryOpen(true);
      return;
    }
    setDraft({ ...EMPTY_DRAFT, categoryId: activeCategories[0]?.id || "" });
    setErrorMessage("");
    setIsCreatingInline(true);
  };

  const cancelInlineEdit = () => {
    setIsCreatingInline(false);
    setDraft(EMPTY_DRAFT);
    setErrorMessage("");
  };

  const validateDraft = (): boolean => {
    if (
      !draft.personName.trim() ||
      !draft.birthDate ||
      !draft.title.trim() ||
      !draft.categoryId
    ) {
      setErrorMessage("이름, 생년월일, 기록, 카테고리는 모두 입력하세요.");
      return false;
    }
    if (draft.incidentDate && !isDateOnly(draft.incidentDate)) {
      setErrorMessage("발생일은 올바른 YYYY-MM-DD 형식이어야 합니다.");
      return false;
    }
    return true;
  };

  const saveRecord = async () => {
    setErrorMessage("");
    setNoticeMessage("");
    if (!currentUser?.uid) {
      setErrorMessage("로그인 정보를 확인할 수 없습니다.");
      return;
    }
    if (!validateDraft()) return;

    setIsSaving(true);
    try {
      const recordInput = {
        ...draft,
        title: draft.title.trim(),
        record: draft.title.trim(),
      };
      await incidentCaseService.createCase(recordInput, currentUser.uid);
      setNoticeMessage("기록을 등록했습니다.");
      setIsCreatingInline(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "기록을 저장하지 못했습니다. 권한을 확인하세요.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const beginCellEdit = (record: IncidentCase, field: DirectRecordField) => {
    setEditingCell({ recordId: record.id, field });
    setEditingValue(record[field]);
    setErrorMessage("");
  };

  const updateExistingRecord = async (
    record: IncidentCase,
    changes: Partial<
      Pick<
        UpsertIncidentCaseInput,
        "personName" | "birthDate" | "title" | "categoryId"
      >
    >,
  ): Promise<boolean> => {
    if (!currentUser?.uid) {
      setErrorMessage("로그인 정보를 확인할 수 없습니다.");
      return false;
    }
    const nextTitle = (changes.title ?? record.title).trim();
    const input: UpsertIncidentCaseInput = {
      personName: (changes.personName ?? record.personName).trim(),
      birthDate: (changes.birthDate ?? record.birthDate).trim(),
      title: nextTitle,
      caseType: record.caseType,
      categoryId: changes.categoryId ?? record.categoryId,
      incidentDate: record.incidentDate,
      record: nextTitle,
    };
    if (
      !input.personName ||
      !input.birthDate ||
      !input.title ||
      !input.categoryId
    ) {
      setErrorMessage("이름, 생년월일, 기록, 카테고리는 모두 입력하세요.");
      return false;
    }
    setSavingRecordId(record.id);
    setErrorMessage("");
    try {
      await incidentCaseService.updateCase(record.id, input, currentUser.uid);
      setNoticeMessage("기록을 수정했습니다.");
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "기록을 수정하지 못했습니다.",
      );
      return false;
    } finally {
      setSavingRecordId(null);
    }
  };

  const commitCellEdit = async (record: IncidentCase) => {
    if (!editingCell || editingCell.recordId !== record.id) return;
    const didSave = await updateExistingRecord(record, {
      [editingCell.field]: editingValue,
    } as Partial<
      Pick<UpsertIncidentCaseInput, "personName" | "birthDate" | "title">
    >);
    if (didSave) setEditingCell(null);
  };

  const changeRecordCategory = async (
    record: IncidentCase,
    categoryId: string,
  ) => {
    if (editingCell?.recordId === record.id) return;
    if (record.categoryId === categoryId) return;
    await updateExistingRecord(record, { categoryId });
  };

  const deleteRecord = async (record: IncidentCase) => {
    if (!window.confirm(`“${record.title}” 기록을 삭제할까요?`)) return;
    setErrorMessage("");
    try {
      await incidentCaseService.deleteCase(record.id);
      setNoticeMessage("기록을 삭제했습니다.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "기록을 삭제하지 못했습니다. 관리자 권한을 확인하세요.",
      );
    }
  };

  const downloadUploadTemplate = async () => {
    setIsDownloadingExcel(true);
    setErrorMessage("");
    try {
      await downloadIncidentCaseUploadTemplate({ categories });
      setNoticeMessage("사건·사고 업로드 양식을 다운로드했습니다.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "업로드 양식을 만들지 못했습니다.",
      );
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const downloadRecords = async () => {
    setIsDownloadingExcel(true);
    setErrorMessage("");
    try {
      await downloadIncidentCaseExport(filteredRecords, categories);
      setNoticeMessage(
        `${filteredRecords.length.toLocaleString()}건을 Excel로 내보냈습니다.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Excel 파일을 만들지 못했습니다.",
      );
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const handleUploadFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !currentUser?.uid) return;
    setErrorMessage("");
    try {
      const result = await readIncidentCaseUploadFile(file, { categories });
      if (result.previewRows.length === 0 && result.errors.length > 0) {
        setErrorMessage(result.errors.join("\n"));
        return;
      }
      setUploadPreview({ fileName: file.name, result });
      setNoticeMessage(
        `Excel ${result.previewRows.length.toLocaleString()}행을 불러왔습니다. 미리보기에서 내용을 검수한 뒤 등록하세요.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Excel 업로드에 실패했습니다.",
      );
    }
  };

  const confirmUpload = async () => {
    if (!uploadPreview || !currentUser?.uid) return;
    if (uploadPreview.result.records.length === 0) {
      setErrorMessage(
        "등록 가능한 행이 없습니다. 오류가 표시된 행을 수정한 뒤 다시 업로드하세요.",
      );
      return;
    }
    setIsImporting(true);
    setErrorMessage("");
    try {
      const savedCount = await incidentCaseService.createCases(
        uploadPreview.result.records,
        currentUser.uid,
      );
      setNoticeMessage(
        `${savedCount.toLocaleString()}건의 기록을 등록했습니다.${uploadPreview.result.skippedRows ? ` 빈 행 ${uploadPreview.result.skippedRows}건은 제외했습니다.` : ""}`,
      );
      setUploadPreview(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Excel 등록에 실패했습니다.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    try {
      if (editingCategoryId) {
        await incidentCaseService.updateCategory(editingCategoryId, {
          name: categoryName,
          color: categoryColor,
          active: true,
        });
        setNoticeMessage("카테고리를 수정했습니다.");
      } else {
        await incidentCaseService.createCategory({
          name: categoryName,
          color: categoryColor,
          active: true,
        });
        setNoticeMessage("카테고리를 추가했습니다.");
      }
      resetCategoryEditor();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "카테고리를 저장하지 못했습니다.",
      );
    }
  };

  const deleteCategory = async (category: IncidentCaseCategory) => {
    if (records.some((record) => record.categoryId === category.id)) {
      setErrorMessage(
        `“${category.name}” 카테고리를 사용하는 기록이 있어 삭제할 수 없습니다. 먼저 기록의 카테고리를 변경하세요.`,
      );
      return;
    }
    if (!window.confirm(`“${category.name}” 카테고리를 삭제할까요?`)) return;
    try {
      await incidentCaseService.deleteCategory(category.id);
      setNoticeMessage("카테고리를 삭제했습니다.");
      if (editingCategoryId === category.id) resetCategoryEditor();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "카테고리를 삭제하지 못했습니다.",
      );
    }
  };

  const uploadErrorRowCount =
    uploadPreview?.result.previewRows.filter((row) => row.errors.length > 0)
      .length || 0;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-7 text-white lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-indigo-200">
              <ShieldCheck size={18} /> 제한 접근 기록
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              사건·사고 기록 관리
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              이름, 생년월일, 기록, 카테고리를 한 곳에서 등록·수정·삭제하고
              검색합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => void handleUploadFile(event)}
            />
            <button
              type="button"
              disabled={isDownloadingExcel || isImporting}
              onClick={() => void downloadUploadTemplate()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={16} /> 업로드 양식
            </button>
            <button
              type="button"
              disabled={isDownloadingExcel || isImporting}
              onClick={() => uploadInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImporting ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Upload size={16} />
              )}{" "}
              Excel 업로드
            </button>
            <button
              type="button"
              disabled={isDownloadingExcel || isImporting}
              onClick={() => void downloadRecords()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={16} /> Excel 다운로드
            </button>
            <button
              type="button"
              onClick={() => {
                resetCategoryEditor();
                setIsCategoryOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15"
            >
              <Filter size={16} /> 카테고리 관리
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-indigo-50"
            >
              <Plus size={17} /> 행 추가
            </button>
          </div>
        </div>
        <div className="grid gap-3 border-t border-white/10 bg-slate-50 p-4 sm:p-5">
          <Metric
            label="전체 기록"
            value={records.length}
            icon={<FileText size={18} />}
            tone="slate"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-amber-700" size={19} />
          <p>
            <strong>개인정보 안내:</strong> 이름과 생년월일을 포함한 사건·사고
            기록입니다. 업무상 필요한 범위에서만 입력하고, 권한이 있는 담당자만
            접근하도록 관리하세요.
          </p>
        </div>
      </section>
      {(errorMessage || noticeMessage) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm whitespace-pre-line ${errorMessage ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {errorMessage || noticeMessage}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="기록 · 이름 · 생년월일 · 카테고리 검색"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={categoryFilter === "all"}
              onClick={() => setCategoryFilter("all")}
              className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-indigo-100 ${
                categoryFilter === "all"
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              전체
            </button>
            {categories.map((category) => {
              const isSelected = categoryFilter === category.id;
              const color = getCategoryColor(category.color);
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setCategoryFilter(category.id)}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  style={
                    isSelected
                      ? {
                          backgroundColor: color,
                          borderColor: color,
                          color: getCategoryButtonTextColor(color),
                        }
                      : getCategorySurfaceStyle(color)
                  }
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: color }}
                  />
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center gap-2 text-sm font-medium text-slate-500">
            <Loader2 className="animate-spin" size={20} /> 기록을 불러오는
            중입니다.
          </div>
        ) : filteredRecords.length === 0 && !isCreatingInline ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
            <ClipboardCheck size={42} className="mb-3 text-slate-300" />
            <h2 className="font-bold text-slate-800">
              표시할 기록이 없습니다.
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              새 기록을 등록하거나 검색 조건을 바꾸세요.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">카테고리</th>
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">생년월일</th>
                  <th className="px-4 py-3">기록</th>
                  <th className="px-5 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isCreatingInline && (
                  <InlineCreateRow
                    draft={draft}
                    categories={activeCategories}
                    isSaving={isSaving}
                    onChange={setDraft}
                    onSave={() => void saveRecord()}
                    onCancel={cancelInlineEdit}
                  />
                )}
                {filteredRecords.map((record) => {
                  return (
                    <tr
                      key={record.id}
                      className="align-top transition hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-4">
                        <CategorySelect
                          categories={
                            activeCategories.some(
                              (category) => category.id === record.categoryId,
                            )
                              ? activeCategories
                              : [
                                  ...(categoryById.has(record.categoryId)
                                    ? [categoryById.get(record.categoryId)!]
                                    : []),
                                  ...activeCategories,
                                ]
                          }
                          value={record.categoryId}
                          disabled={
                            savingRecordId === record.id ||
                            editingCell?.recordId === record.id
                          }
                          onChange={(categoryId) =>
                            void changeRecordCategory(record, categoryId)
                          }
                        />
                      </td>
                      <DirectEditableCell
                        record={record}
                        field="personName"
                        editingCell={editingCell}
                        editingValue={editingValue}
                        isSaving={savingRecordId === record.id}
                        onStart={beginCellEdit}
                        onChange={setEditingValue}
                        onCommit={() => void commitCellEdit(record)}
                      />
                      <DirectEditableCell
                        record={record}
                        field="birthDate"
                        editingCell={editingCell}
                        editingValue={editingValue}
                        isSaving={savingRecordId === record.id}
                        onStart={beginCellEdit}
                        onChange={setEditingValue}
                        onCommit={() => void commitCellEdit(record)}
                      />
                      <DirectEditableCell
                        record={record}
                        field="title"
                        editingCell={editingCell}
                        editingValue={editingValue}
                        isSaving={savingRecordId === record.id}
                        onStart={beginCellEdit}
                        onChange={setEditingValue}
                        onCommit={() => void commitCellEdit(record)}
                      />
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <IconButton
                            label="삭제"
                            danger
                            onClick={() => void deleteRecord(record)}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/*
        <Dialog
          title={
            editingRecordId ? "사건·사고 기록 수정" : "사건·사고 기록 등록"
          }
          onClose={() => setIsEditorOpen(false)}
        >
          <form onSubmit={saveRecord} className="space-y-5">
            <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm leading-6 text-indigo-900">
              이름과 생년월일은 본인 확인을 위한 필수 정보입니다. 기록은 확인된
              사실을 중심으로 작성하세요.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="이름" required>
                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                  />
                  <input
                    required
                    maxLength={40}
                    value={draft.personName}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        personName: event.target.value,
                      }))
                    }
                    placeholder="홍길동"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
                  />
                </div>
              </Field>
              <Field
                label="생년월일"
                required
                hint="오류나 비표준 값도 원문 그대로 저장됩니다."
              >
                <input
                  required
                  type="text"
                  maxLength={20}
                  value={draft.birthDate}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      birthDate: event.target.value,
                    }))
                  }
                  placeholder="예: 1990-02-30"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                />
              </Field>
              <Field
                label="기록"
                required
                hint="확인된 사실을 간단히 입력하세요."
              >
                <div className="relative">
                  <Tag
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                  />
                  <input
                    required
                    maxLength={120}
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="예: 주차장 접촉 사고"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
                  />
                </div>
              </Field>
              <Field label="카테고리" required>
                <select
                  required
                  value={draft.categoryId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      categoryId: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                >
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="발생일(선택)">
                <input
                  type="date"
                  value={draft.incidentDate || ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      incidentDate: event.target.value || null,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                취소
              </button>
              <button
                disabled={isSaving}
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {isSaving && <Loader2 className="animate-spin" size={16} />}
                {editingRecordId ? "수정 저장" : "기록 등록"}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      */}
      {uploadPreview && (
        <Dialog
          title="Excel 업로드 미리보기"
          onClose={() => setUploadPreview(null)}
        >
          <div className="space-y-5">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {uploadPreview.fileName}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                아래 자료를 검수한 뒤 등록하세요. 오류가 있는 행은 등록에서
                제외되며, 생년월일 형식 오류는 원문 그대로 등록할 수 있습니다.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="불러온 행"
                value={uploadPreview.result.previewRows.length}
                icon={<FileText size={18} />}
                tone="slate"
              />
              <Metric
                label="등록 가능"
                value={uploadPreview.result.records.length}
                icon={<ClipboardCheck size={18} />}
                tone="violet"
              />
              <Metric
                label="오류 행"
                value={uploadErrorRowCount}
                icon={<AlertTriangle size={18} />}
                tone="orange"
              />
            </div>
            {uploadPreview.result.skippedRows > 0 && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                빈 행 {uploadPreview.result.skippedRows}건은 제외했습니다.
              </p>
            )}
            <div className="max-h-[48vh] overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-[840px] w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 font-bold text-slate-600">
                  <tr>
                    <th className="px-3 py-3">행</th>
                    <th className="px-3 py-3">이름</th>
                    <th className="px-3 py-3">생년월일</th>
                    <th className="px-3 py-3">기록</th>
                    <th className="px-3 py-3">카테고리</th>
                    <th className="px-3 py-3">발생일</th>
                    <th className="px-3 py-3">검수 결과</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uploadPreview.result.previewRows.map((row) => (
                    <tr
                      key={row.sourceRow}
                      className={
                        row.errors.length > 0 ? "bg-rose-50/70" : "bg-white"
                      }
                    >
                      <td className="px-3 py-3 font-mono text-slate-500">
                        {row.sourceRow}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-800">
                        {row.personName || "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {row.birthDate || "-"}
                      </td>
                      <td className="max-w-[300px] px-3 py-3 font-medium leading-5 text-slate-800">
                        {row.record || "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {row.category || "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {row.incidentDate || "-"}
                      </td>
                      <td className="max-w-[250px] px-3 py-3 leading-5">
                        {row.errors.length > 0 ? (
                          <span className="font-medium text-rose-700">
                            {row.errors.join(" ")}
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700">
                            등록 가능
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setUploadPreview(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                disabled={
                  isImporting || uploadPreview.result.records.length === 0
                }
                onClick={() => void confirmUpload()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting && <Loader2 className="animate-spin" size={16} />}
                {uploadPreview.result.records.length.toLocaleString()}건 등록
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {isCategoryOpen && (
        <Dialog
          title="카테고리 관리"
          onClose={() => {
            setIsCategoryOpen(false);
            resetCategoryEditor();
          }}
        >
          <p className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-600">
            필요한 카테고리를 직접 추가해 사용하세요. 사용 중인 카테고리는
            기록의 카테고리를 먼저 변경한 뒤 삭제할 수 있습니다.
          </p>
          <form
            onSubmit={saveCategory}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_110px_auto] sm:items-end"
          >
            <Field label="카테고리 이름">
              <input
                required
                maxLength={40}
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="예: 보험 처리"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
            </Field>
            <Field label="표시 색상">
              <input
                type="color"
                value={categoryColor}
                onChange={(event) => setCategoryColor(event.target.value)}
                className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
              />
            </Field>
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
            >
              {editingCategoryId ? "수정" : "추가"}
            </button>
          </form>
          <div className="mt-5 max-h-80 space-y-2 overflow-y-auto">
            {customCategories.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                추가한 카테고리가 없습니다.
              </p>
            ) : (
              customCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: category.color }}
                    />
                    <span className="text-sm font-bold text-slate-800">
                      {category.name}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <IconButton
                      label="수정"
                      onClick={() => {
                        setEditingCategoryId(category.id);
                        setCategoryName(category.name);
                        setCategoryColor(category.color);
                      }}
                    >
                      <Edit3 size={15} />
                    </IconButton>
                    <IconButton
                      label="삭제"
                      danger
                      onClick={() => void deleteCategory(category)}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
};

const InlineCreateRow: React.FC<{
  draft: RecordDraft;
  categories: IncidentCaseCategory[];
  isSaving: boolean;
  onChange: React.Dispatch<React.SetStateAction<RecordDraft>>;
  onSave: () => void;
  onCancel: () => void;
}> = ({ draft, categories, isSaving, onChange, onSave, onCancel }) => (
  <tr className="bg-indigo-50/70 align-top">
    <td className="px-4 py-3">
      <CategorySelect
        categories={categories}
        value={draft.categoryId}
        onChange={(categoryId) =>
          onChange((current) => ({ ...current, categoryId }))
        }
      />
    </td>
    <td className="px-4 py-3">
      <input
        aria-label="이름"
        required
        maxLength={40}
        value={draft.personName}
        onChange={(event) =>
          onChange((current) => ({
            ...current,
            personName: event.target.value,
          }))
        }
        placeholder="이름"
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-indigo-400"
      />
    </td>
    <td className="px-4 py-3">
      <input
        aria-label="생년월일"
        required
        maxLength={20}
        value={draft.birthDate}
        onChange={(event) =>
          onChange((current) => ({ ...current, birthDate: event.target.value }))
        }
        placeholder="생년월일"
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-indigo-400"
      />
    </td>
    <td className="px-4 py-3">
      <input
        aria-label="기록"
        required
        maxLength={120}
        value={draft.title}
        onChange={(event) =>
          onChange((current) => ({ ...current, title: event.target.value }))
        }
        placeholder="기록"
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-indigo-400"
      />
    </td>
    <td className="px-5 py-3">
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-60"
        >
          취소
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onSave}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {isSaving && <Loader2 className="animate-spin" size={14} />}등록
        </button>
      </div>
    </td>
  </tr>
);

const CategorySelect: React.FC<{
  categories: IncidentCaseCategory[];
  value: string;
  disabled?: boolean;
  onChange: (categoryId: string) => void;
}> = ({ categories, value, disabled = false, onChange }) => {
  const selectedCategory = categories.find((category) => category.id === value);
  const color = getCategoryColor(selectedCategory?.color);

  return (
    <div
      className="flex min-w-[150px] items-center gap-2 rounded-lg border px-2.5 py-1.5 transition focus-within:ring-4 focus-within:ring-indigo-100"
      style={getCategorySurfaceStyle(color)}
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
        style={{ backgroundColor: color }}
      />
      <select
        aria-label="카테고리"
        required
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 bg-transparent py-0.5 text-sm font-bold text-slate-800 outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  );
};

const DirectEditableCell: React.FC<{
  record: IncidentCase;
  field: DirectRecordField;
  editingCell: EditingCell | null;
  editingValue: string;
  isSaving: boolean;
  onStart: (record: IncidentCase, field: DirectRecordField) => void;
  onChange: (value: string) => void;
  onCommit: () => void;
}> = ({
  record,
  field,
  editingCell,
  editingValue,
  isSaving,
  onStart,
  onChange,
  onCommit,
}) => {
  const isEditing =
    editingCell?.recordId === record.id && editingCell.field === field;
  const maxLength =
    field === "personName" ? 40 : field === "birthDate" ? 20 : 120;
  return (
    <td className="px-4 py-3">
      {isEditing ? (
        <input
          autoFocus
          required
          maxLength={maxLength}
          value={editingValue}
          disabled={isSaving}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="w-full rounded-lg border border-indigo-300 bg-white px-2.5 py-2 text-sm outline-none ring-4 ring-indigo-50"
        />
      ) : (
        <button
          type="button"
          onClick={() => onStart(record, field)}
          className="min-h-9 w-full rounded-lg px-2.5 py-2 text-left font-medium text-slate-800 transition hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none"
        >
          {record[field] || "-"}
        </button>
      )}
    </td>
  );
};


const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <label className="block text-sm font-bold text-slate-700">
    <span>
      {label}
      {required && <span className="ml-1 text-rose-600">*</span>}
    </span>
    <div className="mt-1.5">{children}</div>
    {hint && (
      <p className="mt-1.5 text-xs font-normal leading-5 text-slate-500">
        {hint}
      </p>
    )}
  </label>
);
const Metric: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "slate" | "violet" | "orange";
}> = ({ label, value, icon, tone }) => {
  const styles = {
    slate: "border-slate-200 bg-white text-slate-700",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
  }[tone];
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${styles}`}
    >
      <div className="rounded-lg bg-white/80 p-2 shadow-sm">{icon}</div>
      <div>
        <p className="text-xs font-bold opacity-70">{label}</p>
        <p className="mt-0.5 text-xl font-black">{value}</p>
      </div>
    </div>
  );
};
const IconButton: React.FC<{
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, danger, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${danger ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}
  >
    {children}
  </button>
);
const Dialog: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, onClose, children }) => (
  <div
    className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5"
    role="dialog"
    aria-modal="true"
    aria-label={title}
  >
    <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
        <h2 className="text-lg font-black text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  </div>
);

export default IncidentCaseRegisterPage;
