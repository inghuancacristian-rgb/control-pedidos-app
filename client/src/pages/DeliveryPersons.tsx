import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Eye, EyeOff } from "lucide-react";

export default function DeliveryPersons() {
  const { data: deliveryPersons, refetch } = trpc.users.listDeliveryPersons.useQuery();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    role: "user",
  });

  const createMutation = trpc.users.createDeliveryPerson.useMutation({
    onSuccess: () => {
      toast.success("Repartidor creado exitosamente");
      setFormData({ username: "", password: "", name: "", email: "", role: "user" });
      setIsOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear repartidor");
    },
  });

  const updateMutation = trpc.users.updateDeliveryPerson.useMutation({
    onSuccess: () => {
      toast.success("Repartidor actualizado exitosamente");
      setFormData({ username: "", password: "", name: "", email: "", role: "user" });
      setEditingId(null);
      setIsOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar repartidor");
    },
  });

  const deleteMutation = trpc.users.deleteDeliveryPerson.useMutation({
    onSuccess: () => {
      toast.success("Repartidor eliminado exitosamente");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar repartidor");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: formData.name,
        email: formData.email || undefined,
        password: formData.password || undefined,
      });
    } else {
      if (!formData.username.trim()) {
        toast.error("El usuario es requerido");
        return;
      }
      if (!formData.password.trim()) {
        toast.error("La contraseña es requerida");
        return;
      }

      createMutation.mutate({
        username: formData.username,
        password: formData.password,
        name: formData.name,
        email: formData.email || undefined,
      });
    }
  };

  const handleEdit = (person: any) => {
    setEditingId(person.id);
    setFormData({
      username: person.username || "",
      password: "",
      name: person.name || "",
      email: person.email || "",
      role: person.role || "user",
    });
    setIsOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar este repartidor?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData({ username: "", password: "", name: "", email: "", role: "user" });
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gestión de Repartidores</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Repartidor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Repartidor" : "Crear Nuevo Repartidor"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Nombre de usuario"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    disabled={editingId !== null}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Nombre del repartidor"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              {editingId ? (
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva Contraseña (opcional)</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Dejar en blanco para no cambiar"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Contraseña"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="role">Rol de Usuario</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Repartidor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1"
                >
                  {editingId ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {!deliveryPersons || deliveryPersons.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No hay repartidores registrados
            </CardContent>
          </Card>
        ) : (
          deliveryPersons.map((person) => (
            <Card key={person.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {person.name}
                      <Badge variant={person.role === "admin" ? "default" : "secondary"}>
                        {person.role === "admin" ? "Admin" : "Repartidor"}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      @{person.username}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(person)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(person.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {person.email && (
                  <p>
                    <strong>Email:</strong> {person.email}
                  </p>
                )}
                <p>
                  <strong>Creado:</strong>{" "}
                  {new Date(person.createdAt).toLocaleDateString("es-ES")}
                </p>
                <p>
                  <strong>Último acceso:</strong>{" "}
                  {new Date(person.lastSignedIn).toLocaleDateString("es-ES")}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
