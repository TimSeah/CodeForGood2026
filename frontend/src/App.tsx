import { Route, Routes } from "react-router";
import { AppLayout } from "@/components/AppLayout";
import { ApprovalPage } from "@/features/approval/ApprovalPage";
import { AuditPage } from "@/features/audit/AuditPage";
import { DisruptionsPage } from "@/features/disruptions/DisruptionsPage";
import { LogsPage } from "@/features/logs/LogsPage";
import { SchedulePage } from "@/features/schedule/SchedulePage";

// Route table. Add new pages here and a matching link in components/AppLayout.tsx.
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DisruptionsPage />} />
        <Route path="approval" element={<ApprovalPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
    </Routes>
  );
}
