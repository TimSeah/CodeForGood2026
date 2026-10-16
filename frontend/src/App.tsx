import { Route, Routes } from "react-router";
import { AppLayout } from "@/components/AppLayout";
import { AuditPage } from "@/features/audit/AuditPage";
import { DisruptionsPage } from "@/features/reallocation/DisruptionsPage";
import { SchedulePage } from "@/features/schedule/SchedulePage";

// Route table. Add new pages here and a matching link in components/AppLayout.tsx.
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DisruptionsPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
    </Routes>
  );
}
