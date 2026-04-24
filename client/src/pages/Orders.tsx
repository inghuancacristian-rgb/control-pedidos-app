import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Plus, Eye, MapPin, Search, Edit, Trash2, Calendar, DollarSign, MessageCircle } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function Orders() {
  const { user } = useAuth();
  const getLocalDateInputValue = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
  };
  const today = getLocalDateInputValue();

  const { data: displayOrders, isLoading } = trpc.orders.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: deliveryOrders, isLoading: isLoadingDelivery } = trpc.orders.listForDelivery.useQuery(undefined, {
    enabled: user?.role === "user",
  });
  const { data: deliveryPersons } = trpc.users.listDeliveryPersons.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const orders = user?.role === "admin" ? displayOrders : deliveryOrders;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [deliveryPersonFilter, setDeliveryPersonFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"time_asc" | "time_desc" | "none">("time_asc");

  const [dismissOrderId, setDismissOrderId] = useState<number | null>(null);
  const [cancelData, setCancelData] = useState<{ cancelledBy: "client" | "company" | "system"; reason: string }>({
    cancelledBy: "client",
    reason: "",
  });

  const [cancellationRequestOrderId, setCancellationRequestOrderId] = useState<number | null>(null);
  const [cancellationRequestReason, setCancellationRequestReason] = useState<string>("");

  const [rescheduleOrderId, setRescheduleOrderId] = useState<number | null>(null);
  const [rescheduleData, setRescheduleData] = useState({ reason: "", date: "", time: "" });

  const [viewDeliveredOrderId, setViewDeliveredOrderId] = useState<number | null>(null);
  const { data: deliveredOrderDetails, isLoading: isLoadingDeliveredOrderDetails } = trpc.orders.getDetails.useQuery(
    { orderId: viewDeliveredOrderId ?? 0 },
    { enabled: viewDeliveredOrderId !== null }
  );

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const sheetDeliveryPersonId = Number.isFinite(Number(deliveryPersonFilter)) ? Number(deliveryPersonFilter) : null;
  const sheetDate = dateFilter || today;
  const { data: deliverySheet, isLoading: isLoadingSheet } = trpc.orders.getDeliverySheet.useQuery(
    { deliveryPersonId: sheetDeliveryPersonId ?? 0, date: sheetDate },
    { enabled: user?.role === "admin" && isSheetOpen && sheetDeliveryPersonId !== null }
  );

  const utils = trpc.useUtils();

  const dismissMutation = trpc.orders.dismissOrder.useMutation({
    onSuccess: () => {
      toast.success("Pedido dado de baja");
      setDismissOrderId(null);
      setCancelData({ cancelledBy: "client", reason: "" });
      utils.orders.list.invalidate();
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const requestCancellationMutation = trpc.orders.requestCancellation.useMutation({
    onSuccess: () => {
      toast.success("Solicitud de baja enviada al administrador");
      setCancellationRequestOrderId(null);
      setCancellationRequestReason("");
      utils.orders.listForDelivery.invalidate();
      utils.orders.list.invalidate();
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const rescheduleMutation = trpc.orders.rescheduleOrder.useMutation({
    onSuccess: () => {
      toast.success("Pedido reprogramado");
      setRescheduleOrderId(null);
      setRescheduleData({ reason: "", date: "", time: "" });
      utils.orders.list.invalidate();
      utils.orders.listForDelivery.invalidate();
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const requestRescheduleMutation = trpc.orders.requestReschedule.useMutation({
    onSuccess: () => {
      toast.success("Solicitud de reprogramación enviada");
      setRescheduleOrderId(null);
      setRescheduleData({ reason: "", date: "", time: "" });
      utils.orders.list.invalidate();
      utils.orders.listForDelivery.invalidate();
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const rejectRescheduleMutation = trpc.orders.rejectRescheduleRequest.useMutation({
    onSuccess: () => {
      toast.success("Solicitud rechazada");
      setRescheduleOrderId(null);
      utils.orders.list.invalidate();
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const sortedOrders = useMemo(() => {
    if (!orders) return [];
    
    let filtered = orders.filter((order: any) => {
      const searchMatch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatch = statusFilter === "all" || order.status === statusFilter;
      const dateMatch = !dateFilter || !order.deliveryDate || order.deliveryDate === dateFilter;
      const deliveryPersonMatch = deliveryPersonFilter === "all" || 
                                 (deliveryPersonFilter === "none" ? !order.deliveryPersonId : order.deliveryPersonId === parseInt(deliveryPersonFilter));
      
      return searchMatch && statusMatch && dateMatch && deliveryPersonMatch;
    });

    if (sortOrder === "none") return filtered;

    return [...filtered].sort((a: any, b: any) => {
      const dateA = a.deliveryDate || "9999-12-31";
      const dateB = b.deliveryDate || "9999-12-31";
      const dateCompare = sortOrder === "time_asc" ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      if (dateCompare !== 0) return dateCompare;
      const timeA = a.deliveryTime || "99:99";
      const timeB = b.deliveryTime || "99:99";
      return sortOrder === "time_asc" ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
    });
  }, [orders, searchTerm, statusFilter, sortOrder, dateFilter, deliveryPersonFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "assigned": return "bg-blue-100 text-blue-800";
      case "in_transit": return "bg-purple-100 text-purple-800";
      case "delivered": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      case "rescheduled": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendiente", assigned: "Asignado", in_transit: "En tránsito",
      delivered: "Entregado", cancelled: "Cancelado", rescheduled: "Reprogramado",
    };
    return labels[status] || status;
  };

  const openWhatsApp = (phone: string | null | undefined, orderNumber: string) => {
    if (!phone) {
      toast.error("Este pedido no tiene un número de teléfono registrado");
      return;
    }
    // Limpiar el número: quitar espacios, guiones, etc.
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    let formatted = cleaned;
    if (cleaned.startsWith("591")) {
      formatted = cleaned;
    } else if (cleaned.startsWith("0")) {
      formatted = "591" + cleaned.slice(1);
    } else {
      formatted = "591" + cleaned;
    }
    const url = `https://api.whatsapp.com/send/?phone=${formatted}`;
    window.open(url, "_blank");
  };

  const paymentMethodLabel = (method?: string) => {
    if (method === "cash") return "Efectivo";
    if (method === "qr") return "QR";
    if (method === "transfer") return "Transferencia";
    return "â€”";
  };

  const exportSheetCsv = () => {
    if (!deliverySheet) return;

    const lines: string[] = [];
    const sep = ";";
    const q = (value: any) => `"${String(value ?? "").replaceAll('"', '""')}"`;

    lines.push(
      [
        "N",
        "Pedido",
        "Cliente",
        "Tel",
        "Hora",
        "Zona",
        "Productos",
        "Total productos",
        "MÃ©todo pago",
        "Cohorte",
        "Total Bs",
        "Observaciones",
      ].map(q).join(sep)
    );

    (deliverySheet.entries || []).forEach((row: any, idx: number) => {
      const order = row.order;
      const customer = row.customer;
      const products = (row.items || [])
        .map((item: any) => `${item.productName || `Producto #${item.productId}`} x${item.quantity}`)
        .join(" | ");
      const totalProducts = (row.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
      const tel = customer?.phone || customer?.whatsapp || "";

      lines.push(
        [
          idx + 1,
          order.orderNumber || order.id,
          customer?.name || "",
          tel,
          order.deliveryTime || "",
          order.zone || "",
          products,
          totalProducts,
          paymentMethodLabel(order.paymentMethod),
          row.cohort === "new" ? "Nuevo" : "Recompra",
          ((order.totalPrice || 0) / 100).toFixed(2),
          "",
        ].map(q).join(sep)
      );
    });

    lines.push("");
    lines.push(
      q("TOTAL") + sep + q("") + sep + q("") + sep + q("") + sep + q("") + sep + q("") + sep + q("") + sep +
      q(deliverySheet.totals?.totalProducts || 0) + sep + q("") + sep + q("") + sep +
      q(((deliverySheet.totals?.totalBs || 0) / 100).toFixed(2)) + sep + q("")
    );

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hoja-reparto-${deliverySheet.deliveryPersonName || deliverySheet.deliveryPersonId}-${deliverySheet.date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printSheet = () => {
    if (!deliverySheet) return;

    const escapeHtml = (value: any) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

    const rowsHtml = (deliverySheet.entries || []).map((row: any, idx: number) => {
      const order = row.order;
      const customer = row.customer;
      const tel = customer?.phone || customer?.whatsapp || "";
      const productsHtml = (row.items || [])
        .map((item: any) => `${escapeHtml(item.productName || `Producto #${item.productId}`)} x${escapeHtml(item.quantity)}`)
        .join("<br/>");
      const totalProducts = (row.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(order.orderNumber || order.id)}</td>
          <td>${escapeHtml(customer?.name || "")}</td>
          <td>${escapeHtml(tel)}</td>
          <td>${escapeHtml(order.deliveryTime || "")}</td>
          <td>${escapeHtml(order.zone || "")}</td>
          <td>${productsHtml}</td>
          <td style="text-align:right">${escapeHtml(totalProducts)}</td>
          <td>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</td>
          <td>${row.cohort === "new" ? "Nuevo" : "Recompra"}</td>
          <td style="text-align:right">${((order.totalPrice || 0) / 100).toFixed(2)}</td>
          <td></td>
        </tr>
      `;
    }).join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Hoja de reparto</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 18px; }
            h1 { font-size: 16px; margin: 0 0 6px 0; }
            .meta { font-size: 12px; color: #333; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #222; padding: 6px; vertical-align: top; }
            th { background: #f2f2f2; text-align: left; }
            .totals { margin-top: 10px; font-size: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
            .totals div { border: 1px solid #ddd; padding: 8px; }
            @page { size: landscape; margin: 10mm; }
          </style>
        </head>
        <body>
          <h1>Hoja de reparto del dÃ­a</h1>
          <div class="meta">
            Fecha: <strong>${escapeHtml(deliverySheet.date)}</strong> &nbsp;|&nbsp;
            Repartidor: <strong>${escapeHtml(deliverySheet.deliveryPersonName || `#${deliverySheet.deliveryPersonId}`)}</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:36px">NÂ°</th>
                <th style="width:90px">Pedido</th>
                <th style="width:160px">Cliente</th>
                <th style="width:100px">Tel</th>
                <th style="width:64px">Hora</th>
                <th style="width:120px">Zona</th>
                <th>Productos</th>
                <th style="width:70px; text-align:right">Cant.</th>
                <th style="width:90px">Pago</th>
                <th style="width:90px">Nuevo/Recompra</th>
                <th style="width:90px; text-align:right">Total Bs</th>
                <th style="width:140px">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div><strong>Total Bs:</strong> ${((deliverySheet.totals?.totalBs || 0) / 100).toFixed(2)}</div>
            <div><strong>Total productos:</strong> ${deliverySheet.totals?.totalProducts || 0}</div>
            <div><strong>Nuevos:</strong> ${deliverySheet.totals?.newCustomers || 0} &nbsp; <strong>Recompra:</strong> ${deliverySheet.totals?.repeatCustomers || 0}</div>
            <div><strong>Efectivo Bs:</strong> ${((deliverySheet.totals?.cashBs || 0) / 100).toFixed(2)}</div>
            <div><strong>QR Bs:</strong> ${((deliverySheet.totals?.qrBs || 0) / 100).toFixed(2)}</div>
            <div><strong>Transferencia Bs:</strong> ${((deliverySheet.totals?.transferBs || 0) / 100).toFixed(2)}</div>
          </div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (isLoading || isLoadingDelivery) {
    return <div className="p-8 text-center">Cargando pedidos...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Gestión de Pedidos</h1>
          {user?.role === "admin" && (
            <Link href="/create-order">
              <Button className="bg-slate-900 hover:bg-slate-800 gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Pedido
              </Button>
            </Link>
          )}
        </div>

        <Card className="mb-8 border-none shadow-sm">
          <CardContent className="p-4">
            <div className={`grid grid-cols-1 md:grid-cols-2 ${user?.role === "admin" ? "lg:grid-cols-6" : "lg:grid-cols-5"} gap-4`}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Buscar por número..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Input 
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="assigned">Asignados</SelectItem>
                  <SelectItem value="in_transit">En tránsito</SelectItem>
                  <SelectItem value="delivered">Entregados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                  <SelectItem value="rescheduled">Reprogramados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(val: any) => setSortOrder(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar por hora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_asc">Hora (↑)</SelectItem>
                  <SelectItem value="time_desc">Hora (↓)</SelectItem>
                </SelectContent>
              </Select>
              {user?.role === "admin" && (
                <Select value={deliveryPersonFilter} onValueChange={setDeliveryPersonFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Repartidor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los repartidores</SelectItem>
                    <SelectItem value="none">Sin repartidor</SelectItem>
                    {((deliveryPersons as any[]) || [])
                      .filter((u: any) => u?.role === "user")
                      .map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name || u.username || `Usuario #${u.id}`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
              <Button 
                variant="ghost" 
                className="text-slate-500"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setDateFilter("");
                  setSortOrder("time_asc");
                  setDeliveryPersonFilter("all");
                }}
              >
                Limpiar filtros
              </Button>
            </div>

            {user?.role === "admin" && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Hoja del dÃ­a (repartidor + fecha): {sheetDate}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sheetDeliveryPersonId === null}
                    onClick={() => setIsSheetOpen(true)}
                  >
                    Ver hoja de reparto
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {sortedOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-slate-200">
            <p className="text-slate-500">No se encontraron pedidos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sortedOrders.map((order: any) => (
              <Card key={order.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">Pedido #{order.orderNumber}</h3>
                      <Badge className={getStatusColor(order.status)}>
                        {getStatusLabel(order.status)}
                      </Badge>
                      {order.rescheduleRequested === 1 && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-bold">
                          REP. SOLICITADA
                        </Badge>
                      )}
                      {order.cancellationRequested === 1 && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold">
                          BAJA SOLICITADA
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">Zona: {order.zone}</p>
                    {order.notes && (
                      <p className="text-sm text-amber-600 font-medium mb-1">Nota: {order.notes}</p>
                    )}
                    {order.deliveryDate && (
                      <p className="text-sm text-muted-foreground mb-1">
                        Entrega programada: {order.deliveryDate} {order.deliveryTime ? `a las ${order.deliveryTime}` : ""}
                      </p>
                    )}
                    {order.deliveryPersonName && (
                      <p className="text-sm text-muted-foreground mb-1">Repartidor: {order.deliveryPersonName}</p>
                    )}
                    <p className="text-sm font-bold mt-2">Total: {formatCurrency(order.totalPrice)}</p>
                    {order.status === "cancelled" && order.cancelReason && (
                      <p className="text-xs text-red-600 mt-2">
                        Motivo baja: <span className="font-medium">{order.cancelReason}</span>
                      </p>
                    )}
                    {order.cancellationRequested === 1 && order.cancellationReason && (
                      <p className="text-xs text-orange-700 mt-2">
                        Baja solicitada: <span className="font-medium">{order.cancellationReason}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {user?.role === "admin" && (
                      <Link href={`/order/${order.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </Link>
                    )}
                    {user?.role === "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => openWhatsApp(order.customerWhatsapp || order.customerPhone, order.orderNumber)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </Button>
                    )}
                    {user?.role === "admin" && order.status !== "cancelled" && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`gap-2 ${order.rescheduleRequested === 1 ? 'bg-orange-600 text-white hover:bg-orange-700' : 'text-orange-600 border-orange-200'}`}
                          onClick={() => {
                            setRescheduleOrderId(order.id);
                            if (order.rescheduleRequested === 1) {
                              setRescheduleData({
                                date: order.requestedDate || "",
                                time: order.requestedTime || "",
                                reason: order.rescheduleReason || ""
                              });
                            } else {
                              setRescheduleData({
                                date: order.deliveryDate || "",
                                time: order.deliveryTime || "",
                                reason: order.rescheduleReason || ""
                              });
                            }
                          }}
                        >
                          <Calendar className="h-4 w-4" />
                          {order.rescheduleRequested === 1 ? "Atender Solicitud" : "Reprogramar"}
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => setDismissOrderId(order.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Baja
                        </Button>
                      </>
                    )}
                    {user?.role === "user" && (order.status === "assigned" || order.status === "in_transit" || order.status === "rescheduled") && (
                      <>
                        <Link href={`/order/${order.id}`}>
                          <Button variant="default" size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                            <DollarSign className="h-4 w-4" />
                            Entregar / Cobrar
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 text-orange-600 border-orange-200"
                          onClick={() => {
                            setRescheduleOrderId(order.id);
                            setRescheduleData({ reason: "", date: order.deliveryDate || "", time: order.deliveryTime || "" });
                          }}
                        >
                          <Calendar className="h-4 w-4" />
                          Reprogramar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-red-600 border-red-200"
                          disabled={order.cancellationRequested === 1}
                          onClick={() => {
                            setCancellationRequestOrderId(order.id);
                            setCancellationRequestReason(order.cancellationReason || "");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          {order.cancellationRequested === 1 ? "Baja solicitada" : "Baja"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => openWhatsApp(order.customerWhatsapp || order.customerPhone, order.orderNumber)}
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </Button>
                      </>
                    )}
                    {user?.role === "user" && order.status === "delivered" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setViewDeliveredOrderId(order.id)}
                      >
                        <Eye className="h-4 w-4" />
                        Ver productos
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Diálogo: solicitar baja (repartidor) */}
        <Dialog open={cancellationRequestOrderId !== null} onOpenChange={(open) => !open && setCancellationRequestOrderId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar baja / entrega cancelada</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Esto enviará una solicitud al administrador para dar de baja el pedido.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo</label>
                <Textarea
                  placeholder="Ej: Cliente no responde, dirección incorrecta, cliente canceló, etc."
                  value={cancellationRequestReason}
                  onChange={(e) => setCancellationRequestReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancellationRequestOrderId(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!cancellationRequestOrderId) return;
                  requestCancellationMutation.mutate({
                    orderId: cancellationRequestOrderId,
                    reason: cancellationRequestReason,
                  });
                }}
                disabled={requestCancellationMutation.isPending || cancellationRequestReason.trim().length < 3}
              >
                Enviar solicitud
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo: productos entregados */}
        <Dialog open={viewDeliveredOrderId !== null} onOpenChange={(open) => !open && setViewDeliveredOrderId(null)}>
          <DialogContent className="sm:max-w-[650px]">
            <DialogHeader>
              <DialogTitle>Detalle de Entrega</DialogTitle>
            </DialogHeader>

            {isLoadingDeliveredOrderDetails || !deliveredOrderDetails ? (
              <div className="space-y-3 py-2">
                <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                <div className="h-28 bg-muted animate-pulse rounded" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-slate-50/50 p-3 text-sm">
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span className="font-semibold">Pedido:</span>
                    <span>{deliveredOrderDetails.order.orderNumber}</span>
                    <span className="font-semibold">Zona:</span>
                    <span>{deliveredOrderDetails.order.zone}</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">Producto</th>
                        <th className="text-right px-3 py-2 font-semibold w-24">Cantidad</th>
                        <th className="text-right px-3 py-2 font-semibold w-28">Precio</th>
                        <th className="text-right px-3 py-2 font-semibold w-28">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(deliveredOrderDetails.items || []).map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{item.productName || `Producto #${item.productId}`}</td>
                          <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatCurrency(item.price)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatCurrency((item.price || 0) * (item.quantity || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 border-t">
                      <tr>
                        <td className="px-3 py-2 font-bold" colSpan={3}>Total</td>
                        <td className="px-3 py-2 text-right font-black">{formatCurrency(deliveredOrderDetails.order.totalPrice)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDeliveredOrderId(null)}>Cerrar</Button>
              {viewDeliveredOrderId ? (
                <Link href={`/order/${viewDeliveredOrderId}`}>
                  <Button className="gap-2">
                    <Eye className="h-4 w-4" />
                    Ver completo
                  </Button>
                </Link>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo: hoja de reparto (admin) */}
        <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <DialogContent className="sm:max-w-[980px]">
            <DialogHeader>
              <DialogTitle>Hoja de reparto del día</DialogTitle>
            </DialogHeader>

            {sheetDeliveryPersonId === null ? (
              <div className="py-4 text-sm text-muted-foreground">Selecciona un repartidor para ver la hoja.</div>
            ) : isLoadingSheet || !deliverySheet ? (
              <div className="py-4 text-sm text-muted-foreground">Cargando hoja...</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-slate-50/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span><strong>Fecha:</strong> {deliverySheet.date}</span>
                      <span><strong>Repartidor:</strong> {deliverySheet.deliveryPersonName || `#${deliverySheet.deliveryPersonId}`}</span>
                      <span><strong>Pedidos:</strong> {deliverySheet.entries.length}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => printSheet()}>
                        Imprimir
                      </Button>
                      <Button type="button" variant="outline" onClick={() => exportSheetCsv()}>
                        Exportar CSV
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold w-12">N°</th>
                        <th className="text-left px-3 py-2 font-semibold w-28">Pedido</th>
                        <th className="text-left px-3 py-2 font-semibold">Cliente</th>
                        <th className="text-left px-3 py-2 font-semibold w-28">Tel</th>
                        <th className="text-left px-3 py-2 font-semibold w-20">Hora</th>
                        <th className="text-left px-3 py-2 font-semibold w-40">Zona</th>
                        <th className="text-left px-3 py-2 font-semibold">Productos</th>
                        <th className="text-right px-3 py-2 font-semibold w-16">Cant.</th>
                        <th className="text-left px-3 py-2 font-semibold w-28">Pago</th>
                        <th className="text-left px-3 py-2 font-semibold w-28">Nuevo</th>
                        <th className="text-right px-3 py-2 font-semibold w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {deliverySheet.entries.map((row: any, idx: number) => {
                        const order = row.order;
                        const customer = row.customer;
                        const tel = customer?.phone || customer?.whatsapp || "—";
                        const totalProducts = (row.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
                        const products = (row.items || []).map((item: any) => `${item.productName || `Producto #${item.productId}`} x${item.quantity}`).join(", ");

                        return (
                          <tr key={order.id}>
                            <td className="px-3 py-2">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono">{order.orderNumber}</td>
                            <td className="px-3 py-2">{customer?.name || "—"}</td>
                            <td className="px-3 py-2 font-mono">{tel}</td>
                            <td className="px-3 py-2 font-mono">{order.deliveryTime || "—"}</td>
                            <td className="px-3 py-2">{order.zone || "—"}</td>
                            <td className="px-3 py-2">{products || "—"}</td>
                            <td className="px-3 py-2 text-right font-mono">{totalProducts}</td>
                            <td className="px-3 py-2">{paymentMethodLabel(order.paymentMethod)}</td>
                            <td className="px-3 py-2">
                              {row.cohort === "new" ? (
                                <Badge variant="default">Nuevo</Badge>
                              ) : (
                                <Badge variant="outline">Recompra</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{formatCurrency(order.totalPrice)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50/60 border-t">
                      <tr>
                        <td className="px-3 py-2 font-bold" colSpan={7}>Totales</td>
                        <td className="px-3 py-2 text-right font-bold font-mono">{deliverySheet.totals?.totalProducts || 0}</td>
                        <td className="px-3 py-2" colSpan={2}>
                          <span className="text-xs text-muted-foreground">
                            Nuevos: {deliverySheet.totals?.newCustomers || 0} · Recompra: {deliverySheet.totals?.repeatCustomers || 0}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-black font-mono">{formatCurrency(deliverySheet.totals?.totalBs || 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="grid gap-3 md:grid-cols-3 text-sm">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Efectivo</p>
                      <p className="font-semibold">{formatCurrency(deliverySheet.totals?.cashBs || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">QR</p>
                      <p className="font-semibold">{formatCurrency(deliverySheet.totals?.qrBs || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Transferencia</p>
                      <p className="font-semibold">{formatCurrency(deliverySheet.totals?.transferBs || 0)}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSheetOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Baja */}
        <Dialog open={dismissOrderId !== null} onOpenChange={(open) => !open && setDismissOrderId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dar de baja pedido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">¿Quién cancela?</label>
                <Select value={cancelData.cancelledBy} onValueChange={(val: any) => setCancelData({ ...cancelData, cancelledBy: val })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona quién cancela" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Cliente</SelectItem>
                    <SelectItem value="company">Empresa</SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo de la baja</label>
                <Textarea 
                  placeholder="Escribe el motivo aquí..."
                  value={cancelData.reason}
                  onChange={(e) => setCancelData({ ...cancelData, reason: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDismissOrderId(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => dismissOrderId && dismissMutation.mutate({ orderId: dismissOrderId, ...cancelData })} disabled={dismissMutation.isPending || !cancelData.reason}>
                Confirmar Baja
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Reprogramación */}
        <Dialog open={rescheduleOrderId !== null} onOpenChange={(open) => !open && setRescheduleOrderId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reprogramar pedido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {rescheduleOrderId && sortedOrders.find((o: any) => o.id === rescheduleOrderId)?.rescheduleRequested === 1 && (
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 mb-2">
                  <p className="text-xs font-bold text-orange-800 uppercase mb-1">Solicitud del Repartidor:</p>
                  <p className="text-sm text-orange-700 italic">"{sortedOrders.find((o: any) => o.id === rescheduleOrderId)?.rescheduleReason}"</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nueva Fecha</label>
                  <Input type="date" value={rescheduleData.date} onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nueva Hora</label>
                  <Input type="time" value={rescheduleData.time} onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo de reprogramación</label>
                <Textarea 
                  placeholder="Escribe por qué se reprograma..."
                  value={rescheduleData.reason}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, reason: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="flex justify-between sm:justify-between w-full">
              <div>
                {rescheduleOrderId && sortedOrders.find((o: any) => o.id === rescheduleOrderId)?.rescheduleRequested === 1 && (
                  <Button 
                    variant="ghost" 
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 p-0 h-auto font-bold"
                    onClick={() => rescheduleOrderId && rejectRescheduleMutation.mutate({ orderId: rescheduleOrderId })}
                    disabled={rejectRescheduleMutation.isPending}
                  >
                    Rechazar Solicitud
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRescheduleOrderId(null)}>Cancelar</Button>
                <Button 
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => {
                    if (!rescheduleOrderId) return;
                    const data = {
                      orderId: rescheduleOrderId,
                      reason: rescheduleData.reason,
                      newDate: rescheduleData.date,
                      newTime: rescheduleData.time
                    };
                    if (user?.role === "admin") {
                      rescheduleMutation.mutate(data);
                    } else {
                      requestRescheduleMutation.mutate(data);
                    }
                  }}
                  disabled={rescheduleMutation.isPending || requestRescheduleMutation.isPending || !rescheduleData.reason}
                >
                  {user?.role === "admin" ? "Aprobar y Guardar" : "Solicitar Reprogramación"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
