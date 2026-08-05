import React, { forwardRef, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';

const pad2 = (n: number): string => String(n).padStart(2, '0');

const toDateFromYearMonth = (yearMonth: string): Date | null => {
  const m = String(yearMonth ?? '').trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
};

const toYearMonthFromDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}-${pad2(m)}`;
};

type YearMonthPickerInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  value?: string;
  externalInputRef?: React.Ref<HTMLInputElement>;
};

const assignInputRef = (ref: React.Ref<HTMLInputElement> | undefined, input: HTMLInputElement | null) => {
  if (typeof ref === 'function') ref(input);
  else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = input;
};

const YearMonthPickerInput = forwardRef<HTMLInputElement, YearMonthPickerInputProps>(
  ({ value, onClick, className, disabled, externalInputRef, ...rest }, ref) => {
    return (
      <input
        ref={(input) => {
          assignInputRef(ref, input);
          assignInputRef(externalInputRef, input);
        }}
        readOnly
        value={value ?? ''}
        onClick={onClick}
        disabled={disabled}
        className={className ?? ''}
        {...rest}
      />
    );
  }
);

YearMonthPickerInput.displayName = 'YearMonthPickerInput';

export type YearMonthPickerProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLElement>;
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  ariaLabel?: string;
  placeholderText?: string;
  portalId?: string;
  popperClassName?: string;
  minDate?: Date;
  maxDate?: Date;
};

export const YearMonthPicker: React.FC<YearMonthPickerProps> = ({
  value,
  onChange,
  disabled,
  className,
  inputClassName,
  inputRef,
  onBlur,
  onKeyDown,
  ariaLabel,
  placeholderText,
  portalId,
  popperClassName,
  minDate,
  maxDate
}) => {
  const selectedDate = useMemo(() => toDateFromYearMonth(value), [value]);

  type YearMonthPickerHeaderArgs = {
    date: Date;
    decreaseYear: () => void;
    increaseYear: () => void;
    prevYearButtonDisabled: boolean;
    nextYearButtonDisabled: boolean;
  };

  return (
    <div className={className ?? ''}>
      <DatePicker
        selected={selectedDate}
        onChange={(date: Date | null) => {
          if (!date) return;
          onChange(toYearMonthFromDate(date));
        }}
        locale={ko}
        dateFormat="yyyy년 MM월"
        showMonthYearPicker
        showPopperArrow
        disabled={disabled}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
        placeholderText={placeholderText}
        portalId={portalId}
        popperClassName={popperClassName}
        minDate={minDate}
        maxDate={maxDate}
        closeOnScroll
        renderCustomHeader={(args) => {
          const {
            date,
            decreaseYear,
            increaseYear,
            prevYearButtonDisabled,
            nextYearButtonDisabled
          } = args as unknown as YearMonthPickerHeaderArgs;

          return (
            <div className="flex items-center justify-center gap-2 px-2 py-1">
              <button
                type="button"
                onClick={decreaseYear}
                disabled={prevYearButtonDisabled}
                className="px-2 py-1 rounded border bg-white text-slate-600 disabled:opacity-40"
              >
                ‹
              </button>
              <div className="min-w-[64px] text-center font-bold text-slate-700">{date.getFullYear()}</div>
              <button
                type="button"
                onClick={increaseYear}
                disabled={nextYearButtonDisabled}
                className="px-2 py-1 rounded border bg-white text-slate-600 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          );
        }}
        customInput={(
          <YearMonthPickerInput
            externalInputRef={inputRef}
            className={
              inputClassName
              ?? 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-left'
            }
          />
        )}
      />
    </div>
  );
};
