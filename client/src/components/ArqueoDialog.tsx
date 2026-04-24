import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { Calculator } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const BILLS = [200, 100, 50, 20, 10];
const COINS = [5, 2, 1, 0.5, 0.2, 0.1];

export function ArqueoDialog({
  expectedCash,
  expectedQr,
  expectedTransfer,
}: {
  expectedCash: number;
  expectedQr: number;
  expectedTransfer: number;
}) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reportedQr, setReportedQr] = useState<number>(0);
  const [reportedTransfer, setReportedTransfer] = useState<number>(0);

  const utils = trpc.useContext();
  const getLocalDateInputValue = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
  };

  const calculateTotalCash = () => {
    let total = 0;
    Object.entries(counts).forEach(([denomination, qty]) => {
      total += parseFloat(denomination) * qty;
    });
    return total * 100; // Convert to cents
  };

  const totalReportedCash = calculateTotalCash();
  const cashDifference = totalReportedCash - expectedCash;
  const qrDifference = (reportedQr * 100) - expectedQr;
  const transferDifference = (reportedTransfer * 100) - expectedTransfer;

  const mutation = trpc.finance.submitClosure.useMutation({
    onSuccess: () => {
      toast.success("Cierre de caja registrado exitosamente. Esperando validación del administrador.");
      setOpen(false);
      setCounts({});
      setReportedQr(0);
      setReportedTransfer(0);
      utils.finance.getTransactions.invalidate();
      utils.finance.listAllClosures.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Error al procesar el cierre");
    }
  });

  const handleProcessClosure = () => {
    mutation.mutate({
      date: getLocalDateInputValue(),
      initialCash: 0,
      reportedCash: totalReportedCash / 100,
      reportedQr: reportedQr,
      reportedTransfer: reportedTransfer,
      expectedCash: expectedCash / 100,
      expectedQr: expectedQr / 100,
      expectedTransfer: expectedTransfer / 100,
      expenses: 0,
    });
  };

  const handleCountChange = (denom: number, val: string) => {
    const parsed = parseInt(val, 10);
    setCounts(prev => ({
      ...prev,
      [denom.toString()]: isNaN(parsed) || parsed < 0 ? 0 : parsed
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-orange-600 hover:bg-orange-700 h-10 px-4">
          <Calculator className="h-4 w-4" /> Arqueo y Cierre
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Arqueo y Cierre de Caja</DialogTitle>
          <DialogDescription>
            Cuenta y declara tu efectivo (Billetaje), así como los reportes de QR y Cuenta Bancaria.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* Calculadora de Billetes y Monedas */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-800 border-b pb-2">Calculadora de Billetaje</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2 rounded border space-y-2">
                <p className="font-bold text-center text-slate-600">Billetes (Bs)</p>
                {BILLS.map(denom => (
                  <div key={denom} className="flex items-center gap-2">
                    <Label className="w-10 text-right">{denom}</Label>
                    <span>x</span>
                    <Input 
                      type="number" 
                      className="h-7 text-xs" 
                      min="0"
                      value={counts[denom.toString()] || ""} 
                      onChange={(e) => handleCountChange(denom, e.target.value)} 
                    />
                    <div className="w-16 text-right font-mono font-medium text-slate-500">
                      {(denom * (counts[denom.toString()] || 0)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 p-2 rounded border space-y-2">
                <p className="font-bold text-center text-slate-600">Monedas (Bs)</p>
                {COINS.map(denom => (
                  <div key={denom} className="flex items-center gap-2">
                    <Label className="w-10 text-right">{denom}</Label>
                    <span>x</span>
                    <Input 
                      type="number" 
                      className="h-7 text-xs" 
                      min="0"
                      step="1"
                      value={counts[denom.toString()] || ""} 
                      onChange={(e) => handleCountChange(denom, e.target.value)} 
                    />
                    <div className="w-16 text-right font-mono font-medium text-slate-500">
                      {(denom * (counts[denom.toString()] || 0)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg border border-orange-200">
               <p className="text-xs font-bold text-orange-800 uppercase">Total Billetaje Contado</p>
               <p className="text-2xl font-black text-orange-900">{formatCurrency(totalReportedCash)}</p>
            </div>
          </div>

          {/* Cuadre del Sistema */}
          <div className="space-y-4">
             <h3 className="font-bold text-sm text-slate-800 border-b pb-2">Cuadre del Sistema</h3>
             
             <div className="space-y-3">
               <div className="flex flex-col gap-1">
                 <Label className="text-xs font-bold">1. Caja Efectivo</Label>
                 <div className="flex justify-between items-center bg-slate-50 border p-2 rounded text-sm mb-1">
                   <span className="text-muted-foreground">Esperado Sist:</span>
                   <span className="font-mono font-bold">{formatCurrency(expectedCash)}</span>
                 </div>
                 <div className={`flex justify-between items-center p-2 rounded text-sm border ${cashDifference === 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                   <span className={cashDifference === 0 ? "text-green-800" : "text-red-800"}>Faltante/Sobrante:</span>
                   <span className={`font-mono font-bold ${cashDifference === 0 ? "text-green-600" : "text-red-600"}`}>
                     {cashDifference === 0 ? "OK 0.00" : formatCurrency(cashDifference)}
                   </span>
                 </div>
               </div>

               <Separator />

               <div className="flex flex-col gap-1">
                 <Label className="text-xs font-bold">2. Caja QR</Label>
                 <div className="flex justify-between items-center text-sm mb-1">
                   <span className="text-muted-foreground">Total Reportado:</span>
                   <Input 
                     type="number" 
                     className="w-24 h-7 text-right" 
                     value={reportedQr || ""}
                     onChange={(e) => setReportedQr(parseFloat(e.target.value) || 0)}
                   />
                 </div>
                 <div className="flex justify-between items-center bg-slate-50 border p-2 rounded text-sm">
                   <span className="text-muted-foreground">Esperado Sist:</span>
                   <span className="font-mono font-bold">{formatCurrency(expectedQr)}</span>
                 </div>
                 <div className="flex justify-between text-xs px-2 py-1">
                   <span>Diferencia:</span>
                   <span className={`${qrDifference === 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(qrDifference)}</span>
                 </div>
               </div>

               <div className="flex flex-col gap-1">
                 <Label className="text-xs font-bold">3. Cuenta Bancaria</Label>
                 <div className="flex justify-between items-center text-sm mb-1">
                   <span className="text-muted-foreground">Total Reportado:</span>
                   <Input 
                     type="number" 
                     className="w-24 h-7 text-right" 
                     value={reportedTransfer || ""}
                     onChange={(e) => setReportedTransfer(parseFloat(e.target.value) || 0)}
                   />
                 </div>
                 <div className="flex justify-between items-center bg-slate-50 border p-2 rounded text-sm">
                   <span className="text-muted-foreground">Esperado Sist:</span>
                   <span className="font-mono font-bold">{formatCurrency(expectedTransfer)}</span>
                 </div>
                 <div className="flex justify-between text-xs px-2 py-1">
                   <span>Diferencia:</span>
                   <span className={`${transferDifference === 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(transferDifference)}</span>
                 </div>
               </div>
               
             </div>
          </div>
        </div>

        <Button 
          className="w-full mt-4 bg-slate-900 hover:bg-slate-800 font-bold" 
          size="lg"
          onClick={handleProcessClosure}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "PROCESANDO..." : "PROCESAR CIERRE DE CAJA"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
