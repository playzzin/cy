import { format, startOfMonth } from 'date-fns';

export const StartOfMonth = (date: Date): Date => {
    return startOfMonth(date);
};

export const FormatYearMonth = (date: Date): string => {
    return format(date, 'yyyy-MM');
};
