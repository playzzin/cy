import React, { useEffect, useState, ChangeEvent } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number;
    onChange: (value: number) => void;
    emptyWhenZero?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
    value,
    onChange,
    emptyWhenZero = false,
    className,
    ...props
}) => {
    const [displayValue, setDisplayValue] = useState('');

    // 부모로부터 value가 변경되면 displayValue 업데이트 (포맷팅 적용)
    useEffect(() => {
        // value가 유효한 숫자이면 포맷팅, 아니면 빈 문자열 처리
        if (typeof value === 'number' && !Number.isNaN(value)) {
            if (emptyWhenZero && value === 0) {
                setDisplayValue('');
                return;
            }
            setDisplayValue(new Intl.NumberFormat('ko-KR').format(value));
        } else {
            setDisplayValue('');
        }
    }, [emptyWhenZero, value]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/,/g, '');

        // 빈 값 처리 (0으로 간주하거나, 필요시 커스텀 가능)
        if (rawValue === '' || rawValue === '-') {
            setDisplayValue(rawValue);
            onChange(0);
            return;
        }

        // 숫자(정수)만 허용 (마이너스 포함)
        if (!/^[-]?\d*$/.test(rawValue)) {
            return;
        }

        const numValue = Number(rawValue);
        if (!Number.isNaN(numValue)) {
            setDisplayValue(e.target.value);
            onChange(numValue);
        }
    };

    return (
        <input
            type="text"
            className={className} // Tailwind 클래스 등 전달
            value={displayValue}
            onChange={handleChange}
            {...props}
        />
    );
};
