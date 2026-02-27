import React, { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    PieChart,
    Pie
} from 'recharts';
import Swal from 'sweetalert2';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';
import { officeService, OfficeTransaction, OfficeTransactionCategory } from '../../services/officeService';
import { toast } from '../../utils/swal';
import { format } from 'date-fns';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR').format(value);
};

const CATEGORY_LABELS: Record<OfficeTransactionCategory, string> = {
    'TEAM_FEE': '팀 관리비',
    'SALES_GOODS': '물품 판매',
    'SITE_PAYBACK': '현장 바이백',
    'OTHER_INCOME': '기타 수입',
    'SALARY_STAFF': '직원 급여',
    'OFFICE_RENT': '사무실 월세',
    'UTILITIES': '공과금',
    'RENTAL_FEE': '렌트비',
    'GENERAL_EXPENSE': '일반 지출'
};

const INCOME_CATEGORIES: OfficeTransactionCategory[] = ['TEAM_FEE', 'SALES_GOODS', 'SITE_PAYBACK', 'OTHER_INCOME'];
const EXPENSE_CATEGORIES: OfficeTransactionCategory[] = ['SALARY_STAFF', 'OFFICE_RENT', 'UTILITIES', 'RENTAL_FEE', 'GENERAL_EXPENSE'];

