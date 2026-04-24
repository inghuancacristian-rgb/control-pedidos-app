import { useAuth } from "@/_core/hooks/useAuth";
import MobileMenu from "./MobileMenu";
import { Link, useLocation } from "wouter";
import { ChevronRight, LayoutDashboard, ShoppingBag } from "lucide-react";

export default function AppHeader() {
  const { user } = useAuth();
  const [location] = useLocation();

  const navItems = user?.role === "admin"
    ? [
        { href: "/", label: "Inicio" },
        { href: "/orders", label: "Pedidos" },
        { href: "/sales", label: "Ventas", icon: ShoppingBag },
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/inventory", label: "Inventario" },
        { href: "/customers", label: "Clientes" },
        { href: "/finance", label: "Finanzas" },
        { href: "/expenses", label: "Gastos" },
      ]
    : [
        { href: "/", label: "Inicio" },
        { href: "/orders", label: "Mis Pedidos" },
        { href: "/sales", label: "Ventas", icon: ShoppingBag },
        { href: "/repartidor/finance", label: "Caja" },
      ];

  return (
    <header className="sticky top-0 z-50 w-full px-3 pt-3 md:px-5 md:pt-4">
      <div className="page-container">
        <div className="glass-panel flex min-h-[72px] items-center justify-between gap-3 px-4 py-3 md:px-5">
          <Link href="/">
            <div className="group flex cursor-pointer items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1f3351,#36506f)] shadow-[0_16px_28px_-18px_rgba(31,51,81,0.72)]">
                <span className="text-sm font-extrabold tracking-[0.18em] text-white">CP</span>
              </div>
              <div className="min-w-0">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-primary/80">
                  Operacion diaria
                </p>
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-slate-900">Control de Pedidos</span>
                  <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
                </div>
              </div>
            </div>
          </Link>

          {user && (
            <nav className="pill-nav hidden md:flex">
              {navItems.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-[0_14px_26px_-18px_var(--primary)]"
                        : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                    }`}
                  >
                    {Icon ? <Icon className="h-4 w-4" /> : null}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.45)] sm:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-extrabold text-white">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.role === "admin" ? "Administrador" : "Repartidor"}
                  </p>
                </div>
              </div>
            )}
            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
