import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Receipt, WalletCards, Printer, Eye, FileText, CheckCircle2, XCircle, AlertTriangle, History, Download, X, ArrowRightLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/currency";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArqueoDialog } from "@/components/ArqueoDialog";

function getLocalDateInputValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
}

function getToday() {
  return getLocalDateInputValue();
}

function getWeekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

function getMonthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split("T")[0];
}

function paymentMethodLabel(method: string) {
  if (method === "cash") return "Efectivo";
  if (method === "qr") return "QR";
  if (method === "transfer") return "Transferencia";
  return method || "—";
}

function categoryLabel(cat: string) {
  const labels: Record<string, string> = {
    sale: "Venta",
    purchase: "Compra",
    order_delivery: "Entrega Pedido",
    sale_cancellation: "Anulación Venta",
    fuel: "Combustible",
    subsistence: "Viáticos",
    transfer: "Traspaso",
    transfer_between_registers: "Traspaso Cajas",
    facebook_ads: "Facebook Ads",
    google_ads: "Google Ads",
    electricity: "Luz",
    water: "Agua",
    internet: "Internet",
    telephone: "Teléfono",
    rent: "Alquiler",
    salaries: "Sueldos",
    maintenance: "Mantenimiento",
    supplies: "Insumos",
    taxes: "Impuestos",
    insurance: "Seguro",
    bank_fees: "Comisión Bancaria",
    other: "Otros",
  };
  return labels[cat] || cat;
}

