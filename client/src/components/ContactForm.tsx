import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertInquirySchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

// Create a zod schema for the contact form based on the insertInquirySchema
const contactFormSchema = insertInquirySchema.extend({
  phone: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function ContactForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/contact/submit", data);
      
      toast({
        title: "Đã gửi thành công!",
        description: "Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.",
      });
      
      // Reset form
      form.reset();
      setIsSuccess(true);
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setIsSuccess(false);
      }, 5000);
    } catch (error) {
      let errorMessage = "Có lỗi xảy ra. Vui lòng thử lại sau.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Gửi thất bại",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-dark-lighter p-8 rounded-xl border border-white/10">
      {isSuccess ? (
        <div className="text-center py-8">
          <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-check text-accent text-2xl"></i>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Cảm ơn bạn!</h3>
          <p className="text-white/70">
            Thông tin của bạn đã được gửi thành công. Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.
          </p>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={() => setIsSuccess(false)}
          >
            Gửi tin nhắn khác
          </Button>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Họ và tên</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nguyễn Văn A" 
                        className="bg-dark border-white/10 text-white" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="example@example.com" 
                        className="bg-dark border-white/10 text-white" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Số điện thoại (không bắt buộc)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0123 456 789" 
                        className="bg-dark border-white/10 text-white" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Tiêu đề</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Tư vấn dịch vụ chatbot" 
                        className="bg-dark border-white/10 text-white" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Nội dung tin nhắn</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Mô tả chi tiết nhu cầu của bạn..." 
                      className="bg-dark border-white/10 text-white min-h-[150px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                "Gửi tin nhắn"
              )}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
