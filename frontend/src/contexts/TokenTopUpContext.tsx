import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { TokenTopUpDialog } from "@/components/TokenTopUpDialog";

interface TokenTopUpContextValue {
  /** Show the token top-up dialog with an optional message. */
  showTopUp: (message?: string) => void;
}

const TokenTopUpContext = createContext<TokenTopUpContextValue>({
  showTopUp: () => {},
});

export function useTokenTopUp() {
  return useContext(TokenTopUpContext);
}

export function TokenTopUpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  const showTopUp = useCallback((msg?: string) => {
    setMessage(msg);
    setOpen(true);
  }, []);

  return (
    <TokenTopUpContext.Provider value={{ showTopUp }}>
      {children}
      {open && (
        <TokenTopUpDialog message={message} onClose={() => setOpen(false)} />
      )}
    </TokenTopUpContext.Provider>
  );
}
