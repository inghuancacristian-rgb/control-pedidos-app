import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { MapPin, Phone, MessageCircle, Navigation } from "lucide-react";
import { useRoute } from "wouter";

export default function Tracking() {
  const { user } = useAuth();
  const [, params] = useRoute("/track/:orderId");
  const orderId = params?.orderId ? parseInt(params.orderId) : null;

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const { data: orderDetails, isLoading } = trpc.orders.getDetails.useQuery(
    { orderId: orderId || 0 },
    { enabled: !!orderId }
  );

  const { data: currentTracking } = trpc.tracking.getCurrentLocation.useQuery(
    { orderId: orderId || 0 },
    { enabled: !!orderId, refetchInterval: 5000 }
  );

  const updateLocationMutation = trpc.tracking.updateLocation.useMutation();

  // Obtener ubicación GPS del dispositivo
  useEffect(() => {
    if (user?.role !== "user") return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentLocation({ latitude, longitude });

        // Enviar ubicación al servidor
        if (orderId) {
          updateLocationMutation.mutate({
            orderId,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            accuracy: Math.round(accuracy),
          });
        }
      },
      (error) => {
        console.error("Error getting location:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [orderId, user?.role, updateLocationMutation]);

  if (!orderId || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Cargando información del pedido...</p>
      </div>
    );
  }

  if (!orderDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-600">Pedido no encontrado</p>
      </div>
    );
  }

  const { order } = orderDetails;
  const whatsappNumber = orderDetails.order.customerId; // Esto debería venir del cliente

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Rastreo de Entrega</h1>

        {/* Información del pedido */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pedido #{order.orderNumber}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge className="mt-1">
                  {order.status === "in_transit" ? "En tránsito" : order.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Zona de entrega</p>
                <p className="font-semibold mt-1">{order.zone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="font-semibold mt-1">${(order.totalPrice / 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Método de pago</p>
                <p className="font-semibold mt-1 capitalize">{order.paymentMethod || "No especificado"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ubicación actual */}
        {currentTracking && (
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                Ubicación Actual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Latitud</p>
                  <p className="font-mono text-sm mt-1">{currentTracking.latitude}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Longitud</p>
                  <p className="font-mono text-sm mt-1">{currentTracking.longitude}</p>
                </div>
                {currentTracking.accuracy && (
                  <div>
                    <p className="text-sm text-muted-foreground">Precisión</p>
                    <p className="font-semibold mt-1">{currentTracking.accuracy}m</p>
                  </div>
                )}
              </div>

              {/* Botón para abrir en Google Maps */}
              <a
                href={`https://maps.google.com/?q=${currentTracking.latitude},${currentTracking.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full mt-4 gap-2">
                  <Navigation className="h-4 w-4" />
                  Ver en Google Maps
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Contacto con cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Contactar con Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Botón de WhatsApp */}
              <a
                href={`https://wa.me/+5491234567890?text=Hola,%20estoy%20entregando%20tu%20pedido%20%23${order.orderNumber}%20en%20la%20zona%20de%20${order.zone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                  <MessageCircle className="h-4 w-4" />
                  Contactar por WhatsApp
                </Button>
              </a>

              {/* Botón de llamada */}
              <a href="tel:+5491234567890" className="flex-1">
                <Button variant="outline" className="w-full gap-2">
                  <Phone className="h-4 w-4" />
                  Llamar
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        {order.notes && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{order.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
