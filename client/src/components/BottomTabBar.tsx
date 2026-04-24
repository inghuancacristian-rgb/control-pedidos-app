import { Home, ShoppingCart, ShoppingBag, PlusCircle } from "lucide-react";
import { Link, useLocation } from "wouter";

interface TabItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function BottomTabBar() {
  const [location] = useLocation();

  const tabs: TabItem[] = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/orders", label: "Pedidos", icon: ShoppingCart },
    { href: "/sales", label: "Ventas", icon: ShoppingBag },
    { href: "/create-order", label: "Crear", icon: PlusCircle },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border/50"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          const isCreate = tab.href === "/create-order";

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] px-3 py-2 rounded-xl transition-all ${
                active
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              } ${isCreate ? "text-primary" : ""}`}
            >
              <Icon
                className={`h-5 w-5 ${isCreate ? "h-6 w-6" : ""} ${
                  active ? "scale-110" : ""
                } transition-transform`}
              />
              <span className={`text-[10px] font-medium ${isCreate ? "font-semibold" : ""}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
