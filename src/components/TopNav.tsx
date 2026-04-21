import { Link, useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { TimerWidget } from "./TimerWidget";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function TopNav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const initials =
    user?.user_metadata?.full_name
      ?.split(" ")
      .map((s: string) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "Y";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="glass border-b border-border/40">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-xl gradient-bg shadow-button grid place-items-center text-primary-foreground font-display font-bold text-lg group-hover:scale-105 transition-smooth">
              D
            </div>
            <span className="font-display font-bold text-xl tracking-tight">
              <span className="gradient-text">DOM</span>inator
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <TimerWidget />
            <ThemeToggle />
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full ring-2 ring-transparent hover:ring-primary/40 transition-smooth">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.user_metadata?.avatar_url} alt="avatar" />
                      <AvatarFallback className="gradient-bg text-primary-foreground font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-strong w-56">
                  <DropdownMenuLabel className="truncate">
                    {user.user_metadata?.full_name ?? user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app")}>
                    <UserIcon className="mr-2 h-4 w-4" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
