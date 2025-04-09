import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Inquiry {
  id: number;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

interface Endpoint {
  id: number;
  name: string;
  method: string;
  path: string;
  description: string;
  authRequired: boolean;
  isActive: boolean;
}

export default function Dashboard() {
  const { user } = useAuth();
  
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin",
  });

  const { data: inquiries, isLoading: isLoadingInquiries } = useQuery<Inquiry[]>({
    queryKey: ["/api/inquiries"],
    enabled: user?.role === "admin",
  });

  const { data: endpoints, isLoading: isLoadingEndpoints } = useQuery<Endpoint[]>({
    queryKey: ["/api/endpoints"],
    enabled: user?.role === "admin",
  });

  const isLoading = isLoadingUsers || isLoadingInquiries || isLoadingEndpoints;

  return (
    <div className="min-h-screen bg-dark-darker text-white flex flex-col">
      <AdminHeader />
      
      <div className="flex flex-1">
        <Sidebar activePage="dashboard" />
        
        <main className="flex-1 p-6">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <div>
                <button className="bg-dark-lighter hover:bg-opacity-80 px-3 py-2 rounded-md text-sm mr-2">
                  <i className="fas fa-sync-alt mr-1"></i> Refresh
                </button>
                <button className="bg-primary hover:bg-opacity-80 px-3 py-2 rounded-md text-sm">
                  <i className="fas fa-download mr-1"></i> Export Data
                </button>
              </div>
            </div>
            <p className="text-light-darker mt-1">Welcome back, {user?.name}! Here's what's happening with your backend services.</p>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="bg-dark border-dark-lighter">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-light-darker text-sm font-medium">Total Users</p>
                        <h3 className="text-3xl font-bold mt-2">{users ? users.length : 0}</h3>
                        <p className="flex items-center mt-2 text-accent text-xs">
                          <i className="fas fa-user-plus mr-1"></i>
                          <span>Active accounts</span>
                        </p>
                      </div>
                      <div className="rounded-full bg-primary/20 w-12 h-12 flex items-center justify-center">
                        <i className="fas fa-users text-primary"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-dark border-dark-lighter">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-light-darker text-sm font-medium">Active Sessions</p>
                        <h3 className="text-3xl font-bold mt-2">1</h3>
                        <p className="flex items-center mt-2 text-accent text-xs">
                          <i className="fas fa-arrow-up mr-1"></i>
                          <span>Your current session</span>
                        </p>
                      </div>
                      <div className="rounded-full bg-accent/20 w-12 h-12 flex items-center justify-center">
                        <i className="fas fa-bolt text-accent"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-dark border-dark-lighter">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-light-darker text-sm font-medium">API Endpoints</p>
                        <h3 className="text-3xl font-bold mt-2">{endpoints ? endpoints.length : 0}</h3>
                        <p className="flex items-center mt-2 text-accent text-xs">
                          <i className="fas fa-plug mr-1"></i>
                          <span>Active services</span>
                        </p>
                      </div>
                      <div className="rounded-full bg-warning/20 w-12 h-12 flex items-center justify-center">
                        <i className="fas fa-plug text-warning"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-dark border-dark-lighter">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-light-darker text-sm font-medium">New Inquiries</p>
                        <h3 className="text-3xl font-bold mt-2">
                          {inquiries 
                            ? inquiries.filter((i: Inquiry) => i.status === 'unread').length 
                            : 0}
                        </h3>
                        <p className="flex items-center mt-2 text-accent text-xs">
                          <i className="fas fa-envelope mr-1"></i>
                          <span>Unread messages</span>
                        </p>
                      </div>
                      <div className="rounded-full bg-danger/20 w-12 h-12 flex items-center justify-center">
                        <i className="fas fa-envelope text-danger"></i>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Recent Users */}
                <Card className="bg-dark border-dark-lighter lg:col-span-2">
                  <CardHeader className="border-b border-dark-lighter">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-semibold">Recent Users</CardTitle>
                      <a href="/admin/users" className="text-primary text-sm hover:underline">View All</a>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-dark-lighter">
                        <thead>
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">User</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Email</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Role</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-lighter">
                          {users && users.slice(0, 5).map((user: User) => (
                            <tr key={user.id} className="hover:bg-dark-lighter transition-colors">
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                                    <span className="text-xs">{user.name.substring(0, 2).toUpperCase()}</span>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium">{user.name}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="text-sm">{user.email}</div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="text-sm">{user.role}</div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm">
                                <div className="flex space-x-2">
                                  <button className="text-primary hover:text-primary/80" title="Edit"><i className="fas fa-edit"></i></button>
                                  {user.id !== 1 && (
                                    <button className="text-danger hover:text-danger/80" title="Delete"><i className="fas fa-trash"></i></button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          
                          {(!users || users.length === 0) && (
                            <tr>
                              <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-400">
                                No users found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Recent API Logs */}
                <Card className="bg-dark border-dark-lighter">
                  <CardHeader className="border-b border-dark-lighter">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-semibold">Recent Inquiries</CardTitle>
                      <a href="/admin/inquiries" className="text-primary text-sm hover:underline">View All</a>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {inquiries && inquiries.slice(0, 5).map((inquiry: Inquiry) => (
                        <div key={inquiry.id} className={`border-l-4 ${
                          inquiry.status === 'unread' ? 'border-danger' : 
                          inquiry.status === 'in-progress' ? 'border-warning' : 
                          'border-accent'
                        } pl-4 py-1`}>
                          <div className="flex justify-between">
                            <span className="text-xs text-light-darker">
                              {new Date(inquiry.createdAt).toLocaleDateString()} 
                              {' '}
                              {new Date(inquiry.createdAt).toLocaleTimeString()}
                            </span>
                            <span className={`text-xs ${
                              inquiry.status === 'unread' ? 'bg-danger/20 text-danger' : 
                              inquiry.status === 'in-progress' ? 'bg-warning/20 text-warning' : 
                              'bg-accent/20 text-accent'
                            } rounded-full px-2 py-0.5`}>
                              {inquiry.status}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{inquiry.subject}</p>
                          <p className="text-xs text-light-darker mt-1">From: {inquiry.name} ({inquiry.email})</p>
                        </div>
                      ))}
                      
                      {(!inquiries || inquiries.length === 0) && (
                        <div className="text-center py-10 text-gray-400">
                          <i className="fas fa-inbox text-4xl mb-3"></i>
                          <p>No inquiries yet</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </main>
      </div>
      
      {/* Footer */}
      <footer className="bg-dark py-6 border-t border-dark-lighter">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <p className="text-light-darker text-sm">© {new Date().getFullYear()} Tectonic Devs. All rights reserved.</p>
            </div>
            <div className="flex space-x-4">
              <a href="#" className="text-light-darker hover:text-primary transition-colors"><i className="fas fa-code"></i></a>
              <a href="#" className="text-light-darker hover:text-primary transition-colors"><i className="fas fa-server"></i></a>
              <a href="#" className="text-light-darker hover:text-primary transition-colors"><i className="fas fa-database"></i></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
