import { Route, Routes } from "react-router";
import { AppLayout } from "@/components/AppLayout";
import { ApprovalPage } from "@/features/approval/ApprovalPage";
import { RepliesPage } from "@/features/approval/RepliesPage";
import { AuditPage } from "@/features/audit/AuditPage";
import { DisruptionsPage } from "@/features/disruptions/DisruptionsPage";
import { LogsPage } from "@/features/logs/LogsPage";
import { SchedulePage } from "@/features/schedule/SchedulePage";
import { VideoReviewPage } from "@/features/video-review/VideoReviewPage";

// Route table. Add new pages here and a matching link in components/AppLayout.tsx.
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DisruptionsPage />} />
        <Route path="approval" element={<ApprovalPage />} />
        <Route path="replies" element={<RepliesPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="video-review" element={<VideoReviewPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
    </Routes>
  );
}
