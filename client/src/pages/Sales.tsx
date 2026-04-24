import { useMemo, useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { formatCurrency, parsePrice } from "@/lib/currency";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BadgeDollarSign,
  Eye,
  Printer,
  Plus,
  Minus,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  Wallet,
  XCircle,
  Package,
  Receipt,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

type DiscountType = "none" | "percentage" | "fixed";
type PaymentMethod = "cash" | "qr" | "transfer";
type PaymentStatus = "pending" | "completed";

type CartItem = {
  productId: number;
  productName: string;
  productCode: string;
  stock: number;
  quantity: number;
  basePrice: number;
  discountType: DiscountType;
  discountValue: number;
};

function getLinePricing(item: CartItem) {
  const safeBasePrice = Math.max(0, item.basePrice);
  const safeQuantity = Math.max(1, item.quantity);
  const safeDiscountValue = Math.max(0, item.discountValue);

  let finalUnitPrice = safeBasePrice;

  if (item.discountType === "percentage") {
    const percentage = Math.min(100, safeDiscountValue);
    finalUnitPrice = Math.max(0, Math.round(safeBasePrice * (1 - percentage / 100)));
  }

  if (item.discountType === "fixed") {
    finalUnitPrice = Math.max(0, safeBasePrice - safeDiscountValue);
  }

  const subtotal = finalUnitPrice * safeQuantity;
  const discountAmount = Math.max(0, safeBasePrice * safeQuantity - subtotal);

  return {
    finalUnitPrice,
    subtotal,
    discountAmount,
  };
}

function getGlobalDiscountAmount(subtotal: number, discountType: DiscountType, discountValue: number) {
  if (discountType === "percentage") {
    return Math.min(subtotal, Math.round(subtotal * (Math.min(100, discountValue) / 100)));
  }

  if (discountType === "fixed") {
    return Math.min(subtotal, Math.max(0, discountValue));
  }

  return 0;
}

function paymentMethodLabel(method: PaymentMethod) {
  if (method === "cash") return "Efectivo";
  if (method === "qr") return "QR";
  return "Transferencia";
}

function saleStatusLabel(status: string) {
  return status === "cancelled" ? "Anulada" : "Activa";
}

function paymentStatusLabel(status: PaymentStatus | string) {
  return status === "completed" ? "Pagada" : "Pendiente";
}

function printSaleTicket(detail: any) {
  if (!detail) return;

  const itemsRows = (detail.items || [])
    .map((item: any) => `
      <tr>
        <td>${item.productName}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">${formatCurrency(item.finalUnitPrice || item.basePrice)}</td>
        <td style="text-align:right;">${formatCurrency(item.subtotal)}</td>
      </tr>
    `)
    .join("");

  const win = window.open("", "_blank", "width=420,height=720");
  if (!win) {
    toast.error("No se pudo abrir la ventana de impresión");
    return;
  }

  win.document.write(`
    <html>
      <head>
        <title>Ticket ${detail.sale.saleNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
          h1, p { margin: 0; }
          .header { text-align: center; margin-bottom: 16px; }
          .meta { margin: 12px 0; font-size: 14px; }
          .meta div { margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border-bottom: 1px solid #ddd; padding: 8px 4px; font-size: 14px; }
          th { text-transform: uppercase; font-size: 12px; color: #555; }
          .summary { margin-top: 16px; font-size: 14px; }
          .summary div { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .total { font-size: 18px; font-weight: 700; border-top: 2px solid #111; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Control de Pedidos</h1>
          <p>Ticket simple de venta</p>
        </div>
        <div class="meta">
          <div><strong>Venta:</strong> ${detail.sale.saleNumber}</div>
          <div><strong>Fecha:</strong> ${new Date(detail.sale.createdAt).toLocaleString("es-BO")}</div>
          <div><strong>Cliente:</strong> ${detail.sale.customerDisplayName || "Anónimo"}</div>
          <div><strong>Vendedor:</strong> ${detail.sale.sellerName || "Sin nombre"}</div>
          <div><strong>Pago:</strong> ${paymentMethodLabel(detail.sale.paymentMethod)}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>P. Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div class="summary">
          <div><span>Subtotal</span><strong>${formatCurrency(detail.sale.subtotal)}</strong></div>
          <div><span>Descuento global</span><strong>${formatCurrency(detail.sale.discountAmount || 0)}</strong></div>
          <div class="total"><span>Total</span><strong>${formatCurrency(detail.sale.total)}</strong></div>
        </div>
      </body>
    </html>
  `);

  win.document.close();
  win.focus();
  win.print();
}

export default function Sales() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();

  const { data: products } = trpc.inventory.getProductsWithStock.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: salesList, isLoading } = trpc.sales.list.useQuery();
  const { data: nextSaleData } = trpc.sales.getNextSaleNumber.useQuery();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailSaleId, setDetailSaleId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleNumber, setLastSaleNumber] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [anonymousCustomerName, setAnonymousCustomerName] = useState("");
  const [saleChannel, setSaleChannel] = useState<"local" | "delivery">("local");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("completed");
  const [globalDiscountType, setGlobalDiscountType] = useState<DiscountType>("none");
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [historySearch, setHistorySearch] = useState("");
  const [historyDate, setHistoryDate] = useState("");
  const [historyStatus, setHistoryStatus] = useState<"all" | "completed" | "cancelled">("all");
  const productSearchRef = useRef<HTMLInputElement>(null);

  const detailQuery = trpc.sales.getDetails.useQuery(
    { saleId: detailSaleId ?? 0 },
    { enabled: isDetailOpen && detailSaleId !== null }
  );

  const createSaleMutation = trpc.sales.create.useMutation({
    onSuccess: async (data) => {
      const saleNumber = (data as any)?.saleNumber || nextSaleData?.saleNumber || "";
      setLastSaleNumber(saleNumber);
      setShowSuccess(true);
      await Promise.all([
        utils.sales.list.invalidate(),
        utils.inventory.getProductsWithStock.invalidate(),
        utils.inventory.listInventory.invalidate(),
        utils.finance.getTransactions.invalidate(),
      ]);
      setTimeout(() => {
        setShowSuccess(false);
        setIsCreateOpen(false);
        resetForm();
      }, 1800);
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo registrar la venta");
    },
  });

  const cancelSaleMutation = trpc.sales.cancel.useMutation({
    onSuccess: async () => {
      toast.success("Venta anulada y stock repuesto");
      setCancelReason("");
      await Promise.all([
        utils.sales.list.invalidate(),
        utils.sales.getDetails.invalidate(),
        utils.inventory.getProductsWithStock.invalidate(),
        utils.inventory.listInventory.invalidate(),
        utils.finance.getTransactions.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo anular la venta");
    },
  });

  const markPaidMutation = trpc.sales.markPaymentCompleted.useMutation({
    onSuccess: async () => {
      toast.success("Venta marcada como pagada");
      await Promise.all([
        utils.sales.list.invalidate(),
        utils.sales.getDetails.invalidate(),
        utils.finance.getTransactions.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo actualizar el pago");
    },
  });

  const resetForm = () => {
    setProductSearch("");
    setCustomerSearch("");
    setSelectedCustomerId(null);
    setAnonymousCustomerName("");
    setSaleChannel("local");
    setPaymentMethod("cash");
    setPaymentStatus("completed");
    setGlobalDiscountType("none");
    setGlobalDiscountValue(0);
    setNotes("");
    setCartItems([]);
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const search = productSearch.trim().toLowerCase();

    return (products as any[])
      .filter((product: any) => product.category === "finished_product" && product.status === "active")
      .filter((product: any) => {
        if (!search) return true;
        return product.name.toLowerCase().includes(search) || product.code.toLowerCase().includes(search);
      })
      .slice(0, 12);
  }, [products, productSearch]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const search = customerSearch.trim().toLowerCase();
    if (!search) return [];

    return (customers as any[])
      .filter((customer: any) =>
        customer.name.toLowerCase().includes(search) ||
        customer.clientNumber?.toLowerCase().includes(search)
      )
      .slice(0, 8);
  }, [customers, customerSearch]);

  const computedCart = useMemo(() => {
    const items = cartItems.map((item) => ({
      ...item,
      ...getLinePricing(item),
    }));

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const globalDiscountAmount = getGlobalDiscountAmount(subtotal, globalDiscountType, globalDiscountValue);
    const total = Math.max(0, subtotal - globalDiscountAmount);

    return {
      items,
      subtotal,
      globalDiscountAmount,
      total,
    };
  }, [cartItems, globalDiscountType, globalDiscountValue]);

  const filteredSales = useMemo(() => {
    if (!salesList) return [];

    return (salesList as any[]).filter((sale: any) => {
      const matchesSearch =
        !historySearch ||
        sale.saleNumber?.toLowerCase().includes(historySearch.toLowerCase()) ||
        (sale.customerDisplayName || "").toLowerCase().includes(historySearch.toLowerCase()) ||
        (sale.sellerName || "").toLowerCase().includes(historySearch.toLowerCase());

      const matchesDate =
        !historyDate ||
        new Date(sale.createdAt).toISOString().startsWith(historyDate);

      const matchesStatus = historyStatus === "all" || sale.status === historyStatus;

      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [historyDate, historySearch, historyStatus, salesList]);

  const addProductToCart = (product: any) => {
    if (product.stock <= 0) {
      toast.error("Ese producto no tiene stock disponible");
      return;
    }

    setCartItems((current) => {
      const existingIndex = current.findIndex((item) => item.productId === product.id);

      if (existingIndex >= 0) {
        const existing = current[existingIndex];
        if (existing.quantity >= product.stock) {
          toast.error(`Solo hay ${product.stock} unidades disponibles`);
          return current;
        }

        const updated = [...current];
        updated[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
        return updated;
      }

      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          stock: product.stock,
          quantity: 1,
          basePrice: product.salePrice,
          discountType: "none",
          discountValue: 0,
        },
      ];
    });

    setProductSearch("");
    productSearchRef.current?.focus();
  };

  const updateCartItem = (productId: number, changes: Partial<CartItem>) => {
    setCartItems((current) =>
      current.map((item) => {
        if (item.productId !== productId) return item;
        const next = { ...item, ...changes };
        if (next.quantity > item.stock) {
          toast.error(`Solo hay ${item.stock} unidades disponibles`);
          return item;
        }
        return next;
      })
    );
  };

  const removeCartItem = (productId: number) => {
    setCartItems((current) => current.filter((item) => item.productId !== productId));
  };

  const openDetail = (saleId: number) => {
    setDetailSaleId(saleId);
    setCancelReason("");
    setIsDetailOpen(true);
  };

  const submitSale = () => {
    if (cartItems.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }

    createSaleMutation.mutate({
      customerId: selectedCustomerId || undefined,
      customerName: selectedCustomerId ? undefined : anonymousCustomerName.trim() || "Cliente anónimo",
      saleChannel,
      paymentMethod,
      paymentStatus,
      discountType: globalDiscountType,
      discountValue: globalDiscountValue,
      notes,
      items: computedCart.items.map((item) => ({
        productId: item.productId,
        pricingType: "unit",
        quantity: item.quantity,
        basePrice: item.basePrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
      })),
    });
  };

  const detail = detailQuery.data;
  const totalSalesAmount = filteredSales.reduce((sum: number, sale: any) => sum + sale.total, 0);

  return (
    <div className="page-shell">
      <div className="page-container space-y-6">
        <div className="hero-panel flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ventas</h1>
            <p className="mt-2 text-muted-foreground">
              Venta unitaria, descuentos por línea o globales, ticket simple y actualización automática de inventario.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="h-11 gap-2">
            <ShoppingBag className="h-4 w-4" />
            Nueva venta
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ventas registradas</CardTitle>
              <ShoppingBag className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="text-2xl font-black text-slate-900">{salesList?.length || 0}</CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-600/80">Total vendido</CardTitle>
              <BadgeDollarSign className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent className="text-2xl font-black text-emerald-700">{formatCurrency(totalSalesAmount)}</CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-600/80">Pendientes de cobro</CardTitle>
              <Wallet className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent className="text-2xl font-black text-amber-700">
              {(salesList as any[] | undefined)?.filter((sale: any) => sale.paymentStatus === "pending" && sale.status !== "cancelled").length || 0}
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-600/80">Próximo número</CardTitle>
              <Receipt className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent className="text-2xl font-black text-blue-700">{nextSaleData?.saleNumber || "..."}</CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Historial de ventas</CardTitle>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Buscar venta, cliente o vendedor"
                  className="w-full pl-9 md:w-72"
                />
              </div>
              <Input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className="md:w-44" />
              <Select value={historyStatus} onValueChange={(value: "all" | "completed" | "cancelled") => setHistoryStatus(value)}>
                <SelectTrigger className="w-full md:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Activas</SelectItem>
                  <SelectItem value="cancelled">Anuladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {isMobile ? (
              <div className="space-y-3">
                {isLoading ? (
                  <div className="py-10 text-center text-muted-foreground">Cargando ventas...</div>
                ) : filteredSales.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">No hay ventas que coincidan con el filtro.</div>
                ) : (
                  filteredSales.map((sale: any) => (
                    <div key={sale.id} className="rounded-[1.35rem] border border-white/70 bg-white/85 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-bold text-slate-900">{sale.saleNumber}</p>
                          <p className="text-sm text-muted-foreground">{sale.customerDisplayName || "Anonimo"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{sale.sellerName || "Sin nombre"}</p>
                        </div>
                        <Badge variant={sale.status === "cancelled" ? "destructive" : "default"} className="rounded-full">
                          {saleStatusLabel(sale.status)}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-white/70 bg-slate-50/80 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pago</p>
                          <p className="mt-1 font-semibold">{paymentMethodLabel(sale.paymentMethod)}</p>
                          <Badge variant={sale.paymentStatus === "completed" ? "outline" : "secondary"} className="mt-2 rounded-full">
                            {paymentStatusLabel(sale.paymentStatus)}
                          </Badge>
                        </div>
                        <div className="rounded-xl border border-white/70 bg-slate-50/80 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total</p>
                          <p className="mt-1 font-bold text-slate-900">{formatCurrency(sale.total)}</p>
                          <p className="mt-2 text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleString("es-BO")}</p>
                        </div>
                      </div>
                      <Button variant="outline" className="mt-4 h-10 w-full gap-2" onClick={() => openDetail(sale.id)}>
                        <Eye className="h-4 w-4" />
                        Ver detalle
                      </Button>
                    </div>
                  ))
                )}
              </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      Cargando ventas...
                    </TableCell>
                  </TableRow>
                ) : filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No hay ventas que coincidan con el filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-semibold">{sale.saleNumber}</TableCell>
                      <TableCell>{sale.customerDisplayName || "Anónimo"}</TableCell>
                      <TableCell>{sale.sellerName || "Sin nombre"}</TableCell>
                      <TableCell>
                        <Badge variant={sale.status === "cancelled" ? "destructive" : "default"}>
                          {sale.status === "cancelled" ? "Anulada" : "Activa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{paymentMethodLabel(sale.paymentMethod)}</span>
                          <Badge variant={sale.paymentStatus === "completed" ? "outline" : "secondary"}>
                            {sale.paymentStatus === "completed" ? "Pagada" : "Pendiente"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(sale.total)}</TableCell>
                      <TableCell>{new Date(sale.createdAt).toLocaleString("es-BO")}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => openDetail(sale.id)}>
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent
          className={
            isMobile
              ? "max-h-[94vh] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[1.6rem] border-white/70 bg-white/95 p-4 sm:max-w-[calc(100vw-1.5rem)] sm:p-6"
              : "h-[88vh] w-[min(1200px,96vw)] sm:max-w-[min(1200px,96vw)] overflow-hidden rounded-[1.8rem] border-white/70 bg-white/95 p-0"
          }
        >
          {/* Success overlay */}
          {showSuccess && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 rounded-[1.8rem]">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">¡Venta registrada!</p>
                  <p className="mt-1 text-muted-foreground">{lastSaleNumber ? `Comprobante #${lastSaleNumber}` : ""}</p>
                </div>
                <p className="text-sm text-muted-foreground">Redirigiendo...</p>
              </div>
            </div>
          )}

          <DialogHeader className={isMobile ? "" : "border-b border-border/70 px-6 pt-6 pb-4"}>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Nueva venta {nextSaleData?.saleNumber ? `- ${nextSaleData.saleNumber}` : ""}
            </DialogTitle>
            <DialogDescription>
              Registra una venta con varios productos, descuento por ítem y descuento global.
            </DialogDescription>
          </DialogHeader>

          <div className={isMobile ? "mt-6 space-y-6" : "grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1.14fr)_380px]"}>
            <div className={isMobile ? "space-y-6" : "min-h-0 space-y-6 overflow-y-auto px-6 py-6"}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cliente y condiciones</CardTitle>
                </CardHeader>
                <CardContent className={isMobile ? "grid gap-4" : "grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]"}>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <div className="relative">
                      <UserRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={customerSearch}
                        onChange={(event) => {
                          setCustomerSearch(event.target.value);
                          setSelectedCustomerId(null);
                        }}
                        placeholder="Buscar cliente registrado"
                        className="pl-9"
                      />
                    </div>
                    {filteredCustomers.length > 0 && !selectedCustomerId ? (
                      <div className="rounded-xl border border-white/70 bg-white/80">
                        {filteredCustomers.map((customer: any) => (
                          <button
                            key={customer.id}
                            type="button"
                            className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                            onClick={() => {
                              setSelectedCustomerId(customer.id);
                              setCustomerSearch(customer.name);
                            }}
                          >
                            <span className="font-medium">{customer.name}</span>
                            {customer.clientNumber ? <span className="ml-2 text-xs text-muted-foreground">#{customer.clientNumber}</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {!selectedCustomerId ? (
                      <Input
                        value={anonymousCustomerName}
                        onChange={(event) => setAnonymousCustomerName(event.target.value)}
                        placeholder="O escribe nombre libre / anónimo"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Cliente seleccionado</Badge>
                        <Button type="button" size="sm" variant="ghost" onClick={() => {
                          setSelectedCustomerId(null);
                          setCustomerSearch("");
                        }}>
                          Cambiar
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label>Canal</Label>
                      <Select value={saleChannel} onValueChange={(value: "local" | "delivery") => setSaleChannel(value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="local">Venta en local</SelectItem>
                          <SelectItem value="delivery">Entrega a domicilio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Método de pago</Label>
                      <Select value={paymentMethod} onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}>
                        <SelectTrigger className="w-full">
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
                      <Label>Estado de pago</Label>
                      <Select value={paymentStatus} onValueChange={(value: PaymentStatus) => setPaymentStatus(value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="completed">Pagada</SelectItem>
                          <SelectItem value="pending">Pendiente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Productos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={productSearchRef}
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && filteredProducts.length === 1) {
                          addProductToCart(filteredProducts[0]);
                        }
                      }}
                      placeholder="Buscar por nombre o código..."
                      className="pl-9 pr-16"
                    />
                    <kbd className="absolute right-2 top-2 hidden rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground sm:block">
                      Ctrl+B
                    </kbd>
                  </div>

                  {filteredProducts.length > 0 ? (
                    <div className="grid max-h-64 gap-2 overflow-y-auto rounded-[1.2rem] border border-white/70 bg-white/75 p-2">
                      {filteredProducts.map((product: any) => (
                        <button
                          key={product.id}
                          type="button"
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/85 px-3 py-3 text-left transition-colors hover:bg-muted/40"
                          onClick={() => addProductToCart(product)}
                        >
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-muted-foreground">{product.code}</div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-semibold">{formatCurrency(product.salePrice)}</div>
                            <div className={`text-xs ${product.stock > 0 ? "text-muted-foreground" : "text-red-600"}`}>
                              Stock: {product.stock}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {isMobile ? (
                    <div className="space-y-2">
                      {computedCart.items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <Package className="mb-3 h-10 w-10 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">Agrega productos para comenzar.</p>
                        </div>
                      ) : (
                        computedCart.items.map((item) => (
                          <div key={item.productId} className="flex items-center gap-3 rounded-xl border bg-white px-3 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{item.productName}</p>
                              <p className="text-xs text-muted-foreground">{formatCurrency(item.basePrice)} c/u</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateCartItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateCartItem(item.productId, { quantity: Math.min(item.stock, item.quantity + 1) })}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="w-20 text-right">
                              <p className="text-sm font-semibold">{formatCurrency(item.subtotal)}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeCartItem(item.productId)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                  <div className="space-y-2">
                    {computedCart.items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Package className="mb-3 h-12 w-12 text-muted-foreground/40" />
                        <p className="text-muted-foreground">Agrega productos para comenzar la venta.</p>
                        <p className="mt-1 text-xs text-muted-foreground">Usa el buscador de arriba o presiona Ctrl+B</p>
                      </div>
                    ) : (
                      computedCart.items.map((item) => (
                        <div key={item.productId} className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition-colors hover:bg-slate-50/60">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-sm">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.basePrice)} c/u</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateCartItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              max={item.stock}
                              value={item.quantity}
                              onChange={(event) => updateCartItem(item.productId, { quantity: Math.max(1, parseInt(event.target.value || "1", 10)) })}
                              className="h-8 w-14 text-center text-sm"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateCartItem(item.productId, { quantity: Math.min(item.stock, item.quantity + 1) })}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="w-24 text-right">
                            <p className="font-semibold text-sm">{formatCurrency(item.subtotal)}</p>
                            {item.discountAmount > 0 && (
                              <p className="text-xs text-emerald-600">-{formatCurrency(item.discountAmount)}</p>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeCartItem(item.productId)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className={isMobile ? "space-y-6" : "min-h-0 space-y-6 overflow-y-auto border-t border-border/70 pt-6 lg:border-t-0 lg:border-l lg:bg-slate-50/60 lg:px-6 lg:py-6"}>
              <div className="sticky top-0 space-y-4">
                {/* Resumen tipo ticket */}
                <div className="rounded-2xl border-2 border-slate-900 bg-white shadow-sm overflow-hidden">
                  <div className="bg-slate-900 px-4 py-3 text-white">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      <span className="font-bold text-sm">Comprobante de Venta</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {nextSaleData?.saleNumber ? `#${nextSaleData.saleNumber}` : "—"}
                    </p>
                  </div>
                  <div className="bg-emerald-50 px-4 py-4 border-b border-emerald-100">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">Total a Pagar</p>
                    <p className="text-3xl font-black text-emerald-900">{formatCurrency(computedCart.total)}</p>
                  </div>
                  <div className="px-4 py-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Productos</span>
                      <span className="font-medium">{computedCart.items.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(computedCart.subtotal)}</span>
                    </div>
                    {computedCart.globalDiscountAmount > 0 && (
                      <div className="flex items-center justify-between text-emerald-600">
                        <span>Descuento global</span>
                        <span className="font-medium">-{formatCurrency(computedCart.globalDiscountAmount)}</span>
                      </div>
                    )}
                    {computedCart.items.reduce((sum, i) => sum + i.discountAmount, 0) > 0 && (
                      <div className="flex items-center justify-between text-emerald-600">
                        <span>Descuentos línea</span>
                        <span className="font-medium">-{formatCurrency(computedCart.items.reduce((sum, i) => sum + i.discountAmount, 0))}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Descuento global */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BadgeDollarSign className="h-4 w-4 text-emerald-600" />
                      Descuento global
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select value={globalDiscountType} onValueChange={(value: DiscountType) => {
                      setGlobalDiscountType(value);
                      setGlobalDiscountValue(0);
                    }}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin descuento</SelectItem>
                        <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                        <SelectItem value="fixed">Monto fijo (Bs)</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        step={globalDiscountType === "percentage" ? "1" : "0.01"}
                        disabled={globalDiscountType === "none"}
                        value={globalDiscountType === "fixed" ? globalDiscountValue / 100 : globalDiscountValue}
                        onChange={(event) => {
                          if (globalDiscountType === "fixed") {
                            setGlobalDiscountValue(parsePrice(event.target.value || "0"));
                            return;
                          }
                          setGlobalDiscountValue(Math.max(0, Math.round(parseFloat(event.target.value || "0"))));
                        }}
                        className="pr-12"
                        placeholder={globalDiscountType === "percentage" ? "Ej: 10" : "Ej: 5.00"}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {globalDiscountType === "percentage" ? "%" : "Bs"}
                      </span>
                    </div>
                    {computedCart.globalDiscountAmount > 0 && (
                      <p className="text-xs text-emerald-600 font-medium">
                        Ahorro: {formatCurrency(computedCart.globalDiscountAmount)}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Método de pago destacado */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Forma de pago</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      {(["cash", "qr", "transfer"] as PaymentMethod[]).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-center text-xs font-semibold transition-all ${paymentMethod === method
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                            }`}
                        >
                          <Wallet className="h-5 w-5" />
                          {method === "cash" ? "Efectivo" : method === "qr" ? "QR" : "Transfer."}
                        </button>
                      ))}
                    </div>
                    {paymentMethod === "cash" && (
                      <p className="mt-2 text-xs text-center text-muted-foreground">
                        Pago en efectivo al momento de la venta
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Notas */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Observaciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Notas opcionales de la venta..."
                      className="text-sm min-h-[72px]"
                      rows={3}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <DialogFooter className={isMobile ? "gap-2" : "border-t border-border/70 bg-white px-6 py-4"}>
            <Button
              variant="outline"
              onClick={() => { setIsCreateOpen(false); resetForm(); }}
              className={isMobile ? "" : "min-w-32"}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button
              onClick={submitSale}
              disabled={createSaleMutation.isPending || computedCart.items.length === 0}
              className={`${isMobile ? "gap-2 flex-1" : "min-w-64 gap-2"} bg-emerald-600 hover:bg-emerald-700 text-white font-bold`}
            >
              {createSaleMutation.isPending ? (
                "Registrando..."
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Registrar Venta · {formatCurrency(computedCart.total)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[1.6rem] border-white/70 bg-white/95 p-4 sm:max-w-[min(960px,94vw)] sm:p-6">
          <DialogHeader>
            <DialogTitle>Detalle de venta</DialogTitle>
            <DialogDescription>
              Revisa productos, ticket, estado de pago y acciones administrativas.
            </DialogDescription>
          </DialogHeader>

          {!detail ? (
            <div className="py-10 text-center text-muted-foreground">Cargando detalle...</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Venta</CardTitle>
                  </CardHeader>
                  <CardContent className="font-bold">{detail.sale.saleNumber}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="font-bold">{detail.sale.customerDisplayName || "Anónimo"}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Estado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={detail.sale.status === "cancelled" ? "destructive" : "default"}>
                      {detail.sale.status === "cancelled" ? "Anulada" : "Activa"}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Pago</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div>{paymentMethodLabel(detail.sale.paymentMethod)}</div>
                    <Badge variant={detail.sale.paymentStatus === "completed" ? "outline" : "secondary"}>
                      {detail.sale.paymentStatus === "completed" ? "Pagada" : "Pendiente"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {isMobile ? (
                <div className="space-y-3">
                  {(detail.items || []).map((item: any) => (
                    <div key={item.id} className="rounded-[1.3rem] border border-white/70 bg-white/85 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.productCode}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          x{item.quantity}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-white/70 bg-slate-50/80 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Base</p>
                          <p className="mt-1 font-semibold">{formatCurrency(item.basePrice)}</p>
                        </div>
                        <div className="rounded-xl border border-white/70 bg-slate-50/80 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Final</p>
                          <p className="mt-1 font-semibold">{formatCurrency(item.finalUnitPrice || item.basePrice)}</p>
                        </div>
                        <div className="rounded-xl border border-white/70 bg-slate-50/80 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Descuento</p>
                          <p className="mt-1 font-semibold">{formatCurrency(item.discountAmount || 0)}</p>
                        </div>
                        <div className="rounded-xl border border-white/70 bg-slate-50/80 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Subtotal</p>
                          <p className="mt-1 font-bold text-slate-900">{formatCurrency(item.subtotal)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Final</TableHead>
                      <TableHead className="text-right">Desc.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.items || []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.productCode}</div>
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.basePrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.finalUnitPrice || item.basePrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.discountAmount || 0)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="grid gap-6 md:grid-cols-[1fr,320px]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notas y auditoría</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div><strong>Vendedor:</strong> {detail.sale.sellerName || "Sin nombre"}</div>
                    <div><strong>Fecha:</strong> {new Date(detail.sale.createdAt).toLocaleString("es-BO")}</div>
                    <div><strong>Canal:</strong> {detail.sale.saleChannel === "delivery" ? "Entrega" : "Local"}</div>
                    {detail.sale.notes ? <div><strong>Notas:</strong> {detail.sale.notes}</div> : null}
                    {detail.sale.cancelReason ? <div><strong>Motivo de anulación:</strong> {detail.sale.cancelReason}</div> : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Totales</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <strong>{formatCurrency(detail.sale.subtotal)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Descuento global</span>
                      <strong>{formatCurrency(detail.sale.discountAmount || 0)}</strong>
                    </div>
                    <div className="flex items-center justify-between border-t pt-3 text-lg">
                      <span className="font-semibold">Total</span>
                      <strong>{formatCurrency(detail.sale.total)}</strong>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => printSaleTicket(detail)}>
                    <Printer className="h-4 w-4" />
                    Imprimir ticket
                  </Button>
                  {user?.role === "admin" && detail.sale.paymentStatus === "pending" && detail.sale.status !== "cancelled" ? (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => markPaidMutation.mutate({ saleId: detail.sale.id })}
                      disabled={markPaidMutation.isPending}
                    >
                      <Wallet className="h-4 w-4" />
                      Marcar como pagada
                    </Button>
                  ) : null}
                </div>

                {user?.role === "admin" && detail.sale.status !== "cancelled" ? (
                  <div className="w-full space-y-2 md:w-[420px]">
                    <Label>Anular venta</Label>
                    <div className="flex gap-2">
                      <Input
                        value={cancelReason}
                        onChange={(event) => setCancelReason(event.target.value)}
                        placeholder="Motivo de la anulación"
                      />
                      <Button
                        variant="destructive"
                        className="gap-2"
                        onClick={() => cancelSaleMutation.mutate({ saleId: detail.sale.id, reason: cancelReason })}
                        disabled={cancelSaleMutation.isPending || cancelReason.trim().length < 3}
                      >
                        <XCircle className="h-4 w-4" />
                        Anular
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
