import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { Wallet, QrCode, Landmark, Receipt, AlertCircle, CheckCircle2, Truck, PackageCheck, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function paymentMethodLabel(method?: string) {
  if (!method) return "—";
  if (method === "cash") return "Efectivo";
  if (method === "qr") return "QR";
  if (method === "transfer") return "Transferencia";
  return method;
}

export default function RepartidorFinance() {
  const getLocalDateInputValue = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
  };

  const today = getLocalDateInputValue();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    initialCash: 0,
    reportedCash: 0,
    reportedQr: 0,
    reportedTransfer: 0,
    expenses: 0,
  });

  const { data: status, refetch: refetchStatus } = trpc.finance.getMyStatus.useQuery({ date: today });
  const { data: pendingOrders } = trpc.finance.getPendingOrders.useQuery({});
  const { data: expected, isLoading: isLoadingExpected } = trpc.finance.getExpectedDaily.useQuery({ date: today });
  const { data: deliveryHistory } = trpc.finance.getDeliveryHistory.useQuery({ date: today });
  const { data: myClosures, isLoading: isLoadingClosures } = trpc.finance.listMyClosures.useQuery();

  const submitMutation = trpc.finance.submitClosure.useMutation({
    onSuccess: () => {
      toast.success("Cierre de caja enviado correctamente.");
      refetchStatus();
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status?.status === "pending") return;

    setIsSubmitting(true);
    try {
      await submitMutation.mutateAsync({
        date: today,
        initialCash: formData.initialCash,
        reportedCash: formData.reportedCash,
        reportedQr: formData.reportedQr,
        reportedTransfer: formData.reportedTransfer,
        expenses: formData.expenses,
        expectedCash: expected?.cash || 0,
        expectedQr: expected?.qr || 0,
        expectedTransfer: expected?.transfer || 0,
        pendingOrders: pendingOrders?.total || 0,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status && status.status === "pending") {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <Card className="border-t-4 border-t-blue-500 shadow-xl overflow-hidden">
          <CardHeader className="text-center pb-2 bg-slate-50/50">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
              <Receipt className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-800">Cierre en Revisión</CardTitle>
            <CardDescription className="text-slate-500 font-medium">
              Tu reporte del día {today} ha sido enviado al administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex justify-between items-center px-4 py-3 bg-white border border-slate-100 rounded-xl shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estado Actual</span>
              <Badge className="bg-blue-600 hover:bg-blue-700 font-bold px-3 py-1">
                PENDIENTE DE APROBACIÓN
              </Badge>
            </div>

            {status?.pendingOrders != null && status.pendingOrders > 0 && (
              <div className="p-4 bg-orange-50 rounded-xl border-2 border-orange-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-full">
                    <Truck className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-orange-700 uppercase tracking-wider">Monto Pendiente de Entregas</p>
                    <p className="text-2xl font-black text-orange-800">{formatCurrency(status.pendingOrders)}</p>
                    <p className="text-[10px] text-orange-500 italic">Pedidos asignados y sin entregar</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-50/50 border-none shadow-none">
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Efectivo Enviado</p>
                  <p className="text-2xl font-black text-slate-700">{formatCurrency(status.reportedCash)}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50/50 border-none shadow-none">
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] text-slate-400 font-black uppercase mb-1">QR Enviado</p>
                  <p className="text-2xl font-black text-slate-700">{formatCurrency(status.reportedQr)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3 items-start">
               <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
               <p className="text-xs text-blue-800 leading-relaxed font-medium">
                 Mientras el administrador revisa este arqueo, no podrás enviar nuevos reportes.
                 Una vez aprobado, el administrador abrirá tu nueva caja automáticamente.
               </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Totales en Bs. para comparativa visual
  const totalReported = formData.reportedCash + formData.reportedQr + formData.reportedTransfer;
  const expectedCashBs = (expected?.cash || 0) / 100;
  const expectedQrBs = (expected?.qr || 0) / 100;
  const expectedTransferBs = (expected?.transfer || 0) / 100;
  const totalExpectedBs = expectedCashBs + expectedQrBs + expectedTransferBs;
  const diffCents = (totalReported * 100) - ((expected?.cash || 0) + (expected?.qr || 0) + (expected?.transfer || 0));

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cierre de Caja Diario</h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        <Badge
          variant="outline"
          className={
            status?.status === "approved"
              ? "text-emerald-700 border-emerald-200 bg-emerald-50"
              : status?.status === "rejected"
                ? "text-red-700 border-red-200 bg-red-50"
                : "text-blue-600 border-blue-200 bg-blue-50"
          }
        >
          {status?.status === "approved" ? "Último cierre aprobado" : status?.status === "rejected" ? "Último cierre rechazado" : "En Turno"}
        </Badge>
      </div>

      {status && status.status !== "pending" ? (
        <Card className="border border-slate-100 bg-slate-50/40">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-bold text-slate-600">
              Último cierre: #{status.id} · {status.date} · {status.status === "approved" ? "Aprobado" : "Rechazado"}
            </p>
            {status.adminNotes ? (
              <p className="text-xs text-slate-600">Nota admin: {status.adminNotes}</p>
            ) : null}
            <p className="text-[10px] text-slate-500">
              El “Sugerido (Sistema)” de hoy ya descuenta lo que fue aprobado en ese cierre.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pedidos Pendientes */}
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-full">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <Label className="text-orange-100 text-xs font-bold uppercase tracking-wider">Monto Pendiente de Entregas</Label>
                <p className="text-2xl font-black mt-1">
                  {pendingOrders ? formatCurrency(pendingOrders.total) : "..."}
                </p>
                <p className="text-[10px] text-orange-200 italic">
                  {pendingOrders ? `${pendingOrders.count} pedido${pendingOrders.count !== 1 ? "s" : ""} sin entregar` : "Cargando..."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monto Asignado */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-full">
                <Wallet className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider">Monto Inicial Asignado</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-black">Bs.</span>
                  <Input
                    type="number"
                    className="bg-transparent border-none text-2xl font-black p-0 h-auto focus-visible:ring-0 w-32"
                    value={formData.initialCash}
                    onChange={(e) => setFormData({...formData, initialCash: parseFloat(e.target.value) || 0})}
                  />
                  <p className="text-[10px] text-slate-400 italic">(Dinero recibido para cambio)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingresos del Día */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-green-700 font-bold uppercase text-[10px]">
              <Wallet className="w-3 h-3" /> Efectivo Recaudado
            </Label>
            <Input
              type="number"
              placeholder="0.00"
              className="font-bold text-lg"
              value={formData.reportedCash}
              onChange={(e) => setFormData({...formData, reportedCash: parseFloat(e.target.value) || 0})}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-blue-700 font-bold uppercase text-[10px]">
              <QrCode className="w-3 h-3" /> Cobros por QR
            </Label>
            <Input
              type="number"
              placeholder="0.00"
              className="font-bold text-lg"
              value={formData.reportedQr}
              onChange={(e) => setFormData({...formData, reportedQr: parseFloat(e.target.value) || 0})}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-purple-700 font-bold uppercase text-[10px]">
              <Landmark className="w-3 h-3" /> Transf. Directas
            </Label>
            <Input
              type="number"
              placeholder="0.00"
              className="font-bold text-lg"
              value={formData.reportedTransfer}
              onChange={(e) => setFormData({...formData, reportedTransfer: parseFloat(e.target.value) || 0})}
            />
          </div>
        </div>

        {/* Gastos */}
        <Card>
          <CardContent className="p-4 flex gap-4 items-center">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Receipt className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <Label className="text-[10px] font-bold text-orange-600 uppercase">Gastos del día (Gasolina, etc.)</Label>
              <Input
                type="number"
                placeholder="0.00"
                className="mt-1 h-8 text-sm"
                value={formData.expenses}
                onChange={(e) => setFormData({...formData, expenses: parseFloat(e.target.value) || 0})}
              />
            </div>
          </CardContent>
        </Card>

        {/* Resumen Comparativo */}
        <Card className="overflow-hidden border-2 border-slate-100">
          <CardHeader className="bg-slate-50 py-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-500" /> Comparativa vs Sistema
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!expected}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    reportedCash: Number(expectedCashBs.toFixed(2)),
                    reportedQr: Number(expectedQrBs.toFixed(2)),
                    reportedTransfer: Number(expectedTransferBs.toFixed(2)),
                  }))
                }
              >
                Usar sugerido
              </Button>
            </div>
            <CardDescription className="text-xs">
              “Reportado” empieza en Bs. 0.00 hasta que ingreses tu arqueo (o uses el sugerido).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-500 uppercase text-[9px]">Concepto</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-500 uppercase text-[9px]">Sugerido (Sistema)</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-500 uppercase text-[9px]">Reportado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-2">Efectivo</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-400">Bs. {expectedCashBs.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-bold text-green-700">Bs. {formData.reportedCash.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">QR / Transferencia</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-400">Bs. {(expectedQrBs + expectedTransferBs).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-bold text-blue-700">Bs. {(formData.reportedQr + formData.reportedTransfer).toFixed(2)}</td>
                </tr>
                <tr className="bg-slate-50/30">
                  <td className="px-4 py-2 font-bold">TOTAL RECAUDADO</td>
                  <td className="px-4 py-2 text-right font-bold text-slate-600">Bs. {totalExpectedBs.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-black text-blue-800">Bs. {totalReported.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
          <div className={`p-3 text-center text-xs font-bold ${diffCents >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {diffCents === 0 && totalExpectedBs > 0 ? "CUADRE PERFECTO" :
             diffCents > 0 ? `SOBRANTE DE Bs. ${(diffCents / 100).toFixed(2)}` :
             diffCents < 0 ? `FALTANTE DE Bs. ${(Math.abs(diffCents) / 100).toFixed(2)}` :
             totalExpectedBs > 0 ? "Completá los montos reportados" : "Sin entregas pendientes de cuadre"}
          </div>
        </Card>

        {/* Entregas Realizadas Hoy */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-600" /> Entregas Realizadas Hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-48 overflow-y-auto">
            {!deliveryHistory || deliveryHistory.length === 0 ? (
              <div className="p-6 text-center">
                <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 italic">No hay entregas entregadas hoy</p>
              </div>
            ) : (
              <div className="divide-y">
                {deliveryHistory.map(({ order }: any) => (
                  <div key={order.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{order.orderNumber}</p>
                      <p className="text-[10px] text-muted-foreground">{paymentMethodLabel(order.paymentMethod)} · {new Date(order.deliveredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <p className="font-bold text-sm text-emerald-700">{formatCurrency(order.totalPrice)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full h-12 text-lg font-bold shadow-green-200 shadow-lg bg-green-600 hover:bg-green-700"
          disabled={isSubmitting || isLoadingExpected}
        >
          {isSubmitting ? "Enviando Cierre..." : "Finalizar y Cerrar Caja"}
        </Button>

        <p className="text-[10px] text-center text-slate-400 italic">
          Al hacer clic en finalizar, tu reporte será enviado al administrador para su validación oficial.
        </p>
      </form>

      <ClosuresList myClosures={myClosures} isLoading={isLoadingClosures} />
    </div>
  );
}

function ClosuresList({ myClosures, isLoading }: { myClosures: any[] | undefined; isLoading: boolean }) {
  const closures = (myClosures || []).slice(0, 10);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-bold">Historial de Cierres</CardTitle>
        <CardDescription className="text-xs">Tus últimos cierres enviados y su estado.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : closures.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground italic">Todavía no tienes cierres registrados.</div>
        ) : (
          <div className="divide-y">
            {closures.map((closure: any) => {
              const totalExpected = (closure.expectedCash || 0) + (closure.expectedQr || 0) + (closure.expectedTransfer || 0);
              const totalReported = (closure.reportedCash || 0) + (closure.reportedQr || 0) + (closure.reportedTransfer || 0);
              const diff = totalReported - totalExpected;
              const statusLabel =
                closure.status === "approved" ? "Aprobado" : closure.status === "rejected" ? "Rechazado" : "Pendiente";
              const statusClass =
                closure.status === "approved"
                  ? "bg-emerald-600"
                  : closure.status === "rejected"
                    ? "bg-red-600"
                    : "bg-blue-600";

              return (
                <div key={closure.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">Cierre #{closure.id} — {closure.date}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Esperado: {formatCurrency(totalExpected)} · Reportado: {formatCurrency(totalReported)}
                    </p>
                    {closure.adminNotes ? (
                      <p className="text-[10px] text-muted-foreground truncate">Nota admin: {closure.adminNotes}</p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={`${statusClass} hover:${statusClass} font-bold`}>{statusLabel}</Badge>
                    <p className={`text-[10px] font-bold mt-1 ${diff === 0 ? "text-emerald-700" : diff > 0 ? "text-blue-700" : "text-red-700"}`}>
                      {diff === 0 ? "OK" : diff > 0 ? `+${formatCurrency(diff)}` : `-${formatCurrency(Math.abs(diff))}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
