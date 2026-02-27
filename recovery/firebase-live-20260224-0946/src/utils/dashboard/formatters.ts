
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 금액 포맷팅 (원 단위, 3자리 콤마)
 * 예: 1,234,567원
 */
export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
};

/**
 * 금액 포맷팅 (축약형 - 백만/억)
 * 예: 1.2억, 5,300만
 */
export const formatCurrencyShort = (amount: number): string => {
    if (amount >= 100000000) {
        return (amount / 100000000).toFixed(1) + '억';
    }
    if (amount >= 1000000) {
        return (amount / 1000000).toFixed(0) + '백만';
    }
    return new Intl.NumberFormat('ko-KR').format(amount);
};

/**
 * 공수 포맷팅 (소수점 1자리)
 * 예: 15.5공수
 */
export const formatManDay = (manDay: number): string => {
    return manDay.toFixed(1) + '공수';
};

/**
 * 날짜 포맷팅 (YYYY.MM.DD)
 */
export const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        return format(parseISO(dateStr), 'yyyy.MM.dd');
    } catch (e) {
        return dateStr;
    }
};

/**
 * 날짜 포맷팅 (MM.DD 요일)
 */
export const formatDateWithDay = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        return format(parseISO(dateStr), 'MM.dd(eee)', { locale: ko });
    } catch (e) {
        return dateStr;
    }
};

/**
 * 증감률 포맷팅
 * 예: +12.5%, -5.2%
 */
export const formatTrend = (value: number): string => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
};
