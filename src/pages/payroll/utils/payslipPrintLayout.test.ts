import { calculatePayslipPrintScale } from './payslipPrintLayout';

describe('calculatePayslipPrintScale', () => {
  it('keeps a payslip that already fits at full size', () => {
    expect(calculatePayslipPrintScale({
      pageWidth: 733,
      pageHeight: 1062,
      contentWidth: 733,
      contentHeight: 980,
    })).toBe(1);
  });

  it('shrinks a tall payslip to one portrait page', () => {
    expect(calculatePayslipPrintScale({
      pageWidth: 733,
      pageHeight: 1062,
      contentWidth: 733,
      contentHeight: 1327.5,
    })).toBeCloseTo(0.8, 5);
  });

  it('uses the tighter of the width and height constraints', () => {
    expect(calculatePayslipPrintScale({
      pageWidth: 733,
      pageHeight: 1062,
      contentWidth: 916.25,
      contentHeight: 1180,
    })).toBeCloseTo(0.8, 5);
  });

  it('falls back to full size before measurable dimensions are available', () => {
    expect(calculatePayslipPrintScale({
      pageWidth: 0,
      pageHeight: 0,
      contentWidth: 0,
      contentHeight: 0,
    })).toBe(1);
  });
});
