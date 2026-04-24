import { useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  DollarSign,
  LayoutGrid,
  LogOut,
  Package,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

const adminModules = [
  { href: "/dashboard", title: "Dashboard", description: "Metricas y control general.", icon: LayoutGrid },
  { href: "/orders", title: "Pedidos", description: "Gestion y seguimiento del dia.", icon: ShoppingCart },
  { href: "/inventory", title: "Inventario", description: "Stock, vencimientos e historial.", icon: Package },
  { href: "/suppliers", title: "Proveedores", description: "Contactos y abastecimiento.", icon: Users },
  { href: "/purchases", title: "Compras", description: "Registro de compras e ingresos.", icon: ShoppingCart },
  { href: "/sales", title: "Ventas", description: "Ventas rapidas y cobros.", icon: ShoppingBag },
  { href: "/customers", title: "Clientes", description: "Frecuencia, deuda y zonas.", icon: Users },
  { href: "/finance", title: "Finanzas", description: "Caja, ingresos y egresos.", icon: DollarSign },
  { href: "/products", title: "Catalogo", description: "Precios, imagenes y categorias.", icon: LayoutGrid },
  { href: "/delivery-persons", title: "Repartidores", description: "Equipo, asignaciones y control.", icon: Truck },
];

const deliveryModules = [
  { href: "/orders", title: "Mis pedidos", description: "Entregas asignadas y estado.", icon: ShoppingCart },
  { href: "/delivery-load", title: "Mi carga", description: "Productos pendientes por entregar.", icon: Package },
  { href: "/sales", title: "Ventas", description: "Cobros y ventas unitarias.", icon: ShoppingBag },
  { href: "/repartidor/finance", title: "Cierre de caja", description: "Resumen y cierre del turno.", icon: Wallet },
];

function getLocalDateInputValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
}

