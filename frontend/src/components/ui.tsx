// Small shared presentational components. Keep these dumb: props in, markup out — no data fetching.
// Colours come from the theme tokens in index.css (bg-brand, text-muted, border-line, …).
import { type ReactNode, useEffect } from "react";
import { formatCaseDate } from "@/lib/format";
import { Icon, type IconName } from "./icons";

export function PageHeader({ eyebrow, title, actions }: { eyebrow?: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="text-xs font-bold tracking-wider text-muted uppercase">{eyebrow}</div>}
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  count,
  subtitle,
  actions,
  flush,
  className = "",
  children,
}: {
  title?: ReactNode;
  count?: number;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** No padding around the body (for lists and tables that run edge to edge). */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-line bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div>
            {title && (
              <h2 className="text-[17px] font-bold">
                {title}
                {count !== undefined && <span className="ml-1.5 font-semibold text-muted">{count}</span>}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

const BADGE_TONES = {
  neutral: "bg-sunk text-ink-soft",
  success: "bg-good-bg text-good",
  warning: "bg-warn-bg text-warn",
  danger: "bg-bad-bg text-bad",
  info: "bg-info-bg text-info",
  brand: "bg-brand-soft text-brand",
} as const;
export type Tone = keyof typeof BADGE_TONES;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  secondary: "border border-field bg-white text-ink hover:bg-subtle",
  danger: "border border-[#EBC3BC] bg-white text-bad hover:bg-bad-bg",
  ghost: "text-brand hover:bg-brand-soft",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "min-h-9 px-3", md: "min-h-10 px-4", lg: "min-h-12 px-5 text-[15px]" }[size];
  return (
    <button
      {...props}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#DAD8D0] disabled:text-[#6B716E] ${sizes} ${BUTTON_VARIANTS[variant]} ${props.className ?? ""}`}
    />
  );
}

/** Text-style button for secondary row actions ("Undo", "Edit"). */
export function LinkButton({ tone = "brand", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "brand" | "danger" }) {
  return (
    <button
      {...props}
      className={`cursor-pointer rounded-md px-1.5 py-1 text-[13px] font-bold underline-offset-3 hover:underline disabled:opacity-50 ${tone === "danger" ? "text-bad" : "text-brand"} ${props.className ?? ""}`}
    />
  );
}

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Date pill with previous / next day buttons. Clicking the label opens the native date picker. */
export function DateInput({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const step = "inline-flex size-10 cursor-pointer items-center justify-center rounded-[10px] border border-field bg-white hover:bg-subtle";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={step} onClick={() => onChange(addDays(value, -1))} aria-label="Previous day">
        <Icon name="left" />
      </button>
      <label className="relative inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-field bg-white px-3.5 text-sm font-semibold hover:bg-subtle">
        <Icon name="calendar" />
        {formatCaseDate(value)} {value.slice(0, 4)}
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={(e) => e.currentTarget.showPicker?.()}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Date"
        />
      </label>
      <button type="button" className={step} onClick={() => onChange(addDays(value, 1))} aria-label="Next day">
        <Icon name="right" />
      </button>
    </div>
  );
}

export const inputClass =
  "min-h-10 rounded-[10px] border border-field bg-white px-3 text-sm font-medium text-ink focus:border-brand focus:outline-2 focus:outline-brand/20";

/** Labelled form field: label text above the control. */
export function Field({ label, hint, children, className = "" }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 text-[13px] font-semibold text-ink-soft ${className}`}>
      <span>
        {label}
        {hint && <span className="ml-1 font-normal text-muted">— {hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Segmented control. Used for view switches (role="tablist") and small single-choice inputs. */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: ReactNode }[];
  label?: string;
}) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-sunk p-[3px]" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`min-h-[34px] cursor-pointer rounded-lg px-3 text-[13px] font-semibold ${value === t.value ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const CALLOUT_TONES = {
  warning: { box: "bg-warn-bg text-[#6E3B00]", icon: "alert" },
  danger: { box: "bg-bad-bg text-[#8A2216]", icon: "error" },
  info: { box: "bg-info-bg text-info", icon: "info" },
  success: { box: "bg-good-bg text-good", icon: "check" },
} as const satisfies Record<string, { box: string; icon: IconName }>;

/** One-line banner: what needs attention, plus an optional action on the right. */
export function Callout({ tone, children, action }: { tone: keyof typeof CALLOUT_TONES; children: ReactNode; action?: ReactNode }) {
  const t = CALLOUT_TONES[tone];
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${t.box}`}>
      <Icon name={t.icon} size={20} className="shrink-0" />
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}

const AVATAR_TONES = { brand: "bg-brand-soft text-brand", child: "bg-[#EFE7F6] text-[#5B3A82]", warning: "bg-warn-bg text-warn" };

export function Avatar({ name, tone = "brand", small }: { name: string; tone?: keyof typeof AVATAR_TONES; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${small ? "size-7 text-[11px]" : "size-9 text-[13px]"} ${AVATAR_TONES[tone]}`}
    >
      {name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "?"}
    </span>
  );
}

/** Minimal accessible modal. Closes on backdrop click or Escape. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-1 cursor-pointer rounded-lg p-1.5 text-muted hover:bg-sunk">
            <Icon name="x" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Standard loading / error / empty handling for a React Query result. */
export function QueryState({ isLoading, error, isEmpty, emptyText = "Nothing here yet." }: {
  isLoading: boolean;
  error: Error | null;
  isEmpty?: boolean;
  emptyText?: string;
}) {
  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (error) return <p className="text-sm font-semibold text-bad">Error: {error.message}</p>;
  if (isEmpty) return <p className="text-sm text-muted">{emptyText}</p>;
  return null;
}
