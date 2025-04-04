import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Settings, 
  LogOut,
  Bell,
  ChevronDown,
  Menu
} from "lucide-react";

type AdminHeaderProps = {
  onMobileMenuToggle?: (isOpen: boolean) => void;
  title?: string;
};

export function AdminHeader({ onMobileMenuToggle, title }: AdminHeaderProps) {
  const [, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
    setLocation("/auth");
  };
  
  const toggleMobileMenu = () => {
    const newState = !mobileMenuOpen;
    setMobileMenuOpen(newState);
    if (onMobileMenuToggle) {
      onMobileMenuToggle(newState);
    }
  };

  return (
    <header className="bg-dark sticky top-0 z-50 shadow-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="mr-2 md:hidden"
              onClick={toggleMobileMenu}
            >
              <Menu className="h-6 w-6" />
            </Button>
            
            <Link href="/">
              <a className="flex items-center">
                <div className="h-12 w-12 md:h-16 md:w-16 mr-3 transition-transform duration-300 hover:scale-105">
                  <div className="rounded-full bg-primary p-2 h-full flex items-center justify-center">
                    <i className="fas fa-code text-white text-xl md:text-2xl"></i>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-primary to-accent text-transparent bg-clip-text">
                    Tech Style Admin
                  </span>
                  {title && <span className="text-sm text-white/70">{title}</span>}
                </div>
              </a>
            </Link>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="hidden md:flex items-center space-x-4">
              <div className="bg-dark-lighter px-3 py-1 rounded-full text-sm flex items-center">
                <div className="h-2 w-2 rounded-full bg-accent mr-2 animate-pulse"></div>
                <span>Server Status: Online</span>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-danger flex items-center justify-center text-[10px]">
                      {/* This would be populated by real data */}
                      3
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-dark-lighter border-dark-lighter text-white">
                  <DropdownMenuItem className="cursor-pointer">
                    <span className="font-medium text-sm">New contact inquiry</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <span className="font-medium text-sm">New user registration</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <span className="font-medium text-sm">System update available</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 bg-dark-lighter rounded-full py-1 px-2 md:px-3 hover:bg-opacity-80 transition-all">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="hidden md:inline">{user?.name || "Admin"}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-dark-lighter border-dark-lighter text-white">
                <DropdownMenuItem className="cursor-pointer" onClick={() => setLocation("/admin/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setLocation("/admin/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-dark" />
                <DropdownMenuItem className="cursor-pointer text-danger hover:text-danger/80" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
