import { Link } from "react-router";
import { Card } from "@/components/ui";
import { usePreferences } from "./api";
import { PreferenceCard } from "./PreferenceCard";

/**
 * Questions the system is asking about repeated admin changes. Shown on the Approval page; renders nothing when
 * there are none. Suggestions never affect schedules until confirmed.
 */
export function SuggestionsPanel() {
  const { data = [] } = usePreferences(["suggested"]);
  if (data.length === 0) return null;
  return (
    <Card
      title="Should these become rules?"
      count={data.length}
      subtitle="Spotted from repeated changes. Nothing changes in your schedules until you confirm."
      actions={
        <Link to="/preferences" className="text-[13px] font-bold text-brand underline-offset-3 hover:underline">
          All rules
        </Link>
      }
      flush
    >
      {data.map((p) => (
        <PreferenceCard key={p.id} p={p} />
      ))}
    </Card>
  );
}
