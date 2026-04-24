import { type ChangeEvent, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, X } from "lucide-react";

interface AddProductDialogProps {
  onProductAdded?: () => void;
}

export function AddProductDialog({ onProductAdded }: AddProductDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "finished_product",
    price: "",
    salePrice: "",
    imageUrl: "",
    status: "active",
  });
  const [imagePreview, setImagePreview] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const createProductMutation = trpc.inventory.createProduct.useMutation({
    onSuccess: () => {
      toast.success("Producto creado exitosamente");
      setIsOpen(false);
      setFormData({
        code: "",
        name: "",
        category: "finished_product",
        price: "",
        salePrice: "",
        imageUrl: "",
        status: "active",
      });
      setImagePreview("");
      setSelectedFile(null);
      onProductAdded?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear el producto");
    },
  });

  const handleImageUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData((prev) => ({ ...prev, imageUrl: url }));
    setSelectedFile(null);
    setImagePreview(url);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("file", file);

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formDataToSend,
      });

      if (!response.ok) {
        throw new Error("Error al subir la imagen");
      }

      const data = await response.json();
      setFormData((prev) => ({ ...prev, imageUrl: data.url }));
      setImagePreview(data.url);
      toast.success("Imagen subida exitosamente");
    } catch (error) {
      console.error("Error uploading image:", error);
      setSelectedFile(null);
      setFormData((prev) => ({ ...prev, imageUrl: "" }));
      setImagePreview("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast.error("Error al subir la imagen");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen valido");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe superar 5MB");
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
      setFormData((prev) => ({ ...prev, imageUrl: "" }));
    };
    reader.readAsDataURL(file);

    await uploadFile(file);
  };

  const handleRemoveImage = () => {
    setImagePreview("");
    setSelectedFile(null);
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.price || !formData.code.trim()) {
      toast.error("Por favor completa todos los campos requeridos (Nombre, SKU y Precio)");
      return;
    }

    if (selectedFile && !formData.imageUrl) {
      toast.error("Primero termina de subir la imagen antes de guardar el producto");
      return;
    }

    createProductMutation.mutate({
      code: formData.code,
      name: formData.name,
      category: formData.category as "finished_product" | "raw_material" | "supplies",
      price: parseFloat(formData.price),
      salePrice: formData.salePrice ? parseFloat(formData.salePrice) : 0,
      imageUrl: formData.imageUrl || undefined,
      status: formData.status as "active" | "inactive",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar Producto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anadir Nuevo Producto</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Completa los detalles del producto para el inventario y ventas.
          </p>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label htmlFor="name">Nombre del Producto</Label>
            <Input
              id="name"
              placeholder="Ej: Camiseta Algodon Premium"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">SKU (Codigo)</Label>
              <Input
                id="code"
                placeholder="Ej: COCO-001"
                value={formData.code}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, code: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finished_product">Producto Terminado</SelectItem>
                  <SelectItem value="raw_material">Materia Prima</SelectItem>
                  <SelectItem value="supplies">Suministro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Precio de Compra (Bs.)</Label>
              <Input
                id="price"
                type="number"
                placeholder="0"
                value={formData.price}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, price: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="salePrice">Precio de Venta (Bs.)</Label>
              <Input
                id="salePrice"
                type="number"
                placeholder="0"
                value={formData.salePrice}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, salePrice: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="status">Estado del Producto</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo (Disponible para venta)</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
            <Label className="text-base font-semibold">Imagen del Producto (Opcional)</Label>

            <div>
              <Label htmlFor="fileInput" className="text-sm">
                Subir imagen desde archivo
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  ref={fileInputRef}
                  id="fileInput"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Maximo 5MB. Formatos: JPG, PNG, GIF, WebP. La carga empieza
                automaticamente al seleccionar el archivo.
              </p>
            </div>

            <div>
              <Label htmlFor="imageUrl" className="text-sm">
                O ingresa URL de imagen
              </Label>
              <Input
                id="imageUrl"
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={handleImageUrlChange}
                disabled={selectedFile !== null || isUploading}
              />
            </div>
          </div>

          {imagePreview && (
            <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Vista previa de imagen:</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRemoveImage}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <img
                src={imagePreview}
                alt="Preview"
                className="max-w-full h-40 object-cover rounded"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isUploading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createProductMutation.isPending || isUploading}
              className="flex-1"
            >
              {isUploading
                ? "Subiendo imagen..."
                : createProductMutation.isPending
                  ? "Guardando..."
                  : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
