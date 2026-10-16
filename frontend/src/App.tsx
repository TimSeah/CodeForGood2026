import { Route, Routes } from "react-router";
import { AppLayout } from "@/components/AppLayout";
import { ApprovalPage } from "@/features/approval/ApprovalPage";
import { RepliesPage } from "@/features/approval/RepliesPage";
import { AuditPage } from "@/features/audit/AuditPage";
import { DisruptionsPage } from "@/features/disruptions/DisruptionsPage";
import { LogsPage } from "@/features/logs/LogsPage";
import { PreferencesPage } from "@/features/preferences/PreferencesPage";
import { SchedulePage } from "@/features/schedule/SchedulePage";
import { VideoReviewPage } from "@/features/video-review/VideoReviewPage";
import { ConfirmedCalendarPage } from "@/features/calendar/ConfirmedCalendarPage";

// Route table. Add new pages here and a matching link in components/AppLayout.tsx.
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DisruptionsPage />} />
        <Route path="approval" element={<ApprovalPage />} />
        <Route path="replies" element={<RepliesPage />} />
        <Route path="preferences" element={<PreferencesPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="calendar" element={<ConfirmedCalendarPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="video-review" element={<VideoReviewPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
    </Routes>
  );
}
