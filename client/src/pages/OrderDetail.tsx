import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRoute } from "wouter";
import { MessageCircle, MapPin, DollarSign, Receipt, Banknote, QrCode, Building2, AlertCircle, Calendar } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default function OrderDetail() {
  const { user } = useAuth();
  const [, params] = useRoute("/order/:orderId");
  const orderId = params?.orderId ? parseInt(params.orderId) : null;
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr" | "transfer">("cash");

  const { data: orderDetails, isLoading } = trpc.orders.getDetails.useQuery(
    { orderId: orderId || 0 },
    { enabled: !!orderId }
  );

  const utils = trpc.useUtils();
  const recordPaymentMutation = trpc.orders.recordPayment.useMutation();
  const updateStatusMutation = trpc.orders.updateStatus.useMutation();

  if (!orderId || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Cargando detalles del pedido...</p>
      </div>
    );
  }

  if (!orderDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-600">Pedido no encontrado</p>
      </div>
    );
  }

  const { order, items } = orderDetails;

  const handleMarkAsDelivered = () => {
    if (user?.role === "user") {
      updateStatusMutation.mutate({
        orderId: order.id,
        status: "delivered",
      });
    }
  };

  const handleRecordPayment = () => {
    recordPaymentMutation.mutate({
      orderId: order.id,
      amount: order.totalPrice,
      method: paymentMethod,
    }, {
      onSuccess: () => {
        toast.success(`Pago registrado correctamente (${paymentMethod === "cash" ? "Efectivo" : paymentMethod === "qr" ? "QR" : "Transferencia"})`);
        setShowPaymentForm(false);
        // Invalidar todas las consultas relacionadas para refrescar datos
        utils.orders.getDetails.invalidate({ orderId: order.id });
        utils.orders.list.invalidate();
        utils.orders.listForDelivery.invalidate();
        utils.finance.getExpectedDaily.invalidate();
        utils.finance.getMyStatus.invalidate();
        utils.inventory.listInventory.invalidate();
        utils.finance.getTransactions.invalidate();
      },
      onError: (err: any) => toast.error(err.message || "Error al registrar pago"),
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Botón de Impresión */}
        <div className="mb-6 flex justify-end no-print">
          <Button 
            variant="outline" 
            className="gap-2 border-primary text-primary hover:bg-primary/5"
            onClick={() => window.print()}
          >
            <Receipt className="h-4 w-4" />
            Generar Recibo / PDF
          </Button>
        </div>

        {/* Estilos para impresión */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden; }
            .print-receipt, .print-receipt * { visibility: visible; }
            .print-receipt { 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 100%; 
              padding: 20px;
              color: black !important;
              background: white !important;
            }
            .no-print { display: none !important; }
          }
        `}} />

        {/* Vista de Recibo para Impresión */}
        <div className="hidden print-receipt p-8 border-2 border-gray-100 rounded-xl bg-white text-black">
          <div className="flex justify-between items-start mb-8 border-b pb-6">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-black">COMPROBANTE DE ENTREGA</h2>
              <p className="text-sm text-gray-500 mt-1">Order # {order.orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">EMPRESA DE DISTRIBUCIÓN</p>
              <p className="text-xs text-gray-400">Fecha: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Cliente</p>
              <p className="font-bold text-lg">{(order as any).customerName || "Consumidor Final"}</p>
              <p className="text-sm text-gray-600">Zona: {order.zone}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Estado de Pago</p>
              <p className={`font-bold text-lg ${order.paymentStatus === 'completed' ? 'text-green-600' : 'text-orange-600'}`}>
                {order.paymentStatus === 'completed' ? 'PAGADO' : 'PENDIENTE'}
              </p>
              <p className="text-sm text-gray-600">Metodo: {order.paymentMethod || 'Efectivo'}</p>
            </div>
          </div>

          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-2 font-black uppercase text-xs">Descripción</th>
                <th className="text-center py-2 font-black uppercase text-xs">Cant.</th>
                <th className="text-right py-2 font-black uppercase text-xs">Precio</th>
                <th className="text-right py-2 font-black uppercase text-xs">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-3 text-sm">{item.productName || `Producto #${item.productId}`}</td>
                  <td className="py-3 text-center text-sm">{item.quantity}</td>
                  <td className="py-3 text-right text-sm">{formatCurrency(item.price)}</td>
                  <td className="py-3 text-right font-bold text-sm">
                    {formatCurrency(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Alertas de solicitud */}
          {order.rescheduleRequested === 1 && (
            <Alert className="mb-6 bg-orange-50 border-orange-200">
              <Calendar className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800">Reprogramación Solicitada</AlertTitle>
              <AlertDescription className="text-orange-700">
                El repartidor ha solicitado reprogramar para el {order.requestedDate} {order.requestedTime}.
                Razón: {order.rescheduleReason}
              </AlertDescription>
            </Alert>
          )}

          {order.cancellationRequested === 1 && (
            <Alert className="mb-6 bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800">Solicitud de Baja</AlertTitle>
              <AlertDescription className="text-red-700">
                Se ha solicitado la baja de este pedido. Razón: {order.cancellationReason}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end mb-12">
            <div className="w-64 bg-black p-4 rounded-xl text-white">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-400">Subtotal</span>
                <span className="text-sm">{formatCurrency(order.totalPrice)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/20 pt-2 mt-2">
                <span className="text-sm font-bold uppercase tracking-widest">Total Final</span>
                <span className="text-xl font-black">{formatCurrency(order.totalPrice)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-20 px-8 pt-20">
            <div className="border-t border-black text-center pt-2">
              <p className="text-xs font-bold uppercase">Firma del Repartidor</p>
              <p className="text-[10px] text-gray-500 mt-1">{order.deliveryPersonName || "Entregado por la Empresa"}</p>
            </div>
            <div className="border-t border-black text-center pt-2">
              <p className="text-xs font-bold uppercase">Firma del Cliente</p>
              <p className="text-[10px] text-gray-500 mt-1">Conformidad de Recepción</p>
            </div>
          </div>
          
          <div className="mt-20 text-center text-[10px] text-gray-400 uppercase tracking-[0.2em]">
            Gracias por su preferencia • Documento de Control Interno
          </div>
        </div>

        {/* Estado del pedido */}
        <Card className="mb-6 no-print">
          <CardHeader>
            <CardTitle>Estado del Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge className="mt-2">
                  {order.status === "pending" && "Pendiente"}
                  {order.status === "assigned" && "Asignado"}
                  {order.status === "in_transit" && "En tránsito"}
                  {order.status === "delivered" && "Entregado"}
                  {order.status === "cancelled" && "Cancelado"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pago</p>
                <Badge className="mt-2" variant={order.paymentStatus === "completed" ? "default" : "outline"}>
                  {order.paymentStatus === "completed" && "Pagado"}
                  {order.paymentStatus === "pending" && "Pendiente"}
                  {order.paymentStatus === "failed" && "Fallido"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Zona</p>
                <p className="font-semibold mt-2">{order.zone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entrega Programada</p>
                <p className="font-semibold mt-2">
                  {order.deliveryDate ? (
                    <>
                      {order.deliveryDate}
                      {order.deliveryTime && <span className="text-muted-foreground block text-xs">a las {order.deliveryTime}</span>}
                    </>
                  ) : (
                    <span className="text-muted-foreground font-normal">No especificada</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detalles del pedido */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Detalles del Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Producto</th>
                    <th className="text-left py-3 px-4 font-semibold">Cantidad</th>
                    <th className="text-left py-3 px-4 font-semibold">Precio Unit.</th>
                    <th className="text-left py-3 px-4 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">{(item as any).productName || `Producto #${item.productId}`}</td>
                      <td className="py-3 px-4">{item.quantity}</td>
                      <td className="py-3 px-4">{formatCurrency(item.price)}</td>
                      <td className="py-3 px-4 font-semibold">
                        {formatCurrency(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="mt-6 pt-4 border-t flex justify-between items-center">
              <p className="text-lg font-bold">Total:</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(order.totalPrice)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Acciones según el rol */}
        {user?.role === "user" && order.status === "in_transit" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Acciones de Entrega</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button
                onClick={handleMarkAsDelivered}
                className="gap-2"
                disabled={updateStatusMutation.isPending}
              >
                <MapPin className="h-4 w-4" />
                Marcar como Entregado
              </Button>

              <a
                href={`https://wa.me/+5491234567890?text=Hola,%20estoy%20entregando%20tu%20pedido%20%23${order.orderNumber}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full gap-2 bg-green-50">
                  <MessageCircle className="h-4 w-4" />
                  Contactar por WhatsApp
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Formulario de pago */}
        {order.paymentStatus === "pending" && (
          <Card className="mb-6 border-2 border-emerald-200 bg-emerald-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <DollarSign className="h-5 w-5" />
                Registrar Pago — {formatCurrency(order.totalPrice)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground font-medium">Selecciona el método con el que cobró el cliente:</p>
              <div className="grid grid-cols-3 gap-3">
                {/* Efectivo */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    paymentMethod === "cash"
                      ? "border-emerald-500 bg-emerald-100 shadow-md"
                      : "border-slate-200 bg-white hover:border-emerald-300"
                  }`}
                >
                  <Banknote className={`h-7 w-7 ${paymentMethod === "cash" ? "text-emerald-600" : "text-slate-400"}`} />
                  <span className={`text-sm font-bold ${paymentMethod === "cash" ? "text-emerald-700" : "text-slate-600"}`}>Efectivo</span>
                </button>

                {/* QR */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("qr")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    paymentMethod === "qr"
                      ? "border-blue-500 bg-blue-100 shadow-md"
                      : "border-slate-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <QrCode className={`h-7 w-7 ${paymentMethod === "qr" ? "text-blue-600" : "text-slate-400"}`} />
                  <span className={`text-sm font-bold ${paymentMethod === "qr" ? "text-blue-700" : "text-slate-600"}`}>QR</span>
                </button>

                {/* Transferencia */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("transfer")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    paymentMethod === "transfer"
                      ? "border-purple-500 bg-purple-100 shadow-md"
                      : "border-slate-200 bg-white hover:border-purple-300"
                  }`}
                >
                  <Building2 className={`h-7 w-7 ${paymentMethod === "transfer" ? "text-purple-600" : "text-slate-400"}`} />
                  <span className={`text-sm font-bold ${paymentMethod === "transfer" ? "text-purple-700" : "text-slate-600"}`}>Transferencia</span>
                </button>
              </div>

              <Button
                className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 gap-2"
                onClick={handleRecordPayment}
                disabled={recordPaymentMutation.isPending}
              >
                <DollarSign className="h-5 w-5" />
                {recordPaymentMutation.isPending ? "Registrando..." : `Confirmar Pago con ${paymentMethod === "cash" ? "Efectivo" : paymentMethod === "qr" ? "QR" : "Transferencia"}`}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
