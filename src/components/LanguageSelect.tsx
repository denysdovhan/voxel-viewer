import { ChevronDown, Languages } from 'lucide-react';
import { normalizeLocale, useTranslation } from '../i18n';
import { cn } from '../utils/cn';

interface LanguageSelectProps {
  floating?: boolean;
  className?: string;
}

export function LanguageSelect({
  floating = true,
  className,
}: LanguageSelectProps) {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div
      className={cn(
        floating ? 'absolute right-3 top-3 z-50 md:right-4 md:top-4' : '',
        className,
      )}
    >
      <label className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-slate-900/95 pl-2 pr-1.5 text-[11px] text-slate-300 shadow-lg shadow-slate-950/20 ring-1 ring-white/8">
        <Languages
          className="h-3.5 w-3.5 shrink-0 text-slate-500"
          aria-hidden="true"
        />
        <div className="relative min-w-0">
          <select
            className="min-w-0 max-w-24 appearance-none bg-transparent pl-0 pr-5 text-[11px] font-medium text-slate-100 outline-none"
            value={locale}
            onChange={(event) => void i18n.changeLanguage(event.target.value)}
            aria-label={t('common.language')}
          >
            <option value="en">{t('common.languages.en')}</option>
            <option value="uk">{t('common.languages.uk')}</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
        </div>
      </label>
    </div>
  );
}
