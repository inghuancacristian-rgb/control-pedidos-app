import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Link } from "wouter";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppHeader from "./components/AppHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import Inventory from "@/pages/Inventory";
import Tracking from "@/pages/Tracking";
import OrderDetail from "@/pages/OrderDetail";
import CreateOrder from "@/pages/CreateOrder";
import EditOrder from "@/pages/EditOrder";
import DeliveryPersons from "@/pages/DeliveryPersons";
import Suppliers from "@/pages/Suppliers";
import Purchases from "@/pages/Purchases";
import Finance from "@/pages/Finance";
import Products from "@/pages/Products";
import RepartidorFinance from "@/pages/RepartidorFinance";
import DeliveryLoad from "@/pages/DeliveryLoad";
import Sales from "@/pages/Sales";
import Customers from "@/pages/Customers";
import Reports from "@/pages/Reports";
import Expenses from "@/pages/Expenses";
import BottomTabBar from "./components/BottomTabBar";

function ProtectedRoute({ component: Component, adminOnly = false, ...rest }: any) {
  const { user } = useAuth();
  
  if (!user) return <Login />;
  
  if (adminOnly && user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Acceso Denegado</h2>
        <p className="text-muted-foreground mb-4">No tienes permisos para acceder a este módulo administrativo.</p>
        <Link href="/">
          <Button variant="outline">Volver al Inicio</Button>
        </Link>
      </div>
    );
  }

  return <Component {...rest} />;
}

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path={"/login"} component={Login} />
        <Route path={"/register"} component={Register} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <>
      <AppHeader />
      <BottomTabBar />
      <div className="pb-20 md:pb-0"> {/* Espacio para el menú móvil si fuera necesario */}
        <Switch>
          <Route path={"/"} component={Home} />
          <Route path="/dashboard">
            <ProtectedRoute component={Dashboard} adminOnly={true} />
          </Route>
          <Route path="/inventory">
            <ProtectedRoute component={Inventory} adminOnly={true} />
          </Route>
          <Route path="/delivery-persons">
            <ProtectedRoute component={DeliveryPersons} adminOnly={true} />
          </Route>
          <Route path="/suppliers">
            <ProtectedRoute component={Suppliers} adminOnly={true} />
          </Route>
          <Route path="/purchases">
            <ProtectedRoute component={Purchases} adminOnly={true} />
          </Route>
          <Route path="/products">
            <ProtectedRoute component={Products} adminOnly={true} />
          </Route>
          <Route path="/finance">
            <ProtectedRoute component={Finance} adminOnly={true} />
          </Route>
          <Route path="/sales">
            <ProtectedRoute component={Sales} />
          </Route>
          <Route path="/customers">
            <ProtectedRoute component={Customers} adminOnly={true} />
          </Route>
          <Route path="/reports">
            <ProtectedRoute component={Reports} adminOnly={true} />
          </Route>
          <Route path="/expenses">
            <ProtectedRoute component={Expenses} adminOnly={true} />
          </Route>
          <Route path={"/orders"} component={Orders} />
          <Route path={"/track/:orderId"} component={Tracking} />
          <Route path={"/order/:orderId"} component={OrderDetail} />
          <Route path={"/create-order"} component={CreateOrder} />
          <Route path={"/edit-order/:id"} component={EditOrder} />
          <Route path="/repartidor/finance" component={RepartidorFinance} />
          <Route path="/delivery-load" component={DeliveryLoad} />
          <Route path={"/404"} component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
