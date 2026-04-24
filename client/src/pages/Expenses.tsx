import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, DollarSign, CreditCard, Clock, CheckCircle2, AlertTriangle, Trash2, Edit, Printer, Download, X, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function getLocalDateInputValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
}

const EXPENSE_CATEGORIES = [
  { value: "facebook_ads", label: "Facebook Ads", color: "bg-blue-100 text-blue-800" },
  { value: "google_ads", label: "Google Ads", color: "bg-yellow-100 text-yellow-800" },
  { value: "electricity", label: "Luz / Electricidad", color: "bg-amber-100 text-amber-800" },
  { value: "water", label: "Agua", color: "bg-cyan-100 text-cyan-800" },
  { value: "internet", label: "Internet", color: "bg-indigo-100 text-indigo-800" },
  { value: "telephone", label: "Teléfono", color: "bg-purple-100 text-purple-800" },
  { value: "rent", label: "Alquiler", color: "bg-pink-100 text-pink-800" },
  { value: "salaries", label: "Sueldos / Salarios", color: "bg-green-100 text-green-800" },
  { value: "maintenance", label: "Mantenimiento", color: "bg-orange-100 text-orange-800" },
  { value: "supplies", label: "Insumos / Oficina", color: "bg-teal-100 text-teal-800" },
  { value: "taxes", label: "Impuestos", color: "bg-red-100 text-red-800" },
  { value: "insurance", label: "Seguros", color: "bg-slate-100 text-slate-800" },
  { value: "bank_fees", label: "Comisiones Bancarias", color: "bg-gray-100 text-gray-800" },
  { value: "other", label: "Otros", color: "bg-muted text-muted-foreground" },
];

function getCategoryLabel(category: string) {
  return EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
}

function getCategoryColor(category: string) {
  return EXPENSE_CATEGORIES.find(c => c.value === category)?.color || "bg-muted text-muted-foreground";
}

export default function Expenses() {
  const { data: expenses, isLoading, refetch } = trpc.expenses.list.useQuery();
  const { data: totals } = trpc.expenses.totals.useQuery();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filteredExpenses = (expenses as any[])?.filter((e: any) => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    return true;
  });

  return (
    <div className="p-4 space-y-6 max-w-6xl mx-auto mb-20 md:mb-0">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gastos Operativos</h1>
          <p className="text-muted-foreground">Control de gastos generales del negocio.</p>
        </div>
        <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" /> Nuevo Gasto
        </Button>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-red-50/60 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-red-800">Pendientes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-700">{formatCurrency((totals?.totalPending || 0) * 100)}</div>
            <p className="text-xs text-red-600/70">{totals?.countPending || 0} gastos pendientes</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50/60 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-green-800">Pagados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-green-700">{formatCurrency((totals?.totalPaid || 0) * 100)}</div>
            <p className="text-xs text-green-600/70">{totals?.countPaid || 0} gastos pagados</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-50/60 border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-800">Total General</CardTitle>
            <Receipt className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-700">{formatCurrency((totals?.total || 0) * 100)}</div>
            <p className="text-xs text-slate-600/70">{totals?.count || 0} gastos registrados</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/60 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-blue-800">Este Mes</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-700">
              {formatCurrency(((expenses as any[])?.filter((e: any) => {
                const expenseDate = new Date(e.createdAt);
                const now = new Date();
                return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
              }).reduce((sum: number, e: any) => sum + e.amount, 0) || 0))}
            </div>
            <p className="text-xs text-blue-600/70">Gastos del mes en curso</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Gastos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Lista de Gastos</CardTitle>
              <CardDescription>Historial de todos los gastos operativos.</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="paid">Pagados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : filteredExpenses?.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No hay gastos registrados</p>
              <p className="text-sm">Haz clic en "Nuevo Gasto" para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses?.map((expense: any) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      onEdit={expense.status === "pending" ? () => setEditingExpense(expense) : undefined}
                      onRefresh={refetch}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo para Agregar Gasto */}
      {showAddDialog && (
        <ExpenseDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSave={refetch}
        />
      )}

      {/* Diálogo para Editar Gasto */}
      {editingExpense && (
        <ExpenseDialog
          open={!!editingExpense}
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSave={refetch}
        />
      )}
    </div>
  );
}

