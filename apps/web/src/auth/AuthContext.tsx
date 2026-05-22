/**
 * AuthContext — non-blocking sign-in for the local-first PWA (r.md §6).
 *
 * The app keeps running offline without a session; we only surface the sign-in
 * dialog when the user reaches for a cloud-bound action (sync, AI calls that
 * return 401, etc.). `requireSignIn()` returns a promise that resolves once
 * the user finishes the magic-code flow.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  AUTH_TOKEN_KEY,
  endSession,
  fetchMe,
  loadStoredToken,
  requestLoginCode,
  storeToken,
  UnauthorizedError,
  verifyLoginCode,
  type AuthUser,
  type FarmMembership,
} from "./authClient";

type AuthState = {
  status: "loading" | "anonymous" | "authed";
  token: string | null;
  user: AuthUser | null;
  memberships: FarmMembership[];
};

type SignInResult = AuthUser;

type SignInResolver = {
  resolve: (user: SignInResult) => void;
  reject: (err: Error) => void;
};

export type AuthContextValue = {
  state: AuthState;
  /** True if a session token is present (user is presumed signed-in). */
  isAuthed: boolean;
  /** Opens the sign-in dialog and resolves once the user is authed. */
  requireSignIn: () => Promise<SignInResult>;
  /** Opens the dialog without waiting. */
  openSignIn: () => void;
  /** Imperatively close the dialog. */
  closeSignIn: () => void;
  /** Whether the dialog is currently visible. */
  signInOpen: boolean;
  /** Step 1 — request a magic code by email. */
  requestCode: (email: string) => Promise<{ devCode?: string }>;
  /** Step 2 — verify the code and complete sign-in. */
  verifyCode: (email: string, code: string) => Promise<AuthUser>;
  /** Sign out + clear local token. */
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider(props: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    status: typeof localStorage === "undefined" ? "anonymous" : (loadStoredToken() ? "loading" : "anonymous"),
    token: loadStoredToken(),
    user: null,
    memberships: [],
  }));
  const [signInOpen, setSignInOpen] = useState(false);
  const pendingResolvers = useRef<SignInResolver[]>([]);

  const setAuthed = useCallback((token: string, user: AuthUser, memberships: FarmMembership[]) => {
    storeToken(token);
    setState({ status: "authed", token, user, memberships });
  }, []);

  const clearAuth = useCallback(() => {
    storeToken(null);
    setState({ status: "anonymous", token: null, user: null, memberships: [] });
  }, []);

  // Hydrate from token on first mount.
  useEffect(() => {
    const stored = loadStoredToken();
    if (!stored) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchMe(stored);
        if (cancelled) return;
        setState({ status: "authed", token: stored, user: res.user, memberships: res.memberships });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) clearAuth();
        else setState((prev) => ({ ...prev, status: prev.token ? "authed" : "anonymous" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearAuth]);

  // Cross-tab sync: token changes elsewhere update us.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onStorage(e: StorageEvent) {
      if (e.key !== AUTH_TOKEN_KEY) return;
      const next = e.newValue;
      if (!next) clearAuth();
      else {
        setState({ status: "loading", token: next, user: null, memberships: [] });
        void fetchMe(next)
          .then((r) =>
            setState({ status: "authed", token: next, user: r.user, memberships: r.memberships }),
          )
          .catch(() => clearAuth());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clearAuth]);

  const resolvePending = useCallback((user: AuthUser) => {
    const list = pendingResolvers.current;
    pendingResolvers.current = [];
    for (const r of list) r.resolve(user);
  }, []);

  const rejectPending = useCallback((err: Error) => {
    const list = pendingResolvers.current;
    pendingResolvers.current = [];
    for (const r of list) r.reject(err);
  }, []);

  const openSignIn = useCallback(() => setSignInOpen(true), []);

  const closeSignIn = useCallback(() => {
    setSignInOpen(false);
    rejectPending(new Error("sign-in cancelled"));
  }, [rejectPending]);

  const requireSignIn = useCallback(() => {
    return new Promise<AuthUser>((resolve, reject) => {
      if (state.status === "authed" && state.user) {
        resolve(state.user);
        return;
      }
      pendingResolvers.current.push({ resolve, reject });
      setSignInOpen(true);
    });
  }, [state.status, state.user]);

  const requestCode = useCallback(async (email: string) => {
    const res = await requestLoginCode(email);
    return { devCode: res.devCode };
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      const { token, user } = await verifyLoginCode(email, code);
      const me = await fetchMe(token);
      setAuthed(token, me.user, me.memberships);
      setSignInOpen(false);
      resolvePending(me.user);
      return user;
    },
    [resolvePending, setAuthed],
  );

  const signOut = useCallback(async () => {
    const token = state.token;
    clearAuth();
    if (token) {
      try {
        await endSession(token);
      } catch {
        // best-effort
      }
    }
  }, [clearAuth, state.token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      isAuthed: state.status === "authed",
      requireSignIn,
      openSignIn,
      closeSignIn,
      signInOpen,
      requestCode,
      verifyCode,
      signOut,
    }),
    [state, requireSignIn, openSignIn, closeSignIn, signInOpen, requestCode, verifyCode, signOut],
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}