export const OfficeManagementPage: React.FC = () => {
    const [yearMonth, setYearMonth] = useState(() => format(new Date(), 'yyyy-MM'));
    const [transactions, setTransactions] = useState<OfficeTransaction[]>([]);
    const [annualTransactions, setAnnualTransactions] = useState<OfficeTransaction[]>([]);
    const [loading, setLoading] = useState(false);

    // Load Data
    useEffect(() => {
        fetchData();
        fetchAnnualData();
    }, [yearMonth]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await officeService.getTransactionsByMonth(yearMonth);
            setTransactions(data);
        } catch (error) {
            console.error(error);
            toast.error('데이터 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    const fetchAnnualData = async () => {
        try {
            // Fetch data for the whole year of the selected month
            const year = yearMonth.split('-')[0];
            const start = `${year}-01-01`;
            const end = `${year}-12-31`;
            const data = await officeService.getTransactionsByRange(start, end);
            setAnnualTransactions(data);
        } catch (error) {
            console.error("Failed to fetch annual data", error);
        }
    };

    // Dashboard Metrics (Current Month)
    const metrics = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const profit = income - expense;
        return { income, expense, profit };
    }, [transactions]);

    // Chart Data (Annual Trend)
    const trendData = useMemo(() => {
        const monthlyData: Record<string, { month: string, income: number, expense: number, profit: number }> = {};

        // Initialize all 12 months
        const year = yearMonth.split('-')[0];
        for (let i = 1; i <= 12; i++) {
            const m = String(i).padStart(2, '0');
            const key = `${year}-${m}`;
            monthlyData[key] = { month: `${m}월`, income: 0, expense: 0, profit: 0 };
        }

        annualTransactions.forEach(t => {
            const monthKey = t.date.slice(0, 7); // YYYY-MM
            if (monthlyData[monthKey]) {
                if (t.type === 'income') monthlyData[monthKey].income += t.amount;
                else monthlyData[monthKey].expense += t.amount;
            }
        });

        // Calculate profit
        Object.keys(monthlyData).forEach(key => {
            monthlyData[key].profit = monthlyData[key].income - monthlyData[key].expense;
        });

        return Object.values(monthlyData);
    }, [annualTransactions, yearMonth]);

    // Pie Chart Data (Expense Breakdown - Current Month)
    const expenseBreakdown = useMemo(() => {
        const breakdown: Record<string, number> = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            const cat = CATEGORY_LABELS[t.category] || t.category;
            breakdown[cat] = (breakdown[cat] || 0) + t.amount;
        });
        return Object.keys(breakdown).map(k => ({ name: k, value: breakdown[k] }));
    }, [transactions]);

    // Add Transaction Handler
    const handleAdd = () => {
        Swal.fire({
            title: '거래 내역 추가',
            html: `
        <div class="space-y-3 text-left">
            <div>
                <label class="block text-sm font-medium text-slate-700">날짜</label>
                <input id="swal-date" type="date" class="w-full border rounded px-3 py-2" value="${yearMonth}-01">
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700">유형</label>
                <select id="swal-type" class="w-full border rounded px-3 py-2" onchange="window.updateCategories(this.value)">
                    <option value="income">수입</option>
                    <option value="expense">지출</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700">카테고리</label>
                <select id="swal-category" class="w-full border rounded px-3 py-2">
                    <!-- Options populated by JS -->
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700">금액</label>
                <input id="swal-amount" type="number" class="w-full border rounded px-3 py-2" placeholder="0">
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700">내용 (메모)</label>
                <input id="swal-desc" type="text" class="w-full border rounded px-3 py-2" placeholder="내용 입력">
            </div>
        </div>
      `,
            didOpen: () => {
                // Helper to update categories based on type
                const typeSelect = document.getElementById('swal-type') as HTMLSelectElement;
                const catSelect = document.getElementById('swal-category') as HTMLSelectElement;

                (window as any).updateCategories = (type: string) => {
                    const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
                    catSelect.innerHTML = cats.map(c => `<option value="${c}">${CATEGORY_LABELS[c]}</option>`).join('');
                };

                // Initialize
                (window as any).updateCategories(typeSelect.value);
            },
            showCancelButton: true,
            confirmButtonText: '저장',
            cancelButtonText: '취소',
            preConfirm: () => {
                const date = (document.getElementById('swal-date') as HTMLInputElement).value;
                const type = (document.getElementById('swal-type') as HTMLSelectElement).value as 'income' | 'expense';
                const category = (document.getElementById('swal-category') as HTMLSelectElement).value as OfficeTransactionCategory;
                const amount = Number((document.getElementById('swal-amount') as HTMLInputElement).value);
                const description = (document.getElementById('swal-desc') as HTMLInputElement).value;

                if (!date || !category || !amount) {
                    Swal.showValidationMessage('필수 항목을 모두 입력해주세요.');
                    return false;
                }
                return { date, type, category, amount, description };
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                try {
                    const id = `manual_${Date.now()}`;
                    const newTransaction: OfficeTransaction = {
                        id,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        ...result.value
                    };
                    await officeService.setTransaction(newTransaction);
                    toast.success('저장되었습니다.');
                    fetchData();
                    fetchAnnualData(); // Update charts too
                } catch (e) {
                    console.error(e);
                    toast.error('저장 실패');
                }
            }
        });
    };

    // Delete Handler
    const handleDelete = (id: string) => {
        Swal.fire({
            title: '삭제하시겠습니까?',
            text: '삭제된 데이터는 복구할 수 없습니다.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '삭제',
            confirmButtonColor: '#ef4444'
        }).then(async (res) => {
            if (res.isConfirmed) {
                try {
                    await officeService.deleteTransaction(id);
                    toast.success('삭제 완료');
                    fetchData();
                    fetchAnnualData();
                } catch (e) {
                    console.error(e);
                    toast.error('삭제 실패');
                }
            }
        });
    };

    // AG Grid Column Defs
    const colDefs: ColDef<OfficeTransaction>[] = [
        { field: 'date', headerName: '날짜', width: 120, sortable: true },
        {
            field: 'type',
            headerName: '구분',
            width: 80,
            cellRenderer: (params: any) => {
                const isIncome = params.value === 'income';
                return (
                    <span className={`px-2 py-1 rounded text-xs font-bold ${isIncome ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                        {isIncome ? '수입' : '지출'}
                    </span>
                );
            }
        },
        {
            field: 'category',
            headerName: '카테고리',
            width: 150,
            valueFormatter: (params) => CATEGORY_LABELS[params.value as OfficeTransactionCategory] || params.value
        },
        { field: 'description', headerName: '내용', flex: 1 },
        {
            field: 'amount',
            headerName: '금액',
            width: 120,
            type: 'rightAligned',
            valueFormatter: (params: ValueFormatterParams) => formatCurrency(params.value),
            cellStyle: (params) => ({
                color: params.data?.type === 'income' ? '#2563eb' : '#dc2626',
                fontWeight: '600'
            })
        },
        {
            headerName: '관리',
            width: 80,
            cellRenderer: (params: any) => (
                <button
                    onClick={() => handleDelete(params.data.id)}
                    className="text-red-500 hover:text-red-700 text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50"
                >
                    삭제
                </button>
            )
        }
    ];

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div className="w-full p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">사무실 관리</h1>
                    <p className="text-slate-500 text-sm mt-1">사무실 수입/지출 및 자금 흐름을 관리합니다.</p>
                </div>
                <div>
                    <YearMonthPicker value={yearMonth} onChange={setYearMonth} />
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="text-sm text-slate-500 font-medium">총 수입 (Current Month)</div>
                    <div className="text-3xl font-extrabold text-blue-600 mt-2">{formatCurrency(metrics.income)}원</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="text-sm text-slate-500 font-medium">총 지출 (Current Month)</div>
                    <div className="text-3xl font-extrabold text-red-600 mt-2">{formatCurrency(metrics.expense)}원</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="text-sm text-slate-500 font-medium">순이익 (Net Profit)</div>
                    <div className={`text-3xl font-extrabold mt-2 ${metrics.profit >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {formatCurrency(metrics.profit)}원
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">연간 자금 흐름 ({yearMonth.split('-')[0]}년)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis tickFormatter={(val) => `${val / 10000}만`} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(val: any) => formatCurrency(Number(val || 0))} />
                                <Legend />
                                <Bar dataKey="income" name="수입" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" name="지출" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">지출 내역 ({yearMonth})</h3>
                    <div className="h-64 flex items-center justify-center">
                        {expenseBreakdown.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={expenseBreakdown}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {expenseBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val: any) => formatCurrency(Number(val || 0))} />
                                    <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-slate-400 text-sm">지출 내역이 없습니다.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Ledger Grid */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800">거래 명세서 (Transaction Ledger)</h3>
                    <button
                        onClick={handleAdd}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                        + 거래 내역 추가
                    </button>
                </div>
                <div className="ag-theme-alpine w-full h-[500px]">
                    <AgGridReact
                        rowData={transactions}
                        columnDefs={colDefs}
                        defaultColDef={{ resizable: true }}
                        animateRows={true}
                        rowSelection="multiple"
                    />
                </div>
            </div>
        </div>
    );
};

export default OfficeManagementPage;
