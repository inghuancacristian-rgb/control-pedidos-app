import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Search, Plus, Filter, Tag, ShoppingCart } from "lucide-react";
import { AddProductDialog } from "@/components/AddProductDialog";
import { EditProductDialog } from "@/components/EditProductDialog";
import { formatCurrency } from "@/lib/currency";

export default function Products() {
  const { user } = useAuth();
  const { data: products, isLoading, refetch } = trpc.inventory.listProducts.useQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Cargando productos...</p>
      </div>
    );
  }

  const filteredProducts = products?.filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }) || [];

  const categories = [
    { id: "all", label: "Todos" },
    { id: "finished_product", label: "Prod. Terminado" },
    { id: "raw_material", label: "Materia Prima" },
    { id: "supplies", label: "Insumos" },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 mb-20 md:mb-0">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Catálogo de Productos</h1>
            <p className="text-muted-foreground mt-1">Define y categoriza tus tipos de productos e insumos.</p>
          </div>
          {user?.role === "admin" && (
            <AddProductDialog onProductAdded={() => refetch()} />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nombre o código..." 
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={categoryFilter === cat.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategoryFilter(cat.id)}
                      className="whitespace-nowrap"
                    >
                      {cat.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product: any) => (
                  <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow border-muted">
                    <div className="aspect-video bg-muted relative group">
                      {product.imageUrl ? (
                        <img 
                          src={product.imageUrl} 
                          alt={product.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Package className="h-10 w-10 opacity-20" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                          {product.category === 'finished_product' ? '📦 Terminado' : 
                           product.category === 'raw_material' ? '🧪 Materia' : '🛠️ Insumo'}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-bold text-lg leading-none">{product.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">Cod: {product.code}</p>
                      </div>
                      
                      <div className="space-y-2 border-t pt-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Tag className="h-3 w-3" /> P. Compra:
                          </span>
                          <p className="font-mono font-bold text-blue-600">
                            {product.price ? formatCurrency(product.price) : "S/ P"}
                          </p>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" /> P. Venta:
                          </span>
                          <p className="font-mono font-bold text-green-600">
                            {product.salePrice ? formatCurrency(product.salePrice) : "S/ P"}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2">
                        {user?.role === "admin" && (
                          <EditProductDialog product={product} onProductUpdated={() => refetch()} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {filteredProducts.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto opacity-20 mb-4" />
                  <p className="text-muted-foreground">No se encontraron productos con estos criterios.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Resumen del Catálogo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm text-muted-foreground">Total Productos</span>
                  <span className="font-bold">{products?.length || 0}</span>
                </div>
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Distribución</p>
                  <div className="flex justify-between text-xs">
                    <span>Terminados</span>
                    <span>{products?.filter((p: any) => p.category === 'finished_product').length || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Materia Prima</span>
                    <span>{products?.filter((p: any) => p.category === 'raw_material').length || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Insumos</span>
                    <span>{products?.filter((p: any) => p.category === 'supplies').length || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Tag className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-blue-800">Tipos de Productos</h4>
                    <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                      Diferencia tus productos terminados de tus insumos para que el sistema descuente stock automáticamente al vender.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
