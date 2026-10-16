import { useState } from "react";
import type { PreferenceStatus, PreferenceType } from "@/api/types";
import { Button, Card, Field, inputClass, Modal, PageHeader, QueryState, Tabs } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useStudents, useTherapists } from "@/features/reference/api";
import { useCreatePreference, usePreferences } from "./api";
import { PreferenceCard } from "./PreferenceCard";
import { PreferenceForm } from "./PreferenceForm";

type View = "suggested" | "active" | "paused" | "history";
const VIEW_STATUSES: Record<View, PreferenceStatus[]> = {
  suggested: ["suggested"],
  active: ["active"],
  paused: ["paused"],
  history: ["rejected", "removed"],
};
const EMPTY: Record<View, string> = {
  suggested: "No open questions. When you change the same thing on several dates (with a reason), I’ll ask here.",
  active: "No active rules yet.",
  paused: "No paused rules.",
  history: "Nothing rejected or removed yet.",
};

/** Scheduling rules learned from admin changes (once confirmed) or added by hand — view, confirm, edit, pause, remove. */
export function PreferencesPage() {
  const [view, setView] = useState<View>("suggested");
  const [adding, setAdding] = useState(false);
  const { data = [], isLoading, error } = usePreferences(VIEW_STATUSES[view]);
  const { data: counts = [] } = usePreferences(["suggested", "active", "paused"]);
  const n = (s: PreferenceStatus) => counts.filter((p) => p.status === s).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Scheduling memory"
        title="Scheduling rules"
        actions={
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Icon name="plus" />
            Add a rule
          </Button>
        }
      />
      <p className="max-w-3xl text-sm text-muted">
        Rules are only ever applied after an admin confirms them. Suggestions come from repeated changes you made with a reason —
        nothing is learned silently, and nothing is sent to anyone.
      </p>
      <Tabs
        label="Show"
        value={view}
        onChange={setView}
        tabs={[
          { value: "suggested", label: `Needs your answer (${n("suggested")})` },
          { value: "active", label: `Active (${n("active")})` },
          { value: "paused", label: `Paused (${n("paused")})` },
          { value: "history", label: "Rejected & removed" },
        ]}
      />
      <Card flush>
        <div className={data.length ? "" : "px-5 py-4"}>
          <QueryState isLoading={isLoading} error={error} isEmpty={data.length === 0} emptyText={EMPTY[view]} />
        </div>
        {data.map((p) => (
          <PreferenceCard key={p.id} p={p} />
        ))}
      </Card>
      {adding && <AddRuleModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddRuleModal({ onClose }: { onClose: () => void }) {
  const { data: therapists = [] } = useTherapists();
  const { data: students = [] } = useStudents();
  const create = useCreatePreference();
  const [type, setType] = useState<PreferenceType>("pairing");
  const [therapistId, setTherapistId] = useState<number | "">("");
  const [studentId, setStudentId] = useState<number | "">("");
  const ready = therapistId !== "" && (type === "time_unavailable" || studentId !== "");

  return (
    <Modal title="Add a scheduling rule" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Tabs
          label="Rule type"
          value={type}
          onChange={setType}
          tabs={[
            { value: "pairing", label: "Therapist ↔ child" },
            { value: "time_unavailable", label: "Therapist time" },
          ]}
        />
        <div className="flex flex-wrap gap-4">
          <Field label="Therapist" className="flex-1">
            <select className={inputClass} value={therapistId} onChange={(e) => setTherapistId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choose…</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.rank})
                </option>
              ))}
            </select>
          </Field>
          {type === "pairing" && (
            <Field label="Child" className="flex-1">
              <select className={inputClass} value={studentId} onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Choose…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {ready ? (
          <PreferenceForm
            key={type}
            type={type}
            submitLabel="Add rule"
            pending={create.isPending}
            error={create.error}
            onCancel={onClose}
            onSubmit={(input) =>
              create.mutate(
                { ...input, type, therapistId: therapistId as number, studentId: type === "pairing" ? (studentId as number) : null },
                { onSuccess: onClose },
              )
            }
          />
        ) : (
          <p className="text-sm text-muted">Choose who the rule is about first.</p>
        )}
      </div>
    </Modal>
  );
}
