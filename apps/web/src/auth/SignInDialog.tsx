/**
 * Two-step magic-code sign-in dialog (r.md §6).
 *
 *   1. Enter email          → worker emails a 6-digit code (or returns it in dev)
 *   2. Enter the 6-digit code → session token persists in localStorage
 *
 * Rendered once at the app root; visibility is driven by AuthContext.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from "./AuthContext";

export function SignInDialog() {
  const auth = useAuth();
  const { t } = useTranslation(["auth", "common"]);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.signInOpen) {
      setStep("email");
      setCode("");
      setError(null);
      setDevCode(null);
      setBusy(false);
    }
  }, [auth.signInOpen]);

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await auth.requestCode(email.trim());
      if (res.devCode) setDevCode(res.devCode);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await auth.verifyCode(email.trim(), code.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={auth.signInOpen}
      onOpenChange={(open) => {
        if (!open) auth.closeSignIn();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("auth:dialog.title")}</DialogTitle>
          <DialogDescription>{t("auth:dialog.description")}</DialogDescription>
        </DialogHeader>
        {step === "email" ? (
          <form onSubmit={submitEmail} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">{t("auth:email.label")}</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={busy}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => auth.closeSignIn()}
                disabled={busy}
              >
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit" disabled={busy || email.length < 3}>
                {busy ? t("auth:email.sending") : t("auth:email.submit")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("auth:code.sentTo", { email })}
            </p>
            {devCode ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-mono text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                {t("auth:code.devLabel")} <strong>{devCode}</strong>
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="auth-code">{t("auth:code.label")}</Label>
              <Input
                id="auth-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\\d{6}"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                disabled={busy}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("email")}
                disabled={busy}
              >
                {t("auth:code.back")}
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => auth.closeSignIn()}
                  disabled={busy}
                >
                  {t("common:actions.cancel")}
                </Button>
                <Button type="submit" disabled={busy || code.length !== 6}>
                  {busy ? t("auth:code.verifying") : t("auth:code.submit")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
