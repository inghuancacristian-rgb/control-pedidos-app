import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/useMobile";
import {
  AlertTriangle,
  Box,
  Edit2,
  Sparkles,
  TriangleAlert,
  ScanBarcode,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddProductDialog } from "@/components/AddProductDialog";
import { EditProductDialog } from "@/components/EditProductDialog";
import { ProductHistoryDialog } from "@/components/ProductHistoryDialog";
import { formatCurrency } from "@/lib/currency";

type InventoryTab = "finished" | "raw";

function formatExpiryDate(value?: string | Date | null) {
  if (!value) return "Sin vencimiento";
  return new Date(value).toLocaleDateString("es-BO");
}

function getExpiryTone(value?: string | Date | null) {
  if (!value) return "text-muted-foreground";
  return new Date(value) < new Date() ? "text-red-600 font-semibold" : "text-orange-600";
}

function ProductThumb({ item }: { item: any }) {
  if (item.product?.imageUrl) {
    return (
      <img
        src={item.product.imageUrl}
        alt={item.product?.name || "Producto"}
        className="h-14 w-14 rounded-2xl border border-white/70 object-cover shadow-sm"
      />
    );
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/60 text-xs font-semibold text-muted-foreground">
      N/A
    </div>
  );
}

function AdjustInventoryDialog({
  item,
  isOpen,
  onOpenChange,
  quantity,
  setQuantity,
  reason,
  setReason,
  type,
  setType,
  price,
  setPrice,
  expiryDate,
  setExpiryDate,
  registerPurchase,
  setRegisterPurchase,
  paymentMethod,
  setPaymentMethod,
  onSubmit,
  isPending,
}: {
  item: any;
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
  quantity: string;
  setQuantity: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  type: "entry" | "exit" | "adjustment";
  setType: (value: "entry" | "exit" | "adjustment") => void;
  price: string;
  setPrice: (value: string) => void;
  expiryDate: string;
  setExpiryDate: (value: string) => void;
  registerPurchase: boolean;
  setRegisterPurchase: (value: boolean) => void;
  paymentMethod: "cash" | "qr" | "transfer";
  setPaymentMethod: (value: "cash" | "qr" | "transfer") => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Edit2 className="h-4 w-4" />
          Ajustar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-[1.6rem] border-white/70 bg-white/95">
        <DialogHeader>
          <DialogTitle>Ajustar stock de {item.product?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Tipo de ajuste</Label>
            <select
              className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-white/80 px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring/40"
              value={type}
              onChange={(e) => setType(e.target.value as "entry" | "exit" | "adjustment")}
            >
              <option value="adjustment">Ajuste de stock</option>
              <option value="entry">Entrada (compra o produccion)</option>
              <option value="exit">Salida (baja o perdida)</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="quantity">Cantidad</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="Ej: 10 o -5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-11 rounded-xl border-white/70 bg-white/80"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price">
                Precio compra {registerPurchase ? "(obligatorio)" : "(opcional)"}
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder={item.product?.price != null ? `Actual: ${(item.product.price / 100).toFixed(2)}` : "Mantener actual"}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-11 rounded-xl border-white/70 bg-white/80"
              />
            </div>
          </div>

          {type === "entry" && (
            <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2 sm:items-start">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={registerPurchase}
                  onChange={(e) => setRegisterPurchase(e.target.checked)}
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Compra rápida</p>
                  <p className="text-xs text-muted-foreground">
                    Registra la entrada como compra: crea movimiento en Finanzas (egreso) y aparece en Historial de Compras.
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="purchase-payment-method" className={!registerPurchase ? "text-muted-foreground" : ""}>
                  Método de pago
                </Label>
                <select
                  id="purchase-payment-method"
                  disabled={!registerPurchase}
                  className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-white/80 px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                >
                  <option value="cash">Efectivo</option>
                  <option value="qr">QR</option>
                  <option value="transfer">Cuenta Bancaria</option>
                </select>
              </div>

              {false && (
                <div className="grid gap-2">
                  <Label>Método de pago</Label>
                  <select
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-white/80 px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring/40"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="qr">QR</option>
                    <option value="transfer">Cuenta Bancaria</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="expiry">Vencimiento</Label>
              <Input
                id="expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-11 rounded-xl border-white/70 bg-white/80"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Motivo</Label>
              <Input
                id="reason"
                type="text"
                placeholder="Ajuste manual"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-11 rounded-xl border-white/70 bg-white/80"
              />
            </div>
          </div>

          <Button onClick={onSubmit} disabled={isPending} className="h-11 w-full">
            {isPending ? "Actualizando..." : "Actualizar producto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const utils = trpc.useContext();
  const { data: inventory, isLoading, refetch } = trpc.inventory.listInventory.useQuery();
  const [activeTab, setActiveTab] = useState<InventoryTab>("finished");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"entry" | "exit" | "adjustment">("adjustment");
  const [price, setPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [registerPurchase, setRegisterPurchase] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr" | "transfer">("cash");
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInputActive, setBarcodeInputActive] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Buscar por código de barras
  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const found = displayItems.find(
        (item: any) => item.product?.code?.toLowerCase() === searchQuery.toLowerCase()
      );
      if (found) {
        setSelectedItem(found);
        setIsDialogOpen(true);
        setSearchQuery("");
      } else {
        toast.error(`Producto con código "${searchQuery}" no encontrado`);
      }
    }
  };

  const toggleBarcodeInput = () => {
    setBarcodeInputActive(!barcodeInputActive);
    if (!barcodeInputActive) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  };

  useEffect(() => {
    if (selectedItem) {
      setPrice("");
      setExpiryDate(
        selectedItem.expiryDate ? new Date(selectedItem.expiryDate).toISOString().split("T")[0] : ""
      );
      setReason("");
      setRegisterPurchase(false);
      setPaymentMethod("cash");
    }
  }, [selectedItem]);

  // Si es entrada, por defecto asumimos "compra rápida" para que no se olvide registrar el pago
  useEffect(() => {
    if (!isDialogOpen) return;
    if (type === "entry") {
      setRegisterPurchase(true);
      if (selectedItem?.product?.price != null && !price) {
        setPrice((selectedItem.product.price / 100).toFixed(2));
      }
    } else {
      setRegisterPurchase(false);
    }
  }, [type, isDialogOpen, selectedItem?.product?.price]);

  const updateInventoryMutation = trpc.inventory.updateQuantity.useMutation({
    onSuccess: () => {
      toast.success("Inventario actualizado");
      setIsDialogOpen(false);
      setQuantity("");
      setReason("");
      refetch();
      (utils as any).purchases?.list?.invalidate?.();
      (utils as any).finance?.getTransactions?.invalidate?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar inventario");
    },
  });

  const finishedProducts = useMemo(
    () => inventory?.filter((item: any) => item.product?.category === "finished_product") || [],
    [inventory]
  );
  const rawMaterials = useMemo(
    () => inventory?.filter((item: any) => item.product?.category === "raw_material") || [],
    [inventory]
  );
  const supplies = useMemo(
    () => inventory?.filter((item: any) => item.product?.category === "supplies") || [],
    [inventory]
  );
  const allRawItems = useMemo(() => [...rawMaterials, ...supplies], [rawMaterials, supplies]);

  const lowStockFinished = useMemo(
    () => finishedProducts.filter((item: any) => item.isLowStock) || [],
    [finishedProducts]
  );
  const lowStockRaw = useMemo(() => allRawItems.filter((item: any) => item.isLowStock) || [], [allRawItems]);

  const displayItems = useMemo(() => {
    let items = activeTab === "finished" ? finishedProducts : allRawItems;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item: any) =>
          item.product?.name?.toLowerCase().includes(query) ||
          item.product?.code?.toLowerCase().includes(query)
      );
    }
    return items;
  }, [activeTab, finishedProducts, allRawItems, searchQuery]);
  const lowStockItems = activeTab === "finished" ? lowStockFinished : lowStockRaw;

  const inventorySummary = useMemo(() => {
    const currentItems = activeTab === "finished" ? finishedProducts : allRawItems;

    return {
      totalItems: currentItems.length,
      units: currentItems.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0),
      lowStock: currentItems.filter((item: any) => item.isLowStock).length,
      expiring: currentItems.filter((item: any) => item.expiryDate).length,
    };
  }, [activeTab, finishedProducts, allRawItems]);

  const handleUpdateInventory = () => {
    if (!selectedItem) return;

    const priceInCents = price ? Math.round(parseFloat(price) * 100) : undefined;
    const parsedQuantity = quantity ? parseInt(quantity, 10) : 0;
    const currentExpiryDate = selectedItem.expiryDate
      ? new Date(selectedItem.expiryDate).toISOString().split("T")[0]
      : "";
    const hasExpiryChange = expiryDate !== currentExpiryDate;

    if (parsedQuantity === 0 && priceInCents === undefined && !hasExpiryChange) {
      toast.error("Ingresa una cantidad, un precio o cambia el vencimiento para actualizar");
      return;
    }

    if (registerPurchase) {
      if (type !== "entry") {
        toast.error("La compra rápida solo aplica para entradas de inventario.");
        return;
      }
      if (!Number.isFinite(priceInCents) || (priceInCents || 0) <= 0) {
        toast.error("Para compra rápida debes ingresar el precio de compra.");
        return;
      }
      if (parsedQuantity <= 0) {
        toast.error("Para compra rápida la cantidad debe ser mayor a 0.");
        return;
      }
    }

    updateInventoryMutation.mutate({
      productId: selectedItem.productId,
      quantity: parsedQuantity,
      price: priceInCents,
      reason: reason || "Ajuste manual",
      type,
      expiryDate: expiryDate || undefined,
      registerPurchase,
      paymentMethod: registerPurchase ? paymentMethod : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="glass-panel flex min-h-[220px] w-full max-w-md items-center justify-center px-6 text-center">
          <p className="text-lg font-semibold">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-container space-y-6">
        <section className="hero-panel p-5 sm:p-7 md:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="status-chip">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Inventario con mejor lectura
                </span>
                {lowStockItems.length > 0 ? (
                  <span className="status-chip text-red-700">
                    <TriangleAlert className="mr-1.5 h-3.5 w-3.5 text-red-600" />
                    {lowStockItems.length} alertas de stock
                  </span>
                ) : null}
              </div>

              <h1 className="mt-5 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                Gestion de inventario optimizada para celular, tablet y escritorio.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Consulta productos, detecta faltantes, revisa historiales y ajusta stock con una interfaz mas clara y tactil.
              </p>
            </div>

            {user?.role === "admin" && isMobile ? <AddProductDialog onProductAdded={() => refetch()} /> : null}
          </div>
        </section>

        <section className="soft-grid sm:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <p className="text-sm font-semibold text-muted-foreground">Items visibles</p>
            <p className="kpi-value mt-3">{inventorySummary.totalItems}</p>
          </div>
          <div className="metric-card">
            <p className="text-sm font-semibold text-muted-foreground">Unidades en stock</p>
            <p className="kpi-value mt-3">{inventorySummary.units}</p>
          </div>
          <div className="metric-card">
            <p className="text-sm font-semibold text-muted-foreground">Stock bajo</p>
            <p className="kpi-value mt-3">{inventorySummary.lowStock}</p>
          </div>
          <div className="metric-card">
            <p className="text-sm font-semibold text-muted-foreground">Con vencimiento</p>
            <p className="kpi-value mt-3">{inventorySummary.expiring}</p>
          </div>
        </section>

        <section className="glass-panel p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => setActiveTab("finished")}
              className={`rounded-[1.2rem] px-4 py-4 text-left transition-all ${
                activeTab === "finished"
                  ? "bg-primary text-primary-foreground shadow-[0_18px_28px_-22px_var(--primary)]"
                  : "bg-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <p className="text-sm font-semibold">Productos terminados</p>
              <p className={`mt-1 text-sm ${activeTab === "finished" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                Venta directa y seguimiento comercial.
              </p>
            </button>

            <button
              onClick={() => setActiveTab("raw")}
              className={`rounded-[1.2rem] px-4 py-4 text-left transition-all ${
                activeTab === "raw"
                  ? "bg-primary text-primary-foreground shadow-[0_18px_28px_-22px_var(--primary)]"
                  : "bg-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <p className="text-sm font-semibold">Insumos y materias primas</p>
              <p className={`mt-1 text-sm ${activeTab === "raw" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                Control de abastecimiento y reposicion.
              </p>
            </button>
          </div>
        </section>

        {lowStockItems.length > 0 ? (
          <Card className="overflow-hidden border-red-200/70 bg-[linear-gradient(180deg,rgba(254,226,226,0.9),rgba(255,255,255,0.92))]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                {activeTab === "finished" ? "Productos" : "Insumos"} con stock bajo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {lowStockItems.map((item: any) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-[1.25rem] border border-red-200/80 bg-white/85 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <ProductThumb item={item} />
                    <div>
                      <p className="font-bold text-slate-900">{item.product?.name}</p>
                      <p className="text-sm text-muted-foreground">Codigo: {item.product?.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:text-right">
                    <Badge variant="destructive" className="rounded-full">
                      Stock: {item.quantity}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Minimo: {item.minStock}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {activeTab === "finished" ? "Productos terminados" : "Insumos y materias primas"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {displayItems.length} registros visibles en la vista actual.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-40 rounded-full pl-9 pr-20 sm:w-60"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleBarcodeInput}
                  className={`absolute right-1 h-7 rounded-full px-2 ${barcodeInputActive ? 'bg-primary text-primary-foreground' : ''}`}
                  title="Escanear código de barras"
                >
                  <ScanBarcode className="h-4 w-4" />
                </Button>
              </div>
              {!isMobile && user?.role === "admin" ? <AddProductDialog onProductAdded={() => refetch()} /> : null}
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {isMobile ? (
              <div className="grid gap-4">
                {displayItems.map((item: any) => {
                  const margin =
                    item.product?.price != null && item.product?.salePrice != null
                      ? item.product.salePrice - item.product.price
                      : null;

                  return (
                    <div key={item.id} className="rounded-[1.45rem] border border-white/70 bg-white/85 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <ProductThumb item={item} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-base font-bold text-slate-900">{item.product?.name}</p>
                              <p className="text-sm text-muted-foreground">{item.product?.code}</p>
                            </div>
                            <Badge variant={item.isLowStock ? "destructive" : "default"} className="rounded-full">
                              {item.isLowStock ? "Bajo" : "Normal"}
                            </Badge>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <InfoBlock label="Compra" value={item.product?.price != null ? formatCurrency(item.product.price) : "-"} accent="text-sky-700" />
                            <InfoBlock label="Venta" value={item.product?.salePrice != null ? formatCurrency(item.product.salePrice) : "-"} accent="text-emerald-700" />
                            <InfoBlock label="Stock" value={`${item.quantity} uds.`} />
                            <InfoBlock label="Pedidos" value={`${item.onOrder || 0} uds.`} accent="text-orange-600" />
                            <InfoBlock label="Minimo" value={`${item.minStock} uds.`} />
                            <InfoBlock
                              label="Margen"
                              value={margin != null ? formatCurrency(margin) : "-"}
                              accent={margin != null && margin < 0 ? "text-red-600" : "text-emerald-700"}
                            />
                            <InfoBlock
                              label="Vencimiento"
                              value={formatExpiryDate(item.expiryDate)}
                              accent={getExpiryTone(item.expiryDate)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <ProductHistoryDialog productId={item.productId} productName={item.product?.name || "Producto"} />
                        {user?.role === "admin" ? (
                          <>
                            <EditProductDialog product={item.product} onProductUpdated={() => refetch()} />
                            <AdjustInventoryDialog
                              item={item}
                              isOpen={isDialogOpen && selectedItem?.id === item.id}
                              onOpenChange={(value) => {
                                setIsDialogOpen(value);
                                if (value) setSelectedItem(item);
                              }}
                              quantity={quantity}
                              setQuantity={setQuantity}
                              reason={reason}
                              setReason={setReason}
                              type={type}
                              setType={setType}
                              price={price}
                              setPrice={setPrice}
                              expiryDate={expiryDate}
                              setExpiryDate={setExpiryDate}
                              registerPurchase={registerPurchase}
                              setRegisterPurchase={setRegisterPurchase}
                              paymentMethod={paymentMethod}
                              setPaymentMethod={setPaymentMethod}
                              onSubmit={handleUpdateInventory}
                              isPending={updateInventoryMutation.isPending}
                            />
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="table-shell">
                <div className="table-scroll">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 text-slate-700">
                      <tr className="border-b border-border/70">
                        <th className="w-16 px-4 py-4 text-left font-semibold">Imagen</th>
                        <th className="px-4 py-4 text-left font-semibold">Producto</th>
                        <th className="px-4 py-4 text-left font-semibold">Codigo</th>
                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase">Precio compra</th>
                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase">Precio venta</th>
                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase">Dif / margen</th>
                        <th className="px-4 py-4 text-center font-semibold">Stock actual</th>
                        <th className="px-4 py-4 text-center font-semibold">Pedidos</th>
                        <th className="px-4 py-4 text-center font-semibold">Stock minimo</th>
                        <th className="px-4 py-4 text-center font-semibold">Vencimiento</th>
                        <th className="px-4 py-4 text-center font-semibold">Estado</th>
                        <th className="px-4 py-4 text-center font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map((item: any) => {
                        const margin =
                          item.product?.price != null && item.product?.salePrice != null
                            ? item.product.salePrice - item.product.price
                            : null;

                        return (
                          <tr key={item.id} className="border-b border-border/60 transition-colors hover:bg-accent/30">
                            <td className="px-4 py-4">
                              <ProductThumb item={item} />
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <Box className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-slate-900">{item.product?.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-muted-foreground">{item.product?.code}</td>
                            <td className="px-4 py-4 text-right font-semibold text-sky-700">
                              {item.product?.price != null ? formatCurrency(item.product.price) : "-"}
                            </td>
                            <td className="px-4 py-4 text-right font-semibold text-emerald-700">
                              {item.product?.salePrice != null ? formatCurrency(item.product.salePrice) : "-"}
                            </td>
                            <td className="px-4 py-4 text-right font-bold">
                              {margin != null ? (
                                <span className={margin < 0 ? "text-red-600" : "text-emerald-700"}>
                                  {formatCurrency(margin)}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-4 py-4 text-center font-semibold text-slate-900">{item.quantity}</td>
                            <td className="px-4 py-4 text-center font-semibold text-orange-600">{item.onOrder || 0}</td>
                            <td className="px-4 py-4 text-center text-muted-foreground">{item.minStock}</td>
                            <td className={`px-4 py-4 text-center text-sm ${getExpiryTone(item.expiryDate)}`}>
                              {item.expiryDate ? formatExpiryDate(item.expiryDate) : "-"}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <Badge variant={item.isLowStock ? "destructive" : "default"} className="rounded-full">
                                {item.isLowStock ? "Bajo" : "Normal"}
                              </Badge>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                <ProductHistoryDialog
                                  productId={item.productId}
                                  productName={item.product?.name || "Producto"}
                                />
                                {user?.role === "admin" ? (
                                  <>
                                    <EditProductDialog product={item.product} onProductUpdated={() => refetch()} />
                                    <AdjustInventoryDialog
                                      item={item}
                                      isOpen={isDialogOpen && selectedItem?.id === item.id}
                                      onOpenChange={(value) => {
                                        setIsDialogOpen(value);
                                        if (value) setSelectedItem(item);
                                      }}
                                      quantity={quantity}
                                      setQuantity={setQuantity}
                                      reason={reason}
                                      setReason={setReason}
                                      type={type}
                                      setType={setType}
                                      price={price}
                                      setPrice={setPrice}
                                      expiryDate={expiryDate}
                                      setExpiryDate={setExpiryDate}
                                      registerPurchase={registerPurchase}
                                      setRegisterPurchase={setRegisterPurchase}
                                      paymentMethod={paymentMethod}
                                      setPaymentMethod={setPaymentMethod}
                                      onSubmit={handleUpdateInventory}
                                      isPending={updateInventoryMutation.isPending}
                                    />
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {displayItems.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                No hay {activeTab === "finished" ? "productos" : "insumos"} registrados.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/70 bg-slate-50/70 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-bold ${accent || "text-slate-900"}`}>{value}</p>
    </div>
  );
}
