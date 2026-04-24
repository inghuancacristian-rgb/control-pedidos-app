import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { formatCurrency, formatPriceInput, parsePrice } from "@/lib/currency";
import { useAuth } from "@/_core/hooks/useAuth";
import { CustomerLookup } from "@/components/CustomerLookup";
import { useIsMobile } from "@/hooks/useMobile";

export default function CreateOrder() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [formData, setFormData] = useState({
    orderNumber: "",
    clientNumber: "",
    clientName: "",
    zone: "",
    sourceChannel: "other" as "facebook" | "tiktok" | "marketplace" | "referral" | "other",
    deliveryDate: "",
    deliveryTime: "",
    paymentMethod: "cash" as "qr" | "cash" | "transfer",
    deliveryPersonId: "",
    notes: "",
    items: [{ productId: 0, productCode: "", quantity: 1, price: 0 }],
  });

  // Todos los hooks deben estar antes de cualquier condicional o return
  const { data: products } = trpc.inventory.getProductsWithStock.useQuery();
  const { data: nextOrderData } = trpc.orders.getNextOrderNumber.useQuery();
  const { data: deliveryPersons } = trpc.users.listDeliveryPersons.useQuery();
  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: async () => {
      toast.success("Pedido creado exitosamente");
      await Promise.all([
        utils.orders.list.invalidate(),
        utils.orders.list.refetch(),
        utils.orders.listForDelivery.invalidate(),
        utils.stats.getDashboardStats.invalidate(),
        utils.customers.list.invalidate(),
        utils.customers.getInsights.invalidate(),
      ]);
      setLocation("/orders");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Establecer el número de pedido automáticamente
  useEffect(() => {
    if (nextOrderData?.orderNumber && !formData.orderNumber) {
      setFormData((prev) => ({ ...prev, orderNumber: nextOrderData.orderNumber }));
    }
  }, [nextOrderData?.orderNumber, formData.orderNumber]);

  // Inicializar el primer producto cuando se carguen los productos
  useEffect(() => {
    if (products && products.length > 0 && !formData.items[0].productCode) {
      const firstProduct = products[0];
      setFormData((prev) => ({
        ...prev,
        items: [{ productId: firstProduct.id, productCode: firstProduct.code, quantity: 1, price: firstProduct.salePrice || 0 }],
      }));
    }
  }, [products]);


  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-600">Solo administradores pueden crear pedidos</p>
      </div>
    );
  }

  const handleAddItem = () => {
    const defaultProduct = products?.[0];
    setFormData({
      ...formData,
      items: [...formData.items, { productId: defaultProduct?.id || 0, productCode: defaultProduct?.code || "COCO", quantity: 1, price: defaultProduct?.salePrice || 0 }],
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validar campos requeridos
    if (!formData.clientName.trim()) {
      toast.error("El nombre del cliente es requerido");
      return;
    }

    if (!formData.deliveryDate) {
      toast.error("La fecha de entrega es requerida");
      return;
    }

    const totalPrice = formData.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    createOrderMutation.mutate({
      orderNumber: formData.orderNumber,
      clientNumber: formData.clientNumber,
      clientName: formData.clientName,
      zone: formData.zone,
      sourceChannel: formData.sourceChannel,
      deliveryDate: formData.deliveryDate,
      deliveryTime: formData.deliveryTime,
      paymentMethod: formData.paymentMethod,
      deliveryPersonId: formData.deliveryPersonId ? parseInt(formData.deliveryPersonId) : undefined,
      notes: formData.notes.trim() || undefined,
      totalPrice,
      items: formData.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
    });
  };

  const totalPrice = formData.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Crear Nuevo Pedido</h1>

        <form onSubmit={handleSubmit}>
          {/* Información básica */}
          <Card className="mb-6">
            <CardHeader>
            <CardTitle>Información del Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CustomerLookup
              clientNumber={formData.clientNumber}
              clientName={formData.clientName}
              zone={formData.zone}
              sourceChannel={formData.sourceChannel}
              onChange={(patch) =>
                setFormData((prev) => ({
                  ...prev,
                  ...patch,
                }))
              }
            />

            <div>
              <Label htmlFor="orderNumber">Número de Pedido</Label>
              <Input
                  id="orderNumber"
                  value={formData.orderNumber}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">Se genera automáticamente de forma correlativa</p>
              </div>

              <div>
                <Label htmlFor="clientNumber">Número de Cliente</Label>
                <Input
                  id="clientNumber"
                  value={formData.clientNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, clientNumber: e.target.value })
                  }
                  placeholder="ej: 7887295"
                  required
                />
              </div>

              <div>
                <Label htmlFor="clientName">Nombre del Cliente</Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) =>
                    setFormData({ ...formData, clientName: e.target.value })
                  }
                  placeholder="ej: Juan García"
                  required
                />
              </div>

              <div>
                <Label htmlFor="zone">Zona de Entrega</Label>
                <Input
                  id="zone"
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  placeholder="ej: OBELISCO"
                  required
                />
              </div>

              <div>
                <Label htmlFor="sourceChannel">Canal de venta</Label>
                <Select
                  value={formData.sourceChannel}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      sourceChannel: value as "facebook" | "tiktok" | "marketplace" | "referral" | "other",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="marketplace">Marketplace</SelectItem>
                    <SelectItem value="referral">Referido</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="paymentMethod">Método de Pago</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      paymentMethod: value as "qr" | "cash" | "transfer",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="qr">QR</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="deliveryDate">Fecha de Entrega</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) =>
                    setFormData({ ...formData, deliveryDate: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="deliveryTime">Hora de Entrega</Label>
                <Input
                  id="deliveryTime"
                  type="time"
                  value={formData.deliveryTime}
                  onChange={(e) =>
                    setFormData({ ...formData, deliveryTime: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="deliveryPerson">Asignar a Repartidor</Label>
                <Select
                  value={formData.deliveryPersonId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, deliveryPersonId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un repartidor" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryPersons?.map((person) => (
                      <SelectItem key={person.id} value={person.id.toString()}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas del pedido</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ej: Llamar antes de entregar, dejar en conserjería, etc."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items del pedido */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Productos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-2 sm:items-end sm:gap-3">
                    <div className="flex-1">
                      <Label>Producto</Label>
                      <Select
                        value={item.productCode}
                        onValueChange={(value) => {
                          const selectedProduct = products?.find((p: any) => p.code === value);
                          const newItems = [...formData.items];
                          newItems[index].productCode = value;
                          newItems[index].productId = selectedProduct?.id || 0;
                          newItems[index].price = selectedProduct?.salePrice || 0;
                          setFormData({ ...formData, items: newItems });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((p: any) => (
                            <SelectItem key={p.id} value={p.code}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {item.productId > 0 && products?.find((p: any) => p.id === item.productId) && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-tight">
                            En inventario: {products.find((p: any) => p.id === item.productId)?.stock || 0} unidades
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="w-20 sm:w-24">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[index].quantity = parseInt(e.target.value) || 1;
                          setFormData({ ...formData, items: newItems });
                        }}
                      />
                    </div>

                    <div className="w-28 sm:w-32">
                      <Label>Precio Venta (Bs.)</Label>
                      <Input
                        type="text"
                        placeholder="0.00"
                        value={formatPriceInput(item.price)}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[index].price = parsePrice(e.target.value);
                          setFormData({ ...formData, items: newItems });
                        }}
                      />
                    </div>

                    {formData.items.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddItem}
                  className="w-full"
                >
                  Agregar Producto
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resumen */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center text-lg">
                <p className="font-semibold">Total:</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalPrice)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/orders")}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createOrderMutation.isPending}
              className="flex-1"
            >
              {createOrderMutation.isPending ? "Creando..." : "Crear Pedido"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
