import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getAllProducts,
  createProduct,
  getAllInventory,
  getInventoryByProductId,
  getProductsWithStock,
  updateInventory,
  updateProductPrice,
  updateProduct,
  createInventoryMovement,
  getInventoryMovements,
  getProductById,
  getPurchasesByProductId,
  recordInventoryEntryAsPurchase,
  getOnOrderQuantities,
} from "../db";
import { TRPCError } from "@trpc/server";

function formatCurrencyCents(amount?: number | null) {
  if (amount == null) return "Bs. 0.00";
  return `Bs. ${(amount / 100).toFixed(2)}`;
}

function formatStatusLabel(status?: "active" | "inactive") {
  return status === "inactive" ? "inactivo" : "activo";
}

function classifyHistoryEvent(movement: any) {
  const reason = (movement.reason || "").toLowerCase();
  const notes = movement.notes || movement.reason || "";

  if (reason.includes("producto creado")) {
    return {
      eventType: "created",
      title: "Producto creado",
      description: notes || "Se registró el producto en el inventario.",
    };
  }

  if (reason.includes("dado de baja")) {
    return {
      eventType: "deactivated",
      title: "Producto dado de baja",
      description: notes || "El producto fue marcado como inactivo.",
    };
  }

  if (reason.includes("reactivado")) {
    return {
      eventType: "reactivated",
      title: "Producto reactivado",
      description: notes || "El producto volvió a estar disponible.",
    };
  }

  if (reason.includes("precio") || reason.includes("datos del producto")) {
    return {
      eventType: "updated",
      title: "Datos actualizados",
      description: notes || "Se modificaron datos del producto.",
    };
  }

  if (reason.includes("pedido reservado")) {
    return {
      eventType: "order_reservation",
      title: "Pedido reservado",
      description: notes || `Stock reservado para ${movement.orderNumber || "pedido"} (${movement.quantity} uds.).`,
    };
  }

  if (reason.includes("pedido cancelado")) {
    return {
      eventType: "order_cancellation",
      title: "Pedido cancelado",
      description: notes || `Stock devuelto por ${movement.orderNumber || "pedido"} (${movement.quantity} uds.).`,
    };
  }

  if (reason.includes("pedido")) {
    return {
      eventType: "order_delivery",
      title: "Pedido entregado",
      description: notes || `Entrega de ${movement.orderNumber || "pedido"} confirmada (${movement.quantity} uds.).`,
    };
  }

  if (reason.includes("venta")) {
    return {
      eventType: "sale",
      title: "Venta registrada",
      description: notes || movement.reason || "Se descontó stock por una venta.",
    };
  }

  if (reason.includes("anulaci")) {
    return {
      eventType: "sale_cancellation",
      title: "Venta anulada y stock repuesto",
      description: notes || movement.reason || "Se devolvió stock por anulación.",
    };
  }

  if (movement.type === "entry") {
    return {
      eventType: "inventory_entry",
      title: "Entrada de inventario",
      description: notes || "Se aumentó el stock del producto.",
    };
  }

  if (movement.type === "exit") {
    return {
      eventType: "inventory_exit",
      title: "Salida de inventario",
      description: notes || "Se redujo el stock del producto.",
    };
  }

  return {
    eventType: "inventory_adjustment",
    title: "Ajuste de inventario",
    description: notes || "Se realizó un ajuste manual del producto.",
  };
}

