import { useState } from "react";
import { DateInput, PageHeader, Tabs } from "@/components/ui";
import { useSelectedDate } from "@/hooks/useSelectedDate";
import { DailySchedule } from "./DailySchedule";
import { MonthlyAllocation } from "./MonthlyAllocation";

/** Monthly = the recurring MWF / TT allocation (Case-Allocation.xlsx). Daily = what actually happens on a date. */
export function SchedulePage() {
  const [date, setDate] = useSelectedDate();
  const [view, setView] = useState<"monthly" | "daily">("monthly");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={view === "monthly" ? "Recurring allocation" : "The day as it stands"}
        title="Schedule"
        actions={
          <>
            <Tabs
              label="View"
              value={view}
              onChange={setView}
              tabs={[
                { value: "monthly", label: "Monthly (MWF / TT)" },
                { value: "daily", label: "Daily" },
              ]}
            />
            <DateInput value={date} onChange={setDate} />
          </>
        }
      />
      {view === "monthly" ? <MonthlyAllocation month={date.slice(0, 7)} /> : <DailySchedule date={date} />}
    </div>
  );
}
