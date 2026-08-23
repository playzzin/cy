export interface PayslipPrintDimensions {
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  contentHeight: number;
}

export const calculatePayslipPrintScale = ({
  pageWidth,
  pageHeight,
  contentWidth,
  contentHeight,
}: PayslipPrintDimensions): number => {
  if (
    !Number.isFinite(pageWidth)
    || !Number.isFinite(pageHeight)
    || !Number.isFinite(contentWidth)
    || !Number.isFinite(contentHeight)
    || pageWidth <= 0
    || pageHeight <= 0
    || contentWidth <= 0
    || contentHeight <= 0
  ) {
    return 1;
  }

  return Math.min(1, pageWidth / contentWidth, pageHeight / contentHeight);
};