export default function Finance() {
  const { data: transactions, isLoading } = trpc.finance.getTransactions.useQuery();
  const { data: cashOpenings, isLoading: isLoadingOpenings } = trpc.finance.getCashOpenings.useQuery();
  const [cashHistoryOpen, setCashHistoryOpen] = useState(false);
  const [qrHistoryOpen, setQrHistoryOpen] = useState(false);
  const [transferHistoryOpen, setTransferHistoryOpen] = useState(false);

  const cashIncome = (transactions as any[])?.filter((t: any) => t.type === "income" && (t.paymentMethod === "cash" || !t.paymentMethod)).reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
  const cashExpense = (transactions as any[])?.filter((t: any) => t.type === "expense" && (t.paymentMethod === "cash" || !t.paymentMethod)).reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
  const baseCashBalance = cashIncome - cashExpense;

  const qrIncome = (transactions as any[])?.filter((t: any) => t.type === "income" && t.paymentMethod === "qr").reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
  const qrExpense = (transactions as any[])?.filter((t: any) => t.type === "expense" && t.paymentMethod === "qr").reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
  const baseQrBalance = qrIncome - qrExpense;

  const transferIncome = (transactions as any[])?.filter((t: any) => t.type === "income" && t.paymentMethod === "transfer").reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
  const transferExpense = (transactions as any[])?.filter((t: any) => t.type === "expense" && t.paymentMethod === "transfer").reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
  const baseTransferBalance = transferIncome - transferExpense;

  const today = getLocalDateInputValue();

  const todaysOpenings = useMemo(
    () => ((cashOpenings as any[]) || []).filter((opening: any) => opening.openingDate === today),
    [cashOpenings, today]
  );

  const todaysCashOpenings = todaysOpenings.filter((o: any) => o.paymentMethod === "cash" || !o.paymentMethod).reduce((sum: number, o: any) => sum + o.openingAmount, 0);
  const todaysQrOpenings = todaysOpenings.filter((o: any) => o.paymentMethod === "qr").reduce((sum: number, o: any) => sum + o.openingAmount, 0);
  const todaysTransferOpenings = todaysOpenings.filter((o: any) => o.paymentMethod === "transfer").reduce((sum: number, o: any) => sum + o.openingAmount, 0);

  const todaysOpenedAmount = todaysCashOpenings + todaysQrOpenings + todaysTransferOpenings;

  const cashBalance = baseCashBalance + todaysCashOpenings;
  const qrBalance = baseQrBalance + todaysQrOpenings;
  const transferBalance = baseTransferBalance + todaysTransferOpenings;

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto mb-20 md:mb-0">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finanzas</h1>
          <p className="text-muted-foreground">Resumen de ingresos, egresos y rentabilidad.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ArqueoDialog expectedCash={cashBalance} expectedQr={qrBalance} expectedTransfer={transferBalance} />
          <TransferDialog />
          <OpenCashDialog />
          <AddExpenseDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Caja Efectivo */}
        <Card className="bg-emerald-50/60 border-emerald-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-emerald-800">Caja Efectivo</CardTitle>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                title="Ver Historial"
                onClick={() => setCashHistoryOpen(true)}
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-700">{formatCurrency(cashBalance)}</div>
            <div className="flex justify-between text-[10px] uppercase font-bold text-emerald-600/70 mt-2">
              <span>Ingresos: {formatCurrency(cashIncome)}</span>
              <span>Egresos: {formatCurrency(cashExpense)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Caja QR */}
        <Card className="bg-blue-50/60 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-blue-800">Caja QR</CardTitle>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                title="Ver Historial"
                onClick={() => setQrHistoryOpen(true)}
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-700">{formatCurrency(qrBalance)}</div>
            <div className="flex justify-between text-[10px] uppercase font-bold text-blue-600/70 mt-2">
              <span>Ing: {formatCurrency(qrIncome)}</span>
              <span>Egr: {formatCurrency(qrExpense)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Cuenta Bancaria */}
        <Card className="bg-purple-50/60 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-purple-800">Cuenta Bancaria</CardTitle>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-purple-600" />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                title="Ver Historial"
                onClick={() => setTransferHistoryOpen(true)}
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-purple-700">{formatCurrency(transferBalance)}</div>
            <div className="flex justify-between text-[10px] uppercase font-bold text-purple-600/70 mt-2">
              <span>Ing: {formatCurrency(transferIncome)}</span>
              <span>Egr: {formatCurrency(transferExpense)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modales de Historial */}
      <BoxHistoryModal paymentMethod="cash" title="Caja Efectivo" colorClass="emerald" open={cashHistoryOpen} onOpenChange={setCashHistoryOpen} />
      <BoxHistoryModal paymentMethod="qr" title="Caja QR" colorClass="blue" open={qrHistoryOpen} onOpenChange={setQrHistoryOpen} />
      <BoxHistoryModal paymentMethod="transfer" title="Cuenta Bancaria" colorClass="purple" open={transferHistoryOpen} onOpenChange={setTransferHistoryOpen} />

      <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-4">
        <Card className="bg-slate-50/70 border-slate-200/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <WalletCards className="h-5 w-5" />
              Apertura de Caja
            </CardTitle>
            <CardDescription>Control de fondo inicial y responsable por fecha.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm text-muted-foreground">Aperturas de hoy</p>
                <p className="text-2xl font-bold text-slate-900">{todaysOpenings.length}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Fondo inicial</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(todaysOpenedAmount)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Usa la opcion "Apertura de caja" para registrar fondo inicial, fecha de apertura y usuario responsable.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aperturas Recientes</CardTitle>
            <CardDescription>Ultimas aperturas registradas en caja.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingOpenings ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
              </div>
            ) : ((cashOpenings as any[]) || []).length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Todavia no hay aperturas de caja registradas.
              </div>
            ) : (
              <div className="space-y-3">
                {((cashOpenings as any[]) || []).slice(0, 5).map((opening: any) => (
                  <div key={opening.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{opening.responsibleUserName || `Usuario #${opening.responsibleUserId}`}</p>
                      <p className="text-sm text-muted-foreground">
                        Fecha: {opening.openingDate} · Aperturo: {opening.openedByUserName || `Usuario #${opening.openedByUserId}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{formatCurrency(opening.openingAmount)}</p>
                      <Badge variant={opening.status === "open" ? "outline" : "secondary"}>
                        {opening.status === "open" ? "Abierta" : "Cerrada"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="transactions">Libro de Transacciones</TabsTrigger>
          <TabsTrigger value="closures">Cierres de Caja Repartidores</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" /> Libro de Transacciones
                  </CardTitle>
                  <CardDescription>Historial detallado de todas las operaciones economicas.</CardDescription>
                </div>
                <Button variant="outline" className="gap-2 no-print" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Imprimir Libro
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
                </div>
              ) : (
                <div className="space-y-4" id="transactions-book">
                  {(transactions as any[])?.map((t: any) => (
                    <TransactionRow key={t.id} transaction={t} />
                  ))}
                  {transactions?.length === 0 && (
                    <div className="py-10 text-center text-muted-foreground italic text-sm">
                      No hay transacciones registradas todavia.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="closures">
          <CashClosuresAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// MODAL DE HISTORIAL POR CAJA
// ============================================================
interface BoxHistoryModalProps {
  paymentMethod: "cash" | "qr" | "transfer";
  title: string;
  colorClass: "emerald" | "blue" | "purple";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BoxHistoryModal({ paymentMethod, title, colorClass, open, onOpenChange }: BoxHistoryModalProps) {
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "custom">("month");
  const [startDate, setStartDate] = useState(getMonthAgo());
  const [endDate, setEndDate] = useState(getToday());
  const [showPrintArea, setShowPrintArea] = useState(false);

  // Reset dates when modal opens with "month" preset
  useEffect(() => {
    if (open && dateRange === "month") {
      setStartDate(getMonthAgo());
      setEndDate(getToday());
    }
  }, [open]);

  const colorStyles: Record<string, { bg: string; border: string; text: string; light: string }> = {
    emerald: { bg: "bg-emerald-600", border: "border-emerald-200", text: "text-emerald-700", light: "bg-emerald-50" },
    blue: { bg: "bg-blue-600", border: "border-blue-200", text: "text-blue-700", light: "bg-blue-50" },
    purple: { bg: "bg-purple-600", border: "border-purple-200", text: "text-purple-700", light: "bg-purple-50" },
  };

  const colors = colorStyles[colorClass];

  const { data, isLoading, refetch } = trpc.finance.getBoxHistory.useQuery(
    { paymentMethod, startDate, endDate, type: filter },
    { enabled: open }
  );

  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, filter, startDate, endDate, refetch]);

  useEffect(() => {
    if (!open) return;
    switch (dateRange) {
      case "today":
        setStartDate(getToday());
        setEndDate(getToday());
        break;
      case "week":
        setStartDate(getWeekAgo());
        setEndDate(getToday());
        break;
      case "month":
        setStartDate(getMonthAgo());
        setEndDate(getToday());
        break;
    }
  }, [dateRange, open]);

  const handleExportCsv = () => {
    if (!data?.transactions) return;

    const headers = ["Fecha", "Hora", "Usuario", "Tipo", "Categoría", "Referencia", "Método", "Monto", "Ingreso", "Egreso", "Saldo", "Notas"];
    const rows = data.transactions.map((t: any) => [
      new Date(t.createdAt).toLocaleDateString("es-BO"),
      new Date(t.createdAt).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }),
      `Usuario #${t.userId || "—"}`,
      t.type === "income" ? "Ingreso" : "Egreso",
      categoryLabel(t.category),
      t.referenceId ? `#${t.referenceId}` : "—",
      paymentMethodLabel(paymentMethod),
      (t.amount / 100).toFixed(2),
      t.type === "income" ? (t.amount / 100).toFixed(2) : "",
      t.type === "expense" ? (t.amount / 100).toFixed(2) : "",
      (t.runningBalance / 100).toFixed(2),
      t.notes || "",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/\s+/g, "_")}_${startDate}_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    setShowPrintArea(true);
    setTimeout(() => {
      window.print();
      setShowPrintArea(false);
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <div className={`${colors.light} p-4 border-b ${colors.border}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-bold ${colors.text}`}>Historial - {title}</h3>
              <p className="text-sm text-muted-foreground">Transacciones del período seleccionado</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="p-4 border-b space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mes</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {dateRange === "custom" && (
              <>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-36"
                />
                <span className="text-muted-foreground self-center">-</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-36"
                />
              </>
            )}

            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="income">Ingresos</SelectItem>
                <SelectItem value="expense">Egresos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Totales */}
          {data && (
            <div className="flex gap-4 text-sm">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <div className={`p-2 rounded border ${colors.border} ${colors.light}`}>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Ingresos</p>
                  <p className="font-bold text-green-600">{formatCurrency(data.summary.totalIncome)}</p>
                </div>
                <div className={`p-2 rounded border ${colors.border} ${colors.light}`}>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Egresos</p>
                  <p className="font-bold text-red-600">{formatCurrency(data.summary.totalExpense)}</p>
                </div>
                <div className={`p-2 rounded border ${colors.border} ${colors.light}`}>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Saldo Final</p>
                  <p className={`font-bold ${data.summary.finalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(data.summary.finalBalance)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabla de Transacciones */}
        <div className="overflow-auto max-h-[50vh]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando transacciones...</div>
          ) : data?.transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No hay transacciones en este período</div>
          ) : (
            <table className="w-full text-sm">
              <thead className={`${colors.light} sticky top-0`}>
                <tr>
                  <th className="text-left p-3 font-bold">Fecha / Hora</th>
                  <th className="text-left p-3 font-bold">Tipo</th>
                  <th className="text-left p-3 font-bold">Categoría</th>
                  <th className="text-left p-3 font-bold">Referencia</th>
                  <th className="text-right p-3 font-bold">Monto</th>
                  <th className="text-right p-3 font-bold">Ingreso</th>
                  <th className="text-right p-3 font-bold">Egreso</th>
                  <th className="text-right p-3 font-bold">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.transactions.map((t: any) => (
                  <tr key={t.id} className="hover:bg-muted/50">
                    <td className="p-3">
                      <div className="font-medium">{new Date(t.createdAt).toLocaleDateString("es-BO")}</div>
                      <div className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant={t.type === "income" ? "default" : "destructive"} className={t.type === "income" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                        {t.type === "income" ? "INGRESO" : "EGRESO"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {t.type === "income" ? (
                          <ArrowUpRight className="h-3 w-3 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 text-red-600" />
                        )}
                        {categoryLabel(t.category)}
                      </div>
                      {t.notes && <p className="text-xs text-muted-foreground truncate max-w-48">{t.notes}</p>}
                    </td>
                    <td className="p-3 font-mono text-xs">{t.referenceId ? `#${t.referenceId}` : "—"}</td>
                    <td className={`p-3 text-right font-mono font-bold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                      {t.type === "income" ? "+" : "-"} {formatCurrency(t.amount)}
                    </td>
                    <td className="p-3 text-right font-mono text-green-600">
                      {t.type === "income" ? formatCurrency(t.amount) : ""}
                    </td>
                    <td className="p-3 text-right font-mono text-red-600">
                      {t.type === "expense" ? formatCurrency(t.amount) : ""}
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${t.runningBalance >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {formatCurrency(t.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Acciones */}
        <div className="p-4 border-t flex justify-between">
          <div className="text-sm text-muted-foreground">
            {data?.summary.count || 0} transacciones
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-2">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
          </div>
        </div>

        {/* Área de impresión */}
        {showPrintArea && (
          <div className="hidden print:block p-8" id={`print-area-${paymentMethod}`}>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold uppercase">Historial de {title}</h1>
              <p className="text-sm">Del {startDate} al {endDate}</p>
            </div>
            <table className="w-full text-sm border-collapse mb-4">
              <thead>
                <tr className="bg-gray-100 border">
                  <th className="p-2 text-left border">Fecha/Hora</th>
                  <th className="p-2 text-left border">Tipo</th>
                  <th className="p-2 text-left border">Categoría</th>
                  <th className="p-2 text-right border">Ingreso</th>
                  <th className="p-2 text-right border">Egreso</th>
                  <th className="p-2 text-right border">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {data?.transactions.map((t: any) => (
                  <tr key={t.id}>
                    <td className="p-2 border">
                      {new Date(t.createdAt).toLocaleDateString("es-BO")}{" "}
                      {new Date(t.createdAt).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-2 border">{t.type === "income" ? "Ingreso" : "Egreso"}</td>
                    <td className="p-2 border">{categoryLabel(t.category)}</td>
                    <td className="p-2 text-right border text-green-600">
                      {t.type === "income" ? formatCurrency(t.amount) : ""}
                    </td>
                    <td className="p-2 text-right border text-red-600">
                      {t.type === "expense" ? formatCurrency(t.amount) : ""}
                    </td>
                    <td className="p-2 text-right border font-bold">{formatCurrency(t.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="p-2 border" colSpan={3}>TOTALES</td>
                  <td className="p-2 text-right border text-green-600">{formatCurrency(data?.summary.totalIncome || 0)}</td>
                  <td className="p-2 text-right border text-red-600">{formatCurrency(data?.summary.totalExpense || 0)}</td>
                  <td className="p-2 text-right border">{formatCurrency(data?.summary.finalBalance || 0)}</td>
                </tr>
              </tfoot>
            </table>
            <div className="text-center text-xs text-gray-400 mt-4">
              Generado por Control de Pedidos App - {new Date().toLocaleString()}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// DIÁLOGOS EXISTENTES (OpenCashDialog, AddExpenseDialog, etc.)
// ============================================================

function OpenCashDialog() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data: responsibleUsers } = trpc.finance.listResponsibleUsers.useQuery(undefined, { enabled: open });
  const [form, setForm] = useState({
    openingAmount: "",
    paymentMethod: "cash",
    openingDate: getLocalDateInputValue(),
    responsibleUserId: "",
  });

  useEffect(() => {
    if (!open) return;
    if (form.responsibleUserId) return;
    const firstUser = (responsibleUsers as any[])?.[0];
    if (firstUser) setForm((current) => ({ ...current, responsibleUserId: String(firstUser.id) }));
  }, [open, responsibleUsers, form.responsibleUserId]);

  const mutation = trpc.finance.openCashRegister.useMutation({
    onSuccess: () => {
      toast.success("Apertura de caja registrada");
      setOpen(false);
      setForm({ openingAmount: "", paymentMethod: "cash", openingDate: getLocalDateInputValue(), responsibleUserId: "" });
      void utils.finance.getCashOpenings.invalidate();
    },
    onError: (error) => toast.error(error.message || "No se pudo registrar la apertura de caja"),
  });

  const handleSubmit = () => {
    const openingAmount = parseFloat(form.openingAmount);
    if (Number.isNaN(openingAmount) || openingAmount < 0) { toast.error("Ingresa un fondo inicial valido"); return; }
    if (!form.openingDate) { toast.error("Selecciona la fecha de apertura"); return; }
    if (!form.responsibleUserId) { toast.error("Selecciona el usuario responsable"); return; }
    mutation.mutate({
      openingAmount, paymentMethod: form.paymentMethod as "cash" | "qr" | "transfer",
      openingDate: form.openingDate, responsibleUserId: parseInt(form.responsibleUserId, 10),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <WalletCards className="h-4 w-4" /> Apertura de Caja
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apertura de Caja</DialogTitle>
          <DialogDescription>Registra fondo inicial, fecha de apertura y usuario responsable.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2"><Label htmlFor="openingAmount">Fondo inicial</Label>
            <Input id="openingAmount" type="number" step="0.01" min="0" placeholder="0.00" value={form.openingAmount} onChange={(e) => setForm({ ...form, openingAmount: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="paymentMethod">Caja a Aperturar</Label>
            <Select value={form.paymentMethod} onValueChange={(val: any) => setForm({ ...form, paymentMethod: val })}>
              <SelectTrigger id="paymentMethod"><SelectValue placeholder="Seleccione Caja" /></SelectTrigger>
              <SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="qr">Caja QR</SelectItem><SelectItem value="transfer">Cuenta Bancaria</SelectItem></SelectContent>
            </Select></div>
          <div className="space-y-2"><Label htmlFor="openingDate">F. de apertura</Label>
            <Input id="openingDate" type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} /></div>
          <div className="space-y-2"><Label>Usuario Resp.</Label>
            <Select value={form.responsibleUserId} onValueChange={(value) => setForm({ ...form, responsibleUserId: value })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar responsable" /></SelectTrigger>
              <SelectContent>{((responsibleUsers as any[]) || []).map((user: any) => (
                <SelectItem key={user.id} value={String(user.id)}>{user.name || user.username || `Usuario #${user.id}`}</SelectItem>
              ))}</SelectContent>
            </Select></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>{mutation.isPending ? "Aperturando..." : "Aperturar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CashClosuresAdmin() {
  const { data: closures, isLoading, refetch } = trpc.finance.listAllClosures.useQuery();
  const utils = trpc.useUtils();
  const updateMutation = trpc.finance.updateClosureStatus.useMutation({
    onSuccess: () => { toast.success("Cierre actualizado y nueva caja abierta"); refetch(); utils.finance.getCashOpenings.invalidate(); },
    onError: (err) => toast.error(`Error: ${err.message}`)
  });
  const [selectedClosure, setSelectedClosure] = useState<any>(null);
  if (isLoading) return <div>Cargando cierres...</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Cierres de Caja Pendientes y Recientes</CardTitle>
        <CardDescription>Valida los montos reportados por los repartidores contra el sistema.</CardDescription></CardHeader>
      <CardContent>
        <Table><TableHeader><TableRow>
          <TableHead>Fecha</TableHead><TableHead>Repartidor</TableHead>
          <TableHead className="text-right">Esperado</TableHead><TableHead className="text-right">Reportado</TableHead>
          <TableHead className="text-right">Pendiente</TableHead>
          <TableHead className="text-center">Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
        </TableRow></TableHeader><TableBody>
          {(closures as any[])?.map((c) => {
            const totalExp = c.expectedCash + c.expectedQr + c.expectedTransfer;
            const totalRep = c.reportedCash + c.reportedQr + c.reportedTransfer;
            const diff = totalRep - totalExp;
            const pending = c.pendingOrders || 0;
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.date}</TableCell>
                <TableCell>{c.userName}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalExp)}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totalRep)}
                  <p className={`text-[10px] ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>{diff === 0 ? "OK" : diff > 0 ? `+${formatCurrency(diff)}` : `${formatCurrency(diff)}`}</p>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{formatCurrency(pending)}</Badge>
                </TableCell>
                <TableCell className="text-center"><Badge variant={c.status === "approved" ? "default" : c.status === "rejected" ? "destructive" : "secondary"}>{c.status.toUpperCase()}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {c.status === "pending" ? (<>
                      <Button size="sm" variant="ghost" className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50 font-bold" onClick={() => updateMutation.mutate({ id: c.id, status: "approved" })} disabled={updateMutation.isPending}>Aprobar</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 font-bold" onClick={() => updateMutation.mutate({ id: c.id, status: "rejected" })} disabled={updateMutation.isPending}>Rechazar</Button>
                    </>) : (
                      <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => setSelectedClosure(c)}><Printer className="h-3 w-3" />Imprimir</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody></Table>
        {selectedClosure && <ClosureDetailDialog closure={selectedClosure} onClose={() => setSelectedClosure(null)} />}
      </CardContent>
    </Card>
  );
}

function ClosureDetailDialog({ closure, onClose }: { closure: any, onClose: () => void }) {
  const totalExp = closure.expectedCash + closure.expectedQr + closure.expectedTransfer;
  const totalRep = closure.reportedCash + closure.reportedQr + closure.reportedTransfer;
  const diff = totalRep - totalExp;
  const handlePrint = () => window.print();

  return (
    <Dialog open={!!closure} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <div className="p-6 print:p-0 no-print">
          <DialogHeader className="mb-4"><div className="flex items-center justify-between">
            <div><DialogTitle className="text-xl">Resumen de Cierre de Caja</DialogTitle>
              <DialogDescription>Detalle de liquidacion del repartidor {closure.userName}</DialogDescription></div>
            <Badge className={closure.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{closure.status === 'approved' ? 'APROBADO' : 'RECHAZADO'}</Badge>
          </div></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card><CardContent className="pt-4"><p className="text-xs uppercase font-bold text-muted-foreground mb-1">Fecha de Cierre</p><p className="font-semibold">{closure.date}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs uppercase font-bold text-muted-foreground mb-1">Responsable</p><p className="font-semibold">{closure.userName}</p></CardContent></Card>
          </div>
          <div className="space-y-3 mb-6">
            <h4 className="font-bold text-sm text-slate-800">Desglose de Montos</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Concepto</TableHead><TableHead className="text-right">Sistema</TableHead><TableHead className="text-right">Reportado</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell className="font-medium">Efectivo</TableCell><TableCell className="text-right">{formatCurrency(closure.expectedCash)}</TableCell><TableCell className="text-right">{formatCurrency(closure.reportedCash)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">QR / Digital</TableCell><TableCell className="text-right">{formatCurrency(closure.expectedQr)}</TableCell><TableCell className="text-right">{formatCurrency(closure.reportedQr)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">Transferencia</TableCell><TableCell className="text-right">{formatCurrency(closure.expectedTransfer)}</TableCell><TableCell className="text-right">{formatCurrency(closure.reportedTransfer)}</TableCell></TableRow>
                  <TableRow className="bg-slate-50 font-bold"><TableCell>TOTAL RECAUDADO</TableCell><TableCell className="text-right">{formatCurrency(totalExp)}</TableCell><TableCell className="text-right">{formatCurrency(totalRep)}</TableCell></TableRow>
                </TableBody></Table>
            </div>
          </div>
          <div className={`p-4 rounded-lg flex items-center gap-3 ${diff === 0 ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {diff === 0 ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            <div><p className="font-bold text-sm">{diff === 0 ? 'CUADRE PERFECTO' : 'DESCUADRE DETECTADO'}</p>
              <p className="text-xs">{diff === 0 ? 'No se detectaron diferencias.' : `Existe una diferencia de ${formatCurrency(diff)}.`}</p></div>
          </div>
          {closure.adminNotes && <div className="mt-4 p-3 bg-slate-50 rounded border text-sm italic"><span className="font-bold not-italic">Notas Admin: </span>{closure.adminNotes}</div>}
          <DialogFooter className="mt-6 flex gap-2">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button onClick={handlePrint} className="gap-2 bg-slate-900 group"><Printer className="h-4 w-4" />Imprimir Recibo</Button>
          </DialogFooter>
        </div>
        <div className="hidden print:block p-8 bg-white text-black w-full" id="print-area-closure">
          <div className="text-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold uppercase">Recibo de Liquidacion</h1><p className="text-sm">Control de Pedidos App</p></div>
          <div className="grid grid-cols-2 gap-y-4 mb-8 text-sm">
            <div><span className="font-bold">Nro. Arqueo:</span> #{`ARK-${String(closure.id).padStart(5, '0')}`}</div>
            <div><span className="font-bold">Fecha:</span> {closure.date}</div>
            <div><span className="font-bold">Repartidor:</span> {closure.userName}</div>
            <div><span className="font-bold">Estado:</span> {closure.status === 'approved' ? 'APROBADO' : 'RECHAZADO'}</div>
          </div>
          <table className="w-full text-sm border-collapse mb-8"><thead><tr className="bg-gray-100 border border-gray-300">
            <th className="p-2 text-left border-r border-gray-300">Concepto</th><th className="p-2 text-right border-r border-gray-300">Esperado</th><th className="p-2 text-right">Reportado</th>
          </tr></thead>
            <tbody>
            <tr className="border-b"><td className="p-2 border-r">Efectivo</td><td className="p-2 text-right border-r">{formatCurrency(closure.expectedCash)}</td><td className="p-2 text-right">{formatCurrency(closure.reportedCash)}</td></tr>
            <tr className="border-b"><td className="p-2 border-r">QR / Digital</td><td className="p-2 text-right border-r">{formatCurrency(closure.expectedQr)}</td><td className="p-2 text-right">{formatCurrency(closure.reportedQr)}</td></tr>
            <tr className="border-b"><td className="p-2 border-r">Transferencia</td><td className="p-2 text-right border-r">{formatCurrency(closure.expectedTransfer)}</td><td className="p-2 text-right">{formatCurrency(closure.reportedTransfer)}</td></tr>
            <tr className="bg-gray-100 font-bold"><td className="p-2 border-r">TOTAL</td><td className="p-2 text-right border-r">{formatCurrency(totalExp)}</td><td className="p-2 text-right">{formatCurrency(totalRep)}</td></tr>
          </tbody></table>
          <div className="mb-12"><p className="font-bold text-sm mb-1 uppercase">Diferencia: {diff === 0 ? 'OK' : formatCurrency(diff)}</p>
            {closure.adminNotes && <p className="text-xs italic mt-2">{closure.adminNotes}</p>}</div>
          <div className="mt-16 grid grid-cols-2 gap-12"><div className="text-center pt-8 border-t border-black"><p className="text-sm font-bold uppercase">Firma Administrador</p></div>
            <div className="text-center pt-8 border-t border-black"><p className="text-sm font-bold uppercase">Firma Repartidor</p><p className="text-xs">{closure.userName}</p></div></div>
          <div className="mt-8 text-[10px] text-center text-gray-400">Generado por Sistema de Control de Pedidos - {new Date().toLocaleString()}</div>
        </div>
      </DialogContent>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-area-closure, #print-area-closure * { visibility: visible; }
          #print-area-closure { position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index: 9999; background: white !important; padding: 40px !important; }
          .no-print { display: none !important; }
        }
      `}} />
    </Dialog>
  );
}

function AddExpenseDialog() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data: deliveryPersons } = trpc.users.listDeliveryPersons.useQuery();
  const [expense, setExpense] = useState({ deliveryPersonId: 0, amount: 0, type: "fuel" as const, notes: "" });

  const mutation = trpc.finance.addDeliveryExpense.useMutation({
    onSuccess: () => { toast.success("Gasto registrado"); setOpen(false); utils.finance.getTransactions.invalidate(); }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2 bg-red-600 hover:bg-red-700"><ArrowDownRight className="h-4 w-4" /> Registrar Gasto Logistico</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>Nuevo Gasto de Repartidor</DialogTitle><DialogDescription>Registra combustible, viaticos o reparaciones.</DialogDescription></DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2"><Label>Repartidor</Label>
            <Select onValueChange={(v) => setExpense({ ...expense, deliveryPersonId: parseInt(v) })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar repartidor" /></SelectTrigger>
              <SelectContent>{(deliveryPersons as any[])?.filter((u: any) => u.role === 'user').map((u: any) => (
                <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
              ))}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Monto</Label><Input type="number" placeholder="0.00" onChange={(e) => setExpense({ ...expense, amount: parseFloat(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Categoria</Label>
              <Select onValueChange={(v: any) => setExpense({ ...expense, type: v })}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent><SelectItem value="fuel">Combustible</SelectItem><SelectItem value="subsistence">Viaticos / Comida</SelectItem><SelectItem value="other">Otros</SelectItem></SelectContent>
              </Select></div>
          </div>
          <div className="space-y-2"><Label>Descripcion</Label><Input placeholder="Ej: Carga de Nafta" onChange={(e) => setExpense({ ...expense, notes: e.target.value })} /></div>
          <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => mutation.mutate(expense)} disabled={mutation.isPending}>{mutation.isPending ? "Registrando..." : "Registrar Gasto"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ fromMethod: "cash", toMethod: "transfer", amount: "", notes: "" });
  const mutation = trpc.finance.transferFunds.useMutation({
    onSuccess: () => { toast.success("Traspaso realizado con exito"); setOpen(false); setForm({ fromMethod: "cash", toMethod: "transfer", amount: "", notes: "" }); void utils.finance.getTransactions.invalidate(); },
    onError: (error) => toast.error(error.message || "Error al realizar el traspaso"),
  });
  const handleSubmit = () => {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { toast.error("Ingresa un monto valido"); return; }
    if (form.fromMethod === form.toMethod) { toast.error("Las cajas deben ser distintas"); return; }
    mutation.mutate({ fromMethod: form.fromMethod as "cash" | "qr" | "transfer", toMethod: form.toMethod as "cash" | "qr" | "transfer", amount, notes: form.notes });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="gap-2"><ArrowRightLeft className="h-4 w-4" />Traspaso</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Traspaso de Fondos</DialogTitle><DialogDescription>Mueve dinero entre tus diferentes cajas.</DialogDescription></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2"><Label>Dinero sale de:</Label>
            <Select value={form.fromMethod} onValueChange={(val) => setForm({ ...form, fromMethod: val })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="cash">Caja Efectivo</SelectItem><SelectItem value="qr">Caja QR</SelectItem><SelectItem value="transfer">Cuenta Bancaria</SelectItem></SelectContent>
            </Select></div>
          <div className="space-y-2"><Label>Dinero entra a:</Label>
            <Select value={form.toMethod} onValueChange={(val) => setForm({ ...form, toMethod: val })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="cash">Caja Efectivo</SelectItem><SelectItem value="qr">Caja QR</SelectItem><SelectItem value="transfer">Cuenta Bancaria</SelectItem></SelectContent>
            </Select></div>
          <div className="space-y-2"><Label>Monto a transferir</Label><Input type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="space-y-2"><Label>Concepto (Opcional)</Label><Input placeholder="Ej. Deposito al banco" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <Button className="w-full" onClick={handleSubmit} disabled={mutation.isPending}>{mutation.isPending ? "Procesando..." : "Confirmar Traspaso"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// TRANSACCION ROW & DETAIL DIALOGS
// ============================================================

function TransactionRow({ transaction }: { transaction: any }) {
  const [showDetail, setShowDetail] = useState(false);
  const categoryLabels: Record<string, string> = {
    sale: "Venta", purchase: "Compra", order_delivery: "Entrega de Pedido",
    sale_cancellation: "Anulacion de Venta", fuel: "Combustible",
    subsistence: "Viaticos / Comida", transfer: "Traspaso",
    transfer_between_registers: "Traspaso Cajas",
  };

  return (
    <>
      <div className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/5 transition-colors print:border-black">
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${transaction.type === "income" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
            {transaction.type === "income" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          </div>
          <div>
            <p className="font-semibold text-sm">{transaction.notes || transaction.category}</p>
            <p className="text-xs text-muted-foreground">{new Date(transaction.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`font-mono font-bold ${transaction.type === "income" ? "text-green-600" : "text-red-600"}`}>
              {transaction.type === "income" ? "+" : "-"} {formatCurrency(transaction.amount)}
            </p>
            <Badge variant="outline" className="text-[10px] uppercase font-light">
              {categoryLabels[transaction.category] || transaction.category}
            </Badge>
          </div>
          <div className="flex gap-1 no-print">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowDetail(true)}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      {showDetail && <TransactionDetailDialog transaction={transaction} onClose={() => setShowDetail(false)} />}
    </>
  );
}

function TransactionDetailDialog({ transaction, onClose }: { transaction: any, onClose: () => void }) {
  const handlePrint = () => window.print();

  if (transaction.category === "purchase" && transaction.referenceId) {
    return <PurchaseTransactionDialog purchaseId={transaction.referenceId} transaction={transaction} onClose={onClose} onPrint={handlePrint} />;
  }
  if ((transaction.category === "sale" || transaction.category === "order_delivery") && transaction.referenceId) {
    return <SaleTransactionDialog saleId={transaction.referenceId} transaction={transaction} onClose={onClose} onPrint={handlePrint} />;
  }
  return <BasicTransactionDialog transaction={transaction} onClose={onClose} onPrint={handlePrint} />;
}

// ---- COMPRA ----
function PurchaseTransactionDialog({ purchaseId, transaction, onClose, onPrint }: { purchaseId: number; transaction: any; onClose: () => void; onPrint: () => void }) {
  const { data: purchase } = (trpc.purchases as any).getById.useQuery({ id: purchaseId }, { enabled: !!purchaseId });
  const { data: items } = (trpc.purchases as any).getItems.useQuery({ purchaseId }, { enabled: !!purchaseId });

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Detalle de Compra: {purchase?.purchaseNumber || `#${purchaseId}`}</DialogTitle></DialogHeader>
        {!purchase ? (
          <div className="py-10 text-center text-muted-foreground">Cargando...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg text-sm">
              <div><p className="text-muted-foreground uppercase text-[10px] font-bold">Nro de Compra</p><p className="font-semibold">{purchase.purchaseNumber}</p></div>
              <div><p className="text-muted-foreground uppercase text-[10px] font-bold">Fecha</p><p className="font-semibold">{new Date(purchase.createdAt).toLocaleString()}</p></div>
              {purchase.supplierName && <div><p className="text-muted-foreground uppercase text-[10px] font-bold">Proveedor</p><p className="font-semibold">{purchase.supplierName}</p></div>}
              <div><p className="text-muted-foreground uppercase text-[10px] font-bold">Metodo de Pago</p><Badge variant="outline" className="capitalize">{purchase.paymentMethod}</Badge></div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground"><tr>
                  <th className="px-3 py-2 text-left font-medium">Producto</th>
                  <th className="px-3 py-2 text-center font-medium">Cant.</th>
                  <th className="px-3 py-2 text-right font-medium">Precio Uni.</th>
                  <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                </tr></thead>
                <tbody className="divide-y">
                  {items?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2"><p className="font-medium">{item.productName}</p><p className="text-[10px] text-muted-foreground">{item.productCode}</p></td>
                      <td className="px-3 py-2 text-center font-bold">{item.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(item.price)}</td>
                      <td className="px-3 py-2 text-right font-bold text-blue-700">{formatCurrency(item.quantity * item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-slate-50 p-3 flex justify-between items-center border-t border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Compra</span>
                <span className="text-xl font-black text-slate-900 font-mono">{formatCurrency(purchase.totalAmount)}</span>
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              <Button onClick={onPrint} className="gap-2 bg-slate-900"><Printer className="h-4 w-4" />Imprimir Comprobante</Button>
            </DialogFooter>
          </div>
        )}
        {purchase && items && (
          <div className="hidden print:block p-8 bg-white text-black w-full" id={`purchase-print-${purchaseId}`}>
            <PrintPurchaseContent purchase={purchase} items={items} />
          </div>
        )}
      </DialogContent>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #purchase-print-${purchaseId}, #purchase-print-${purchaseId} * { visibility: visible; }
          #purchase-print-${purchaseId} { position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index: 9999; background: white !important; padding: 40px !important; }
          .no-print { display: none !important; }
        }
      `}} />
    </Dialog>
  );
}

function PrintPurchaseContent({ purchase, items }: { purchase: any; items: any[] }) {
  return (
    <>
      <div className="text-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold uppercase">Comprobante de Compra</h1><p className="text-sm">Control de Pedidos App</p></div>
      <div className="grid grid-cols-2 gap-y-4 mb-8 text-sm">
        <div><span className="font-bold">Nro:</span> {purchase.purchaseNumber}</div>
        <div><span className="font-bold">Fecha:</span> {new Date(purchase.createdAt).toLocaleString()}</div>
        {purchase.supplierName && <div><span className="font-bold">Proveedor:</span> {purchase.supplierName}</div>}
        <div><span className="font-bold">Metodo:</span> {paymentMethodLabel(purchase.paymentMethod)}</div>
        <div><span className="font-bold">Estado:</span> {purchase.status}</div>
      </div>
      <table className="w-full text-sm border-collapse mb-8">
        <thead><tr className="bg-gray-100 border border-gray-300">
          <th className="p-2 text-left border-r border-gray-300">Producto</th>
          <th className="p-2 text-center border-r border-gray-300">Cant.</th>
          <th className="p-2 text-right border-r border-gray-300">P. Unit.</th>
          <th className="p-2 text-right">Subtotal</th>
        </tr></thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
              <td className="p-2 border border-gray-300">{item.productName}</td>
              <td className="p-2 border text-center border-gray-300">{item.quantity}</td>
              <td className="p-2 border text-right border-gray-300">{formatCurrency(item.price)}</td>
              <td className="p-2 border text-right border-gray-300">{formatCurrency(item.quantity * item.price)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="bg-gray-100 font-bold">
          <td className="p-2 border border-gray-300 text-right" colSpan={3}>TOTAL COMPRA</td>
          <td className="p-2 border text-right border-gray-300">{formatCurrency(purchase.totalAmount)}</td>
        </tr></tfoot>
      </table>
      <div className="mt-16 grid grid-cols-2 gap-12"><div className="text-center pt-8 border-t border-black"><p className="text-sm font-bold uppercase">Firma del Responsable</p></div></div>
      <div className="mt-8 text-[10px] text-center text-gray-400">Generado por Sistema de Control de Pedidos - {new Date().toLocaleString()}</div>
    </>
  );
}

// ---- VENTA ----
function SaleTransactionDialog({ saleId, transaction, onClose, onPrint }: { saleId: number; transaction: any; onClose: () => void; onPrint: () => void }) {
  const { data: detail, isLoading } = trpc.sales.getDetails.useQuery({ saleId }, { enabled: !!saleId });

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Detalle de Venta: {detail?.sale?.saleNumber || `#${saleId}`}</DialogTitle></DialogHeader>
        {isLoading || !detail ? (
          <div className="py-10 text-center text-muted-foreground">Cargando...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg text-sm">
              <div><p className="text-muted-foreground uppercase text-[10px] font-bold">Venta</p><p className="font-semibold">{detail.sale.saleNumber}</p></div>
              <div><p className="text-muted-foreground uppercase text-[10px] font-bold">Fecha</p><p className="font-semibold">{new Date(detail.sale.createdAt).toLocaleString("es-BO")}</p></div>
              <div><p className="text-muted-foreground uppercase text-[10px] font-bold">Cliente</p><p className="font-semibold">{detail.sale.customerDisplayName || "Anonimo"}</p></div>
              <div><p className="text-muted-foreground uppercase text-[10px] font-bold">Vendedor</p><p className="font-semibold">{detail.sale.sellerName || "Sin nombre"}</p></div>
              <div><p className="text-muted-foreground uppercase text-[10px] font-bold">Estado</p>
                <Badge variant={detail.sale.status === "cancelled" ? "destructive" : "default"}>{detail.sale.status === "cancelled" ? "Anulada" : "Activa"}</Badge></div>
              <div><p className="text-muted-foreground uppercase text-[10px] font-bold">Metodo de Pago</p><p className="font-semibold">{paymentMethodLabel(detail.sale.paymentMethod)}</p></div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground"><tr>
                  <th className="px-3 py-2 text-left font-medium">Producto</th>
                  <th className="px-3 py-2 text-center font-medium">Cant.</th>
                  <th className="px-3 py-2 text-right font-medium">P. Unit.</th>
                  <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                </tr></thead>
                <tbody className="divide-y">
                  {(detail.items || []).map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2"><p className="font-medium">{item.productName}</p><p className="text-[10px] text-muted-foreground">{item.productCode}</p></td>
                      <td className="px-3 py-2 text-center font-bold">{item.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(item.finalUnitPrice || item.basePrice)}</td>
                      <td className="px-3 py-2 text-right font-bold text-green-700">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-slate-50 p-3 flex justify-between items-center border-t border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Venta</span>
                <span className="text-xl font-black text-slate-900 font-mono">{formatCurrency(detail.sale.total)}</span>
              </div>
            </div>
            {detail.sale.notes && (
              <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-100 p-2 rounded">
                <p className="font-bold uppercase text-[9px] mb-1">Notas:</p>{detail.sale.notes}
              </div>
            )}
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              <Button onClick={onPrint} className="gap-2 bg-slate-900"><Printer className="h-4 w-4" />Imprimir Ticket</Button>
            </DialogFooter>
          </div>
        )}
        {detail && (
          <div className="hidden print:block p-8 bg-white text-black w-full" id="sale-print-area">
            <PrintSaleContent detail={detail} />
          </div>
        )}
      </DialogContent>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #sale-print-area, #sale-print-area * { visibility: visible; }
          #sale-print-area { position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index: 9999; background: white !important; padding: 40px !important; }
          .no-print { display: none !important; }
        }
      `}} />
    </Dialog>
  );
}

function PrintSaleContent({ detail }: { detail: any }) {
  return (
    <>
      <div className="text-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold uppercase">Comprobante de Venta</h1><p className="text-sm">Control de Pedidos App</p></div>
      <div className="grid grid-cols-2 gap-y-4 mb-8 text-sm">
        <div><span className="font-bold">Venta:</span> {detail.sale.saleNumber}</div>
        <div><span className="font-bold">Fecha:</span> {new Date(detail.sale.createdAt).toLocaleString("es-BO")}</div>
        <div><span className="font-bold">Cliente:</span> {detail.sale.customerDisplayName || "Anonimo"}</div>
        <div><span className="font-bold">Vendedor:</span> {detail.sale.sellerName || "Sin nombre"}</div>
        <div><span className="font-bold">Metodo:</span> {paymentMethodLabel(detail.sale.paymentMethod)}</div>
        <div><span className="font-bold">Estado:</span> {detail.sale.status === "cancelled" ? "ANULADA" : "ACTIVA"}</div>
      </div>
      <table className="w-full text-sm border-collapse mb-8">
        <thead><tr className="bg-gray-100 border border-gray-300">
          <th className="p-2 text-left border-r border-gray-300">Producto</th>
          <th className="p-2 text-center border-r border-gray-300">Cant.</th>
          <th className="p-2 text-right border-r border-gray-300">P. Unit.</th>
          <th className="p-2 text-right">Subtotal</th>
        </tr></thead>
        <tbody>
          {(detail.items || []).map((item: any) => (
            <tr key={item.id} className="border-b">
              <td className="p-2">{item.productName}</td>
              <td className="p-2 text-center">{item.quantity}</td>
              <td className="p-2 text-right">{formatCurrency(item.finalUnitPrice || item.basePrice)}</td>
              <td className="p-2 text-right">{formatCurrency(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="bg-gray-100 font-bold">
          <td className="p-2 border border-gray-300 text-right" colSpan={3}>TOTAL VENTA</td>
          <td className="p-2 border text-right border-gray-300">{formatCurrency(detail.sale.total)}</td>
        </tr></tfoot>
      </table>
      {detail.sale.notes && <div className="mb-6 text-sm italic border-l-4 border-gray-300 pl-3">Notas: {detail.sale.notes}</div>}
      <div className="mt-16 grid grid-cols-2 gap-12"><div className="text-center pt-8 border-t border-black"><p className="text-sm font-bold uppercase">Firma del Responsable</p></div></div>
      <div className="mt-8 text-[10px] text-center text-gray-400">Generado por Sistema de Control de Pedidos - {new Date().toLocaleString()}</div>
    </>
  );
}

// ---- BASICO (otros) ----
function BasicTransactionDialog({ transaction, onClose, onPrint }: { transaction: any; onClose: () => void; onPrint: () => void }) {
  const typeLabel = transaction.type === "income" ? "INGRESO" : "EGRESO";
  const categoryLabels: Record<string, string> = {
    sale: "Venta", purchase: "Compra", order_delivery: "Entrega de Pedido",
    sale_cancellation: "Anulacion de Venta", fuel: "Combustible",
    subsistence: "Viaticos / Comida", transfer: "Traspaso",
    transfer_between_registers: "Traspaso Cajas",
  };
  const methodLabels: Record<string, string> = { cash: "Caja Efectivo", qr: "Caja QR", transfer: "Cuenta Bancaria" };

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <div className="p-6 print:p-0 no-print">
          <DialogHeader className="mb-4">
            <div className="flex items-center justify-between">
              <div><DialogTitle className="text-xl">Detalle de Transaccion</DialogTitle>
                <DialogDescription>{typeLabel} #{`TXN-${String(transaction.id).padStart(5, "0")}`}</DialogDescription></div>
              <Badge className={transaction.type === "income" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>{typeLabel}</Badge>
            </div>
          </DialogHeader>
          <div className="space-y-3 mb-6">
            <div className="border rounded-lg overflow-hidden">
              <Table><TableBody>
                <TableRow><TableCell className="font-bold text-muted-foreground w-40">Fecha y Hora</TableCell><TableCell>{new Date(transaction.createdAt).toLocaleString()}</TableCell></TableRow>
                <TableRow><TableCell className="font-bold text-muted-foreground">Concepto</TableCell><TableCell className="font-semibold">{transaction.notes || transaction.category}</TableCell></TableRow>
                <TableRow><TableCell className="font-bold text-muted-foreground">Categoria</TableCell><TableCell>{categoryLabels[transaction.category] || transaction.category}</TableCell></TableRow>
                <TableRow><TableCell className="font-bold text-muted-foreground">Metodo de Pago</TableCell><TableCell>{methodLabels[transaction.paymentMethod] || transaction.paymentMethod || "—"}</TableCell></TableRow>
                <TableRow><TableCell className="font-bold text-muted-foreground">Monto</TableCell>
                  <TableCell className={`font-mono font-bold text-lg ${transaction.type === "income" ? "text-green-600" : "text-red-600"}`}>{transaction.type === "income" ? "+" : "-"} {formatCurrency(transaction.amount)}</TableCell></TableRow>
                <TableRow><TableCell className="font-bold text-muted-foreground">ID Referencia</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{transaction.referenceId || "—"}</TableCell></TableRow>
              </TableBody></Table>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button onClick={onPrint} className="gap-2 bg-slate-900"><Printer className="h-4 w-4" />Imprimir Comprobante</Button>
          </DialogFooter>
        </div>
        <div className="hidden print:block p-8 bg-white text-black w-full" id="print-area">
          <div className="text-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold uppercase">Comprobante de Transaccion</h1><p className="text-sm">Control de Pedidos App</p></div>
          <div className="grid grid-cols-2 gap-y-4 mb-8 text-sm">
            <div><span className="font-bold">Nro.:</span> #{`TXN-${String(transaction.id).padStart(5, "0")}`}</div>
            <div><span className="font-bold">Fecha:</span> {new Date(transaction.createdAt).toLocaleString()}</div>
            <div><span className="font-bold">Tipo:</span> {typeLabel}</div>
            <div><span className="font-bold">Categoria:</span> {categoryLabels[transaction.category] || transaction.category}</div>
            <div><span className="font-bold">Metodo:</span> {methodLabels[transaction.paymentMethod] || transaction.paymentMethod || "—"}</div>
          </div>
          <div className="p-4 border-2 border-black rounded-lg text-center mb-8">
            <p className="text-xs uppercase font-bold text-gray-500 mb-1">Monto Total</p>
            <p className="text-3xl font-bold">{transaction.type === "income" ? "+" : "-"} {formatCurrency(transaction.amount)}</p>
          </div>
          {transaction.notes && <div className="mb-10 p-3 bg-gray-50 border rounded text-sm italic"><span className="font-bold not-italic">Concepto: </span>{transaction.notes}</div>}
          <div className="mt-12 pt-8 border-t border-black text-center"><p className="text-sm font-bold uppercase">Firma Responsable</p></div>
          <div className="mt-8 text-[10px] text-center text-gray-400">Generado por Sistema de Control de Pedidos - {new Date().toLocaleString()}</div>
        </div>
      </DialogContent>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index: 9999; background: white !important; padding: 40px !important; }
          .no-print { display: none !important; }
        }
      `}} />
    </Dialog>
  );
}
