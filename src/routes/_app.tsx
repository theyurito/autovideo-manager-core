import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import { Loader } from "@/components/states";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { isAuthenticated, email, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate({ to: "/login", replace: true });
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) {
    return <Loader label="Verificando acesso..." className="min-h-screen" />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <span className="truncate text-sm text-muted-foreground">{email}</span>
            <div className="ml-auto flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
                    {theme === "dark" ? <Sun /> : <Moon />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {theme === "dark" ? "Modo claro" : "Modo escuro"}
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  toast.success("Sessão encerrada");
                  navigate({ to: "/login", replace: true });
                }}
              >
                <LogOut /> Sair
              </Button>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
