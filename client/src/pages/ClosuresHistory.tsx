import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollText, Calendar, DollarSign, Clock, CheckCircle2, AlertCircle, History } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ClosureDetail = {
  id: number;
  userId: number;
  date: string;
  initialCash: number;
  reportedCash: number;
  reportedQr: number;
  reportedTransfer: number;
  expectedCash: number;
  expectedQr: number;
  expectedTransfer: number;
  expenses: number;
  pendingOrders: number;
  status: "pending" | "approved" | "rejected";
  adminNotes?: string;
  createdAt: string;
};

function formatBs(amount: number) {
  return `Bs. ${(amount / 100).toLocaleString("es-BO", { minimumFractionDigits: 2 })}`;
}

export default function ClosuresHistory() {
  const utils = trpc.useUtils();
  const [selectedClosure, setSelectedClosure] = useState<ClosureDetail | null>(null);

  const { data: closures, isLoading } = trpc.finance.listAllClosures.useQuery();

  const closeDetail = () => {
    setSelectedClosure(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Historial de Cierres de Caja</h1>
          <p className="text-sm text-muted-foreground">
            Registro completo de todos los cierres de caja realizados
          </p>
        </div>
        <Button variant="outline" onClick={() => utils.finance.listAllClosures.refetch()}>
          <ScrollText className="h-4 w-4 mr-2" />
          Refrescar
        </Button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando historial...</p>
        </div>
      ) : !closures || closures.length === 0 ? (
        <div className="py-20 text-center">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No hay registros de cierres de caja</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resumen de Cierres */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Cierres</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{closures.length}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Aprobados</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-green-600">
                {closures.filter(c => c.status === "approved").length}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-orange-600">
                {closures.filter(c => c.status === "pending").length}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Rechazados</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-red-600">
                {closures.filter(c => c.status === "rejected").length}
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Cierres */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-slate-50/50">
              <CardTitle className="text-base">Registro Completo de Cierres</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Nº</TableHead>
                    <TableHead>Repartidor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Ingreso Inicial</TableHead>
                    <TableHead className="text-right">Efectivo Reportado</TableHead>
                    <TableHead className="text-right">QR/Transfer</TableHead>
                    <TableHead className="text-right">Total Esperado</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closures.map((closure: any) => (
                    <TableRow key={closure.id}>
                      <TableCell className="font-mono text-sm">#{closure.id}</TableCell>
                      <TableCell className="font-medium">
                        {closure.userName || `Repartidor #${closure.userId}`}
                      </TableCell>
                      <TableCell>
                        {format(new Date(closure.date), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {closure.initialCash ? formatBs(closure.initialCash) : "Bs. 0.00"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-700 font-semibold">
                        {formatBs(closure.reportedCash)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-blue-700 font-semibold">
                        {formatBs(closure.reportedQr + closure.reportedTransfer)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-slate-600">
                        {formatBs((closure.expectedCash || 0) + (closure.expectedQr || 0) + (closure.expectedTransfer || 0))}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm font-bold ${
                        closure.status === "approved" ? "text-green-600" : "text-orange-600"
                      }`}>
                        {(() => {
                          const totalReported = (closure.reportedCash || 0) + (closure.reportedQr || 0) + (closure.reportedTransfer || 0);
                          const totalExpected = (closure.expectedCash || 0) + (closure.expectedQr || 0) + (closure.expectedTransfer || 0);
                          const diff = totalReported - totalExpected;
                          const sign = diff > 0 ? "+" : "";
                          return `${sign}${formatBs(diff)}`;
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`${
                          closure.status === "approved" ? "bg-green-100 text-green-700 border-green-200" :
                          closure.status === "rejected" ? "bg-red-100 text-red-700 border-red-200" :
                          "bg-orange-100 text-orange-700 border-orange-200"
                        }`}>
                          {closure.status === "approved" ? "Aprobado" :
                           closure.status === "rejected" ? "Rechazado" : "Pendiente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog open={!!selectedClosure && selectedClosure.id === closure.id} onOpenChange={closeDetail}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <ScrollText className="h-4 w-4" />
                              Ver
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Detalle del Cierre de Caja #{closure.id}</DialogTitle>
                              <DialogDescription>
                                Repartidor: {closure.userName || `Repartidor #${closure.userId}`} · Fecha: {format(new Date(closure.date), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6">
                              {/* Resumen General */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                      <DollarSign className="h-4 w-4" /> Financiero
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Ingreso Inicial</span>
                                      <span className="font-semibold">{formatBs(closure.initialCash)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Gastos Registrados</span>
                                      <span className="font-semibold text-red-600">-{formatBs(closure.expenses || 0)}</span>
                                    </div>
                                    <div className="border-t pt-3 flex justify-between">
                                      <span className="font-semibold">Neto a Reportar</span>
                                      <span className="font-bold">{formatBs(closure.initialCash - (closure.expenses || 0))}</span>
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                      <AlertCircle className="h-4 w-4" /> Esperado vs Reportado
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                                      <div className="text-xs text-green-700 font-semibold mb-2">TOTAL ESPERADO (Sistema)</div>
                                      <div className="flex justify-between mb-1">
                                        <span className="text-muted-foreground">Efectivo</span>
                                        <span className="font-medium">{formatBs(closure.expectedCash || 0)}</span>
                                      </div>
                                      <div className="flex justify-between mb-1">
                                        <span className="text-muted-foreground">QR / Transferencia</span>
                                        <span className="font-medium">{formatBs((closure.expectedQr || 0) + (closure.expectedTransfer || 0))}</span>
                                      </div>
                                      <div className="border-t pt-2 font-bold text-green-800 text-lg">
                                        {formatBs((closure.expectedCash || 0) + (closure.expectedQr || 0) + (closure.expectedTransfer || 0))}
                                      </div>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                      <div className="text-xs text-blue-700 font-semibold mb-2">TOTAL REPORTADO (Repartidor)</div>
                                      <div className="flex justify-between mb-1">
                                        <span className="text-muted-foreground">Efectivo</span>
                                        <span className="font-medium">{formatBs(closure.reportedCash || 0)}</span>
                                      </div>
                                      <div className="flex justify-between mb-1">
                                        <span className="text-muted-foreground">QR</span>
                                        <span className="font-medium">{formatBs(closure.reportedQr || 0)}</span>
                                      </div>
                                      <div className="flex justify-between mb-1">
                                        <span className="text-muted-foreground">Transferencia</span>
                                        <span className="font-medium">{formatBs(closure.reportedTransfer || 0)}</span>
                                      </div>
                                      <div className="border-t pt-2 font-bold text-blue-800 text-lg">
                                        {formatBs((closure.reportedCash || 0) + (closure.reportedQr || 0) + (closure.reportedTransfer || 0))}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Detalles de Pendientes */}
                              {closure.pendingOrders && closure.pendingOrders > 0 && (
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                      <AlertCircle className="h-4 w-4" /> Monto Pendiente de Entregas
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="text-sm">
                                    <p className="text-muted-foreground mb-2">
                                      Este monto corresponde a pedidos que el repartidor tenía asignados pero que aún no habían sido entregados al momento del cierre.
                                    </p>
                                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                      <div className="text-center">
                                        <span className="text-3xl font-bold text-orange-700">{formatBs(closure.pendingOrders)}</span>
                                        <p className="text-xs text-orange-600 mt-1">Por entregar</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Estado y Notas */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4" /> Estado y Aprobación
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Estado Actual</span>
                                      <Badge variant="outline" className={`${
                                        closure.status === "approved" ? "bg-green-100 text-green-700 border-green-200" :
                                        closure.status === "rejected" ? "bg-red-100 text-red-700 border-red-200" :
                                        "bg-orange-100 text-orange-700 border-orange-200"
                                      }`}>
                                        {closure.status === "approved" ? "Aprobado" :
                                         closure.status === "rejected" ? "Rechazado" : "Pendiente de Aprobación"}
                                      </Badge>
                                    </div>
                                    {closure.adminNotes && (
                                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <span className="text-xs text-slate-500 uppercase font-semibold block mb-1">Notas del Administrador</span>
                                        <span className="text-sm text-slate-800">{closure.adminNotes}</span>
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground">
                                      Creado: {format(new Date(closure.createdAt), "dd 'de' MMMM 'de' yyyy HH:mm", { locale: es })}
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                      <Clock className="h-4 w-4" /> Desglose por Método de Pago
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-2 text-sm">
                                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="font-semibold text-green-700">Efectivo</span>
                                        <span className="font-bold">{formatBs(closure.expectedCash || 0)} esperado</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground mb-1">Reportado: {formatBs(closure.reportedCash || 0)}</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="font-semibold text-blue-700">QR / Transferencia</span>
                                        <span className="font-bold">{formatBs((closure.expectedQr || 0) + (closure.expectedTransfer || 0))} esperado</span>
                                      </div>
                                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                        <span>QR: {formatBs(closure.reportedQr || 0)}</span>
                                        <span>Transfer: {formatBs(closure.reportedTransfer || 0)}</span>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
