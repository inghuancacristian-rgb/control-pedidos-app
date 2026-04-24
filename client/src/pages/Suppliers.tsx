import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Phone, MapPin, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Suppliers() {
  const [open, setOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    contactName: "",
    phone: "",
    taxId: "",
    address: "",
  });

  const utils = trpc.useContext();
  const { data: suppliers, isLoading } = trpc.suppliers.list.useQuery();
  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => {
      toast.success("Proveedor registrado correctamente");
      setOpen(false);
      setNewSupplier({ name: "", contactName: "", phone: "", taxId: "", address: "" });
      utils.suppliers.list.invalidate();
    },
    onError: (error) => {
      toast.error("Error al registrar: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newSupplier);
  };

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto mb-20 md:mb-0">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-muted-foreground">Gestiona tus contactos comerciales y de suministros.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Proveedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Proveedor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre Comercial *</Label>
                <Input 
                  id="name" 
                  value={newSupplier.name} 
                  onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact">Contacto</Label>
                  <Input 
                    id="contact" 
                    value={newSupplier.contactName} 
                    onChange={(e) => setNewSupplier({...newSupplier, contactName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input 
                    id="phone" 
                    value={newSupplier.phone} 
                    onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">NIT / Identificación Fiscal</Label>
                <Input 
                  id="taxId" 
                  value={newSupplier.taxId} 
                  onChange={(e) => setNewSupplier({...newSupplier, taxId: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input 
                  id="address" 
                  value={newSupplier.address} 
                  onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Guardando..." : "Guardar Proveedor"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers?.map((supplier: any) => (
            <Card key={supplier.id} className="overflow-hidden border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    {supplier.name}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                    ID: {supplier.id}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {supplier.contactName && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>Contacto: {supplier.contactName}</span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>Tel: {supplier.phone}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{supplier.address}</span>
                  </div>
                )}
                {supplier.taxId && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>NIT: {supplier.taxId}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {suppliers?.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4 border-2 border-dashed rounded-xl">
              <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
              <p className="text-muted-foreground">No hay proveedores registrados aún.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
