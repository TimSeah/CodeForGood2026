import { NavLink, Outlet, useLocation } from "react-router";
import { Icon, type IconName } from "./icons";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Today", icon: "alert" },
  { to: "/approval", label: "Review & approve", icon: "approve" },
  { to: "/replies", label: "Parent replies", icon: "chat" },
  { to: "/schedule", label: "Schedule", icon: "calendar" },
  { to: "/logs", label: "Session logs", icon: "file" },
  { to: "/video-review", label: "Video review", icon: "video" },
  { to: "/audit", label: "Audit trail", icon: "clock" },
];

/** Sidebar on wide screens, a scrollable top bar on narrow ones. */
export function AppLayout() {
  // Carry ?date=... across pages.
  const { search } = useLocation();
  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-line lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:gap-7 lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
        <div className="flex items-center gap-3 px-4 pt-4 lg:px-2 lg:pt-0">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand text-white">
            <Icon name="swap" size={20} />
          </span>
          <div>
            <div className="font-extrabold">Cover Desk</div>
            <div className="text-xs text-muted">Autism Partnership</div>
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col lg:p-0">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={{ pathname: n.to, search }}
              end
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] whitespace-nowrap ${
                  isActive ? "bg-white font-bold text-brand shadow-sm" : "font-medium text-ink-soft hover:bg-sunk"
                }`
              }
            >
              <Icon name={n.icon} size={20} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto hidden px-3 text-xs text-muted lg:block">Local prototype · fictional case-study data</p>
      </aside>
      <main className="mx-auto w-full max-w-[1200px] min-w-0 px-4 py-7 sm:px-8 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}
