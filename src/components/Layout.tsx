import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "./ui/button";
import { Footer } from "./Footer";
import { checkSessionExpiry, logout, getCurrentUser } from "@/pages/Auth";
import { toast } from "sonner";
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  Settings,
  Sun,
  Moon,
  ShoppingCart,
  RotateCcw,
  DollarSign,
  BookOpen,
  FolderOpen,
  StickyNote,
  FileStack,
  UserCheck,
  LogOut,
  Sparkles,
} from "lucide-react";
import { getCompanyProfile } from "@/lib/storage";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [company, setCompany] = useState<any>(null);
  const user = getCurrentUser();
  const permissions = user.role === 'admin' ? [] : (localStorage.getItem('userPermissions')?.split(',') || []);

  useEffect(() => {
    const loadCompany = async () => {
      const companyData = await getCompanyProfile();
      setCompany(companyData);
    };
    loadCompany();
  }, []);

  // Check session expiry periodically and auto-logout
  useEffect(() => {
    const checkSession = () => {
      if (!checkSessionExpiry()) {
        logout();
        toast.error("Your session has expired. Please login again.");
        navigate("/auth", { replace: true });
      }
    };
    // Check immediately
    checkSession();
    // Check every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  // Global scrollbar hiding styles (injected once)
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "scrollbar-hide-style";
    style.textContent = `
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `;
    document.head.appendChild(style);
    return () => {
      const existingStyle = document.getElementById("scrollbar-hide-style");
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  const allNavItems = [
    { path: "/", icon: LayoutDashboard, label: "Home" },
    { path: "/bills", icon: FileText, label: "Bills" },
    { path: "/sample-bill", icon: FileStack, label: "Sample" },
    { path: "/purchases", icon: ShoppingCart, label: "Buy" },
    { path: "/returns", icon: RotateCcw, label: "Returns" },
    { path: "/passbook", icon: BookOpen, label: "Passbook" },
    { path: "/expenses", icon: DollarSign, label: "Expenses" },
    { path: "/products", icon: Package, label: "Stock" },
    { path: "/clients", icon: Users, label: "Clients" },
    { path: "/files", icon: FolderOpen, label: "Files" },
    { path: "/notes", icon: StickyNote, label: "Notes" },
    { path: "/ai-agent", icon: Sparkles, label: "AI-Agent" },
    { path: "/bill-creators", icon: UserCheck, label: "Creators" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  const [navItems, setNavItems] = useState<any[]>([]);

  useEffect(() => {
    const savedOrder = localStorage.getItem('navItemOrder');
    const items = user.role === 'admin' 
      ? allNavItems 
      : allNavItems.filter(item => permissions.includes(item.path));
    
    if (savedOrder) {
      try {
        const order = JSON.parse(savedOrder);
        const orderedItems = order.map((path: string) => items.find(i => i.path === path)).filter(Boolean);
        // Add any new items that weren't in the saved order
        const newItems = items.filter(i => !order.includes(i.path));
        
        const finalItems = [...orderedItems, ...newItems];
        // Only update if the items have actually changed
        if (JSON.stringify(navItems.map(i => i.path)) !== JSON.stringify(finalItems.map(i => i.path))) {
          setNavItems(finalItems);
        }
      } catch (e) {
        setNavItems(items);
      }
    } else if (JSON.stringify(navItems.map(i => i.path)) !== JSON.stringify(items.map(i => i.path))) {
      setNavItems(items);
    }
  }, [user.role, permissions]);

  const moveItem = (index: number, direction: 'left' | 'right') => {
    const newItems = [...navItems];
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < newItems.length) {
      [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
      setNavItems(newItems);
      localStorage.setItem('navItemOrder', JSON.stringify(newItems.map(i => i.path)));
      toast.success("Navigation reordered");
    }
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden w-full md:min-h-screen md:overflow-x-hidden">
      {/* Top Header - Fixed */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-sm border-b border-border/50 z-50 flex items-center justify-between px-4 md:px-6 shadow-sm w-full">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {company?.logo && (
            <div className="flex-shrink-0">
              <img
                src={company.logo}
                alt="Company Logo"
                className="h-10 w-10 md:h-12 md:w-12 object-contain rounded-md shadow-sm border border-border/50 bg-card/50 p-1"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-lg md:text-xl text-foreground truncate leading-tight">
              {company?.name || "BillEasy"}
            </h1>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {user.name} ({user.role})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-lg h-9 w-9 md:h-10 md:w-10 flex-shrink-0 hover:bg-muted"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4 md:h-5 md:w-5" />
            ) : (
              <Sun className="h-4 w-4 md:h-5 md:w-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Logout"
            className="rounded-lg h-9 w-9 md:h-10 md:w-10 flex-shrink-0 hover:bg-muted text-destructive"
          >
            <LogOut className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>
      </header>
      {/* Main Content Area - Fixed height on mobile, scrollable */}
      <main
        className="overflow-y-auto overflow-x-hidden"
        style={{
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          position: "fixed",
          top: "4rem",
          bottom: "4rem",
          left: 0,
          right: 0,
          width: "100%",
        }}
      >
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto w-full py-4 sm:py-6 overflow-x-hidden">
          {children}
        </div>
      </main>
      {/* Footer */}
      {/* <Footer /> */}
      {/* Bottom Navigation - Scrollable on Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 shadow-2xl safe-area-inset-bottom w-full overflow-hidden">
        {/* Mobile: Horizontal Scrollable Nav */}
        <div className="md:hidden h-16 sm:h-18 w-full overflow-hidden">
          <div className="h-full flex overflow-x-auto scrollbar-hide py-2 px-2 sm:px-4 gap-1.5 sm:gap-2 snap-x snap-mandatory touch-pan-x"
            style={{ overscrollBehaviorX: "contain" }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <div
                  key={item.path}
                  className="relative group snap-center flex-shrink-0"
                  style={{ scrollSnapAlign: "center" }}
                >
                  <Link
                    to={item.path}
                    className={`
                        flex flex-col items-center justify-center
                        min-w-[72px] sm:min-w-[84px] px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl
                        transition-all duration-300 ease-out
                        shadow-sm backdrop-blur-sm
                        ${
                          active
                            ? "bg-primary text-primary-foreground shadow-lg scale-105 ring-2 ring-primary/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:scale-105 hover:shadow-md"
                        }
                      `}
                  >
                    <Icon
                      className={`h-5 w-5 sm:h-6 sm:w-6 mb-0.5 sm:mb-1 ${
                        active ? "drop-shadow-sm" : ""
                      }`}
                    />
                    <span className="text-[10px] sm:text-xs font-semibold leading-tight text-center px-0.5 sm:px-1">
                      {item.label}
                    </span>
                  </Link>
                  <div className="absolute -top-2 left-0 right-0 flex justify-between px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveItem(navItems.indexOf(item), 'left')} className="bg-background/80 rounded-full p-0.5 shadow-sm border border-border">
                      <LayoutDashboard className="h-3 w-3 rotate-180" />
                    </button>
                    <button onClick={() => moveItem(navItems.indexOf(item), 'right')} className="bg-background/80 rounded-full p-0.5 shadow-sm border border-border">
                      <LayoutDashboard className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Desktop/Tablet: Full Width Button Layout */}
        <div className="hidden md:block h-18">
          <div className="h-full max-w-[96%] mx-auto px-4 py-3">
            <div className="h-full flex items-center justify-between gap-3 lg:gap-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                        flex flex-col items-center justify-center
                        flex-1 px-3 py-2 rounded-xl
                        transition-all duration-300 ease-out
                        ${
                          active
                            ? "bg-primary text-primary-foreground shadow-lg scale-105 ring-2 ring-primary/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:scale-105 hover:shadow-md"
                        }
                      `}
                  >
                    <Icon
                      className={`h-5 w-5 mb-1 ${
                        active ? "drop-shadow-sm" : ""
                      }`}
                    />
                    <span className="text-xs font-semibold leading-tight text-center whitespace-nowrap">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
