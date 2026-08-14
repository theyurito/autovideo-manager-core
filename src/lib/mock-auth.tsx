import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** Mock-only auth. No backend, no storage — state lives in memory for this session. */
export const AUTHORIZED_EMAIL = "marcosyurisepol@gmail.com";
export const MOCK_OTP = "123456";

type AuthState = {
  isAuthenticated: boolean;
  email: string | null;
  signIn: (email: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated: email !== null,
      email,
      signIn: (value: string) => setEmail(value),
      signOut: () => setEmail(null),
    }),
    [email],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useMockAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useMockAuth must be used inside MockAuthProvider");
  return ctx;
}
