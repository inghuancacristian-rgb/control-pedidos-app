import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { formatCurrency, formatPriceInput, parsePrice } from "@/lib/currency";
import { useAuth } from "@/_core/hooks/useAuth";
import { CustomerLookup } from "@/components/CustomerLookup";

export default function EditOrder() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [, params] = useRoute("/edit-order/:id");
  const orderId = params?.id ? parseInt(params.id) : 0;

  const [formData, setFormData] = useState({
    orderNumber: "",
    clientNumber: "",
    clientName: "",
    zone: "",
    deliveryDate: "",
    deliveryTime: "",
    paymentMethod: "cash" as "qr" | "cash" | "transfer",
    deliveryPersonId: "",
    items: [{ productId: 0, productCode: "", quantity: 1, price: 0 }],
  });

  const { data: products } = trpc.inventory.listProducts.useQuery();
  const { data: deliveryPersons } = trpc.users.listDeliveryPersons.useQuery();
  const { data: orderDetails, isLoading: isLoadingOrder } = trpc.orders.getDetails.useQuery(
    { orderId },
    { enabled: !!orderId }
  );

  const updateOrderMutation = trpc.orders.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.orders.list.invalidate(),
        utils.orders.listForDelivery.invalidate(),
        utils.customers.list.invalidate(),
        utils.customers.getInsights.invalidate(),
      ]);
      toast.success("Pedido actualizado exitosamente");
      setLocation("/orders");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Populate form data once orderDetails and products are loaded
  useEffect(() => {
    if (orderDetails?.order && products) {
      const existingItems = orderDetails.items.map((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        return {
          productId: item.productId,
          productCode: product?.code || "",
          quantity: item.quantity,
          price: item.price,
        };
      });

      setFormData({
        orderNumber: orderDetails.order.orderNumber,
        clientNumber: orderDetails.customer?.clientNumber || "",
        clientName: orderDetails.customer?.name || "",
        zone: orderDetails.order.zone,
        deliveryDate: orderDetails.order.deliveryDate || "",
        deliveryTime: orderDetails.order.deliveryTime || "",
        paymentMethod: (orderDetails.order.paymentMethod || "cash") as any,
        deliveryPersonId: orderDetails.order.deliveryPersonId?.toString() || "",
        items: existingItems.length > 0 ? existingItems : [{ productId: 0, productCode: "", quantity: 1, price: 0 }],
      });
    }
  }, [orderDetails, products]);

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-600">Solo administradores pueden editar pedidos</p>
      </div>
    );
  }

  if (isLoadingOrder || !products) {
    return <div className="p-8 text-center text-muted-foreground">Cargando pedido...</div>;
  }

  const handleAddItem = () => {
    const defaultProduct = products?.[0];
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          productId: defaultProduct?.id || 0,
          productCode: defaultProduct?.code || "",
          quantity: 1,
          price: defaultProduct?.salePrice || 0,
        },
      ],
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

    if (!formData.clientName.trim() || !formData.clientNumber.trim()) {
      toast.error("El nombre y número de cliente son requeridos para guardar editado");
      return;
    }

    if (!formData.deliveryDate) {
      toast.error("La fecha de entrega es requerida");
      return;
    }

    const totalPrice = formData.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    updateOrderMutation.mutate({
      orderId,
      clientNumber: formData.clientNumber,
      clientName: formData.clientName,
      zone: formData.zone,
      deliveryDate: formData.deliveryDate,
      deliveryTime: formData.deliveryTime,
      paymentMethod: formData.paymentMethod,
      deliveryPersonId: formData.deliveryPersonId ? parseInt(formData.deliveryPersonId) : undefined,
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
        <h1 className="text-3xl font-bold mb-8">Editar Pedido {formData.orderNumber}</h1>

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
              onChange={(patch) =>
                setFormData((prev) => ({
                  ...prev,
                  ...patch,
                }))
              }
            />

              <div>
                <Label htmlFor="clientNumber">Número de Cliente / Celular</Label>
                <Input
                  id="clientNumber"
                  value={formData.clientNumber}
                  onChange={(e) => setFormData({ ...formData, clientNumber: e.target.value })}
                  placeholder="Ej: 7887295"
                  required
                />
              </div>

              <div>
                <Label htmlFor="clientName">Nombre del Cliente</Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
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
                  required
                />
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
                  onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="deliveryTime">Hora de Entrega</Label>
                <Input
                  id="deliveryTime"
                  type="time"
                  value={formData.deliveryTime}
                  onChange={(e) => setFormData({ ...formData, deliveryTime: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="deliveryPerson">Asignar a Repartidor</Label>
                <Select
                  value={formData.deliveryPersonId}
                  onValueChange={(value) => setFormData({ ...formData, deliveryPersonId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin repartidor asignado" />
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
                  <div key={index} className="flex gap-2 items-end">
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
                    </div>

                    <div className="w-20">
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

                    <div className="w-32">
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

                <Button type="button" variant="outline" onClick={handleAddItem} className="w-full">
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
            <Button type="submit" disabled={updateOrderMutation.isPending} className="flex-1">
              {updateOrderMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
