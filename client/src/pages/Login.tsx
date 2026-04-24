import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.loginTraditional.useMutation({
    onSuccess: async () => {
      toast.success("Sesion iniciada correctamente");
      await utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al iniciar sesion");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error("Por favor ingresa tu usuario");
      return;
    }

    if (!password.trim()) {
      toast.error("Por favor ingresa tu contrasena");
      return;
    }

    await loginMutation.mutateAsync({ username, password });
  };

  return (
    <div className="page-shell flex items-center justify-center p-4">
      <div className="page-container w-full max-w-md mx-auto">
        <Card className="overflow-hidden border-white/70">
          <CardHeader className="space-y-3 border-b border-border/70 bg-white/65 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[linear-gradient(135deg,#1f3351,#36506f)] shadow-[0_20px_32px_-18px_rgba(31,51,81,0.72)]">
                <span className="text-base font-extrabold tracking-[0.24em] text-white">CP</span>
              </div>
              <CardTitle className="text-3xl font-extrabold text-slate-900">Control de Pedidos</CardTitle>
              <p className="text-sm text-muted-foreground">Inicia sesion para continuar con tu jornada.</p>
            </CardHeader>

            <CardContent className="space-y-6 p-6 sm:p-7">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Ingresa tu usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loginMutation.isPending}
                    autoComplete="username"
                    className="h-11 rounded-xl border-white/70 bg-white/85"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contrasena</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Ingresa tu contrasena"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loginMutation.isPending}
                      autoComplete="current-password"
                      className="h-11 rounded-xl border-white/70 bg-white/85 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      disabled={loginMutation.isPending}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="h-11 w-full" disabled={loginMutation.isPending} size="lg">
                  {loginMutation.isPending ? "Ingresando..." : "Iniciar sesion"}
                </Button>
              </form>

              <div className="rounded-[1.3rem] border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4" />
                  Credenciales de administracion
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CredentialPill label="Usuario" value="admin" />
                  <CredentialPill label="Contrasena" value="admin123" />
                </div>
              </div>
            </CardContent>

            <CardFooter className="justify-center border-t border-border/70 bg-slate-50/70 px-6 py-5 text-center">
              <p className="text-sm text-muted-foreground">
                No tienes cuenta?{" "}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  Registrate aqui
                </Link>
              </p>
            </CardFooter>
          </Card>
      </div>
    </div>
  );
}

function CredentialPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/70 bg-white/85 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <code className="mt-1 block text-sm font-bold text-slate-900">{value}</code>
    </div>
  );
}
