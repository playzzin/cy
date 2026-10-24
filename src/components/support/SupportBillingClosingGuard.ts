import { createContext, useContext, useEffect } from 'react';

export type RegisterSupportClosingBlock = (key: string, reason: string | null) => void;
const ignoreBlock: RegisterSupportClosingBlock = () => undefined;
export const SupportBillingClosingGuardContext = createContext<RegisterSupportClosingBlock>(ignoreBlock);

// The optional parent guard only controls the new closing entry point. A ledger
// rendered elsewhere retains its existing save and navigation behavior.
export const useSupportBillingClosingGuard = (key: string, reason: string | null): void => {
  const register = useContext(SupportBillingClosingGuardContext);
  useEffect(() => {
    register(key, reason);
    return () => register(key, null);
  }, [key, reason, register]);
};
