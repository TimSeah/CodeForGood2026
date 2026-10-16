import { useState } from "react";
import { DateInput, Tabs } from "@/components/ui";
import { useSelectedDate } from "@/hooks/useSelectedDate";
import { DailySchedule } from "./DailySchedule";
import { MonthlyAllocation } from "./MonthlyAllocation";

/** Monthly = the recurring MWF / TT allocation (Case-Allocation.xlsx). Daily = what actually happens on a date. */
export function SchedulePage() {
  const [date, setDate] = useSelectedDate();
  const [view, setView] = useState<"monthly" | "daily">("monthly");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Schedule</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={view}
            onChange={setView}
            tabs={[
              { value: "monthly", label: "Monthly (MWF / TT)" },
              { value: "daily", label: "Daily" },
            ]}
          />
          <DateInput value={date} onChange={setDate} />
        </div>
      </div>
      {view === "monthly" ? <MonthlyAllocation month={date.slice(0, 7)} /> : <DailySchedule date={date} />}
    </div>
  );
}
