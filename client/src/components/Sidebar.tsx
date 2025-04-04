import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type SidebarProps = {
  activePage?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ 
  activePage = "dashboard",
  isMobileOpen = false,
  onMobileClose
}: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Mock data for system stats - would be replaced with real data in production
  const memoryUsage = 64;
  const cpuLoad = 28;
  const storageUsage = 82;

  const getIsActive = (path: string) => {
    if (activePage) {
      return activePage === path;
    }
    return location.includes(path);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed md:sticky top-0 md:top-16 z-50 md:z-0",
        "w-[280px] md:w-64 bg-dark h-screen md:h-[calc(100vh-4rem)]",
        "transition-transform duration-300 shadow-lg",
        "transform md:transform-none",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Mobile Close Button */}
        <button
          onClick={onMobileClose}
          className="md:hidden absolute right-4 top-4 text-light-darker hover:text-light p-2"
        >
          <i className="fas fa-times text-xl"></i>
        </button>

        <nav className="py-4 mt-12 md:mt-0">
          <ul className="space-y-1">
            <li>
              <Link href="/admin">
                <a className={cn(
                  "flex items-center px-6 md:px-4 py-3 text-sm",
                  getIsActive("dashboard") 
                    ? "bg-primary bg-opacity-20 border-l-4 border-primary" 
                    : "hover:bg-dark-lighter transition-colors"
                )}>
                  <i className="fas fa-tachometer-alt w-5 mr-3"></i>
                  <span>Dashboard</span>
                </a>
              </Link>
            </li>
            <li>
              <Link href="/admin/users">
                <a className={cn(
                  "flex items-center px-6 md:px-4 py-3 text-sm",
                  getIsActive("users") 
                    ? "bg-primary bg-opacity-20 border-l-4 border-primary" 
                    : "hover:bg-dark-lighter transition-colors"
                )}>
                  <i className="fas fa-users w-5 mr-3"></i>
                  <span>User Management</span>
                </a>
              </Link>
            </li>
            <li>
              <Link href="/admin/inquiries">
                <a className={cn(
                  "flex items-center px-6 md:px-4 py-3 text-sm",
                  getIsActive("inquiries") 
                    ? "bg-primary bg-opacity-20 border-l-4 border-primary" 
                    : "hover:bg-dark-lighter transition-colors"
                )}>
                  <i className="fas fa-envelope w-5 mr-3"></i>
                  <span>Contact Inquiries</span>
                  {user && (
                    <div className="ml-auto px-1.5 py-0.5 bg-danger rounded-full text-xs">
                      {/* This would be populated by actual backend data */}
                    </div>
                  )}
                </a>
              </Link>
            </li>
            <li>
              <Link href="/admin/api-endpoints">
                <a className={cn(
                  "flex items-center px-6 md:px-4 py-3 text-sm",
                  getIsActive("api-endpoints") 
                    ? "bg-primary bg-opacity-20 border-l-4 border-primary" 
                    : "hover:bg-dark-lighter transition-colors"
                )}>
                  <i className="fas fa-plug w-5 mr-3"></i>
                  <span>API Endpoints</span>
                </a>
              </Link>
            </li>
            <li>
              <Link href="/admin/logs">
                <a className={cn(
                  "flex items-center px-6 md:px-4 py-3 text-sm",
                  getIsActive("logs") 
                    ? "bg-primary bg-opacity-20 border-l-4 border-primary" 
                    : "hover:bg-dark-lighter transition-colors"
                )}>
                  <i className="fas fa-list w-5 mr-3"></i>
                  <span>Server Logs</span>
                </a>
              </Link>
            </li>
            <li>
              <Link href="/admin/settings">
                <a className={cn(
                  "flex items-center px-6 md:px-4 py-3 text-sm",
                  getIsActive("settings") 
                    ? "bg-primary bg-opacity-20 border-l-4 border-primary" 
                    : "hover:bg-dark-lighter transition-colors"
                )}>
                  <i className="fas fa-cog w-5 mr-3"></i>
                  <span>Settings</span>
                </a>
              </Link>
            </li>
            <li className={location.includes("/admin/support") ? "active" : ""}>
              <Link href="/admin/support">
                <a className={cn(
                  "flex items-center px-6 md:px-4 py-3 text-sm",
                  getIsActive("support") 
                    ? "bg-primary bg-opacity-20 border-l-4 border-primary" 
                    : "hover:bg-dark-lighter transition-colors"
                )}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 mr-3">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>Hỗ Trợ Trực Tuyến</span>
                </a>
              </Link>
            </li>
          </ul>
          
          <div className="border-t border-dark-lighter my-4"></div>
          
          <div className="px-6 md:px-4">
            <h3 className="text-xs uppercase text-light-darker tracking-wider mb-3">System Status</h3>
            <div className="space-y-3">
              <div className="text-xs">
                <div className="flex justify-between mb-1">
                  <span>Memory Usage</span>
                  <span className="text-light-darker">{memoryUsage}%</span>
                </div>
                <div className="h-1.5 w-full bg-dark-lighter rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full" 
                    style={{ width: `${memoryUsage}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="text-xs">
                <div className="flex justify-between mb-1">
                  <span>CPU Load</span>
                  <span className="text-light-darker">{cpuLoad}%</span>
                </div>
                <div className="h-1.5 w-full bg-dark-lighter rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent rounded-full" 
                    style={{ width: `${cpuLoad}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="text-xs">
                <div className="flex justify-between mb-1">
                  <span>Storage</span>
                  <span className="text-light-darker">{storageUsage}%</span>
                </div>
                <div className="h-1.5 w-full bg-dark-lighter rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-warning rounded-full" 
                    style={{ width: `${storageUsage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
