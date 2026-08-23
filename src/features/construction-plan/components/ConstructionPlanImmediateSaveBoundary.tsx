import React, { useEffect, useRef } from 'react';

type ConstructionPlanImmediateSaveBoundaryProps = {
  children: React.ReactNode;
  className?: string;
  enabled: boolean;
  onImmediateSave: () => void | Promise<void>;
};

export const isConstructionPlanSaveField = (target: EventTarget | null): target is HTMLElement => (
  target instanceof HTMLElement
  && target.matches('input, textarea, select, [contenteditable="true"]')
  && !target.matches(':disabled, [readonly], [aria-readonly="true"]')
);

export default function ConstructionPlanImmediateSaveBoundary({
  children,
  className,
  enabled,
  onImmediateSave,
}: ConstructionPlanImmediateSaveBoundaryProps) {
  const timerRef = useRef<number>();

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const handleBlurCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!enabled || !isConstructionPlanSaveField(event.target)) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      void onImmediateSave();
    }, 0);
  };

  return <div className={className} onBlurCapture={handleBlurCapture}>{children}</div>;
}
