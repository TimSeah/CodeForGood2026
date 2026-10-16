import { useSearchParams } from "react-router";

// Demo default: the disruption day from docs/data/Case-Scenario.docx.
export const DEFAULT_DATE = "2031-07-11";

/** The date being viewed, kept in the URL (?date=YYYY-MM-DD) so it survives refreshes and page changes. */
export function useSelectedDate(): [string, (date: string) => void] {
  const [params, setParams] = useSearchParams();
  const date = params.get("date") ?? DEFAULT_DATE;
  const setDate = (next: string) =>
    setParams(
      (p) => {
        p.set("date", next);
        return p;
      },
      { replace: true },
    );
  return [date, setDate];
}
