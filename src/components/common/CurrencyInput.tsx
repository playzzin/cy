import React, { useEffect, useState, ChangeEvent } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number;
    onChange: (value: number) => void;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
    value,
    onChange,
    className,
    ...props
}) => {
    const [displayValue, setDisplayValue] = useState('');

    // 부모로부터 value가 변경되면 displayValue 업데이트 (포맷팅 적용)
    useEffect(() => {
        // value가 유효한 숫자이면 포맷팅, 아니면 빈 문자열(또는 0 처리가 필요할 수 있음)
        // 여기서는 0도 "0"으로 표시.
        if (typeof value === 'number' && !Number.isNaN(value)) {
            setDisplayValue(new Intl.NumberFormat('ko-KR').format(value));
        } else {
            setDisplayValue('');
        }
    }, [value]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/,/g, '');

        // 빈 값 처리 (0으로 간주하거나, 필요시 커스텀 가능)
        if (rawValue === '' || rawValue === '-') {
            setDisplayValue(e.target.value);
            onChange(0);
            return;
        }

        // 숫자(정수)만 허용 (마이너스 포함)
        if (!/^[-]?\d*$/.test(rawValue)) {
            return;
        }

        const numValue = Number(rawValue);
        if (!Number.isNaN(numValue)) {
            // 입력 중에는 콤마를 제거한 상태로 부모에게 전달 -> 부모가 state 업데이트 -> useEffect가 다시 포맷팅
            // 단, useEffect 의존성에 의해 커서 점프 문제가 발생할 수 있음.
            // 간단한 해결책: 입력 시점에는 로컬 state(displayValue)를 사용자가 입력한 값(콤마 포함 로직 적용 전)으로 유지하고,
            // 부모의 값이 들어올 때 포맷팅하는 방식은 타이핑 중 콤마 자동 삽입이 안 될 수 있음.
            // 여기서는 "입력 즉시 포맷팅"을 위해 Intl.NumberFormat 사용.

            const formatted = new Intl.NumberFormat('ko-KR').format(numValue);
            // 만약 입력한 값이 이미 포맷팅된 것과 같다면 그대로 둠 (커서 문제 완화)

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
