import type { ChangeReason, ChangeReasonCode } from "@/api/types";
import { inputClass } from "@/components/ui";
import { REASON_OPTIONS } from "@/lib/format";

/**
 * "Why are you replacing X?" — a short reason list plus an optional note. Repeated reasons of the first two
 * kinds let the system suggest a lasting preference (which the admin still has to confirm).
 */
export function ReasonPicker({
  name,
  therapistName,
  value,
  onChange,
}: {
  name: string;
  therapistName: string;
  value: ChangeReason | null;
  onChange: (r: ChangeReason | null) => void;
}) {
  const pick = (code: ChangeReasonCode) => onChange({ code, note: value?.note ?? null });
  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-field bg-white p-3.5">
      <legend className="px-1 text-[13px] font-bold text-ink-soft">Why isn’t {therapistName} right for this session?</legend>
      <div className="flex flex-col gap-1">
        {REASON_OPTIONS.map((o) => (
          <label key={o.code} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 text-sm has-checked:bg-brand-soft">
            <input
              type="radio"
              name={name}
              checked={value?.code === o.code}
              onChange={() => pick(o.code)}
              className="size-4 accent-brand"
            />
            {o.label}
          </label>
        ))}
      </div>
      <input
        aria-label="Note (optional)"
        placeholder="Note (optional)"
        maxLength={500}
        className={inputClass}
        value={value?.note ?? ""}
        disabled={!value}
        onChange={(e) => value && onChange({ ...value, note: e.target.value })}
      />
      <p className="text-xs text-muted">
        If the same reason comes up on several dates, I’ll ask whether it should become a rule. Nothing changes until you confirm.
      </p>
    </fieldset>
  );
}
