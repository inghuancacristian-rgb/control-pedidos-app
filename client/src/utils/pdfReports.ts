import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Formatear dinero en Bs.
export const formatBs = (cents: number) => {
  return `Bs. ${(cents / 100).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Función base para crear PDF
export const createPDF = (title: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text("KÉFIR DELICIOUS", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(16);
  doc.text(title, pageWidth / 2, 30, { align: "center" });

  // Línea separadora
  doc.setLineWidth(0.5);
  doc.line(20, 35, pageWidth - 20, 35);

  // Footer con fecha
  const now = new Date();
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generado: ${format(now, "dd 'de' MMMM 'de' yyyy HH:mm", { locale: es })}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  return doc;
};

// Configuración de tabla base
export const getTableOptions = (startY: number) => ({
  startY,
  headStyles: {
    fillColor: [76, 175, 80], // Verde Kéfir
    textColor: 255,
    fontStyle: "bold",
  },
  bodyStyles: {
    textColor: [40, 40, 40],
  },
  alternateRowStyles: {
    fillColor: [245, 245, 245],
  },
  margin: { top: 10, left: 20, right: 20 },
});

// 1. REPORTE DE PEDIDOS
export const generateOrdersPDF = (orders: any[], filters: any) => {
  const doc = createPDF("Reporte de Pedidos");

  let y = 45;

  // Información de filtros
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  if (filters.startDate || filters.endDate) {
    doc.text(
      `Período: ${filters.startDate || "Inicio"} - ${filters.endDate || "Fin"}`,
      20,
      y
    );
    y += 7;
  }
  if (filters.status) {
    doc.text(`Estado: ${filters.status}`, 20, y);
    y += 7;
  }

  // Tabla de pedidos
  const tableData = orders.map((order) => [
    order.orderNumber,
    order.customer?.name || order.customerName || "N/A",
    format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
    order.status === "pending" ? "Pendiente"
      : order.status === "assigned" ? "Asignado"
      : order.status === "in_transit" ? "En camino"
      : order.status === "delivered" ? "Entregado"
      : order.status === "cancelled" ? "Cancelado"
      : order.status,
    formatBs(order.totalPrice),
    order.paymentStatus || "pendiente",
  ]);

  autoTable(doc, {
    ...getTableOptions(y),
    head: [["Nº Pedido", "Cliente", "Fecha", "Estado", "Total", "Pago"]],
    body: tableData,
  });

  // Totales al final
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  const totalPedidos = orders.length;
  const totalMonto = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const pendientes = orders.filter((o) => o.status === "pending").length;
  const entregados = orders.filter((o) => o.status === "delivered").length;

  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("RESUMEN", 20, finalY);
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.text(`Total de Pedidos: ${totalPedidos}`, 20, finalY + 7);
  doc.text(`Entregados: ${entregados}`, 20, finalY + 14);
  doc.text(`Pendientes: ${pendientes}`, 20, finalY + 21);
  doc.setFont(undefined, "bold");
  doc.text(`Monto Total: ${formatBs(totalMonto)}`, 20, finalY + 28);

  return doc;
};

// 2. REPORTE DE VENTAS
export const generateSalesPDF = (sales: any[], filters: any) => {
  const doc = createPDF("Reporte de Ventas");

  let y = 45;

  // Filtros
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  if (filters.startDate || filters.endDate) {
    doc.text(
      `Período: ${filters.startDate || "Inicio"} - ${filters.endDate || "Fin"}`,
      20,
      y
    );
    y += 7;
  }

  // Tabla de ventas
  const tableData = sales.map((sale) => [
    sale.saleNumber,
    sale.customerName || sale.customer?.name || "Venta anónima",
    format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
    sale.saleChannel === "delivery" ? "Delivery" : "Local",
    sale.paymentMethod === "cash" ? "Efectivo"
      : sale.paymentMethod === "qr" ? "QR"
      : "Transferencia",
    formatBs(sale.total),
  ]);

  autoTable(doc, {
    ...getTableOptions(y),
    head: [["Nº Venta", "Cliente", "Fecha", "Canal", "Método Pago", "Total"]],
    body: tableData,
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Resumen
  const totalVentas = sales.length;
  const montoTotal = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const efectivo = sales
    .filter((s) => s.paymentMethod === "cash")
    .reduce((sum, s) => sum + s.total, 0);
  const qr = sales
    .filter((s) => s.paymentMethod === "qr")
    .reduce((sum, s) => sum + s.total, 0);
  const transferencia = sales
    .filter((s) => s.paymentMethod === "transfer")
    .reduce((sum, s) => sum + s.total, 0);

  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("RESUMEN", 20, finalY);
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.text(`Total de Ventas: ${totalVentas}`, 20, finalY + 7);
  doc.text(`Efectivo: ${formatBs(efectivo)}`, 20, finalY + 14);
  doc.text(`QR: ${formatBs(qr)}`, 20, finalY + 21);
  doc.text(`Transferencia: ${formatBs(transferencia)}`, 20, finalY + 28);
  doc.setFont(undefined, "bold");
  doc.text(`Ingresos Totales: ${formatBs(montoTotal)}`, 20, finalY + 35);

  return doc;
};

// 3. REPORTE DE INVENTARIO
export const generateInventoryPDF = (products: any[], inventory: any[]) => {
  const doc = createPDF("Reporte de Inventario");

  let y = 45;

  // Tabla de productos con stock
  const tableData = products.map((product, idx) => {
    const inv = inventory.find((i) => i.productId === product.id) || {};
    return [
      product.code,
      product.name,
      product.category === "finished_product" ? "Producto Terminado"
        : product.category === "raw_material" ? "Materia Prima"
        : "Suministro",
      (inv.quantity || 0).toString(),
      (inv.minStock || 0).toString(),
      (inv.quantity || 0) <= (inv.minStock || 0) ? "BAJO" : "OK",
      formatBs(product.salePrice),
    ];
  });

  autoTable(doc, {
    ...getTableOptions(y),
    head: [["Código", "Producto", "Categoría", "Stock", "Mín.", "Estado", "Precio"]],
    body: tableData,
    didParseCell: (data: any) => {
      if (data.column.index === 5 && data.cell.text[0] === "BAJO") {
        data.cell.styles.textColor = [220, 53, 69];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Resumen
  const totalProducts = products.length;
  const lowStock = products.filter((p, idx) => {
    const inv = inventory.find((i) => i.productId === p.id) || {};
    return (inv.quantity || 0) <= (inv.minStock || 0);
  }).length;
  const totalValue = products.reduce((sum, p, idx) => {
    const inv = inventory.find((i) => i.productId === p.id) || {};
    return sum + (p.salePrice || 0) * (inv.quantity || 0);
  }, 0);

  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("RESUMEN", 20, finalY);
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.text(`Total de Productos: ${totalProducts}`, 20, finalY + 7);
  doc.setTextColor(220, 53, 69);
  doc.text(`Stock Bajo: ${lowStock}`, 20, finalY + 14);
  doc.setTextColor(40, 40, 40);
  doc.setFont(undefined, "bold");
  doc.text(`Valor Total en Inventario: ${formatBs(totalValue)}`, 20, finalY + 21);

  return doc;
};

// 4. REPORTE FINANCIERO
export const generateFinancePDF = (transactions: any[], cashClosures: any[]) => {
  const doc = createPDF("Reporte Financiero");

  let y = 45;

  // Resumen general
  const ingresos = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const gastos = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const balance = ingresos - gastos;

  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("RESUMEN GENERAL", 20, y);
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.text(`Total Ingresos: ${formatBs(ingresos)}`, 20, y + 7);
  doc.text(`Total Gastos: ${formatBs(gastos)}`, 20, y + 14);
  doc.setFont(undefined, "bold");
  if (balance >= 0) {
    doc.setTextColor(76, 175, 80);
  } else {
    doc.setTextColor(220, 53, 69);
  }
  doc.text(`Balance: ${formatBs(balance)}`, 20, y + 21);
  doc.setTextColor(40, 40, 40);

  y += 30;

  // Tabla de transacciones
  const tableData = transactions.map((t) => [
    format(new Date(t.createdAt), "dd/MM/yyyy", { locale: es }),
    t.category,
    t.type === "income" ? "Ingreso" : "Gasto",
    t.paymentMethod === "cash" ? "Efectivo"
      : t.paymentMethod === "qr" ? "QR"
      : "Transferencia",
    formatBs(t.amount),
    t.notes || "-",
  ]);

  autoTable(doc, {
    ...getTableOptions(y),
    head: [["Fecha", "Categoría", "Tipo", "Método", "Monto", "Notas"]],
    body: tableData,
    didParseCell: (data: any) => {
      if (data.column.index === 2 && data.cell.text[0] === "Gasto") {
        data.cell.styles.textColor = [220, 53, 69];
      }
    },
  });

  // Cierres de caja
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("CIERRES DE CAJA", 20, finalY);

  const closureTable = cashClosures.map((c) => [
    c.date,
    formatBs(c.initialCash),
    formatBs(c.reportedCash),
    formatBs(c.reportedQr + c.reportedTransfer),
    c.status,
  ]);

  autoTable(doc, {
    startY: finalY + 5,
    head: [["Fecha", "Inicial", "Efectivo", "Digital", "Estado"]],
    body: closureTable,
    headStyles: { fillColor: [33, 150, 243] },
  });

  return doc;
};

// 5. REPORTE DE CLIENTES
export const generateCustomersPDF = (customers: any[]) => {
  const doc = createPDF("Reporte de Clientes");

  let y = 45;

  // Estadísticas
  const total = customers.length;
  const conWhatsApp = customers.filter((c) => c.whatsapp).length;
  const conZona = customers.filter((c) => c.zona).length;

  doc.setFontSize(10);
  doc.text(`Total de Clientes: ${total}`, 20, y);
  doc.text(`Con WhatsApp: ${conWhatsApp}`, 100, y);
  doc.text(`Con Zona Asignada: ${conZona}`, 20, y + 7);

  y += 15;

  // Tabla
  const tableData = customers.map((c) => [
    c.clientNumber,
    c.name,
    c.phone || "-",
    c.whatsapp || "-",
    c.zona || "Sin zona",
    c.address ? c.address.substring(0, 30) + (c.address.length > 30 ? "..." : "") : "-",
  ]);

  autoTable(doc, {
    ...getTableOptions(y),
    head: [["Código", "Nombre", "Teléfono", "WhatsApp", "Zona", "Dirección"]],
    body: tableData,
    styles: { fontSize: 8 },
  });

  return doc;
};

// 6. REPORTE DE MOVIMIENTOS DE INVENTARIO
export const generateInventoryMovementsPDF = (movements: any[], products: any[]) => {
  const doc = createPDF("Reporte de Movimientos de Inventario");

  let y = 45;

  const entradas = movements
    .filter((m) => m.type === "entry")
    .reduce((sum, m) => sum + m.quantity, 0);
  const salidas = movements
    .filter((m) => m.type === "exit")
    .reduce((sum, m) => sum + m.quantity, 0);
  const ajustes = movements
    .filter((m) => m.type === "adjustment")
    .reduce((sum, m) => sum + m.quantity, 0);

  doc.setFontSize(10);
  doc.text(`Total Movimientos: ${movements.length}`, 20, y);
  doc.text(`Entradas: ${entradas}`, 80, y);
  doc.text(`Salidas: ${salidas}`, 140, y);
  doc.text(`Ajustes: ${ajustes}`, 20, y + 7);

  y += 15;

  const tableData = movements.map((m) => {
    const product = products.find((p) => p.id === m.productId);
    return [
      format(new Date(m.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
      product?.name || "N/A",
      m.type === "entry" ? "ENTRADA"
        : m.type === "exit" ? "SALIDA"
        : "AJUSTE",
      m.quantity > 0 ? `+${m.quantity}` : m.quantity.toString(),
      m.reason || "-",
    ];
  });

  autoTable(doc, {
    ...getTableOptions(y),
    head: [["Fecha", "Producto", "Tipo", "Cantidad", "Razón"]],
    body: tableData,
    didParseCell: (data: any) => {
      if (data.column.index === 2) {
        const text = data.cell.text[0];
        if (text === "ENTRADA") data.cell.styles.textColor = [76, 175, 80];
        else if (text === "SALIDA") data.cell.styles.textColor = [220, 53, 69];
      }
    },
  });

  return doc;
};

// 7. REPORTE DE AUDITORÍA / HISTORIAL DE CAMBIOS
export const generateAuditPDF = (logs: any[]) => {
  const doc = createPDF("Historial de Cambios (Auditoría)");

  let y = 45;

  const totalLogs = logs.length;
  const creates = logs.filter((l) => l.action === "CREATE").length;
  const updates = logs.filter((l) => l.action === "UPDATE").length;
  const deletes = logs.filter((l) => l.action === "DELETE").length;

  doc.setFontSize(10);
  doc.text(`Total Registros: ${totalLogs}`, 20, y);
  doc.text(`Creaciones: ${creates}`, 80, y);
  doc.text(`Actualizaciones: ${updates}`, 130, y);
  doc.text(`Eliminaciones: ${deletes}`, 20, y + 7);

  y += 15;

  const tableData = logs.map((l) => [
    format(new Date(l.createdAt), "dd/MM/yyyy HH:mm", { locale: es }),
    l.entityType,
    l.action,
    l.entityId.toString(),
    l.user?.name || l.userId || "Sistema",
    l.description || "-",
  ]);

  autoTable(doc, {
    ...getTableOptions(y),
    head: [["Fecha", "Entidad", "Acción", "ID", "Usuario", "Descripción"]],
    body: tableData,
    styles: { fontSize: 8 },
    didParseCell: (data: any) => {
      if (data.column.index === 2) {
        const text = data.cell.text[0];
        if (text === "CREATE") data.cell.styles.textColor = [76, 175, 80];
        else if (text === "DELETE") data.cell.styles.textColor = [220, 53, 69];
        else if (text === "UPDATE") data.cell.styles.textColor = [33, 150, 243];
      }
    },
  });

  return doc;
};

// Descargar PDF
export const downloadPDF = (doc: jsPDF, filename: string) => {
  doc.save(filename);
};

// Obtener PDF como blob
export const getPDFBlob = (doc: jsPDF) => {
  return doc.output("blob");
};

// Obtener PDF como base64
export const getPDFBase64 = (doc: jsPDF) => {
  return doc.output("datauristring");
};