export const inventoryRouter = router({
  // Obtener todos los productos
  listProducts: protectedProcedure.query(async ({ ctx }) => {
    return await getAllProducts();
  }),

  getProductsWithStock: protectedProcedure.query(async () => {
    return await getProductsWithStock();
  }),

  // Crear un nuevo producto
  createProduct: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1, "El código no puede estar vacío"),
        name: z.string(),
        category: z.enum(["finished_product", "raw_material", "supplies"]),
        price: z.number(),
        salePrice: z.number().optional(),
        imageUrl: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const result = await createProduct({
        code: input.code,
        name: input.name,
        category: input.category,
        price: Math.round(input.price * 100), // Convertir a centavos
        salePrice: Math.round((input.salePrice || 0) * 100),
        imageUrl: input.imageUrl,
        status: (input.status || "active") as "active" | "inactive",
      });

      const productId = Number((result as any)?.insertId);
      if (Number.isFinite(productId) && productId > 0) {
        await createInventoryMovement({
          productId,
          userId: ctx.user.id,
          type: "adjustment",
          quantity: 0,
          reason: "Producto creado",
          notes: `Creado por ${ctx.user.name || ctx.user.username || "usuario"} con precio compra ${formatCurrencyCents(Math.round(input.price * 100))} y precio venta ${formatCurrencyCents(Math.round((input.salePrice || 0) * 100))}. Estado inicial: ${formatStatusLabel(input.status || "active")}.`,
        });
      }

      return { success: true };
    }),

  // Actualizar un producto
  updateProduct: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        code: z.string().optional(),
        name: z.string().optional(),
        category: z.enum(["finished_product", "raw_material", "supplies"]).optional(),
        price: z.number().optional(),
        salePrice: z.number().optional(),
        imageUrl: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const existingProduct = await getProductById(input.id);
      if (!existingProduct) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado" });
      }

      const { id, ...updateData } = input;
      if (updateData.price !== undefined) {
        updateData.price = Math.round(updateData.price * 100);
      }
      if (updateData.salePrice !== undefined) {
        updateData.salePrice = Math.round(updateData.salePrice * 100);
      }

      await updateProduct(id, updateData as any);

      const actorName = ctx.user.name || ctx.user.username || "usuario";
      const historyEvents: Array<{ reason: string; notes: string }> = [];

      if (updateData.status && updateData.status !== existingProduct.status) {
        historyEvents.push({
          reason: updateData.status === "inactive" ? "Producto dado de baja" : "Producto reactivado",
          notes: `${actorName} cambió el estado de ${formatStatusLabel(existingProduct.status)} a ${formatStatusLabel(updateData.status)}.`,
        });
      }

      if (
        updateData.price !== undefined && updateData.price !== existingProduct.price ||
        updateData.salePrice !== undefined && updateData.salePrice !== existingProduct.salePrice
      ) {
        historyEvents.push({
          reason: "Precios actualizados",
          notes: `${actorName} actualizó precios. Compra: ${formatCurrencyCents(existingProduct.price)} -> ${formatCurrencyCents(updateData.price ?? existingProduct.price)}. Venta: ${formatCurrencyCents(existingProduct.salePrice)} -> ${formatCurrencyCents(updateData.salePrice ?? existingProduct.salePrice)}.`,
        });
      }

      const changedFields: string[] = [];
      if (updateData.name !== undefined && updateData.name !== existingProduct.name) {
        changedFields.push(`nombre: ${existingProduct.name} -> ${updateData.name}`);
      }
      if (updateData.code !== undefined && updateData.code !== existingProduct.code) {
        changedFields.push(`código: ${existingProduct.code} -> ${updateData.code}`);
      }
      if (updateData.category !== undefined && updateData.category !== existingProduct.category) {
        changedFields.push(`categoría: ${existingProduct.category} -> ${updateData.category}`);
      }
      if (updateData.imageUrl !== undefined && updateData.imageUrl !== existingProduct.imageUrl) {
        changedFields.push("imagen actualizada");
      }

      if (changedFields.length > 0) {
        historyEvents.push({
          reason: "Datos del producto actualizados",
          notes: `${actorName} modificó ${changedFields.join(", ")}.`,
        });
      }

      for (const event of historyEvents) {
        await createInventoryMovement({
          productId: id,
          userId: ctx.user.id,
          type: "adjustment",
          quantity: 0,
          reason: event.reason,
          notes: event.notes,
        });
      }

      return { success: true };
    }),

  // Obtener inventario completo
  listInventory: protectedProcedure.query(async ({ ctx }) => {
    const [inventory, products, onOrder] = await Promise.all([
      getAllInventory(),
      getAllProducts(),
      getOnOrderQuantities()
    ]);

    return inventory.map((inv: any) => {
      const product = products.find((p: any) => p.id === inv.productId);
      return {
        ...inv,
        product,
        onOrder: onOrder[inv.productId] || 0,
        isLowStock: inv.quantity <= inv.minStock,
      };
    });
  }),

  // Actualizar cantidad de producto y precio
  updateQuantity: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        quantity: z.number(),
        price: z.number().optional(), // nuevo precio en centavos
        reason: z.string().optional(),
        type: z.enum(["entry", "exit", "adjustment"]).optional(),
        expiryDate: z.string().optional(),
        registerPurchase: z.boolean().optional(),
        paymentMethod: z.enum(["cash", "qr", "transfer"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const inv = await getInventoryByProductId(input.productId);
      const product = await getProductById(input.productId);
      const newQuantity = (inv?.quantity || 0) + input.quantity;
      
      await updateInventory(input.productId, newQuantity, input.expiryDate);

      const notes: string[] = [];
      if (input.price !== undefined && product && input.price !== product.price) {
        notes.push(
          `Precio compra: ${formatCurrencyCents(product.price)} -> ${formatCurrencyCents(input.price)}`
        );
      }
      if (input.expiryDate !== undefined && input.expiryDate !== (inv?.expiryDate || undefined)) {
        notes.push(
          `Vencimiento: ${inv?.expiryDate || "sin fecha"} -> ${input.expiryDate || "sin fecha"}`
        );
      }

      if (input.quantity !== 0 || notes.length > 0) {
        await createInventoryMovement({
          productId: input.productId,
          userId: ctx.user.id,
          type: input.type || (input.quantity === 0 ? "adjustment" : input.quantity > 0 ? "entry" : "exit"),
          quantity: Math.abs(input.quantity),
          reason: input.reason || "Ajuste manual",
          notes: notes.length > 0 ? notes.join(". ") : undefined,
        });
      }

      // Actualizar precio si es necesario (solo si se enviÃ³)
      if (input.price !== undefined) {
        await updateProductPrice(input.productId, input.price);
      }

      // Compra rÃ¡pida: registrar como compra (finanzas + historial)
      if (input.registerPurchase && input.quantity > 0) {
        const effectivePrice = input.price ?? product?.price;
        if (!effectivePrice || effectivePrice <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Para compra rÃ¡pida debes indicar el precio de compra." });
        }

        await recordInventoryEntryAsPurchase(
          input.productId,
          input.quantity,
          effectivePrice,
          input.expiryDate,
          input.reason,
          input.paymentMethod,
          ctx.user.id
        );
      }

      return { success: true };
    }),

  // Obtener productos con stock bajo
  getLowStockProducts: protectedProcedure.query(async ({ ctx }) => {
    const inventory = await getAllInventory();
    const products = await getAllProducts();

    return inventory
      .filter((inv: any) => inv.quantity <= inv.minStock)
      .map((inv: any) => {
        const product = products.find((p: any) => p.id === inv.productId);
        return {
          ...inv,
          product,
        };
      });
  }),

  // Obtener alertas de vencimiento
  getExpiryAlerts: protectedProcedure.query(async ({ ctx }) => {
    const inventory = await getAllInventory();
    const products = await getAllProducts();
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const alerts = inventory
      .filter((inv: any) => inv.expiryDate !== null)
      .map((inv: any) => {
        const product = products.find((p: any) => p.id === inv.productId);
        const expiryDate = new Date(inv.expiryDate!);
        
        let status: 'expired' | 'critical' | 'warning' = 'warning';
        if (expiryDate < now) status = 'expired';
        else if (expiryDate <= sevenDaysFromNow) status = 'critical';
        else if (expiryDate <= thirtyDaysFromNow) status = 'warning';
        else return null;

        return {
          ...inv,
          product,
          expiryStatus: status,
          daysRemaining: Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        };
      })
      .filter((item: any): item is NonNullable<typeof item> => item !== null)
      .sort((a: any, b: any) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());

    return alerts;
  }),

  // Obtener inventario por producto
  getByProductId: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await getInventoryByProductId(input.productId);
    }),

  getProductHistory: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const [product, stock, movements, purchases] = await Promise.all([
        getProductById(input.productId),
        getInventoryByProductId(input.productId),
        getInventoryMovements(input.productId),
        getPurchasesByProductId(input.productId),
      ]);

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado" });
      }

      const hasCreationMovement = movements.some((movement: any) =>
        (movement.reason || "").toLowerCase().includes("producto creado")
      );

      const timeline = movements.map((movement: any) => {
        const classification = classifyHistoryEvent(movement);
        return {
          id: `movement-${movement.id}`,
          source: "movement",
          createdAt: movement.createdAt,
          quantity: movement.quantity,
          movementType: movement.type,
          userName: movement.userName,
          userRole: movement.userRole,
          orderNumber: movement.orderNumber,
          saleNumber: movement.saleNumber,
          ...classification,
        };
      });

      const purchaseTimeline = purchases
        .filter((purchase: any) => purchase.purchaseStatus !== "cancelled")
        .map((purchase: any) => ({
          id: `purchase-item-${purchase.id}`,
          source: "purchase",
          createdAt: purchase.createdAt || purchase.purchaseCreatedAt || purchase.orderDate,
          quantity: purchase.quantity,
          movementType: "entry",
          eventType: "purchase",
          title: "Compra registrada",
          description: `Compra ${purchase.purchaseNumber} de ${purchase.supplierName || "proveedor desconocido"} por ${formatCurrencyCents(purchase.price)} por unidad.${purchase.expiryDate ? ` Vencimiento: ${purchase.expiryDate}.` : ""}`,
        }));

      if (!hasCreationMovement) {
        timeline.push({
          id: `product-created-${product.id}`,
          source: "product",
          createdAt: product.createdAt,
          quantity: 0,
          movementType: "adjustment",
          eventType: "created",
          title: "Producto creado",
          description: `Se registró el producto ${product.name} con código ${product.code}.`,
        });
      }

      timeline.push(...purchaseTimeline);

      timeline.sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const totalSoldUnits = timeline
        .filter((event: any) => event.eventType === "sale")
        .reduce((sum: number, event: any) => sum + (event.quantity || 0), 0);

      const totalPurchasedUnits = timeline
        .filter((event: any) => event.eventType === "purchase")
        .reduce((sum: number, event: any) => sum + (event.quantity || 0), 0);

      return {
        product,
        stock,
        summary: {
          totalEvents: timeline.length,
          totalSoldUnits,
          totalPurchasedUnits,
          currentStatus: product.status,
        },
        timeline,
      };
    }),
});
