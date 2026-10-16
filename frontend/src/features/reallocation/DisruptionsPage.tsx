import { DateInput } from "@/components/ui";
import { AbsencePanel } from "@/features/absences/AbsencePanel";
import { useSelectedDate } from "@/hooks/useSelectedDate";
import { ProposalsPanel } from "./ProposalsPanel";

/** The main 7 AM workflow: see who is away → generate proposals → approve/reject each one. */
export function DisruptionsPage() {
  const [date, setDate] = useSelectedDate();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Disruptions</h1>
        <DateInput value={date} onChange={setDate} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <AbsencePanel date={date} />
        <ProposalsPanel date={date} />
      </div>
    </div>
  );
}
