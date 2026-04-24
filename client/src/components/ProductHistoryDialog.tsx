import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Clock3,
  Eye,
  PackagePlus,
  PencilLine,
  RotateCcw,
  ShoppingCart,
  Truck,
  User,
} from "lucide-react";

interface ProductHistoryDialogProps {
  productId: number;
  productName: string;
}

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getEventBadge(eventType: string) {
  switch (eventType) {
    case "created":
      return <Badge className="bg-blue-600 text-white hover:bg-blue-600">Creado</Badge>;
    case "purchase":
      return <Badge className="bg-sky-600 text-white hover:bg-sky-600">Compra</Badge>;
    case "sale":
      return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Venta</Badge>;
    case "sale_cancellation":
      return <Badge variant="secondary">Reposicion</Badge>;
    case "order_reservation":
      return <Badge className="bg-orange-500 text-white hover:bg-orange-500">Pedido</Badge>;
    case "order_cancellation":
      return <Badge variant="destructive">Pedido cancelado</Badge>;
    case "order_delivery":
      return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Entregado</Badge>;
    case "deactivated":
      return <Badge variant="destructive">Baja</Badge>;
    case "reactivated":
      return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Reactivado</Badge>;
    case "updated":
      return <Badge variant="outline">Actualizacion</Badge>;
    case "inventory_entry":
      return <Badge className="bg-cyan-600 text-white hover:bg-cyan-600">Entrada</Badge>;
    case "inventory_exit":
      return <Badge variant="secondary">Salida</Badge>;
    default:
      return <Badge variant="outline">Ajuste</Badge>;
  }
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "created":
      return <PackagePlus className="h-4 w-4 text-blue-600" />;
    case "purchase":
      return <Truck className="h-4 w-4 text-sky-600" />;
    case "sale":
      return <ShoppingCart className="h-4 w-4 text-emerald-600" />;
    case "sale_cancellation":
      return <RotateCcw className="h-4 w-4 text-slate-600" />;
    case "order_reservation":
      return <Truck className="h-4 w-4 text-orange-500" />;
    case "order_cancellation":
      return <Ban className="h-4 w-4 text-red-600" />;
    case "order_delivery":
      return <Eye className="h-4 w-4 text-amber-600" />;
    case "deactivated":
      return <Ban className="h-4 w-4 text-red-600" />;
    case "reactivated":
      return <RotateCcw className="h-4 w-4 text-amber-600" />;
    case "updated":
      return <PencilLine className="h-4 w-4 text-slate-600" />;
    case "inventory_entry":
      return <ArrowUp className="h-4 w-4 text-cyan-600" />;
    case "inventory_exit":
      return <ArrowDown className="h-4 w-4 text-slate-600" />;
    default:
      return <Clock3 className="h-4 w-4 text-slate-600" />;
  }
}

function getQuantityLabel(event: any) {
  if (!event.quantity) {
    return "Sin cambio de cantidad";
  }

  if (event.eventType === "sale" || event.eventType === "inventory_exit") {
    return `-${event.quantity} unidades`;
  }

  if (
    event.eventType === "purchase" ||
    event.eventType === "sale_cancellation" ||
    event.eventType === "inventory_entry"
  ) {
    return `+${event.quantity} unidades`;
  }

  if (event.eventType === "order_reservation") {
    return `-${event.quantity} en pedido`;
  }

  if (event.eventType === "order_cancellation") {
    return `+${event.quantity} repuesto`;
  }

  if (event.eventType === "order_delivery") {
    return `${event.quantity} entregados`;
  }

  return `${event.quantity} unidades`;
}

export function ProductHistoryDialog({
  productId,
  productName,
}: ProductHistoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading } = trpc.inventory.getProductHistory.useQuery(
    { productId },
    { enabled: isOpen }
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Eye className="h-4 w-4" />
          Historial
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Seguimiento del producto</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Historial completo de {productName}.
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Cargando historial...
          </div>
        ) : !data ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No se pudo cargar el historial.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Codigo</p>
                <p className="font-semibold">{data.product.code}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Stock actual</p>
                <p className="font-semibold">{data.stock?.quantity ?? 0} unidades</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Unidades compradas</p>
                <p className="font-semibold">{data.summary.totalPurchasedUnits}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Unidades vendidas</p>
                <p className="font-semibold">{data.summary.totalSoldUnits}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Estado actual</p>
                <p className="font-semibold">
                  {data.summary.currentStatus === "inactive" ? "Dado de baja" : "Activo"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{data.product.name}</span>
                <span className="text-muted-foreground">
                  Compra: {formatCurrency(data.product.price)}
                </span>
                <span className="text-muted-foreground">
                  Venta: {formatCurrency(data.product.salePrice)}
                </span>
                <span className="text-muted-foreground">
                  Eventos registrados: {data.summary.totalEvents}
                </span>
              </div>
            </div>

            <ScrollArea className="h-[420px] rounded-lg border">
              <div className="space-y-3 p-4">
                {data.timeline.map((event: any) => (
                  <div
                    key={event.id}
                    className="rounded-lg border bg-background p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {getEventIcon(event.eventType)}
                          <p className="font-semibold">{event.title}</p>
                          {getEventBadge(event.eventType)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                        
                        {(event.orderNumber || event.saleNumber || event.userName || event.deliveryPersonName) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
                            {event.orderNumber && (
                              <div className="flex items-center gap-1 text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded-md">
                                <Truck className="h-3 w-3" />
                                Pedido: {event.orderNumber}
                                {event.orderStatus ? (
                                  <span className={`ml-1 px-1 rounded ${event.orderStatus === 'delivered' ? 'bg-green-100 text-green-700' : event.orderStatus === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {event.orderStatus === 'delivered' ? '✓ Entregado' : event.orderStatus === 'cancelled' ? '✗ Cancelado' : '⏳ Pendiente'}
                                  </span>
                                ) : null}
                              </div>
                            )}
                            {event.saleNumber && (
                              <div className="flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                <ShoppingCart className="h-3 w-3" />
                                Venta: {event.saleNumber}
                              </div>
                            )}
                            {event.deliveryPersonName && (
                              <div className="flex items-center gap-1 text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded-md">
                                <Truck className="h-3 w-3" />
                                Repartidor: {event.deliveryPersonName}
                              </div>
                            )}
                            {event.userName && !event.deliveryPersonName && (
                              <div className="flex items-center gap-1 text-slate-600 font-medium bg-slate-100 px-1.5 py-0.5 rounded-md">
                                <User className="h-3 w-3" />
                                {event.userName} {event.userRole && <span className="text-[10px] opacity-70">({event.userRole === 'admin' ? 'Admin' : 'Repartidor'})</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 text-sm md:text-right">
                        <p className="font-medium">{getQuantityLabel(event)}</p>
                        <p className="text-muted-foreground">
                          {formatDateTime(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
