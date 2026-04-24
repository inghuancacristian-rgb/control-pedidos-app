import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  DollarSign,
  Home,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";

export default function MobileMenu() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  const adminMenuItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/orders", label: "Pedidos", icon: ShoppingCart },
    { href: "/sales", label: "Ventas", icon: ShoppingBag },
    { href: "/inventory", label: "Inventario", icon: Package },
    { href: "/customers", label: "Clientes", icon: Users },
    { href: "/suppliers", label: "Proveedores", icon: Users },
    { href: "/purchases", label: "Compras", icon: ShoppingCart },
    { href: "/finance", label: "Finanzas", icon: DollarSign },
    { href: "/delivery-persons", label: "Repartidores", icon: Users },
  ];

  const deliveryMenuItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/orders", label: "Mis pedidos", icon: ShoppingCart },
    { href: "/delivery-load", label: "Mi carga", icon: Package },
    { href: "/sales", label: "Ventas", icon: ShoppingBag },
    { href: "/repartidor/finance", label: "Cierre de caja", icon: DollarSign },
  ];

  const menuItems = user?.role === "admin" ? adminMenuItems : deliveryMenuItems;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[88vw] max-w-sm border-white/60 bg-white/92 px-0 backdrop-blur-2xl"
      >
        <SheetHeader className="border-b border-border/70 px-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1f3351,#36506f)] shadow-[0_18px_28px_-18px_rgba(31,51,81,0.72)]">
              <span className="text-sm font-extrabold tracking-[0.18em] text-white">CP</span>
            </div>
            <div>
              <SheetTitle className="text-left">Panel principal</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Navegacion rapida para celular y tablet.
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex h-full flex-col">
          <div className="px-6 pt-5">
            <div className="hero-panel rounded-[1.4rem] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                    Sesion activa
                  </p>
                  <p className="mt-2 text-lg font-bold">{user?.name || "Usuario"}</p>
                  <p className="text-sm text-muted-foreground">
                    {user?.role === "admin" ? "Administrador" : "Repartidor"}
                  </p>
                </div>
                <span className="status-chip">
                  <Sparkles className="mr-1 h-3.5 w-3.5 text-primary" />
                  Online
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-5">
            {menuItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive(item.href) ? "default" : "ghost"}
                    className={`h-12 w-full justify-start gap-3 rounded-2xl px-4 ${
                      isActive(item.href) ? "" : "text-foreground hover:bg-accent/70"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          <div className="border-t border-border/70 px-4 py-5">
            <Button
              variant="destructive"
              className="h-12 w-full justify-start gap-3 rounded-2xl"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesion
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
