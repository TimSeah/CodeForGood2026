import { NavLink, Outlet, useLocation } from "react-router";

const NAV = [
  { to: "/", label: "Disruptions" },
  { to: "/schedule", label: "Schedule" },
  { to: "/audit", label: "Audit log" },
];

export function AppLayout() {
  // Carry ?date=... across pages.
  const { search } = useLocation();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">Therapist Reallocation</span>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={{ pathname: n.to, search }}
                end
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