function ExpenseRow({ expense, onEdit, onRefresh }: { expense: any; onEdit: (() => void) | undefined; onRefresh: () => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const utils = trpc.useUtils();
  const markPaidMutation = trpc.expenses.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Gasto marcado como pagado");
      onRefresh();
      void utils.expenses.list.invalidate();
      void utils.expenses.totals.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("Gasto eliminado");
      onRefresh();
      void utils.expenses.list.invalidate();
      void utils.expenses.totals.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const handleMarkAsPaid = () => {
    markPaidMutation.mutate({ id: expense.id });
  };

  const handleDelete = () => {
    if (confirm("¿Estás seguro de eliminar este gasto?")) {
      deleteMutation.mutate({ id: expense.id });
    }
  };

  return (
    <>
      <TableRow className={expense.status === "pending" ? "bg-amber-50/50" : ""}>
        <TableCell className="font-medium">
          <div>{new Date(expense.createdAt).toLocaleDateString("es-BO")}</div>
          {expense.expenseDate && expense.expenseDate !== expense.createdAt && (
            <div className="text-xs text-muted-foreground">
              Exp: {new Date(expense.expenseDate).toLocaleDateString("es-BO")}
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="font-medium">{expense.description}</div>
          {expense.supplierName && (
            <div className="text-xs text-muted-foreground">{expense.supplierName}</div>
          )}
        </TableCell>
        <TableCell>
          <Badge className={getCategoryColor(expense.category)}>
            {getCategoryLabel(expense.category)}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="capitalize">
            {expense.paymentMethod === "cash" ? "Efectivo" : expense.paymentMethod === "qr" ? "QR" : "Transferencia"}
          </Badge>
        </TableCell>
        <TableCell className="text-right font-mono font-bold">
          {formatCurrency(expense.amount)}
        </TableCell>
        <TableCell className="text-center">
          {expense.status === "pending" ? (
            <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
              <Clock className="h-3 w-3 mr-1" /> Pendiente
            </Badge>
          ) : (
            <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Pagado
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowDetail(true)}>
              <Receipt className="h-4 w-4" />
            </Button>
            {expense.status === "pending" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={handleMarkAsPaid}
                disabled={markPaidMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
            {expense.status === "pending" && onEdit && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {showDetail && (
        <ExpenseDetailDialog expense={expense} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}

function ExpenseDetailDialog({ expense, onClose }: { expense: any; onClose: () => void }) {
  return (
    <Dialog open={!!expense} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalle del Gasto</DialogTitle>
          <DialogDescription>Gasto operativo #{expense.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Descripción</p>
              <p className="font-medium">{expense.description}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Categoría</p>
              <Badge className={getCategoryColor(expense.category)}>{getCategoryLabel(expense.category)}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Monto</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(expense.amount)}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Método de Pago</p>
              <p className="font-medium capitalize">
                {expense.paymentMethod === "cash" ? "Efectivo" : expense.paymentMethod === "qr" ? "QR" : "Transferencia"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Fecha del Gasto</p>
              <p className="font-medium">{new Date(expense.expenseDate || expense.createdAt).toLocaleDateString("es-BO")}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Estado</p>
              <Badge variant={expense.status === "paid" ? "default" : "outline"} className={expense.status === "pending" ? "border-amber-300 text-amber-700" : "bg-green-100 text-green-800"}>
                {expense.status === "paid" ? "Pagado" : "Pendiente"}
              </Badge>
            </div>
          </div>

          {expense.supplierName && (
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Proveedor</p>
              <p className="font-medium">{expense.supplierName}</p>
            </div>
          )}

          {expense.invoiceNumber && (
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Nro. Factura</p>
              <p className="font-medium">{expense.invoiceNumber}</p>
            </div>
          )}

          {expense.notes && (
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Notas</p>
              <p className="text-sm">{expense.notes}</p>
            </div>
          )}

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Creado: {new Date(expense.createdAt).toLocaleString("es-BO")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ExpenseDialogProps {
  open: boolean;
  expense?: any;
  onClose: () => void;
  onSave: () => void;
}

function ExpenseDialog({ open, expense, onClose, onSave }: ExpenseDialogProps) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    description: "",
    category: "other" as string,
    amount: "",
    paymentMethod: "cash" as string,
    expenseDate: getLocalDateInputValue(),
    dueDate: "",
    status: "pending" as string,
    supplierName: "",
    invoiceNumber: "",
    notes: "",
  });

  useEffect(() => {
    if (expense) {
      setForm({
        description: expense.description || "",
        category: expense.category || "other",
        amount: expense.amount ? (expense.amount / 100).toString() : "",
        paymentMethod: expense.paymentMethod || "cash",
        expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().split("T")[0] : getLocalDateInputValue(),
        dueDate: expense.dueDate ? new Date(expense.dueDate).toISOString().split("T")[0] : "",
        status: expense.status || "pending",
        supplierName: expense.supplierName || "",
        invoiceNumber: expense.invoiceNumber || "",
        notes: expense.notes || "",
      });
    } else {
      setForm({
        description: "",
        category: "other",
        amount: "",
        paymentMethod: "cash",
        expenseDate: getLocalDateInputValue(),
        dueDate: "",
        status: "pending",
        supplierName: "",
        invoiceNumber: "",
        notes: "",
      });
    }
  }, [expense, open]);

  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("Gasto registrado exitosamente");
      onSave();
      onClose();
      void utils.expenses.list.invalidate();
      void utils.expenses.totals.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const updateMutation = trpc.expenses.update.useMutation({
    onSuccess: () => {
      toast.success("Gasto actualizado exitosamente");
      onSave();
      onClose();
      void utils.expenses.list.invalidate();
      void utils.expenses.totals.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!form.description.trim()) {
      toast.error("La descripción es requerida");
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    const data: any = {
      description: form.description,
      category: form.category as any,
      amount: Math.round(amount * 100),
      paymentMethod: form.paymentMethod as any,
      expenseDate: form.expenseDate,
      dueDate: form.dueDate || undefined,
      supplierName: form.supplierName || undefined,
      invoiceNumber: form.invoiceNumber || undefined,
      notes: form.notes || undefined,
    };

    // Solo enviar status al crear, nunca al editar un gasto ya pagado
    if (!expense || expense.status !== "paid") {
      data.status = form.status as any;
    }

    if (expense) {
      updateMutation.mutate({ id: expense.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar Gasto" : "Nuevo Gasto Operativo"}</DialogTitle>
          <DialogDescription>
            {expense ? "Modifica los datos del gasto" : "Registra un nuevo gasto operativo del negocio"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descripción *</Label>
            <Input
              id="description"
              placeholder="Ej: Pago de publicidad Facebook"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoría *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Monto (Bs) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Método de Pago *</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="qr">QR</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              {expense?.status === "paid" ? (
                <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Pagado
                </Badge>
              ) : (
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="paid">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expenseDate">Fecha del Gasto</Label>
              <Input
                id="expenseDate"
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Fecha de Vencimiento</Label>
              <Input
                id="dueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplierName">Proveedor / Empresa</Label>
            <Input
              id="supplierName"
              placeholder="Ej: ENEL, Telefónica, etc."
              value={form.supplierName}
              onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Número de Factura / Comprobante</Label>
            <Input
              id="invoiceNumber"
              placeholder="Ej: 001-002-0034567"
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas / Observaciones</Label>
            <Input
              id="notes"
              placeholder="Notas adicionales..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? "Guardando..." : expense ? "Actualizar" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
