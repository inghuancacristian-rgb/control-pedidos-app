import { useState } from "react";
import { trpc } from "../utils/trpc";
import { format } from "date-fns";
import {
  generateOrdersPDF,
  generateSalesPDF,
  generateInventoryPDF,
  generateFinancePDF,
  generateCustomersPDF,
  generateInventoryMovementsPDF,
  generateAuditPDF,
} from "../utils/pdfReports";
import {
  generateOrdersExcel,
  generateSalesExcel,
  generateInventoryExcel,
  generateFinanceExcel,
  generateCustomersExcel,
  generateInventoryMovementsExcel,
  generateAuditExcel,
  downloadExcel,
  getExcelFilename,
} from "../utils/excelReports";
import { Download, FileText, Calendar, DollarSign, Package, Users, Activity, History, FileSpreadsheet } from "lucide-react";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    startDate: format(new Date(new Date().setDate(new Date().getDate() - 30)), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [selectedReport, setSelectedReport] = useState("orders");

  // Queries para obtener datos
  const ordersQuery = trpc.reports.ordersReport.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const salesQuery = trpc.reports.salesReport.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const inventoryQuery = trpc.reports.inventoryReport.useQuery();
  const movementsQuery = trpc.reports.inventoryMovementsReport.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const financeQuery = trpc.reports.financeReport.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const customersQuery = trpc.reports.customersReport.useQuery();
  const auditQuery = trpc.audit.list.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    limit: 200,
  });

  const isLoading = ordersQuery.isLoading ||
    salesQuery.isLoading ||
    inventoryQuery.isLoading ||
    movementsQuery.isLoading ||
    financeQuery.isLoading ||
    customersQuery.isLoading ||
    auditQuery.isLoading;

  // Funciones de descarga
  const downloadOrdersReport = () => {
    if (ordersQuery.data) {
      const doc = generateOrdersPDF(ordersQuery.data, dateRange);
      doc.save(`reporte-pedidos-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadSalesReport = () => {
    if (salesQuery.data) {
      const doc = generateSalesPDF(salesQuery.data, dateRange);
      doc.save(`reporte-ventas-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadInventoryReport = () => {
    if (inventoryQuery.data) {
      const doc = generateInventoryPDF(
        inventoryQuery.data.products,
        inventoryQuery.data.inventory
      );
      doc.save(`reporte-inventario-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadMovementsReport = () => {
    if (movementsQuery.data) {
      const doc = generateInventoryMovementsPDF(
        movementsQuery.data.movements,
        movementsQuery.data.products
      );
      doc.save(`reporte-movimientos-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadFinanceReport = () => {
    if (financeQuery.data) {
      const doc = generateFinancePDF(
        financeQuery.data.transactions,
        financeQuery.data.closures
      );
      doc.save(`reporte-financiero-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadCustomersReport = () => {
    if (customersQuery.data) {
      const doc = generateCustomersPDF(customersQuery.data);
      doc.save(`reporte-clientes-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  const downloadAuditReport = () => {
    if (auditQuery.data) {
      const doc = generateAuditPDF(auditQuery.data);
      doc.save(`reporte-auditoria-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
  };

  // Funciones de descarga Excel
  const downloadOrdersExcel = () => {
    if (ordersQuery.data) {
      const wb = generateOrdersExcel(ordersQuery.data, dateRange);
      downloadExcel(wb, getExcelFilename("reporte-pedidos"));
    }
  };

  const downloadSalesExcel = () => {
    if (salesQuery.data) {
      const wb = generateSalesExcel(salesQuery.data, dateRange);
      downloadExcel(wb, getExcelFilename("reporte-ventas"));
    }
  };

  const downloadInventoryExcel = () => {
    if (inventoryQuery.data) {
      const wb = generateInventoryExcel(inventoryQuery.data.products, inventoryQuery.data.inventory);
      downloadExcel(wb, getExcelFilename("reporte-inventario"));
    }
  };

  const downloadMovementsExcel = () => {
    if (movementsQuery.data) {
      const wb = generateInventoryMovementsExcel(movementsQuery.data.movements, movementsQuery.data.products);
      downloadExcel(wb, getExcelFilename("reporte-movimientos"));
    }
  };

  const downloadFinanceExcel = () => {
    if (financeQuery.data) {
      const wb = generateFinanceExcel(financeQuery.data.transactions, financeQuery.data.closures);
      downloadExcel(wb, getExcelFilename("reporte-financiero"));
    }
  };

  const downloadCustomersExcel = () => {
    if (customersQuery.data) {
      const wb = generateCustomersExcel(customersQuery.data);
      downloadExcel(wb, getExcelFilename("reporte-clientes"));
    }
  };

  const downloadAuditExcel = () => {
    if (auditQuery.data) {
      const wb = generateAuditExcel(auditQuery.data);
      downloadExcel(wb, getExcelFilename("reporte-auditoria"));
    }
  };

  const reportTypes = [
    {
      id: "orders",
      name: "Pedidos",
      icon: FileText,
      description: "Reporte de todos los pedidos",
      onDownloadPDF: downloadOrdersReport,
      onDownloadExcel: downloadOrdersExcel,
      dataCount: ordersQuery.data?.length || 0,
    },
    {
      id: "sales",
      name: "Ventas",
      icon: DollarSign,
      description: "Reporte de ventas y cobranzas",
      onDownloadPDF: downloadSalesReport,
      onDownloadExcel: downloadSalesExcel,
      dataCount: salesQuery.data?.length || 0,
    },
    {
      id: "inventory",
      name: "Inventario",
      icon: Package,
      description: "Estado actual del inventario",
      onDownloadPDF: downloadInventoryReport,
      onDownloadExcel: downloadInventoryExcel,
      dataCount: inventoryQuery.data?.products.length || 0,
    },
    {
      id: "movements",
      name: "Movimientos",
      icon: Activity,
      description: "Historial de movimientos",
      onDownloadPDF: downloadMovementsReport,
      onDownloadExcel: downloadMovementsExcel,
      dataCount: movementsQuery.data?.movements.length || 0,
    },
    {
      id: "finance",
      name: "Finanzas",
      icon: Calendar,
      description: "Transacciones y cierres de caja",
      onDownloadPDF: downloadFinanceReport,
      onDownloadExcel: downloadFinanceExcel,
      dataCount: financeQuery.data?.transactions.length || 0,
    },
    {
      id: "customers",
      name: "Clientes",
      icon: Users,
      description: "Lista de clientes registrados",
      onDownloadPDF: downloadCustomersReport,
      onDownloadExcel: downloadCustomersExcel,
      dataCount: customersQuery.data?.length || 0,
    },
    {
      id: "audit",
      name: "Auditoría",
      icon: History,
      description: "Historial de cambios del sistema",
      onDownloadPDF: downloadAuditReport,
      onDownloadExcel: downloadAuditExcel,
      dataCount: auditQuery.data?.length || 0,
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
        <p className="text-gray-500">Genera y descarga reportes del sistema</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <h2 className="font-medium text-gray-700 mb-3">Período de Reporte</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
              }
              className="border rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
              }
              className="border rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
        </div>
      </div>

      {/* Reportes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <div
            key={report.id}
            className={`bg-white rounded-lg border p-5 transition-all cursor-pointer ${
              selectedReport === report.id
                ? "border-green-500 shadow-md"
                : "border-gray-200 hover:border-green-300"
            }`}
            onClick={() => setSelectedReport(report.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className={`p-2 rounded-lg ${
                  selectedReport === report.id
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <report.icon size={24} />
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                {report.dataCount} registros
              </span>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">{report.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{report.description}</p>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  report.onDownloadPDF();
                }}
                disabled={isLoading || report.dataCount === 0}
                className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-2 px-3 rounded-lg transition-colors text-sm"
              >
                <Download size={14} />
                PDF
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  report.onDownloadExcel();
                }}
                disabled={isLoading || report.dataCount === 0}
                className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-2 px-3 rounded-lg transition-colors text-sm"
              >
                <FileSpreadsheet size={14} />
                Excel
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-3"></div>
            <p className="text-gray-600">Generando reporte...</p>
          </div>
        </div>
      )}

      {/* Vista previa del reporte seleccionado */}
      {selectedReport && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-700 mb-3">
            Vista previa: {reportTypes.find((r) => r.id === selectedReport)?.name}
          </h3>
          <div className="text-sm text-gray-500">
            {selectedReport === "orders" &&
              ordersQuery.data?.length === 0 &&
              "No hay pedidos en el período seleccionado"}
            {selectedReport === "sales" &&
              salesQuery.data?.length === 0 &&
              "No hay ventas en el período seleccionado"}
            {selectedReport === "inventory" &&
              inventoryQuery.data?.products.length === 0 &&
              "No hay productos registrados"}
            {selectedReport === "movements" &&
              movementsQuery.data?.movements.length === 0 &&
              "No hay movimientos en el período seleccionado"}
            {selectedReport === "finance" &&
              financeQuery.data?.transactions.length === 0 &&
              "No hay transacciones en el período seleccionado"}
            {selectedReport === "customers" &&
              customersQuery.data?.length === 0 &&
              "No hay clientes registrados"}
            {selectedReport === "audit" &&
              auditQuery.data?.length === 0 &&
              "No hay registros de auditoría"}
          </div>
        </div>
      )}
    </div>
  );
}