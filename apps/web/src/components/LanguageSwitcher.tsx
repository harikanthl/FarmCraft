import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES, normalizeLanguage } from "@/i18n/languages";
import { Check, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation("common");
  const current = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const currentLabel = SUPPORTED_LANGUAGES.find((l) => l.code === current)?.nativeLabel ?? "English";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs font-medium"
          aria-label={t("language.label")}
          title={t("language.label")}
        >
          <Languages className="h-4 w-4" aria-hidden />
          <span>{currentLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(70vh,28rem)] min-w-[12rem] overflow-y-auto">
        <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onSelect={() => {
              void i18n.changeLanguage(lang.code);
            }}
            className="flex items-center justify-between gap-3"
          >
            <span>{lang.nativeLabel}</span>
            {lang.code === current ? <Check className="h-4 w-4 opacity-70" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
