import * as XLSX from "xlsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Formatear dinero en Bs.
export const formatBs = (cents: number) => {
  return `Bs. ${(cents / 100).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Estilos para Excel
const headerStyle = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "4CAF50" } },
  alignment: { horizontal: "center" },
};

const currencyFormat = '"Bs." #,##0.00';
const dateFormat = "dd/MM/yyyy HH:mm";

// 1. REPORTE DE PEDIDOS
export const generateOrdersExcel = (orders: any[], filters: any) => {
  const data = orders.map((order) => ({
    "Nº Pedido": order.orderNumber,
    Cliente: order.customer?.name || order.customerName || "N/A",
    Fecha: format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
    Estado: order.status === "pending" ? "Pendiente"
      : order.status === "assigned" ? "Asignado"
      : order.status === "in_transit" ? "En camino"
      : order.status === "delivered" ? "Entregado"
      : order.status === "cancelled" ? "Cancelado"
      : order.status,
    Total: order.totalPrice / 100,
    "Estado Pago": order.paymentStatus || "pendiente",
    Zona: order.zone || "-",
    "Método Pago": order.paymentMethod || "-",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

  // Ajustar anchos de columnas
  ws["!cols"] = [
    { wch: 15 }, // Nº Pedido
    { wch: 25 }, // Cliente
    { wch: 18 }, // Fecha
    { wch: 12 }, // Estado
    { wch: 12 }, // Total
    { wch: 12 }, // Estado Pago
    { wch: 15 }, // Zona
    { wch: 12 }, // Método Pago
  ];

  return wb;
};

// 2. REPORTE DE VENTAS
export const generateSalesExcel = (sales: any[], filters: any) => {
  const data = sales.map((sale) => ({
    "Nº Venta": sale.saleNumber,
    Cliente: sale.customerName || sale.customer?.name || "Venta anónima",
    Fecha: format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
    Canal: sale.saleChannel === "delivery" ? "Delivery" : "Local",
    "Método Pago": sale.paymentMethod === "cash" ? "Efectivo"
      : sale.paymentMethod === "qr" ? "QR"
      : "Transferencia",
    Subtotal: (sale.subtotal || 0) / 100,
    Descuento: (sale.discount || 0) / 100,
    Total: (sale.total || 0) / 100,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ventas");

  ws["!cols"] = [
    { wch: 12 }, // Nº Venta
    { wch: 25 }, // Cliente
    { wch: 18 }, // Fecha
    { wch: 10 }, // Canal
    { wch: 15 }, // Método Pago
    { wch: 12 }, // Subtotal
    { wch: 12 }, // Descuento
    { wch: 12 }, // Total
  ];

  return wb;
};

// 3. REPORTE DE INVENTARIO
export const generateInventoryExcel = (products: any[], inventory: any[]) => {
  const data = products.map((product) => {
    const inv = inventory.find((i) => i.productId === product.id) || {};
    return {
      Código: product.code,
      Producto: product.name,
      Categoría: product.category === "finished_product" ? "Producto Terminado"
        : product.category === "raw_material" ? "Materia Prima"
        : "Suministro",
      "Precio Compra": product.price ? product.price / 100 : 0,
      "Precio Venta": product.salePrice ? product.salePrice / 100 : 0,
      "Precio Mayor": product.wholesalePrice ? product.wholesalePrice / 100 : 0,
      Stock: inv.quantity || 0,
      "Stock Mínimo": inv.minStock || 0,
      Estado: (inv.quantity || 0) <= (inv.minStock || 0) ? "BAJO" : "OK",
      "Fecha Vencimiento": inv.expiryDate || "-",
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");

  ws["!cols"] = [
    { wch: 12 }, // Código
    { wch: 30 }, // Producto
    { wch: 18 }, // Categoría
    { wch: 14 }, // Precio Compra
    { wch: 14 }, // Precio Venta
    { wch: 14 }, // Precio Mayor
    { wch: 8 },  // Stock
    { wch: 12 }, // Stock Mínimo
    { wch: 8 },  // Estado
    { wch: 15 }, // Fecha Vencimiento
  ];

  return wb;
};

// 4. REPORTE FINANCIERO
export const generateFinanceExcel = (transactions: any[], cashClosures: any[]) => {
  const transData = transactions.map((t) => ({
    Fecha: format(new Date(t.createdAt), "dd/MM/yyyy", { locale: es }),
    Hora: format(new Date(t.createdAt), "HH:mm", { locale: es }),
    Categoría: t.category || "-",
    Tipo: t.type === "income" ? "Ingreso" : "Gasto",
    "Método Pago": t.paymentMethod === "cash" ? "Efectivo"
      : t.paymentMethod === "qr" ? "QR"
      : "Transferencia",
    Monto: t.amount / 100,
    Notas: t.notes || "-",
  }));

  const closureData = cashClosures.map((c) => ({
    Fecha: c.date,
    "Efectivo Inicial": c.initialCash / 100,
    "Efectivo Reportado": c.reportedCash / 100,
    "QR Reportado": c.reportedQr / 100,
    "Transfer Reportado": c.reportedTransfer / 100,
    Diferencia: ((c.reportedCash + c.reportedQr + c.reportedTransfer) - c.initialCash) / 100,
    Estado: c.status,
  }));

  const wb = XLSX.utils.book_new();

  const wsTrans = XLSX.utils.json_to_sheet(transData);
  XLSX.utils.book_append_sheet(wb, wsTrans, "Transacciones");
  wsTrans["!cols"] = [
    { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 30 },
  ];

  const wsClosures = XLSX.utils.json_to_sheet(closureData);
  XLSX.utils.book_append_sheet(wb, wsClosures, "Cierres de Caja");
  wsClosures["!cols"] = [
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 10 },
  ];

  return wb;
};

// 5. REPORTE DE CLIENTES
export const generateCustomersExcel = (customers: any[]) => {
  const data = customers.map((c) => ({
    Código: c.clientNumber,
    Nombre: c.name,
    Teléfono: c.phone || "-",
    WhatsApp: c.whatsapp || "-",
    Zona: c.zone || "Sin zona",
    Dirección: c.address || "-",
    "Fecha Registro": c.createdAt ? format(new Date(c.createdAt), "dd/MM/yyyy", { locale: es }) : "-",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");

  ws["!cols"] = [
    { wch: 12 }, // Código
    { wch: 30 }, // Nombre
    { wch: 15 }, // Teléfono
    { wch: 15 }, // WhatsApp
    { wch: 15 }, // Zona
    { wch: 40 }, // Dirección
    { wch: 15 }, // Fecha Registro
  ];

  return wb;
};

// 6. REPORTE DE MOVIMIENTOS DE INVENTARIO
export const generateInventoryMovementsExcel = (movements: any[], products: any[]) => {
  const data = movements.map((m) => {
    const product = products.find((p) => p.id === m.productId);
    return {
      Fecha: format(new Date(m.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
      Producto: product?.name || "N/A",
      Código: product?.code || "-",
      Tipo: m.type === "entry" ? "ENTRADA" : m.type === "exit" ? "SALIDA" : "AJUSTE",
      Cantidad: m.quantity,
      Razón: m.reason || "-",
      Notas: m.notes || "-",
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimientos");

  ws["!cols"] = [
    { wch: 18 }, // Fecha
    { wch: 30 }, // Producto
    { wch: 12 }, // Código
    { wch: 10 }, // Tipo
    { wch: 10 }, // Cantidad
    { wch: 20 }, // Razón
    { wch: 30 }, // Notas
  ];

  return wb;
};

// 7. REPORTE DE AUDITORÍA
export const generateAuditExcel = (logs: any[]) => {
  const data = logs.map((l) => ({
    Fecha: l.createdAt ? format(new Date(l.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "-",
    Entidad: l.entityType,
    Acción: l.action,
    "ID Registro": l.entityId,
    Usuario: l.user?.name || l.userId || "Sistema",
    Descripción: l.description || "-",
    "Datos Anteriores": l.oldValue ? JSON.stringify(l.oldValue) : "-",
    "Datos Nuevos": l.newValue ? JSON.stringify(l.newValue) : "-",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Auditoría");

  ws["!cols"] = [
    { wch: 18 }, // Fecha
    { wch: 15 }, // Entidad
    { wch: 10 }, // Acción
    { wch: 12 }, // ID Registro
    { wch: 20 }, // Usuario
    { wch: 30 }, // Descripción
    { wch: 30 }, // Datos Anteriores
    { wch: 30 }, // Datos Nuevos
  ];

  return wb;
};

// Descargar Excel
export const downloadExcel = (wb: XLSX.WorkBook, filename: string) => {
  XLSX.writeFile(wb, filename);
};

// Generar nombre de archivo con fecha
export const getExcelFilename = (prefix: string) => {
  const date = format(new Date(), "yyyy-MM-dd");
  return `${prefix}_${date}.xlsx`;
};