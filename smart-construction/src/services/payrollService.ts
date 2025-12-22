import type { DailyReport, DailyReportWorker } from './dailyReportService';

export interface PayrollData {
    id: string; // Worker ID
    workerId?: string; // Optional alias if needed, or I'll just change usage in Invoice to .id
    name: string;
    role: string;
    gongsu: {
        total: number;
        reported: number;
        labor: number;
        remaining?: number;
    };
    unitPrice: number;
    grossPay: number;
    reportedGrossPay?: number;
    tax: {
        income: number;
        resident: number;
        nationalPension?: number;
        healthInsurance?: number;
        careInsurance?: number;
        employmentInsurance?: number;
    };
    deductions: {
        advance: number;
        accommodation: number;
        other: number;
    };
    netPay: number;
}

export const payrollService = {
    async getPayrollData(year: number, month: number, teamId?: string, siteId?: string): Promise<PayrollData[]> {
        try {
            const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDateStr = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

            // 1. Fetch Daily Reports for the period using dailyReportService
            const { dailyReportService } = await import('./dailyReportService');

            // Pass undefined for teamId if not provided, and pass siteId
            const reports = await dailyReportService.getReportsByRange(startDateStr, endDateStr, teamId, siteId);

            // 2. Fetch Deductions (Advance payments, etc.)
            // Assuming a 'deductions' collection exists. If not, this part will be empty for now.
            // const deductionsRef = collection(db, 'deductions');
            // const deductionsQuery = query(...);

            // Fetch Workser Master Data to check Salary Model
            const { manpowerService } = await import('./manpowerService');
            const workersMaster = await manpowerService.getWorkers();
            const workerMasterMap = new Map(workersMaster.map(w => [w.id, w]));

            // 3. Aggregate Data by Worker
            interface AggregatedWorker {
                id: string;
                name: string;
                role: string;
                totalManDay: number;
                unitPrice: number;
                totalGross: number;
                salaryModel: string;
                deductions: { advance: number; accommodation: number; other: number };
            }

            const workerMap = new Map<string, AggregatedWorker>();

            reports.forEach((report: DailyReport) => {
                if (report.workers && Array.isArray(report.workers)) {
                    report.workers.forEach((worker: DailyReportWorker) => {
                        const workerId = worker.workerId || worker.name; // Fallback to name if ID missing

                        const masterData = workerMasterMap.get(workerId);
                        const fallbackUnitPrice = Number(masterData?.unitPrice) || 0;
                        const snapshotUnitPrice =
                            typeof worker.unitPrice === 'number' && Number.isFinite(worker.unitPrice) ? worker.unitPrice : null;
                        const unitPrice = snapshotUnitPrice ?? fallbackUnitPrice;

                        const salaryModelSnapshot =
                            typeof worker.salaryModel === 'string' && worker.salaryModel.trim().length > 0
                                ? worker.salaryModel
                                : typeof worker.payType === 'string' && worker.payType.trim().length > 0
                                    ? worker.payType
                                    : masterData?.teamType === '지원팀'
                                        ? '지원팀'
                                        : masterData?.teamType === '용역팀'
                                            ? '용역팀'
                                            : '일급제';

                        if (!workerMap.has(workerId)) {
                            workerMap.set(workerId, {
                                id: workerId,
                                name: worker.name,
                                role: worker.role || '기능공', // Default role
                                totalManDay: 0,
                                unitPrice: unitPrice,
                                totalGross: 0,
                                salaryModel: salaryModelSnapshot,
                                deductions: { advance: 0, accommodation: 0, other: 0 }
                            });
                        }

                        const current = workerMap.get(workerId);
                        if (!current) return;
                        const manDay = Number(worker.manDay) || 0;

                        current.totalManDay += manDay;

                        // Default Daily Calculation
                        current.totalGross += (manDay * unitPrice);

                        // Update unit price to latest from report (snapshot)
                        current.unitPrice = unitPrice;

                        if (current.salaryModel !== salaryModelSnapshot && current.salaryModel !== '혼합') {
                            current.salaryModel = '혼합';
                        }
                    });
                }
            });

            // 4. Calculate Tax and Net Pay
            const payrollList: PayrollData[] = Array.from(workerMap.values()).map(worker => {
                const salaryModel = worker.salaryModel || '일급제';

                let grossPay = worker.totalGross;

                // Removed Fixed Monthly Override - Calculated as Daily per user request

                // Tax Calculation (3.3%)
                const incomeTax = Math.floor(grossPay * 0.03);
                const residentTax = Math.floor(incomeTax * 0.1);

                // Deductions (Placeholder)
                const advance = worker.deductions.advance;
                const accommodation = worker.deductions.accommodation;
                const other = worker.deductions.other;
                const totalDeductions = advance + accommodation + other;

                const netPay = grossPay - (incomeTax + residentTax) - totalDeductions;

                return {
                    id: worker.id,
                    workerId: worker.id,
                    name: worker.name,
                    role: worker.role,
                    gongsu: {
                        total: worker.totalManDay,
                        reported: worker.totalManDay, // Default to total
                        labor: worker.totalManDay
                    },
                    unitPrice: worker.unitPrice,
                    grossPay: grossPay,
                    reportedGrossPay: salaryModel === '월급제' ? worker.totalGross : undefined,
                    tax: {
                        income: incomeTax,
                        resident: residentTax
                    },
                    deductions: {
                        advance,
                        accommodation,
                        other
                    },
                    netPay: netPay
                };
            });

            return payrollList;

        } catch (error) {
            console.error("Error fetching payroll data:", error);
            return [];
        }
    }
};
