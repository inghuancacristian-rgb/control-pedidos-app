import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Package, Truck, TrendingUp, Eye, BarChart3, PieChart, MapPin } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/currency";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from "recharts";
import { useIsMobile } from "@/hooks/useMobile";

const COLORS = ["#4CAF50", "#2196F3", "#FF9800", "#F44336", "#9C27B0", "#00BCD4"];

function getLocalDateInputValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
}

export default function Dashboard() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { data: stats, isLoading } = trpc.stats.getDashboardStats.useQuery(
    undefined,
    { enabled: user?.role === "admin" }
  );
  const { data: orders } = trpc.orders.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: customers } = trpc.customers.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: salesData } = trpc.reports.salesReport.useQuery({
    startDate: format(new Date(new Date().setDate(new Date().getDate() - 30)), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  }, { enabled: user?.role === "admin" });

  const today = getLocalDateInputValue();
  const [tableDate, setTableDate] = useState(today);

  const todayOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o: any) =>
      !tableDate || !o.deliveryDate || o.deliveryDate === tableDate
    ).sort((a: any, b: any) => {
      const ta = a.deliveryTime || "99:99";
      const tb = b.deliveryTime || "99:99";
      return ta.localeCompare(tb);
    });
  }, [orders, tableDate]);

  const getCustomerName = (order: any) => {
    return (order as any).customerName || (customers as any[])?.find((c: any) => c.id === order.customerId)?.name || "—";
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending:    { label: "Pendiente",  className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      assigned:   { label: "Asignado",  className: "bg-blue-100 text-blue-800 border-blue-200" },
      in_transit: { label: "En Reparto", className: "bg-purple-100 text-purple-800 border-purple-200" },
      delivered:  { label: "Entregado", className: "bg-green-100 text-green-800 border-green-200" },
      cancelled:  { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-200" },
    };
    const s = map[status] || { label: status, className: "bg-gray-100 text-gray-700 border-gray-200" };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.className}`}>{s.label}</span>;
  };

  const getPaymentBadge = (paymentStatus: string) => {
    if (paymentStatus === "completed") {
      return <span className="flex items-center gap-1.5 text-sm text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Pagado</span>;
    }
    return <span className="flex items-center gap-1.5 text-sm text-orange-500"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Pendiente</span>;
  };

  // Datos para gráficos
  const salesByPaymentMethod = useMemo(() => {
    if (!salesData) return [];
    const byMethod = salesData.reduce((acc: Record<string, number>, sale: any) => {
      const method = sale.paymentMethod === "cash" ? "Efectivo" : sale.paymentMethod === "qr" ? "QR" : "Transferencia";
      acc[method] = (acc[method] || 0) + (sale.total || 0);
      return acc;
    }, {});
    return Object.entries(byMethod).map(([name, value]) => ({ name, value: value / 100 }));
  }, [salesData]);

  const ordersByZone = useMemo(() => {
    if (!orders) return [];
    const byZone = orders.reduce((acc: Record<string, number>, order: any) => {
      const zone = order.zone || "Sin zona";
      acc[zone] = (acc[zone] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(byZone)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [orders]);

  const topProducts = useMemo(() => {
    if (!salesData) return [];
    const productCount: Record<string, number> = {};
    salesData.forEach((sale: any) => {
      (sale.items || []).forEach((item: any) => {
        const name = item.productName || "Producto";
        productCount[name] = (productCount[name] || 0) + (item.quantity || 1);
      });
    });
    return Object.entries(productCount)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [salesData]);

  // Calcular margen de ganancia
  const totalProfit = useMemo(() => {
    if (!salesData) return 0;
    return salesData.reduce((sum: number, sale: any) => {
      return sum + (sale.total || 0) - ((sale.totalCost || 0) || (sale.total || 0) * 0.6);
    }, 0) / 100;
  }, [salesData]);

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Solo administradores pueden acceder al dashboard</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Cargando estadísticas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

        {/* Estadísticas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Totales</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats?.pendingOrders || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Tránsito</CardTitle>
              <Truck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.inTransitOrders || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entregados</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.deliveredOrders || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Ingresos y inventario */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(stats?.totalRevenue || 0)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">De pedidos completados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertas de Inventario</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats?.lowStockProducts || 0}</div>
              <p className="text-sm text-muted-foreground mt-2">Productos con stock bajo</p>
              <Link href="/inventory" className="text-blue-600 hover:underline mt-4 inline-block">
                Ver inventario →
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos de KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Ventas por método de pago */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Ventas por Método de Pago
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesByPaymentMethod.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPie>
                    <Pie
                      data={salesByPaymentMethod}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: Bs. ${value.toLocaleString()}`}
                    >
                      {salesByPaymentMethod.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `Bs. ${value.toLocaleString()}`} />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">Sin datos de ventas</p>
              )}
            </CardContent>
          </Card>

          {/* Pedidos por zona */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Pedidos por Zona
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersByZone.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ordersByZone} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#4CAF50" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">Sin datos de zonas</p>
              )}
            </CardContent>
          </Card>

          {/* Productos más vendidos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Productos Más Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topProducts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#2196F3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">Sin datos de productos</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resumen de ingresos y margen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Margen de Ganancia Estimado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                Bs. {totalProfit.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Basado en últimos 30 días (estimado 40% costo)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ticket Promedio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {salesData?.length ? formatCurrency(
                  salesData.reduce((sum: number, s: any) => sum + (s.total || 0), 0) / salesData.length
                ) : "Bs. 0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Valor promedio por venta
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de pedidos del día */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Pedidos del Día</CardTitle>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={tableDate}
                  onChange={(e) => setTableDate(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm bg-background"
                />
                {tableDate && (
                  <button
                    onClick={() => setTableDate("")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Ver todos
                  </button>
                )}
                <Link href="/orders">
                  <Button variant="outline" size="sm">Ver todos →</Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isMobile ? (
              /* Mobile card layout */
              <div className="divide-y divide-border">
                {todayOrders.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No hay pedidos para la fecha seleccionada
                  </div>
                ) : (
                  todayOrders.map((order: any) => (
                    <div key={order.id} className="p-4 hover:bg-muted/20">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-sm">{order.orderNumber}</span>
                          <span className="ml-2">{getStatusBadge(order.status)}</span>
                        </div>
                        <span className="font-semibold text-sm">{formatCurrency(order.totalPrice)}</span>
                      </div>
                      <p className="text-sm font-medium">{getCustomerName(order)}</p>
                      {order.deliveryPersonName && (
                        <p className="text-xs text-muted-foreground mt-0.5">Rep: {order.deliveryPersonName}</p>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        {getPaymentBadge(order.paymentStatus)}
                        <Link href={`/order/${order.id}`}>
                          <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-700 h-9 px-3">
                            <Eye className="h-4 w-4 mr-1" /> Ver
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Desktop table layout */
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pedido #</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pago</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                      <th className="text-center px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {todayOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                          No hay pedidos para la fecha seleccionada
                        </td>
                      </tr>
                    ) : (
                      todayOrders.map((order: any) => (
                        <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-bold text-sm">{order.orderNumber}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-semibold text-sm">{getCustomerName(order)}</p>
                              {order.deliveryPersonName && (
                                <p className="text-xs text-muted-foreground mt-0.5">Rep: {order.deliveryPersonName}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(order.status)}
                          </td>
                          <td className="px-6 py-4">
                            {getPaymentBadge(order.paymentStatus)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-semibold text-sm">{formatCurrency(order.totalPrice)}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Link href={`/order/${order.id}`}>
                              <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
