import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Plus, Package, Calendar, User, Trash2, Eye, Printer, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
function getLocalDateInputValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
}

export default function Purchases() {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<number>(0);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [purchaseData, setPurchaseData] = useState({
    purchaseNumber: "COM-" + Math.floor(Math.random() * 10000),
    status: "received" as const,
    isCredit: 0,
    paymentMethod: "cash",
    totalAmount: 0,
  });

  const [items, setItems] = useState<any[]>([]);
  const [currentItem, setCurrentItem] = useState({
    productId: 0,
    quantity: 1,
    price: 0,
    expiryDate: "",
  });

  const utils = trpc.useContext();
  const { data: purchases, isLoading: isPurchasesLoading } = (trpc.purchases as any).list.useQuery();
  const { data: suppliers } = (trpc.suppliers as any).list.useQuery();
  const { data: products } = (trpc.inventory as any).listProducts.useQuery();

  const selectedProduct = (products as any[])?.find((p: any) => p.id === currentItem.productId);

  const createMutation = (trpc.purchases as any).create.useMutation({
    onSuccess: () => {
      toast.success("Compra registrada e inventario actualizado");
      setOpen(false);
      setItems([]);
      setSupplierId(0);
      setPurchaseData({
        purchaseNumber: "COM-" + Math.floor(Math.random() * 10000),
        status: "received",
        isCredit: 0,
        paymentMethod: "cash",
        totalAmount: 0,
      });
      utils.purchases.list.invalidate();
      (utils as any).inventory.listInventory.invalidate(); // Invalida el inventario completo para ver las nuevas cantidades
    },
  });

  const addItem = () => {
    if (currentItem.productId === 0 || currentItem.quantity <= 0) return;
    const product = (products as any[])?.find((p: any) => p.id === currentItem.productId);
    
    // Convertir precio a centavos para almacenamiento consistente
    const priceInCents = Math.round(currentItem.price * 100);
    
    setItems([...items, { ...currentItem, price: priceInCents, productName: product?.name }]);
    
    // Actualizar total (en centavos)
    setPurchaseData(prev => ({
      ...prev,
      totalAmount: prev.totalAmount + (currentItem.quantity * priceInCents)
    }));
    setCurrentItem({ productId: 0, quantity: 1, price: 0, expiryDate: "" });
  };

  const removeItem = (index: number) => {
    const item = items[index];
    // item.price ya debe estar en centavos
    setPurchaseData(prev => ({
      ...prev,
      totalAmount: prev.totalAmount - (item.quantity * item.price)
    }));
    setItems(items.filter((_, i) => i !== index));
  };

  const { data: transactions } = trpc.finance.getTransactions.useQuery();
  const { data: cashOpenings } = trpc.finance.getCashOpenings.useQuery();

  const balances = useMemo(() => {
    if (!transactions) return { cash: 0, qr: 0, transfer: 0 };
    
    // Calcular ingresos y egresos base
    const getBalance = (method: string) => {
      const txs = (transactions as any[]) || [];
      const income = txs.filter(t => t.type === "income" && (t.paymentMethod === method || (!t.paymentMethod && method === 'cash'))).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const expense = txs.filter(t => t.type === "expense" && (t.paymentMethod === method || (!t.paymentMethod && method === 'cash'))).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      return income - expense;
    };

    // Aperturas de hoy
    const today = getLocalDateInputValue();
    const getOpening = (method: string) => {
      const openings = (cashOpenings as any[]) || [];
      return openings
        .filter(o => o.openingDate === today && (o.paymentMethod === method || (!o.paymentMethod && method === 'cash')))
        .reduce((sum, o) => sum + (Number(o.openingAmount) || 0), 0);
    };

    return {
      cash: getBalance('cash') + getOpening('cash'),
      qr: getBalance('qr') + getOpening('qr'),
      transfer: getBalance('transfer') + getOpening('transfer')
    };
  }, [transactions, cashOpenings]);

  const currentBalance = purchaseData.paymentMethod === 'cash' ? balances.cash : 
                         purchaseData.paymentMethod === 'qr' ? balances.qr : 
                         balances.transfer;

  const isInsufficient = purchaseData.totalAmount > currentBalance;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Añade al menos un producto a la compra");
      return;
    }
    const purchasePayload = {
      ...purchaseData,
      supplierId: supplierId === 0 ? undefined : supplierId,
      items
    };
    createMutation.mutate(purchasePayload);
  };

  const handlePrint = (purchase: any) => {
    const printContent = document.getElementById(`purchase-print-${purchase.id}`);
    if (!printContent) return;
    
    const win = window.open('', '', 'height=700,width=900');
    if (!win) return;
    
    win.document.write('<html><head><title>Comprobante de Compra</title>');
    win.document.write('<style>');
    win.document.write('body { font-family: sans-serif; padding: 20px; }');
    win.document.write('.header { border-bottom: 2px solid #333; margin-bottom: 20px; padding-bottom: 10px; }');
    win.document.write('.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }');
    win.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
    win.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
    win.document.write('th { background-color: #f2f2f2; }');
    win.document.write('.total { text-align: right; margin-top: 20px; font-size: 1.2rem; font-weight: bold; }');
    win.document.write('</style></head><body>');
    win.document.write(printContent.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto mb-20 md:mb-0">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registro de Compras</h1>
          <p className="text-muted-foreground">Ingresa nuevas facturas, notas e insumos al sistema.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de Compra */}
        <Card className="lg:col-span-2 border-green-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2 text-green-700">
              <Plus className="h-5 w-5" /> Nueva Entrada de Mercancía / Insumos
            </CardTitle>
            <CardDescription>
              Completa los datos para actualizar el stock automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Select
                    value={supplierId === 0 ? "" : supplierId.toString()}
                    onValueChange={(val) => setSupplierId(parseInt(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin proveedor (Compra Directa)" />
                    </SelectTrigger>
                    <SelectContent>
                      {(suppliers as any[])?.map((s: any) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nro de Factura/Nota</Label>
                  <Input 
                    value={purchaseData.purchaseNumber} 
                    onChange={(e) => setPurchaseData({...purchaseData, purchaseNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Método de Pago</Label>
                  <Select value={purchaseData.paymentMethod} onValueChange={(val: any) => setPurchaseData({...purchaseData, paymentMethod: val})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="qr">Transferencia QR</SelectItem>
                      <SelectItem value="transfer">Cuenta Bancaria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={`space-y-2 p-3 rounded-lg border transition-colors ${isInsufficient ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                   <Label className={`text-[10px] font-bold uppercase tracking-wider ${isInsufficient ? 'text-red-600' : 'text-slate-500'}`}>Saldo Disponible</Label>
                   <p className={`text-xl font-black ${isInsufficient ? 'text-red-700' : 'text-slate-900'}`}>
                     {formatCurrency(currentBalance)}
                   </p>
                   {isInsufficient && (
                     <p className="text-[9px] font-bold text-red-500 animate-pulse uppercase">¡Fondos insuficientes en esta caja!</p>
                   )}
                </div>
              </div>

              <div className="border p-4 rounded-lg bg-muted/30 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 border-b pb-2">
                  <Package className="h-4 w-4" /> Detalle de Productos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs font-bold text-blue-800">Producto / Insumo</Label>
                    <div className="flex gap-2">
                      {currentItem.productId !== 0 && (
                        selectedProduct?.imageUrl ? (
                          <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="h-10 w-10 rounded-md object-cover border flex-shrink-0 bg-white" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center border flex-shrink-0">
                            <Package className="h-5 w-5 text-slate-400" />
                          </div>
                        )
                      )}
                      <div className="flex-1 min-w-0">
                        <Select value={currentItem.productId.toString()} onValueChange={(val) => setCurrentItem({...currentItem, productId: parseInt(val), price: 0})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(products as any[])?.map((p: any) => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Info del producto seleccionado */}
                  {selectedProduct && (
                    <div className="md:col-span-2 grid grid-cols-3 gap-2">
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                        <p className="text-[9px] font-bold uppercase text-blue-500 tracking-wide">Stock Disponible</p>
                        <p className="text-lg font-black text-blue-700">{selectedProduct.stock ?? selectedProduct.quantity ?? 0}</p>
                        <p className="text-[9px] text-blue-400">{selectedProduct.unit || 'unidades'}</p>
                      </div>
                      <div className="bg-green-50 border border-green-100 rounded-lg p-2 text-center">
                        <p className="text-[9px] font-bold uppercase text-green-500 tracking-wide">Precio Venta</p>
                        <p className="text-lg font-black text-green-700">{formatCurrency((selectedProduct.salePrice ?? selectedProduct.price ?? 0))}</p>
                        <p className="text-[9px] text-green-400">por unidad</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                        <p className="text-[9px] font-bold uppercase text-amber-500 tracking-wide">Saldo Inventario</p>
                        <p className="text-lg font-black text-amber-700">{formatCurrency((selectedProduct.stock ?? selectedProduct.quantity ?? 0) * (selectedProduct.salePrice ?? selectedProduct.price ?? 0))}</p>
                        <p className="text-[9px] text-amber-400">valor total</p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Cant.</Label>
                    <Input 
                      type="number" 
                      value={currentItem.quantity} 
                      onChange={(e) => setCurrentItem({...currentItem, quantity: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-green-700 uppercase">P. Unitario Compra</Label>
                    <Input 
                      type="number" 
                      value={currentItem.price} 
                      onChange={(e) => setCurrentItem({...currentItem, price: parseFloat(e.target.value) || 0})}
                      placeholder="0"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-[10px] text-orange-600 uppercase">Fecha Vencimiento (opcional)</Label>
                    <Input 
                      type="date" 
                      value={currentItem.expiryDate} 
                      onChange={(e) => setCurrentItem({...currentItem, expiryDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1 bg-slate-50 border rounded p-2 flex flex-col justify-center border-dashed">
                    <Label className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">TOTAL ITEM</Label>
                    <p className="text-sm font-black text-blue-700">
                      {formatCurrency(Math.round(currentItem.quantity * currentItem.price * 100))}
                    </p>
                  </div>
                  <Button type="button" variant="secondary" className="w-full font-bold h-10 border-2" onClick={addItem}>
                    Añadir Item
                  </Button>
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-sm bg-background p-2 rounded border border-blue-100">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{item.productName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          <span className="text-green-700 font-medium">P. Unit:</span> {formatCurrency(item.price)} x {item.quantity} unidades
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 font-bold uppercase leading-none">Subtotal Item</p>
                          <p className="font-mono font-bold text-blue-700 leading-tight">{formatCurrency(item.quantity * item.price)}</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-center text-muted-foreground text-xs py-4">No hay productos añadidos a la compra</p>
                  )}
                </div>
              </div>

              {/* Sección de Resumen Mejorada */}
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-5 rounded-xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <h4 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Resumen de la Transacción</h4>
                  <Badge variant="outline" className="bg-white">
                    {items.length} {items.length === 1 ? 'Producto' : 'Productos'}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Subtotal de items:</span>
                    <span className="font-mono">{formatCurrency(purchaseData.totalAmount)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-1">
                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setPurchaseData({...purchaseData, isCredit: purchaseData.isCredit === 1 ? 0 : 1})}>
                      <div className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${purchaseData.isCredit === 1 ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}>
                        {purchaseData.isCredit === 1 && <ShoppingCart className="h-3 w-3" />}
                      </div>
                      <Label className="text-xs font-semibold text-slate-700 cursor-pointer">Marcar como compra a crédito</Label>
                    </div>
                    {purchaseData.isCredit === 1 && (
                      <Badge variant="destructive" className="animate-pulse">Pendiente de Pago</Badge>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-end pt-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total a Pagar</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">
                      {formatCurrency(purchaseData.totalAmount)}
                    </p>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-medium">
                    Actualiza stock al finalizar
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700" disabled={createMutation.isPending || items.length === 0}>
                {createMutation.isPending ? "Procesando..." : "Registrar y Finalizar Compra"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Historial Reciente */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" /> Últimos Registros
          </h2>
          <div className="space-y-3">
            {isPurchasesLoading ? (
              <p className="text-sm text-muted-foreground">Cargando historial...</p>
            ) : (purchases as any[])?.map((purchase: any) => (
              <Card key={purchase.id} className="hover:shadow-sm transition-shadow border-l-4 border-l-blue-400 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-blue-700">{purchase.purchaseNumber}</p>
                    <Badge variant={purchase.status === "received" ? "default" : "outline"} className="text-[10px] h-5">
                      {purchase.status === "received" ? "OK" : "P"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                    <User className="h-3 w-3" /> {purchase.supplierName}
                  </p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-muted-foreground">{new Date(purchase.createdAt).toLocaleDateString()}</p>
                      <p className="font-mono font-bold text-lg">{formatCurrency(purchase.totalAmount)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8 rounded-full border-blue-200 hover:bg-blue-50 text-blue-600"
                        title="Ver Registro"
                        onClick={() => {
                          setSelectedPurchase(purchase);
                          setShowDetails(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8 rounded-full border-slate-200 hover:bg-slate-50 text-slate-600"
                        title="Imprimir"
                        onClick={() => handlePrint(purchase)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {purchase.isCredit === 1 && (
                    <div className="mt-2">
                       <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 hover:bg-red-50 w-full justify-center">Crédito</Badge>
                    </div>
                  )}

                  {/* Template para impresión (oculto) */}
                  <div id={`purchase-print-${purchase.id}`} className="hidden">
                    <div className="header">
                      <h1>Comprobante de Compra</h1>
                      <p><strong>Nro:</strong> {purchase.purchaseNumber}</p>
                    </div>
                    <div className="grid">
                      <div>
                        <p><strong>Proveedor:</strong> {purchase.supplierName}</p>
                        <p><strong>Fecha:</strong> {new Date(purchase.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p><strong>Método:</strong> {purchase.paymentMethod}</p>
                        <p><strong>Estado:</strong> {purchase.status}</p>
                      </div>
                    </div>
                    <div className="total">
                      TOTAL: {formatCurrency(purchase.totalAmount)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Dialog de Detalles de Compra */}
      <PurchaseDetailDialog 
        purchase={selectedPurchase}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </div>
  );
}

function PurchaseDetailDialog({ purchase, open, onOpenChange }: any) {
  const { data: items, isLoading } = (trpc.purchases as any).getItems.useQuery(
    { purchaseId: purchase?.id },
    { enabled: !!purchase?.id }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Detalle de Compra: {purchase?.purchaseNumber}
          </DialogTitle>
        </DialogHeader>
        
        {purchase && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg text-sm">
              <div>
                <p className="text-muted-foreground uppercase text-[10px] font-bold">Proveedor</p>
                <p className="font-semibold">{purchase.supplierName}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase text-[10px] font-bold">Fecha</p>
                <p className="font-semibold">{new Date(purchase.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase text-[10px] font-bold">Método de Pago</p>
                <Badge variant="outline" className="capitalize">{purchase.paymentMethod}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground uppercase text-[10px] font-bold">Estado</p>
                <Badge variant={purchase.status === "received" ? "default" : "outline"} className="capitalize">
                  {purchase.status === "received" ? "Recibido" : purchase.status}
                </Badge>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Producto</th>
                    <th className="px-3 py-2 text-center font-medium">Cant.</th>
                    <th className="px-3 py-2 text-right font-medium">Precio Uni.</th>
                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground italic">
                        Cargando items...
                      </td>
                    </tr>
                  ) : items?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-[10px] text-muted-foreground">{item.productCode}</p>
                      </td>
                      <td className="px-3 py-2 text-center font-bold px-4">{item.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(item.price)}</td>
                      <td className="px-3 py-2 text-right font-bold text-blue-700">{formatCurrency(item.quantity * item.price)}</td>
                    </tr>
                  ))}
                  {(!items || items.length === 0) && !isLoading && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground italic">
                        No hay detalles disponibles (posible ajuste manual).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="bg-slate-50 p-3 flex justify-between items-center border-t border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Compra</span>
                <span className="text-xl font-black text-slate-900 font-mono">
                  {formatCurrency(purchase.totalAmount)}
                </span>
              </div>
            </div>

            {purchase.notes && (
              <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-100 p-2 rounded">
                 <p className="font-bold uppercase text-[9px] mb-1">Notas:</p>
                 {purchase.notes}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
