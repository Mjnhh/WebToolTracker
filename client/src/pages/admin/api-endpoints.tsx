import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { AdminHeader } from "@/components/AdminHeader";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Switch } from "@/components/ui/switch";

const endpointSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  method: z.string(),
  path: z.string().min(1, "Path is required"),
  description: z.string().optional(),
  authRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

interface Endpoint {
  id: number;
  name: string;
  method: string;
  path: string;
  description: string;
  authRequired: boolean;
  isActive: boolean;
}

export default function ApiEndpoints() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const form = useForm<z.infer<typeof endpointSchema>>({
    resolver: zodResolver(endpointSchema),
    defaultValues: {
      name: "",
      method: "GET",
      path: "",
      description: "",
      authRequired: false,
      isActive: true,
    },
  });

  const { data: endpoints, isLoading, refetch } = useQuery<Endpoint[]>({
    queryKey: ["/api/endpoints"],
  });

  const createEndpointMutation = useMutation({
    mutationFn: async (data: z.infer<typeof endpointSchema>) => {
      const res = await apiRequest("POST", "/api/endpoints", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/endpoints"] });
      setModalOpen(false);
      form.reset();
      toast({
        title: "Endpoint created",
        description: "New API endpoint has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEndpointMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: z.infer<typeof endpointSchema> }) => {
      const res = await apiRequest("PATCH", `/api/endpoints/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/endpoints"] });
      setModalOpen(false);
      setCurrentEndpoint(null);
      toast({
        title: "Endpoint updated",
        description: "The API endpoint has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEndpointMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/endpoints/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/endpoints"] });
      setDeleteModalOpen(false);
      setCurrentEndpoint(null);
      toast({
        title: "Endpoint deleted",
        description: "The API endpoint has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentEndpoint(null);
    form.reset({
      name: "",
      method: "GET",
      path: "",
      description: "",
      authRequired: false,
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (endpoint: any) => {
    setIsEditing(true);
    setCurrentEndpoint(endpoint);
    form.reset({
      name: endpoint.name,
      method: endpoint.method,
      path: endpoint.path,
      description: endpoint.description || "",
      authRequired: endpoint.authRequired,
      isActive: endpoint.isActive,
    });
    setModalOpen(true);
  };

  const openDeleteModal = (endpoint: any) => {
    setCurrentEndpoint(endpoint);
    setDeleteModalOpen(true);
  };

  const onSubmit = (data: z.infer<typeof endpointSchema>) => {
    if (isEditing && currentEndpoint) {
      updateEndpointMutation.mutate({ id: currentEndpoint.id, data });
    } else {
      createEndpointMutation.mutate(data);
    }
  };

  const handleDeleteEndpoint = () => {
    if (currentEndpoint) {
      deleteEndpointMutation.mutate(currentEndpoint.id);
    }
  };

  return (
    <div className="min-h-screen bg-dark-darker text-white flex flex-col">
      <AdminHeader />
      
      <div className="flex flex-1">
        <Sidebar activePage="api-endpoints" />
        
        <main className="flex-1 p-6">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">API Endpoints</h1>
              <div>
                <button 
                  className="bg-dark-lighter hover:bg-opacity-80 px-3 py-2 rounded-md text-sm mr-2"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/endpoints"] })}
                >
                  <i className="fas fa-sync-alt mr-1"></i> Refresh
                </button>
                <button 
                  className="bg-primary hover:bg-opacity-80 px-3 py-2 rounded-md text-sm"
                  onClick={openAddModal}
                >
                  <i className="fas fa-plus mr-1"></i> Add Endpoint
                </button>
              </div>
            </div>
            <p className="text-light-darker mt-1">Manage your backend API endpoints and their configurations.</p>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="bg-dark rounded-lg shadow-lg border border-dark-lighter">
              <div className="p-6 border-b border-dark-lighter">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">All API Endpoints</h2>
                </div>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-dark-lighter">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Method</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Path</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Auth Required</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-lighter">
                      {endpoints && endpoints.map((endpoint: Endpoint) => (
                        <tr key={endpoint.id} className="hover:bg-dark-lighter transition-colors">
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium">{endpoint.name}</div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              endpoint.method === 'GET' ? 'bg-accent/20 text-accent' :
                              endpoint.method === 'POST' ? 'bg-primary/20 text-primary' :
                              endpoint.method === 'PUT' ? 'bg-warning/20 text-warning' :
                              'bg-danger/20 text-danger'
                            }`}>
                              {endpoint.method}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-sm font-mono">{endpoint.path}</div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="text-sm">{endpoint.authRequired ? "Yes" : "No"}</div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              endpoint.isActive ? 'bg-accent/20 text-accent' : 'bg-danger/20 text-danger'
                            }`}>
                              {endpoint.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm">
                            <div className="flex space-x-2">
                              <button 
                                className="text-primary hover:text-primary/80" 
                                title="Edit"
                                onClick={() => openEditModal(endpoint)}
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button className="text-warning hover:text-warning/80" title="Test">
                                <i className="fas fa-vial"></i>
                              </button>
                              <button 
                                className="text-danger hover:text-danger/80" 
                                title="Delete"
                                onClick={() => openDeleteModal(endpoint)}
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      
                      {(!endpoints || endpoints.length === 0) && (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">
                            No endpoints defined. Click "Add Endpoint" to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Endpoint Form Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-dark-lighter border-dark-lighter text-white">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Endpoint" : "Add New Endpoint"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {isEditing 
                ? "Update the details of your API endpoint" 
                : "Fill out the details to create a new API endpoint"}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endpoint Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="User Authentication" 
                        className="bg-dark border-dark-lighter text-white"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-dark border-dark-lighter text-white">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-dark-lighter border-dark-lighter text-white">
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="authRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-dark p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Authentication Required</FormLabel>
                        <FormDescription className="text-xs text-gray-400">
                          Is this endpoint protected?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="path"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Path</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="/api/auth/login" 
                        className="bg-dark border-dark-lighter text-white"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe this endpoint and its purpose" 
                        className="bg-dark border-dark-lighter text-white h-20 resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-dark p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Status</FormLabel>
                      <FormDescription className="text-xs text-gray-400">
                        Is this endpoint active?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createEndpointMutation.isPending || updateEndpointMutation.isPending}
                >
                  {(createEndpointMutation.isPending || updateEndpointMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                      {isEditing ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    isEditing ? "Update Endpoint" : "Create Endpoint"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-dark-lighter border-dark-lighter text-white">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete the endpoint "{currentEndpoint?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteEndpoint}
              disabled={deleteEndpointMutation.isPending}
            >
              {deleteEndpointMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
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
