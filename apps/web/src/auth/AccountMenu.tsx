/**
 * Account chip rendered in the global map header.
 *
 *   - signed-out → "Sign in" button that opens the magic-code dialog
 *   - signed-in  → dropdown with the user's email + a sign-out item
 */
import { useTranslation } from "react-i18next";
import { LogIn, LogOut, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useAuth } from "./AuthContext";

export function AccountMenu() {
  const auth = useAuth();
  const { t } = useTranslation(["auth", "common"]);

  if (!auth.isAuthed) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="inline-flex items-center gap-1.5"
        onClick={() => auth.openSignIn()}
      >
        <LogIn className="h-4 w-4" aria-hidden />
        {t("auth:actions.signIn")}
      </Button>
    );
  }
  const user = auth.state.user;
  if (!user) return null;
  const label = user.name || user.email;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="inline-flex max-w-[12rem] items-center gap-1.5 truncate"
          title={user.email}
        >
          <UserRound className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-[16rem] truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void auth.signOut()}>
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          {t("auth:actions.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
