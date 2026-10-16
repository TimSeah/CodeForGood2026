import type { Reallocation } from "@/api/types";
import { Badge, Button, Card, QueryState } from "@/components/ui";
import { useDecideReallocation, useProposeReallocations, useReallocations } from "./api";

export function ProposalsPanel({ date }: { date: string }) {
  const { data = [], isLoading, error } = useReallocations(date);
  const propose = useProposeReallocations(date);

  return (
    <Card
      title="Proposed reallocations"
      actions={
        <Button onClick={() => propose.mutate()} disabled={propose.isPending}>
          {propose.isPending ? "Generating…" : "Generate proposals"}
        </Button>
      }
    >
      {propose.error && <p className="mb-2 text-sm text-rose-600">{propose.error.message}</p>}
      <QueryState
        isLoading={isLoading}
        error={error}
        isEmpty={data.length === 0}
        emptyText="No proposals yet. Report absences, then generate proposals."
      />
      <ul className="divide-y divide-slate-100">
        {data.map((r) => (
          <ProposalRow key={r.id} r={r} date={date} />
        ))}
      </ul>
    </Card>
  );
}

function ProposalRow({ r, date }: { r: Reallocation; date: string }) {
  const decide = useDecideReallocation(date);
  const isCancel = r.toTherapistId === null;

  return (
    <li className="flex items-start justify-between gap-4 py-3 text-sm">
      <div>
        <div className="font-medium">
          <Badge>{r.slot}</Badge> {r.studentName}: {r.fromTherapistName} →{" "}
          {isCancel ? <span className="text-rose-600">Cancel session</span> : r.toTherapistName}
        </div>
        <ul className="mt-1 list-disc pl-5 text-slate-500">
          {r.rationale.map((why) => (
            <li key={why}>{why}</li>
          ))}
        </ul>
      </div>
      {r.status === "proposed" ? (
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => decide.mutate({ id: r.id, status: "approved" })} disabled={decide.isPending}>
            Approve
          </Button>
          <Button variant="secondary" onClick={() => decide.mutate({ id: r.id, status: "rejected" })} disabled={decide.isPending}>
            Reject
          </Button>
        </div>
      ) : (
        <Badge tone={r.status === "approved" ? "success" : "neutral"}>{r.status}</Badge>
      )}
    </li>
  );
}
