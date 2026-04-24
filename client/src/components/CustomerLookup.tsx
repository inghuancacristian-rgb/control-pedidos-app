import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, UserRound } from "lucide-react";

interface CustomerLookupProps {
  clientNumber: string;
  clientName: string;
  zone: string;
  sourceChannel?: string;
  onChange: (patch: { clientNumber?: string; clientName?: string; zone?: string; sourceChannel?: string }) => void;
}

export function CustomerLookup({
  clientNumber,
  clientName,
  zone,
  sourceChannel,
  onChange,
}: CustomerLookupProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: exactCustomer } = trpc.customers.getByNumber.useQuery(
    { clientNumber },
    { enabled: clientNumber.trim().length > 0 }
  );

  const { data: suggestions, isFetching } = trpc.customers.search.useQuery(
    { query: searchTerm },
    { enabled: searchTerm.trim().length >= 2 }
  );

  useEffect(() => {
    if (!exactCustomer) return;

    const patch: { clientNumber?: string; clientName?: string; zone?: string; sourceChannel?: string } = {};

    if (exactCustomer.clientNumber !== clientNumber) {
      patch.clientNumber = exactCustomer.clientNumber;
    }
    if (exactCustomer.name && exactCustomer.name !== clientName) {
      patch.clientName = exactCustomer.name;
    }
    if (exactCustomer.zone && exactCustomer.zone !== zone) {
      patch.zone = exactCustomer.zone;
    }
    if (exactCustomer.sourceChannel && exactCustomer.sourceChannel !== sourceChannel) {
      patch.sourceChannel = exactCustomer.sourceChannel;
    }

    if (Object.keys(patch).length > 0) {
      onChange(patch);
    }
  }, [exactCustomer?.id]);

  const applyCustomer = (customer: any) => {
    onChange({
      clientNumber: customer.clientNumber || "",
      clientName: customer.name || "",
      zone: customer.zone || "",
      sourceChannel: customer.sourceChannel || "other",
    });
    setSearchTerm("");
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-2">
        <Label htmlFor="customerSearch">Buscar cliente registrado</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="customerSearch"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, número, teléfono o zona"
            className="pl-8"
          />
        </div>
      </div>

      {searchTerm.trim().length >= 2 && (
        <div className="space-y-2 rounded-md border bg-background p-2">
          {isFetching ? (
            <p className="px-2 py-1 text-sm text-muted-foreground">Buscando clientes...</p>
          ) : suggestions && suggestions.length > 0 ? (
            suggestions.map((customer: any) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => applyCustomer(customer)}
                className="flex w-full items-start justify-between rounded-md px-3 py-2 text-left hover:bg-muted"
              >
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {customer.clientNumber}
                    {customer.zone ? ` · ${customer.zone}` : ""}
                  </p>
                </div>
                <Badge variant="outline">Usar</Badge>
              </button>
            ))
          ) : (
            <div className="space-y-2 px-2 py-1">
              <p className="text-sm text-muted-foreground">
                No se encontró un cliente con esa búsqueda.
              </p>
              <p className="text-xs text-muted-foreground">
                Si continúas con este pedido, el cliente se guardará automáticamente.
              </p>
            </div>
          )}
        </div>
      )}

      {exactCustomer && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          <UserRound className="h-4 w-4" />
          <span>
            Cliente reconocido: <strong>{exactCustomer.name}</strong>
            {exactCustomer.zone ? ` · ${exactCustomer.zone}` : ""}
          </span>
        </div>
      )}

      {!exactCustomer && clientNumber.trim().length > 0 && clientName.trim().length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <span>Cliente nuevo. Se guardará automáticamente al registrar el pedido.</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSearchTerm(clientNumber || clientName)}>
            Buscar
          </Button>
        </div>
      )}
    </div>
  );
}
