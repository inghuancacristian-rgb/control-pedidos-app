import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MapPin,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

const CHANNELS = [
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "marketplace", label: "Marketplace" },
  { value: "referral", label: "Referido" },
  { value: "other", label: "Otro" },
] as const;

type SourceChannel = (typeof CHANNELS)[number]["value"];

function sourceChannelLabel(channel?: string | null) {
  return CHANNELS.find((entry) => entry.value === channel)?.label || "Otro";
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Sin actividad";
  return new Date(value).toLocaleString("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getFrequencyVariant(label?: string) {
  if (label === "Alta") return "default";
  if (label === "Media") return "secondary";
  return "outline";
}

function getCustomerTags(customer: any) {
  const tags: string[] = [];

  if (customer.interestHealthFitness) tags.push("Salud/Fitness");
  if (customer.interestNaturalFood) tags.push("Natural/Orgánico");
  if (customer.interestDigestiveIssues) tags.push("Digestivo");
  if (customer.lifestyleGym) tags.push("Gym");
  if (customer.lifestyleVegan) tags.push("Vegano");
  if (customer.lifestyleBiohacking) tags.push("Biohacking");

  return tags;
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | SourceChannel>("all");
  const [cohortFilter, setCohortFilter] = useState<"all" | "new" | "old">("all");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    clientNumber: "",
    name: "",
    sourceChannel: "other" as SourceChannel,
    phone: "",
    whatsapp: "",
    zone: "",
    address: "",
    age: "",
    gender: "",
    socioeconomicLevel: "",
    interestHealthFitness: false,
    interestNaturalFood: false,
    interestDigestiveIssues: false,
    lifestyleGym: false,
    lifestyleVegan: false,
    lifestyleBiohacking: false,
  });
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.customers.getInsights.useQuery();
  const { data: customerDetails, isLoading: isLoadingDetails } = trpc.customers.getDetails.useQuery(
    { customerId: selectedCustomerId || 0 },
    { enabled: selectedCustomerId !== null }
  );
  const createCustomerMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente creado correctamente");
      setIsCreateOpen(false);
      setNewCustomer({
        clientNumber: "",
        name: "",
        sourceChannel: "other" as SourceChannel,
        phone: "",
        whatsapp: "",
        zone: "",
        address: "",
        age: "",
        gender: "",
        socioeconomicLevel: "",
        interestHealthFitness: false,
        interestNaturalFood: false,
        interestDigestiveIssues: false,
        lifestyleGym: false,
        lifestyleVegan: false,
        lifestyleBiohacking: false,
      });
      void Promise.all([
        utils.customers.list.invalidate(),
        utils.customers.getInsights.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo crear el cliente");
    },
  });

  const filteredCustomers = useMemo(() => {
    if (!data?.customers) return [];
    const normalized = search.trim().toLowerCase();

    const start = rangeStart ? new Date(rangeStart + "T00:00:00") : null;
    const end = rangeEnd ? new Date(rangeEnd + "T23:59:59") : null;

    const inRange = (value?: string | Date | null) => {
      if (!start || !end) return null;
      if (!value) return false;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
    };

    const base = data.customers.filter((customer: any) => {
      const customerChannel = (customer.sourceChannel || "other") as SourceChannel;
      const channelOk = channelFilter === "all" || customerChannel === channelFilter;

      const firstActivityAt = customer.firstActivityAt || customer.createdAt || null;
      const isNew = inRange(firstActivityAt);
      const cohortOk =
        cohortFilter === "all" || isNew === null
          ? true
          : cohortFilter === "new"
            ? isNew === true
            : isNew === false;

      return channelOk && cohortOk;
    });

    if (!normalized) return base;

    return base.filter((customer: any) =>
      customer.name?.toLowerCase().includes(normalized) ||
      customer.clientNumber?.toLowerCase().includes(normalized) ||
      customer.zone?.toLowerCase().includes(normalized) ||
      customer.phone?.toLowerCase().includes(normalized) ||
      customer.whatsapp?.toLowerCase().includes(normalized) ||
      customer.gender?.toLowerCase().includes(normalized) ||
      customer.socioeconomicLevel?.toLowerCase().includes(normalized) ||
      sourceChannelLabel(customer.sourceChannel).toLowerCase().includes(normalized) ||
      getCustomerTags(customer).some((tag) => tag.toLowerCase().includes(normalized))
    );
  }, [data?.customers, search, channelFilter, cohortFilter, rangeStart, rangeEnd]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Cargando clientes...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Clientes</h1>
            <p className="mt-1 text-muted-foreground">
              Seguimiento de frecuencia de compra, deuda, historial y zonas activas.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-blue-600" />
                Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.summary.totalCustomers || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                Activos (30 días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.summary.activeCustomers || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Wallet className="h-4 w-4 text-red-600" />
                Deuda pendiente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(data?.summary.totalDebt || 0)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4 text-orange-600" />
                Zonas activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.summary.activeZones || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ShoppingBag className="h-4 w-4 text-purple-600" />
                Frecuencia alta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.summary.frequentCustomers || 0}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Base de clientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Desde</Label>
                  <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Hasta</Label>
                  <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Canal</Label>
                  <Select value={channelFilter} onValueChange={(val) => setChannelFilter(val as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Canal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {CHANNELS.map((channel) => (
                        <SelectItem key={channel.value} value={channel.value}>
                          {channel.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cohorte</Label>
                  <Select value={cohortFilter} onValueChange={(val) => setCohortFilter(val as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Cohorte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="new">Nuevos (rango)</SelectItem>
                      <SelectItem value="old">Antiguos (rango)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por cliente, número, zona o teléfono"
                  className="pl-8"
                />
              </div>

              <div className="space-y-3">
                {filteredCustomers.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No se encontraron clientes con ese filtro.
                  </div>
                ) : (
                  filteredCustomers.map((customer: any) => (
                    <div
                      key={customer.id}
                      className="rounded-lg border p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{customer.name}</p>
                            <Badge variant={getFrequencyVariant(customer.frequencyLabel)}>
                              {customer.frequencyLabel}
                            </Badge>
                            <Badge variant="outline">{sourceChannelLabel(customer.sourceChannel)}</Badge>
                            {customer.debt > 0 && (
                              <Badge variant="destructive">Deuda</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {customer.clientNumber}
                            {customer.zone ? ` · ${customer.zone}` : ""}
                            {customer.phone ? ` · ${customer.phone}` : ""}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Última actividad: {formatDate(customer.lastActivityAt)}
                          </p>
                          {getCustomerTags(customer).length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {getCustomerTags(customer).map((tag) => (
                                <Badge key={tag} variant="outline">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="grid gap-2 text-sm md:min-w-[280px] md:grid-cols-2">
                          <div>
                            <p className="text-muted-foreground">Pedidos</p>
                            <p className="font-semibold">{customer.orderCount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Ventas</p>
                            <p className="font-semibold">{customer.saleCount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total comprado</p>
                            <p className="font-semibold">{formatCurrency(customer.totalSpent)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Deuda</p>
                            <p className="font-semibold">{formatCurrency(customer.debt)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCustomerId(customer.id)}
                        >
                          Ver seguimiento
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Canales de origen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.channelStats?.length ? (
                  data.channelStats.slice(0, 6).map((channel: any) => (
                    <div key={channel.channel} className="rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{sourceChannelLabel(channel.channel)}</p>
                        <Badge variant="outline">{channel.customers} clientes</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Activos (30 días): {channel.activeCustomers || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Compra acumulada: {formatCurrency(channel.totalSpent || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Deuda: {formatCurrency(channel.totalDebt || 0)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No hay canales registrados.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Zonas más activas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.zoneStats?.length ? (
                  data.zoneStats.slice(0, 6).map((zone: any) => (
                    <div key={zone.zone} className="rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{zone.zone}</p>
                        <Badge variant="outline">{zone.customers} clientes</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Compra acumulada: {formatCurrency(zone.totalSpent)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Deuda: {formatCurrency(zone.totalDebt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No hay zonas registradas.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog
          open={selectedCustomerId !== null}
          onOpenChange={(open) => !open && setSelectedCustomerId(null)}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Seguimiento del cliente</DialogTitle>
            </DialogHeader>

            {isLoadingDetails || !customerDetails ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Cargando historial del cliente...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <p className="font-semibold">{customerDetails.customer.name}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Número</p>
                      <p className="font-semibold">{customerDetails.customer.clientNumber}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Frecuencia</p>
                      <p className="font-semibold">
                        {customerDetails.summary?.frequencyLabel || "Sin compras"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Deuda</p>
                      <p className="font-semibold">
                        {formatCurrency(customerDetails.summary?.debt || 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-4">
                    <span>Zona: {customerDetails.customer.zone || "Sin zona"}</span>
                    <span>Pedidos: {customerDetails.summary?.orderCount || 0}</span>
                    <span>Ventas: {customerDetails.summary?.saleCount || 0}</span>
                    <span>Total: {formatCurrency(customerDetails.summary?.totalSpent || 0)}</span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Demográficos básicos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>Edad: {customerDetails.customer.age || "Sin dato"}</p>
                      <p>Género: {customerDetails.customer.gender || "Sin dato"}</p>
                      <p>Zona: {customerDetails.customer.zone || "Sin dato"}</p>
                      <p>Nivel socioeconómico: {customerDetails.customer.socioeconomicLevel || "Sin dato"}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Intereses y estilo de vida</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {getCustomerTags(customerDetails.customer).length > 0 ? (
                        getCustomerTags(customerDetails.customer).map((tag) => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin perfil cargado.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <ScrollArea className="h-[420px] rounded-lg border">
                  <div className="space-y-3 p-4">
                    {customerDetails.history.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        Este cliente todavía no tiene movimientos registrados.
                      </div>
                    ) : (
                      customerDetails.history.map((event: any) => (
                        <div key={event.id} className="rounded-lg border p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{event.title}</p>
                                <Badge variant={event.type === "sale" ? "default" : "secondary"}>
                                  {event.type === "sale" ? "Venta" : "Pedido"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{event.description}</p>
                            </div>
                            <div className="text-sm md:text-right">
                              <p className="font-semibold">{formatCurrency(event.amount || 0)}</p>
                              <p className="text-muted-foreground">{formatDate(event.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Crear nuevo cliente</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-client-number">Número de cliente</Label>
                  <Input
                    id="new-client-number"
                    value={newCustomer.clientNumber}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, clientNumber: e.target.value }))
                    }
                    placeholder="Ej: 7887295"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-client-name">Nombre</Label>
                  <Input
                    id="new-client-name"
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Canal de origen</Label>
                <Select
                  value={newCustomer.sourceChannel}
                  onValueChange={(val) => setNewCustomer((prev) => ({ ...prev, sourceChannel: val as SourceChannel }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((channel) => (
                      <SelectItem key={channel.value} value={channel.value}>
                        {channel.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-client-phone">Teléfono</Label>
                  <Input
                    id="new-client-phone"
                    value={newCustomer.phone}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="Opcional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-client-whatsapp">WhatsApp</Label>
                  <Input
                    id="new-client-whatsapp"
                    value={newCustomer.whatsapp}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, whatsapp: e.target.value }))
                    }
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-client-zone">Zona</Label>
                <Input
                  id="new-client-zone"
                  value={newCustomer.zone}
                  onChange={(e) =>
                    setNewCustomer((prev) => ({ ...prev, zone: e.target.value }))
                  }
                  placeholder="Ej: Obelisco"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="new-client-age">Edad</Label>
                  <Input
                    id="new-client-age"
                    type="number"
                    min="0"
                    max="120"
                    value={newCustomer.age}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, age: e.target.value }))
                    }
                    placeholder="Opcional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-client-gender">Género</Label>
                  <Select
                    value={newCustomer.gender}
                    onValueChange={(val) => setNewCustomer((prev) => ({ ...prev, gender: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="femenino">Femenino</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-client-socioeconomic">Nivel socioeconómico</Label>
                  <Select
                    value={newCustomer.socioeconomicLevel}
                    onValueChange={(val) => setNewCustomer((prev) => ({ ...prev, socioeconomicLevel: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bajo">Bajo</SelectItem>
                      <SelectItem value="medio">Medio</SelectItem>
                      <SelectItem value="alto">Alto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-client-address">Dirección</Label>
                <Textarea
                  id="new-client-address"
                  value={newCustomer.address}
                  onChange={(e) =>
                    setNewCustomer((prev) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder="Referencia o dirección detallada"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">Intereses</p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newCustomer.interestHealthFitness}
                      onCheckedChange={(checked) =>
                        setNewCustomer((prev) => ({ ...prev, interestHealthFitness: checked === true }))
                      }
                    />
                    <Label>Salud / fitness</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newCustomer.interestNaturalFood}
                      onCheckedChange={(checked) =>
                        setNewCustomer((prev) => ({ ...prev, interestNaturalFood: checked === true }))
                      }
                    />
                    <Label>Alimentación natural / orgánica</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newCustomer.interestDigestiveIssues}
                      onCheckedChange={(checked) =>
                        setNewCustomer((prev) => ({ ...prev, interestDigestiveIssues: checked === true }))
                      }
                    />
                    <Label>Problemas digestivos</Label>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">Estilo de vida</p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newCustomer.lifestyleGym}
                      onCheckedChange={(checked) =>
                        setNewCustomer((prev) => ({ ...prev, lifestyleGym: checked === true }))
                      }
                    />
                    <Label>Gym</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newCustomer.lifestyleVegan}
                      onCheckedChange={(checked) =>
                        setNewCustomer((prev) => ({ ...prev, lifestyleVegan: checked === true }))
                      }
                    />
                    <Label>Vegano</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newCustomer.lifestyleBiohacking}
                      onCheckedChange={(checked) =>
                        setNewCustomer((prev) => ({ ...prev, lifestyleBiohacking: checked === true }))
                      }
                    />
                    <Label>Biohacking</Label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createCustomerMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  disabled={createCustomerMutation.isPending}
                  onClick={() => {
                    if (!newCustomer.clientNumber.trim() || !newCustomer.name.trim()) {
                      toast.error("Número de cliente y nombre son obligatorios");
                      return;
                    }

                    createCustomerMutation.mutate({
                      clientNumber: newCustomer.clientNumber.trim(),
                      name: newCustomer.name.trim(),
                      sourceChannel: newCustomer.sourceChannel,
                      phone: newCustomer.phone.trim() || undefined,
                      whatsapp: newCustomer.whatsapp.trim() || undefined,
                      zone: newCustomer.zone.trim() || undefined,
                      address: newCustomer.address.trim() || undefined,
                      age: newCustomer.age ? parseInt(newCustomer.age, 10) : undefined,
                      gender: newCustomer.gender.trim() || undefined,
                      socioeconomicLevel: newCustomer.socioeconomicLevel.trim() || undefined,
                      interestHealthFitness: newCustomer.interestHealthFitness,
                      interestNaturalFood: newCustomer.interestNaturalFood,
                      interestDigestiveIssues: newCustomer.interestDigestiveIssues,
                      lifestyleGym: newCustomer.lifestyleGym,
                      lifestyleVegan: newCustomer.lifestyleVegan,
                      lifestyleBiohacking: newCustomer.lifestyleBiohacking,
                    });
                  }}
                >
                  {createCustomerMutation.isPending ? "Guardando..." : "Guardar cliente"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