function formatDateLabel(value?: string | Date | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    assigned: "Asignado",
    in_transit: "En reparto",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };

  return labels[status] || status;
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  const isAdmin = user?.role === "admin";
  const isDelivery = user?.role === "user";
  const today = getLocalDateInputValue();

  const { data: adminStats } = trpc.stats.getDashboardStats.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: deliveryStats } = trpc.stats.getDeliveryStats.useQuery(undefined, {
    enabled: isDelivery,
  });
  const { data: orders } = trpc.orders.list.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: myOrders } = trpc.orders.listForDelivery.useQuery(undefined, {
    enabled: isDelivery,
  });
  const { data: inventory } = trpc.inventory.listInventory.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: expiryAlerts } = trpc.inventory.getExpiryAlerts.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: sales } = trpc.sales.list.useQuery(undefined, {
    enabled: isAdmin,
  });

  const actionableOrders = useMemo(() => {
    if (!orders) return [];

    return (orders as any[])
      .filter((order: any) => !["delivered", "cancelled"].includes(order.status))
      .sort((a: any, b: any) => {
        const dateA = `${a.deliveryDate || "9999-12-31"} ${a.deliveryTime || "99:99"}`;
        const dateB = `${b.deliveryDate || "9999-12-31"} ${b.deliveryTime || "99:99"}`;
        return dateA.localeCompare(dateB);
      })
      .slice(0, 6);
  }, [orders]);

  const todayOrders = useMemo(() => {
    if (!orders) return [];

    return (orders as any[]).filter((order: any) => !order.deliveryDate || order.deliveryDate === today);
  }, [orders, today]);

  const lowStockItemsCount = useMemo(() => {
    if (!inventory) return 0;
    return (inventory as any[]).filter((item: any) => item.isLowStock).length;
  }, [inventory]);

  const urgentExpiryAlertsCount = useMemo(() => {
    if (!expiryAlerts) return 0;
    return (expiryAlerts as any[]).filter((alert: any) => alert.expiryStatus === "expired" || alert.expiryStatus === "critical").length;
  }, [expiryAlerts]);

  const pendingCollections = useMemo(() => {
    const orderPending = ((orders as any[]) || []).filter(
      (order: any) => order.status !== "cancelled" && order.paymentStatus !== "completed"
    );
    const salePending = ((sales as any[]) || []).filter(
      (sale: any) => sale.status !== "cancelled" && sale.paymentStatus !== "completed"
    );

    return {
      count: orderPending.length + salePending.length,
      amount:
        orderPending.reduce((sum: number, order: any) => sum + (order.totalPrice || 0), 0) +
        salePending.reduce((sum: number, sale: any) => sum + (sale.total || 0), 0),
    };
  }, [orders, sales]);

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="glass-panel flex min-h-[220px] w-full max-w-md items-center justify-center px-6 text-center">
          <p className="text-lg font-semibold">Cargando panel principal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="page-container max-w-5xl">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="hero-panel p-7 sm:p-10">
              <span className="status-chip mb-5">
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Plataforma operativa
              </span>
              <h1 className="max-w-2xl text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
                Pedidos, inventario, clientes y ventas en un mismo sistema.
              </h1>
              <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
                Inicia sesion para entrar al panel principal y ver alertas, stock, pedidos pendientes y datos del dia.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={getLoginUrl()}>
                  <Button size="lg" className="w-full sm:w-auto">
                    Iniciar sesion
                  </Button>
                </a>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Crear cuenta
                  </Button>
                </Link>
              </div>
            </div>

            <div className="glass-panel p-6 sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/80">
                Credenciales demo
              </p>
              <div className="mt-5 grid gap-4">
                <CredentialRow label="Usuario" value="admin" />
                <CredentialRow label="Contrasena" value="admin123" />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <FeaturePill label="Pedidos" />
                <FeaturePill label="Inventario" />
                <FeaturePill label="Clientes" />
                <FeaturePill label="Ventas" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isDelivery) {
    return (
      <div className="page-shell">
        <div className="page-container space-y-6">
          <section className="section-card p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="status-chip">
                    <Truck className="mr-1.5 h-3.5 w-3.5 text-primary" />
                    Resumen de ruta
                  </span>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                    {user?.name}
                  </Badge>
                </div>
                <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Panel de trabajo del repartidor</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Revisa tus pedidos asignados, ventas del turno y cierre de caja desde una sola vista.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/orders">
                  <Button className="w-full sm:w-auto">Ver pedidos</Button>
                </Link>
                <Button variant="outline" className="w-full sm:w-auto" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  Cerrar sesion
                </Button>
              </div>
            </div>

            <div className="mt-6 soft-grid sm:grid-cols-2 xl:grid-cols-4">
              <OverviewMetric title="Asignados" value={`${deliveryStats?.totalAssigned || 0}`} caption="Pedidos en tu jornada." icon={ShoppingCart} />
              <OverviewMetric title="Pendientes" value={`${deliveryStats?.pending || 0}`} caption="Listos para atender." icon={AlertTriangle} />
              <OverviewMetric title="En reparto" value={`${deliveryStats?.inTransit || 0}`} caption="Pedidos en ruta." icon={Truck} />
              <OverviewMetric title="Entregados" value={`${deliveryStats?.delivered || 0}`} caption="Completados del turno." icon={ShoppingCart} />
            </div>
          </section>

          <section className="soft-grid lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Pedidos activos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {((myOrders as any[]) || []).length === 0 ? (
                  <EmptyState message="No tienes pedidos asignados en este momento." />
                ) : (
                  ((myOrders as any[]) || []).slice(0, 5).map((order: any) => (
                    <OperationalRow
                      key={order.id}
                      title={order.orderNumber}
                      subtitle={order.customerName || "Cliente sin nombre"}
                      value={formatDateLabel(order.deliveryDate ? `${order.deliveryDate}T${order.deliveryTime || "00:00"}` : order.createdAt)}
                      badge={getOrderStatusLabel(order.status)}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Accesos rapidos</CardTitle>
              </CardHeader>
              <CardContent className="soft-grid sm:grid-cols-2">
                {deliveryModules.map((module) => (
                  <ModuleCard key={module.href} module={module} />
                ))}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-container space-y-6">
        <section className="section-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="status-chip">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Centro operativo
                </span>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                  {user?.name}
                </Badge>
              </div>
              <h1 className="mt-4 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                Resumen principal del negocio
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
                Aqui tienes primero lo relevante: pedidos por atender, alertas de vencimiento, productos con stock bajo, cobros pendientes y accesos rapidos.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/orders">
                <Button className="w-full sm:w-auto">Ver pedidos</Button>
              </Link>
              <Link href="/inventory">
                <Button variant="outline" className="w-full sm:w-auto">
                  Revisar inventario
                </Button>
              </Link>
              <Button variant="outline" className="w-full sm:w-auto" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Cerrar sesion
              </Button>
            </div>
          </div>
        </section>

        <section className="soft-grid xl:grid-cols-[1.06fr_0.94fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Alertas prioritarias</CardTitle>
              <Link href="/inventory">
                <Button variant="ghost" size="sm" className="gap-2">
                  Ver inventario
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              <OperationalRow
                title="Productos con stock bajo"
                subtitle="Atencion de reposicion"
                value={`${adminStats?.lowStockProducts || 0} productos`}
                badge={lowStockItemsCount > 0 ? "Revisar" : "Ok"}
                tone={lowStockItemsCount > 0 ? "danger" : "normal"}
              />
              <OperationalRow
                title="Alertas de vencimiento"
                subtitle="Vencidos o proximos a vencer"
                value={`${urgentExpiryAlertsCount} alertas`}
                badge={urgentExpiryAlertsCount > 0 ? "Urgente" : "Ok"}
                tone={urgentExpiryAlertsCount > 0 ? "warning" : "normal"}
              />
              <OperationalRow
                title="Cobros pendientes"
                subtitle="Pedidos y ventas sin pago completo"
                value={formatCurrency(pendingCollections.amount)}
                badge={`${pendingCollections.count} casos`}
                tone={pendingCollections.count > 0 ? "warning" : "normal"}
              />
              <OperationalRow
                title="Pedidos del dia"
                subtitle="Programados para hoy"
                value={`${todayOrders.length} pedidos`}
                badge={today}
                tone="normal"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pedidos por atender</CardTitle>
              <Link href="/orders">
                <Button variant="ghost" size="sm" className="gap-2">
                  Ver pedidos
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionableOrders.length === 0 ? (
                <EmptyState message="No hay pedidos pendientes, asignados o en reparto." />
              ) : (
                actionableOrders.map((order: any) => (
                  <OperationalRow
                    key={order.id}
                    title={order.orderNumber}
                    subtitle={order.customerName || order.customerDisplayName || "Cliente sin nombre"}
                    value={formatCurrency(order.totalPrice || 0)}
                    badge={getOrderStatusLabel(order.status)}
                    meta={formatDateLabel(order.deliveryDate ? `${order.deliveryDate}T${order.deliveryTime || "00:00"}` : order.createdAt)}
                    tone={order.status === "pending" ? "warning" : "normal"}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/80">
                Navegacion
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Accesos rapidos</h2>
            </div>
          </div>
          <div className="soft-grid md:grid-cols-2 xl:grid-cols-3">
            {adminModules.map((module) => (
              <ModuleCard key={module.href} module={module} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}


function OverviewMetric({
  title,
  value,
  caption,
  icon: Icon,
}: {
  title: string;
  value: string;
  caption: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[1.25rem] border border-white/70 bg-white/80 p-4 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-3xl font-extrabold text-slate-900">{value}</p>
      <p className="text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

function OperationalRow({
  title,
  subtitle,
  value,
  badge,
  meta,
  tone = "normal",
}: {
  title: string;
  subtitle: string;
  value: string;
  badge: string;
  meta?: string;
  tone?: "normal" | "warning" | "danger";
}) {
  const toneClasses =
    tone === "danger"
      ? "border-red-200/80 bg-red-50/70"
      : tone === "warning"
        ? "border-amber-200/80 bg-amber-50/70"
        : "border-white/70 bg-white/80";

  return (
    <div className={`rounded-[1.25rem] border p-4 ${toneClasses}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          {meta ? <p className="mt-2 text-xs text-muted-foreground">{meta}</p> : null}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-sm font-bold text-slate-900">{value}</span>
          <Badge variant={tone === "danger" ? "destructive" : tone === "warning" ? "secondary" : "outline"} className="rounded-full">
            {badge}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ module }: { module: any }) {
  const Icon = module.icon;

  return (
    <Link href={module.href}>
      <Card className="touch-card h-full cursor-pointer overflow-hidden border-white/70">
        <CardContent className="flex h-full items-start gap-4 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/90">
            <Icon className="h-5 w-5 text-slate-900" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900">{module.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-border bg-white/70 px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <code className="mt-1 block text-base font-bold text-slate-900">{value}</code>
    </div>
  );
}

function FeaturePill({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-center text-sm font-semibold text-slate-700 shadow-sm">
      {label}
    </div>
  );
}
