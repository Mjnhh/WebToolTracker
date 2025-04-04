import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { AdminHeader } from "@/components/AdminHeader";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function Inquiries() {
  const { toast } = useToast();
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { data: inquiries, isLoading } = useQuery({
    queryKey: ["/api/inquiries"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await apiRequest("PATCH", `/api/inquiries/${id}/status`, { status });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      toast({
        title: "Status updated",
        description: "The inquiry status has been updated successfully.",
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

  const deleteInquiryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/inquiries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      setDeleteModalOpen(false);
      toast({
        title: "Inquiry deleted",
        description: "The inquiry has been deleted successfully.",
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

  const handleStatusChange = (inquiryId: number, status: string) => {
    updateStatusMutation.mutate({ id: inquiryId, status });
  };

  const openViewModal = (inquiry: any) => {
    setSelectedInquiry(inquiry);
    setViewModalOpen(true);
  };

  const openDeleteModal = (inquiry: any) => {
    setSelectedInquiry(inquiry);
    setDeleteModalOpen(true);
  };

  const handleDeleteInquiry = () => {
    if (selectedInquiry) {
      deleteInquiryMutation.mutate(selectedInquiry.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread':
        return 'bg-danger/20 text-danger';
      case 'in-progress':
        return 'bg-warning/20 text-warning';
      case 'resolved':
        return 'bg-accent/20 text-accent';
      default:
        return 'bg-gray-500/20 text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-dark-darker text-white flex flex-col">
      <AdminHeader />
      
      <div className="flex flex-1">
        <Sidebar activePage="inquiries" />
        
        <main className="flex-1 p-6">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Contact Inquiries</h1>
              <div>
                <button 
                  className="bg-dark-lighter hover:bg-opacity-80 px-3 py-2 rounded-md text-sm mr-2"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] })}
                >
                  <i className="fas fa-sync-alt mr-1"></i> Refresh
                </button>
              </div>
            </div>
            <p className="text-light-darker mt-1">Manage and respond to customer inquiries from your contact form.</p>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="bg-dark rounded-lg shadow-lg border border-dark-lighter">
              <div className="p-6 border-b border-dark-lighter">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">All Inquiries</h2>
                </div>
              </div>
              <div className="p-6">
                {inquiries && inquiries.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-dark-lighter">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Name</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Email</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Subject</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-light-darker uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-lighter">
                        {inquiries.map((inquiry: any) => (
                          <tr key={inquiry.id} className="hover:bg-dark-lighter transition-colors">
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="text-sm">
                                {new Date(inquiry.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="text-sm">{inquiry.name}</div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="text-sm">{inquiry.email}</div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-sm truncate max-w-[200px]">{inquiry.subject}</div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <Select
                                value={inquiry.status}
                                onValueChange={(value) => handleStatusChange(inquiry.id, value)}
                              >
                                <SelectTrigger className={`w-[130px] h-7 text-xs ${getStatusColor(inquiry.status)}`}>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unread">Unread</SelectItem>
                                  <SelectItem value="in-progress">In Progress</SelectItem>
                                  <SelectItem value="resolved">Resolved</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm">
                              <div className="flex space-x-2">
                                <button 
                                  className="text-primary hover:text-primary/80" 
                                  title="View" 
                                  onClick={() => openViewModal(inquiry)}
                                >
                                  <i className="fas fa-eye"></i>
                                </button>
                                <button 
                                  className="text-danger hover:text-danger/80"
                                  title="Delete"
                                  onClick={() => openDeleteModal(inquiry)}
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <i className="fas fa-inbox text-5xl text-gray-400 mb-4"></i>
                    <h3 className="text-xl font-medium mb-2">No inquiries yet</h3>
                    <p className="text-gray-400">Contact form submissions will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* View Inquiry Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="bg-dark-lighter border-dark-lighter text-white">
          <DialogHeader>
            <DialogTitle>Inquiry Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              View the complete inquiry information
            </DialogDescription>
          </DialogHeader>
          
          {selectedInquiry && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 text-gray-400">Date:</div>
                <div className="col-span-3">
                  {new Date(selectedInquiry.createdAt).toLocaleDateString()}{' '}
                  {new Date(selectedInquiry.createdAt).toLocaleTimeString()}
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 text-gray-400">Name:</div>
                <div className="col-span-3">{selectedInquiry.name}</div>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 text-gray-400">Email:</div>
                <div className="col-span-3">{selectedInquiry.email}</div>
              </div>
              
              {selectedInquiry.phone && (
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-1 text-gray-400">Phone:</div>
                  <div className="col-span-3">{selectedInquiry.phone}</div>
                </div>
              )}
              
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 text-gray-400">Subject:</div>
                <div className="col-span-3">{selectedInquiry.subject}</div>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 text-gray-400">Status:</div>
                <div className="col-span-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(selectedInquiry.status)}`}>
                    {selectedInquiry.status}
                  </span>
                </div>
              </div>
              
              <div className="border-t border-dark pt-4">
                <div className="text-gray-400 mb-2">Message:</div>
                <div className="bg-dark p-4 rounded-md whitespace-pre-line">
                  {selectedInquiry.message}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewModalOpen(false)}>
              Close
            </Button>
            <Button 
              onClick={() => {
                handleStatusChange(selectedInquiry.id, 'resolved');
                setViewModalOpen(false);
              }}
            >
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-dark-lighter border-dark-lighter text-white">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete this inquiry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteInquiry} 
              disabled={deleteInquiryMutation.isPending}
            >
              {deleteInquiryMutation.isPending ? (
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
