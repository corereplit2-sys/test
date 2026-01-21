import { SafeUser } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  Calendar as CalendarIcon,
  Car,
  Gamepad2,
  Users,
  ChevronDown,
  TrendingUp,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { cn } from "@/lib/utils";

interface NavbarProps {
  user: SafeUser;
  pageTitle?: string;
}

export function Navbar({ user, pageTitle }: NavbarProps) {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      queryClient.invalidateQueries();
      setLocation("/login");
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to logout. Please try again.",
      });
    }
  };

  const soldierNavItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "My Currency", path: "/my-currency", icon: Car },
    { name: "My IPPT", path: "/ippt", icon: CalendarIcon },
    { name: "Forecast", path: "/forecast", icon: TrendingUp },
    { name: "Mess Booking", path: "/mess-booking", icon: Gamepad2 },
  ];

  const commanderNavItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    {
      name: "Currency",
      icon: Car,
      submenu: [
        { name: "My Currency", path: "/my-currency" },
        { name: "Currency Tracker", path: "/currency-tracker" },
      ],
    },
    { name: "IPPT Tracker", path: "/ippt-tracker", icon: CalendarIcon },
    { name: "Forecast", path: "/forecast", icon: TrendingUp },
    { name: "Mess Booking", path: "/mess-booking", icon: Gamepad2 },
  ];

  const adminNavItems = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    {
      name: "Currency",
      icon: Car,
      submenu: [
        { name: "Tracker", path: "/currency-tracker" },
        { name: "Drive QR", path: "/drive-qr" },
      ],
    },
    { name: "IPPT Tracker", path: "/ippt-tracker", icon: LayoutDashboard },
    { name: "Forecast", path: "/forecast", icon: TrendingUp },
    { name: "Mess Booking", path: "/mess-booking", icon: Gamepad2 },
    { name: "Users", path: "/users", icon: Users },
  ];

  const navItems =
    user.role === "admin"
      ? adminNavItems
      : user.role === "commander"
        ? commanderNavItems
        : soldierNavItems;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold" data-testid="text-app-title">
            MSC DRIVr v2
          </h1>
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const hasSubmenu = "submenu" in item && item.submenu;

              if (hasSubmenu) {
                return (
                  <DropdownMenu key={`${item.name}-${idx}`}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="gap-2"
                        data-testid={`nav-link-${item.name.toLowerCase().replace(/ /g, "-")}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {hasSubmenu &&
                        item.submenu!.map((subitem, subidx) => (
                          <DropdownMenuItem key={`${subitem.path}-${subidx}`} asChild>
                            <Link href={subitem.path}>
                              <span>{subitem.name}</span>
                            </Link>
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              // Only render as link if item has a path
              if (!("path" in item) || !item.path) {
                return null;
              }

              const isActive = location === item.path;
              const itemPath = item.path;
              const itemName = item.name;

              return (
                <Link key={`${itemPath}-${idx}`} href={itemPath}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn("gap-2", isActive && "bg-muted")}
                    data-testid={`nav-link-${itemName.toLowerCase().replace(/ /g, "-")}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{itemName}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2" data-testid="button-user-menu">
                <UserIcon className="w-5 h-5" />
                <span className="hidden md:inline">{user.fullName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium">{user.fullName}</div>
                  <div className="text-xs text-muted-foreground">@{user.username}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={user.role === "admin" ? "default" : "secondary"}
                      className={
                        user.role === "admin"
                          ? "bg-yellow-500 text-yellow-950"
                          : user.role === "commander"
                            ? "bg-purple-500 text-purple-950"
                            : "bg-blue-500 text-blue-950"
                      }
                      data-testid="badge-user-role"
                    >
                      {user.role === "admin"
                        ? "Admin"
                        : user.role === "commander"
                          ? "Commander"
                          : "Soldier"}
                    </Badge>
                    {user.role === "soldier" && (
                      <span
                        className="text-xs font-mono font-semibold"
                        data-testid="text-nav-credits"
                      >
                        {user.credits.toFixed(1)} Credits
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="md:hidden">
                {navItems.map((item, idx) => {
                  const Icon = item.icon;
                  const hasSubmenu = "submenu" in item && item.submenu;

                  if (hasSubmenu) {
                    return (
                      <div key={`${item.name}-${idx}`}>
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-muted-foreground">
                          <Icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </div>
                        {hasSubmenu &&
                          item.submenu!.map((subitem, subidx) => (
                            <DropdownMenuItem
                              key={`${subitem.path}-${subidx}`}
                              asChild
                              className="pl-8"
                            >
                              <Link href={subitem.path}>
                                <span>{subitem.name}</span>
                              </Link>
                            </DropdownMenuItem>
                          ))}
                      </div>
                    );
                  }

                  // Only render as link if item has a path
                  if (!("path" in item) || !item.path) {
                    return null;
                  }

                  const itemPath = item.path;
                  const itemName = item.name;

                  return (
                    <DropdownMenuItem key={`${itemPath}-${idx}`} asChild>
                      <Link href={itemPath}>
                        <div className="flex items-center gap-2 w-full">
                          <Icon className="w-4 h-4" />
                          <span>{itemName}</span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
              </div>
              <DropdownMenuItem asChild>
                <ChangePasswordDialog />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
