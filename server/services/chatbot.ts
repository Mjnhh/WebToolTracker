import { ChatSession, ChatMessage } from '../types';
import natural from 'natural';
import { IStorage } from '../storage';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const tokenizer = new natural.WordTokenizer();
const classifier = new natural.BayesClassifier();

// Define main intents
type Intent = 
  'greeting' | 
  'farewell' | 
  'question' | 
  'service_inquiry' | 
  'support' | 
  'unknown' | 
  'pricing' |
  'chatbot_info' |
  'web_automation' |
  'software_dev' |
  'portfolio' |
  'company_info' |
  'contact' |
  'location' |
  'business_hours' |
  'demo_request' |
  'integration' |
  'timeline' |
  'testimonials' |
  'technology' |
  'maintenance' |
  'security' |
  'api' |
  'team' |
  'hiring' |
  'partnership' |
  'feedback' |
  'human_support';

interface ConversationContext {
  intent: Intent;
  topic: string;
  entities: Record<string, any>;
  confidence: number;
  previousMessages: ChatMessage[];
  requiresHumanSupport: boolean;
}

export class ChatbotService {
  private storage: IStorage;
  private contexts: Map<string, ConversationContext>;
  private readonly MAX_CONTEXT_MESSAGES = 5;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.contexts = new Map();
    // Tạo mới classifier mỗi khi khởi tạo
    this.initializeClassifier();
  }

  /**
   * Huấn luyện lại classifier với các dữ liệu mới
   */
  public async retrainClassifier(): Promise<void> {
    // Đảm bảo classifier được huấn luyện lại
    classifier.retrain();
    console.log('Classifier retrained successfully');
  }

  private async initializeClassifier() {
    // Basic greetings
    classifier.addDocument('xin chào', 'greeting');
    classifier.addDocument('chào bạn', 'greeting');
    classifier.addDocument('hi', 'greeting');
    classifier.addDocument('hello', 'greeting');

    // Basic farewells
    classifier.addDocument('tạm biệt', 'farewell');
    classifier.addDocument('goodbye', 'farewell');
    classifier.addDocument('bye', 'farewell');
    
    // Basic questions
    classifier.addDocument('bạn có thể giúp tôi không', 'question');
    classifier.addDocument('tôi cần hỗ trợ', 'question');
    classifier.addDocument('tôi muốn hỏi', 'question');

    // Human support requests - thêm intent mới
    classifier.addDocument('tôi muốn nói chuyện với nhân viên', 'human_support');
    classifier.addDocument('kết nối với nhân viên', 'human_support');
    classifier.addDocument('gặp nhân viên', 'human_support');
    classifier.addDocument('nói chuyện với người thật', 'human_support');
    classifier.addDocument('cần gặp tư vấn viên', 'human_support');
    classifier.addDocument('tôi muốn gặp người hỗ trợ', 'human_support');
    classifier.addDocument('không muốn nói chuyện với bot', 'human_support');
    classifier.addDocument('chuyển cho nhân viên', 'human_support');

    classifier.train();
  }

  private async analyzeMessage(message: string): Promise<{
    intent: Intent;
    topic: string;
    entities: Record<string, any>;
    confidence: number;
  }> {
    const lowercaseMessage = message.toLowerCase();
    
    // Xử lý đặc biệt cho các từ khóa cụ thể về business_hours
    if (lowercaseMessage.includes('thời gian làm việc') || 
        lowercaseMessage.includes('thoi gian lam viec') ||
        lowercaseMessage.includes('giờ làm việc') ||
        lowercaseMessage.includes('gio lam viec') ||
        lowercaseMessage.includes('mở cửa') ||
        lowercaseMessage.includes('mo cua') ||
        lowercaseMessage.includes('làm việc giờ nào') ||
        lowercaseMessage.includes('khi nào làm việc')) {
      return {
        intent: 'business_hours',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }
    
    // Xử lý đặc biệt cho human_support
    if (lowercaseMessage.includes('gặp nhân viên') ||
        lowercaseMessage.includes('nói chuyện với người') ||
        lowercaseMessage.includes('kết nối với nhân viên') ||
        lowercaseMessage.includes('cần tư vấn') ||
        lowercaseMessage.includes('hỗ trợ trực tiếp') ||
        lowercaseMessage.includes('gặp người thật') ||
        lowercaseMessage.includes('không muốn nói chuyện với bot')) {
      return {
        intent: 'human_support',
        topic: '',
        entities: {},
        confidence: 0.95
      };
    }
    
    // Xử lý đặc biệt cho timeline
    if (lowercaseMessage.includes('thời gian') || 
        lowercaseMessage.includes('thoi gian') ||
        lowercaseMessage.includes('bao lâu') || 
        lowercaseMessage.includes('bao lau') || 
        lowercaseMessage.includes('khi nào') || 
        lowercaseMessage.includes('khi nao') ||
        lowercaseMessage.includes('mất thời gian') ||
        lowercaseMessage.includes('hoàn thành trong')) {
      return {
        intent: 'timeline',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }

    // Xử lý đặc biệt cho pricing
    if (lowercaseMessage.includes('giá') ||
        lowercaseMessage.includes('chi phí') ||
        lowercaseMessage.includes('bao nhiêu tiền') ||
        lowercaseMessage.includes('tốn bao nhiêu') ||
        lowercaseMessage.includes('báo giá') ||
        lowercaseMessage.includes('học phí')) {
      return {
        intent: 'pricing',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }
    
    // Xử lý đặc biệt cho api
    if (lowercaseMessage.includes('api') ||
        lowercaseMessage.includes('tích hợp') ||
        lowercaseMessage.includes('kết nối hệ thống') ||
        lowercaseMessage.includes('web service') ||
        lowercaseMessage.includes('integraton') ||
        lowercaseMessage.includes('webhook')) {
      return {
        intent: 'api',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }

    // Xử lý đặc biệt cho security
    if (lowercaseMessage.includes('bảo mật') ||
        lowercaseMessage.includes('an toàn') ||
        lowercaseMessage.includes('security') ||
        lowercaseMessage.includes('ssl') ||
        lowercaseMessage.includes('mã hóa') ||
        lowercaseMessage.includes('hack') ||
        lowercaseMessage.includes('lộ thông tin')) {
      return {
        intent: 'security',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }

    // Xử lý đặc biệt cho chatbot_info
    if (lowercaseMessage.includes('chatbot') ||
        lowercaseMessage.includes('bot') ||
        lowercaseMessage.includes('trợ lý ảo') ||
        lowercaseMessage.includes('ai') ||
        lowercaseMessage.includes('trí tuệ nhân tạo')) {
      return {
        intent: 'chatbot_info',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }

    // Xử lý đặc biệt cho web_automation
    if (lowercaseMessage.includes('tự động hóa') ||
        lowercaseMessage.includes('automation') ||
        lowercaseMessage.includes('tự động hóa web') ||
        lowercaseMessage.includes('làm tự động') ||
        lowercaseMessage.includes('robot')) {
      return {
        intent: 'web_automation',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }

    // Xử lý đặc biệt cho software_dev
    if (lowercaseMessage.includes('phát triển phần mềm') ||
        lowercaseMessage.includes('phát triển web') ||
        lowercaseMessage.includes('lập trình') ||
        lowercaseMessage.includes('develop') ||
        lowercaseMessage.includes('software') ||
        lowercaseMessage.includes('thiết kế phần mềm') ||
        lowercaseMessage.includes('mobile app') ||
        lowercaseMessage.includes('website')) {
      return {
        intent: 'software_dev',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }

    // Xử lý đặc biệt cho maintenance
    if (lowercaseMessage.includes('bảo trì') ||
        lowercaseMessage.includes('bảo dưỡng') ||
        lowercaseMessage.includes('maintenance') ||
        lowercaseMessage.includes('cập nhật') ||
        lowercaseMessage.includes('nâng cấp') ||
        lowercaseMessage.includes('sửa lỗi')) {
      return {
        intent: 'maintenance',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }

    // Xử lý đặc biệt cho greeting
    if (lowercaseMessage.includes('chào') ||
        lowercaseMessage.includes('xin chào') ||
        lowercaseMessage.includes('hello') ||
        lowercaseMessage.includes('hi') ||
        lowercaseMessage.includes('hey') ||
        lowercaseMessage.match(/^(chao|hi|hello)$/) ||
        lowercaseMessage.includes('good morning') ||
        lowercaseMessage.includes('good afternoon')) {
      return {
        intent: 'greeting',
        topic: '',
        entities: {},
        confidence: 0.95
      };
    }

    // Xử lý đặc biệt cho farewell
    if (lowercaseMessage.includes('tạm biệt') ||
        lowercaseMessage.includes('chào tạm biệt') ||
        lowercaseMessage.includes('bye') ||
        lowercaseMessage.includes('goodbye') ||
        lowercaseMessage.includes('hẹn gặp lại') ||
        lowercaseMessage.includes('gặp lại sau') ||
        lowercaseMessage.includes('see you')) {
      return {
        intent: 'farewell',
        topic: '',
        entities: {},
        confidence: 0.95
      };
    }

    // Xử lý đặc biệt cho company_info
    if (lowercaseMessage.includes('công ty') ||
        lowercaseMessage.includes('doanh nghiệp') ||
        lowercaseMessage.includes('tổ chức') ||
        lowercaseMessage.includes('thành lập') ||
        lowercaseMessage.includes('lịch sử công ty') ||
        lowercaseMessage.includes('về công ty') ||
        lowercaseMessage.includes('giới thiệu')) {
      return {
        intent: 'company_info',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }

    // Xử lý đặc biệt cho contact
    if (lowercaseMessage.includes('liên hệ') ||
        lowercaseMessage.includes('liên lạc') ||
        lowercaseMessage.includes('đường dây nóng') ||
        lowercaseMessage.includes('hotline') ||
        lowercaseMessage.includes('email') ||
        lowercaseMessage.includes('số điện thoại') ||
        lowercaseMessage.includes('gọi điện')) {
      return {
        intent: 'contact',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }

    // Xử lý đặc biệt cho location
    if (lowercaseMessage.includes('địa chỉ') ||
        lowercaseMessage.includes('văn phòng') ||
        lowercaseMessage.includes('trụ sở') ||
        lowercaseMessage.includes('chi nhánh') ||
        lowercaseMessage.includes('ở đâu') ||
        lowercaseMessage.includes('location')) {
      return {
        intent: 'location',
        topic: '',
        entities: {},
        confidence: 0.9
      };
    }

    // Xử lý đặc biệt cho question
    if (lowercaseMessage.includes('?') || 
        lowercaseMessage.startsWith('ai ') ||
        lowercaseMessage.startsWith('ở đâu ') ||
        lowercaseMessage.startsWith('tại sao ') ||
        lowercaseMessage.startsWith('làm sao ') ||
        lowercaseMessage.startsWith('làm thế nào ') ||
        lowercaseMessage.startsWith('có phải ') ||
        lowercaseMessage.startsWith('bạn có ') ||
        lowercaseMessage.includes('tôi muốn hỏi') ||
        lowercaseMessage.includes('cho tôi biết')) {
      return {
        intent: 'question',
        topic: '',
        entities: {},
        confidence: 0.85
      };
    }

    // Basic intent classification
    const classification = classifier.getClassifications(message);
    const topClassification = classification[0];
    
    // Log để debug chi tiết hơn
    console.log('Message:', message);
    console.log('Lowercase Message:', lowercaseMessage);
    console.log('Classifications (top 5):', JSON.stringify(classification.slice(0, 5), null, 2));
    console.log('Top classification:', topClassification ? `${topClassification.label} (${topClassification.value})` : 'none');
    
    // Giảm ngưỡng xuống 0.005 để dễ match hơn nữa
    const threshold = 0.005;
    return {
      intent: (topClassification && topClassification.value > threshold) 
        ? topClassification.label as Intent 
        : 'unknown',
      topic: '',
      entities: {},
      confidence: topClassification ? topClassification.value : 0
    };
  }

  private getBasicResponse(intent: Intent): string {
    // Get random response from response pool
    return this.getRandomResponse(intent);
  }

  private getRandomResponse(intent: Intent): string {
    const responses = this.getResponsesByIntent(intent);
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
  }

  private getResponsesByIntent(intent: Intent): string[] {
    switch (intent) {
      case 'greeting':
        return [
          '👋 Xin chào! Tôi là trợ lý ảo của TectonicDevs. Tôi có thể giúp bạn tìm hiểu về dịch vụ phát triển website, chatbot thông minh và các giải pháp công nghệ của chúng tôi. Bạn cần hỗ trợ gì?',
          'Chào bạn! Rất vui được gặp bạn. Tôi là chatbot của TectonicDevs, sẵn sàng hỗ trợ bạn tìm hiểu về các dịch vụ phát triển website, ứng dụng và các công cụ tự động hóa của chúng tôi.',
          'Xin chào quý khách! Tôi là trợ lý ảo của TectonicDevs. Tôi có thể giúp bạn tìm hiểu về các dịch vụ của chúng tôi hoặc giải đáp thắc mắc. Bạn cần hỗ trợ gì?',
          'Chào mừng bạn đến với TectonicDevs! Tôi là trợ lý ảo, sẵn sàng giúp bạn tìm hiểu về các dịch vụ phát triển website, chatbot AI và giải pháp công nghệ cho doanh nghiệp.',
          'Xin chào! Tôi là chatbot của TectonicDevs. Hôm nay tôi có thể giúp gì cho bạn về các dịch vụ công nghệ và phát triển phần mềm của chúng tôi?'
        ];
      
      case 'farewell':
        return [
          'Cảm ơn bạn đã liên hệ với chúng tôi. Hẹn gặp lại và chúc bạn một ngày tốt lành!',
          'Tạm biệt! Rất vui được trò chuyện với bạn. Nếu có thắc mắc gì thêm, đừng ngần ngại quay lại nhé!',
          'Chào tạm biệt và cảm ơn bạn đã ghé thăm TectonicDevs. Chúc bạn một ngày tuyệt vời!',
          'Rất vui được hỗ trợ bạn. Nếu cần thêm thông tin, hãy quay lại nhé. Tạm biệt!',
          'Cảm ơn bạn đã dành thời gian trò chuyện. Hẹn gặp lại bạn sớm nhé!'
        ];
      
      case 'question':
        return [
          'Vâng, tôi sẽ cố gắng trả lời câu hỏi của bạn. Bạn muốn biết thông tin gì về dịch vụ của chúng tôi?',
          'Tôi rất vui được giải đáp thắc mắc của bạn. Bạn muốn hỏi về vấn đề gì?',
          'Tôi đang lắng nghe và sẵn sàng trả lời câu hỏi của bạn. Bạn cần tìm hiểu điều gì?',
          'Tôi có thể giúp bạn trả lời nhiều câu hỏi về dịch vụ của chúng tôi. Bạn muốn biết về vấn đề gì?',
          'Đừng ngại đặt câu hỏi, tôi sẽ cố gắng giải đáp mọi thắc mắc của bạn về dịch vụ của TectonicDevs.'
        ];
      
      case 'chatbot_info':
        return [
          'Dịch vụ Chatbot thông minh của chúng tôi giúp doanh nghiệp tự động hóa giao tiếp với khách hàng 24/7. Chatbot có thể tích hợp AI để hiểu ngôn ngữ tự nhiên, trả lời câu hỏi thường gặp, hỗ trợ đặt hàng và chuyển tiếp đến nhân viên khi cần thiết.',
          'Chatbot thông minh của chúng tôi là giải pháp tương tác khách hàng tự động, giúp doanh nghiệp tiết kiệm 40% chi phí hỗ trợ. Chatbot có thể trả lời câu hỏi, hỗ trợ đặt hàng và thu thập thông tin khách hàng 24/7.',
          'Chúng tôi cung cấp dịch vụ Chatbot AI đa nền tảng, có thể tích hợp vào website, Facebook Messenger, Zalo, và nhiều kênh khác. Chatbot được huấn luyện để hiểu và trả lời các câu hỏi của khách hàng một cách tự nhiên và chính xác.',
          'Dịch vụ Chatbot thông minh của chúng tôi sử dụng các công nghệ AI tiên tiến để hiểu ý định của người dùng, trích xuất thông tin quan trọng và tạo ra các cuộc trò chuyện có ngữ cảnh. Chatbot hoạt động 24/7, giúp doanh nghiệp không bỏ lỡ bất kỳ cơ hội tương tác nào với khách hàng.',
          'Chatbot của chúng tôi không chỉ đơn thuần trả lời câu hỏi mà còn có thể thực hiện các tác vụ như đặt lịch hẹn, tạo đơn hàng, gửi thông báo và thu thập phản hồi. Chatbot tự động hóa các tương tác lặp đi lặp lại, giải phóng thời gian cho nhân viên tập trung vào các công việc có giá trị cao hơn.'
        ];
      
      case 'web_automation':
        return [
          'Dịch vụ Tự động hóa web giúp doanh nghiệp tiết kiệm thời gian và nhân lực bằng cách tự động hóa các tác vụ lặp đi lặp lại trên website như thu thập dữ liệu, xử lý form, gửi thông báo và báo cáo.',
          'Tự động hóa web của chúng tôi giúp doanh nghiệp tăng năng suất lên đến 80% cho các tác vụ lặp đi lặp lại. Chúng tôi tự động hóa việc nhập liệu, xử lý dữ liệu, gửi email, và các quy trình kinh doanh khác trên web.',
          'Dịch vụ Tự động hóa web giúp bạn tiết kiệm thời gian và giảm sai sót bằng cách tự động hóa các quy trình làm việc. Chúng tôi sử dụng các công nghệ RPA (Robotic Process Automation) để tạo ra các bot có thể thực hiện các tác vụ như con người.',
          'Giải pháp Tự động hóa web của chúng tôi có thể tự động thu thập dữ liệu từ nhiều nguồn, tạo báo cáo, gửi thông báo, và thực hiện các hành động dựa trên các sự kiện được xác định trước. Điều này giúp doanh nghiệp tiết kiệm hàng trăm giờ làm việc mỗi tháng.',
          'Tự động hóa web là giải pháp giúp doanh nghiệp vận hành hiệu quả hơn bằng cách tự động hóa các công việc lặp đi lặp lại. Chúng tôi sử dụng các công nghệ như Python, Node.js và các framework hiện đại để tạo ra các giải pháp tự động hóa riêng biệt cho từng doanh nghiệp.'
        ];
      
      case 'software_dev':
        return [
          'Chúng tôi cung cấp dịch vụ Phát triển phần mềm theo yêu cầu, từ ứng dụng web đến ứng dụng di động. Đội ngũ lập trình viên giàu kinh nghiệm của chúng tôi sử dụng các công nghệ tiên tiến để tạo ra sản phẩm chất lượng cao, đáp ứng đúng nhu cầu của khách hàng.',
          'Dịch vụ Phát triển phần mềm của chúng tôi bao gồm từ việc phân tích yêu cầu, thiết kế UI/UX, phát triển frontend và backend, đến kiểm thử và triển khai. Chúng tôi sử dụng quy trình Agile để đảm bảo sản phẩm đáp ứng đúng nhu cầu kinh doanh và người dùng.',
          'Đội ngũ phát triển phần mềm của chúng tôi có hơn 5 năm kinh nghiệm trong việc xây dựng các ứng dụng web, ứng dụng di động và phần mềm quản lý doanh nghiệp. Chúng tôi sử dụng các công nghệ hiện đại và bảo mật để tạo ra các giải pháp phần mềm ổn định, bảo mật và dễ mở rộng.',
          'Với dịch vụ Phát triển phần mềm của chúng tôi, bạn sẽ có được giải pháp tùy chỉnh hoàn toàn theo nhu cầu của doanh nghiệp. Chúng tôi cung cấp dịch vụ phát triển toàn diện từ lên ý tưởng, thiết kế, phát triển đến bảo trì và nâng cấp.',
          'Chúng tôi phát triển phần mềm theo phương pháp Agile, cho phép khách hàng tham gia vào quá trình phát triển và điều chỉnh yêu cầu linh hoạt. Điều này đảm bảo sản phẩm cuối cùng đáp ứng chính xác nhu cầu kinh doanh và mang lại trải nghiệm người dùng tốt nhất.'
        ];
      
      case 'pricing':
        return [
          'Giá dịch vụ của chúng tôi phụ thuộc vào quy mô và yêu cầu cụ thể của dự án. Chúng tôi cung cấp các gói dịch vụ linh hoạt phù hợp với ngân sách của bạn. Vui lòng liên hệ với chúng tôi để nhận báo giá chi tiết.',
          'Chúng tôi có nhiều gói dịch vụ với mức giá khác nhau phù hợp với quy mô doanh nghiệp. Gói Cơ bản bắt đầu từ 10 triệu đồng, gói Nâng cao từ 30 triệu đồng và gói Doanh nghiệp được tùy chỉnh theo yêu cầu. Hãy liên hệ để chúng tôi tư vấn gói phù hợp nhất cho bạn.',
          'Chi phí dịch vụ phụ thuộc vào độ phức tạp và phạm vi dự án. Chúng tôi làm việc với nhiều loại ngân sách và có thể đề xuất giải pháp phù hợp với khả năng tài chính của bạn. Vui lòng liên hệ để nhận báo giá miễn phí.',
          'Chúng tôi cung cấp báo giá miễn phí sau khi trao đổi chi tiết về nhu cầu của bạn. Điều này giúp chúng tôi đưa ra mức giá chính xác nhất. Chúng tôi cam kết mức giá cạnh tranh và minh bạch, không có phí ẩn.',
          'Giá dịch vụ của chúng tôi được tính dựa trên thời gian và độ phức tạp của dự án. Chúng tôi cung cấp các lựa chọn thanh toán linh hoạt, từ trả theo giai đoạn đến gói dịch vụ hàng tháng. Hãy liên hệ để nhận tư vấn miễn phí và báo giá chi tiết.'
        ];

      case 'unknown':
        return [
          'Xin lỗi, tôi chưa hiểu rõ yêu cầu của bạn. Bạn có thể hỏi về các chủ đề như: chatbot, tự động hóa web, phát triển phần mềm, giá cả, bảo mật hoặc hỗ trợ kỹ thuật?',
          'Tôi chưa hiểu rõ câu hỏi của bạn. Bạn có thể hỏi về dịch vụ chatbot, tự động hóa, lập trình web, hoặc cho tôi biết cụ thể bạn cần hỗ trợ gì?',
          'Không chắc tôi hiểu đúng ý của bạn. Bạn có thể hỏi về các dịch vụ của chúng tôi như chatbot AI, tự động hóa quy trình, phát triển phần mềm, hoặc báo giá dịch vụ?',
          'Tôi đang không chắc chắn về câu hỏi của bạn. Bạn có thể hỏi về: "Dịch vụ chatbot của bạn có gì?", "Chi phí làm website là bao nhiêu?", hoặc "Thời gian phát triển một ứng dụng là bao lâu?"',
          'Tôi chưa hiểu rõ yêu cầu của bạn. Bạn có thể cho tôi biết bạn cần tìm hiểu về dịch vụ nào? Chúng tôi có dịch vụ chatbot, phát triển phần mềm, tự động hóa web và nhiều dịch vụ khác.'
        ];
      
      case 'portfolio':
        return [
          'Chúng tôi đã thực hiện nhiều dự án cho các khách hàng trong các lĩnh vực thương mại điện tử, giáo dục, tài chính và dịch vụ. Bạn có thể xem chi tiết portfolio của chúng tôi tại trang web hoặc liên hệ để được gửi tài liệu.',
          'Portfolio của chúng tôi bao gồm nhiều dự án thành công như: Chatbot tư vấn cho ngân hàng, hệ thống tự động hóa cho doanh nghiệp thương mại điện tử, ứng dụng di động cho lĩnh vực giáo dục, và nhiều giải pháp phần mềm tùy chỉnh khác.',
          'Chúng tôi đã phát triển nhiều ứng dụng và giải pháp cho các khách hàng lớn trong nhiều lĩnh vực. Một số dự án tiêu biểu bao gồm chatbot hỗ trợ khách hàng 24/7, hệ thống tự động thu thập và phân tích dữ liệu thị trường, và ứng dụng quản lý doanh nghiệp toàn diện.',
          'Web Tool Tracker đã thực hiện hơn 50 dự án thành công cho khách hàng trong và ngoài nước. Bạn có thể tham khảo các case study chi tiết trên trang web của chúng tôi hoặc yêu cầu danh mục dự án qua email.',
          'Chúng tôi tự hào về các dự án đã thực hiện, từ chatbot AI phức tạp đến các hệ thống tự động hóa quy trình kinh doanh và ứng dụng di động. Mỗi dự án đều được thiết kế riêng để đáp ứng nhu cầu cụ thể của khách hàng.'
        ];
      
      case 'company_info':
        return [
          'TectonicDevs là công ty công nghệ chuyên cung cấp giải pháp chatbot thông minh, tự động hóa web và phát triển phần mềm. Chúng tôi thành lập từ năm 2018 với sứ mệnh giúp doanh nghiệp tận dụng công nghệ để tăng hiệu quả hoạt động.',
          'Công ty chúng tôi được thành lập vào năm 2018 bởi đội ngũ kỹ sư phần mềm có hơn 10 năm kinh nghiệm. Chúng tôi chuyên cung cấp các giải pháp công nghệ tiên tiến giúp doanh nghiệp tự động hóa quy trình, cải thiện trải nghiệm khách hàng và tối ưu hóa hoạt động.',
          'TectonicDevs là công ty công nghệ với hơn 20 chuyên gia trong lĩnh vực AI, phát triển phần mềm và tự động hóa. Sứ mệnh của chúng tôi là giúp doanh nghiệp chuyển đổi số hiệu quả với các giải pháp công nghệ tiên tiến.',
          'Chúng tôi là đội ngũ gồm các kỹ sư, nhà phát triển và chuyên gia AI với đam mê tạo ra các giải pháp công nghệ sáng tạo. TectonicDevs được thành lập với mục tiêu giúp các doanh nghiệp vừa và nhỏ tiếp cận với công nghệ tiên tiến với chi phí hợp lý.',
          'TectonicDevs là công ty công nghệ đặt tại Việt Nam, chuyên cung cấp các giải pháp kỹ thuật số. Với đội ngũ kỹ sư tài năng và tầm nhìn đổi mới, chúng tôi đã giúp nhiều doanh nghiệp triển khai thành công các giải pháp công nghệ từ chatbot AI đến hệ thống phần mềm tùy chỉnh.'
        ];
      
      case 'contact':
        return [
          'Bạn có thể liên hệ với chúng tôi qua email info@tectonicdevs.com, số điện thoại 0123.456.789 hoặc điền vào form liên hệ trên trang web của chúng tôi.',
          'Để liên hệ với đội ngũ hỗ trợ của chúng tôi, bạn có thể gọi đến số 0123.456.789, gửi email đến info@tectonicdevs.com, hoặc chat trực tiếp trên trang web của chúng tôi trong giờ làm việc.',
          'Phòng kinh doanh của chúng tôi luôn sẵn sàng hỗ trợ bạn qua số điện thoại 0123.456.789. Ngoài ra, bạn cũng có thể liên hệ qua form trên website, email hoặc các kênh mạng xã hội của chúng tôi.',
          'Bạn có thể liên hệ với chúng tôi qua nhiều kênh khác nhau: điền form liên hệ trên website, gửi email đến info@tectonicdevs.com, gọi số 0123.456.789, hoặc nhắn tin qua Zalo/Messenger. Chúng tôi sẽ phản hồi trong vòng 24 giờ.',
          'Để được tư vấn chi tiết, bạn có thể đặt lịch hẹn với chuyên gia của chúng tôi qua email info@tectonicdevs.com hoặc gọi điện đến số 0123.456.789. Chúng tôi luôn sẵn sàng hỗ trợ bạn.'
        ];
      
      case 'location':
        return [
          'Văn phòng của chúng tôi đặt tại Tầng 8, Tòa nhà ABC, Quận 1, TP.HCM, Việt Nam. Bạn có thể đến trực tiếp trong giờ làm việc.',
          'Trụ sở chính của TectonicDevs đặt tại Tầng 8, Tòa nhà ABC, số 123 Đường XYZ, Quận 1, TP.HCM. Chúng tôi cũng có văn phòng đại diện tại Hà Nội và Đà Nẵng.',
          'Văn phòng chúng tôi nằm ở vị trí trung tâm TP.HCM, tại Tầng 8, Tòa nhà ABC, Quận 1. Bạn có thể dễ dàng đến bằng nhiều phương tiện công cộng hoặc xe cá nhân.',
          'Văn phòng của TectonicDevs đặt tại Tầng 8, Tòa nhà ABC, Quận 1, TP.HCM. Khu vực có nhiều chỗ đỗ xe và thuận tiện di chuyển. Bạn có thể ghé thăm chúng tôi từ 8h30 đến 17h30 các ngày trong tuần.',
          'Chúng tôi có văn phòng tại Tầng 8, Tòa nhà ABC, Quận 1, TP.HCM. Nếu bạn muốn đến thăm, vui lòng đặt lịch hẹn trước qua email hoặc điện thoại để chúng tôi có thể phục vụ bạn tốt nhất.'
        ];
      
      case 'timeline':
        return [
          'Thời gian phát triển dự án phụ thuộc vào độ phức tạp và quy mô. Thông thường, một chatbot đơn giản có thể mất 2-4 tuần, trong khi một dự án phần mềm lớn có thể mất 3-6 tháng. Chúng tôi sẽ cung cấp lộ trình chi tiết sau khi phân tích yêu cầu của bạn.',
          'Lộ trình phát triển của chúng tôi được chia thành nhiều giai đoạn: Phân tích yêu cầu (1-2 tuần), Thiết kế (1-2 tuần), Phát triển (3-8 tuần), Kiểm thử (1-2 tuần) và Triển khai (1 tuần). Thời gian cụ thể sẽ phụ thuộc vào độ phức tạp của dự án của bạn.',
          'Đối với dự án chatbot thông minh, thời gian hoàn thành thường là 3-6 tuần. Đối với dự án tự động hóa web, thời gian là 4-8 tuần. Và đối với dự án phát triển phần mềm đầy đủ, thời gian có thể từ 8-24 tuần tùy theo quy mô và yêu cầu.',
          'Chúng tôi làm việc theo quy trình Agile với các sprint 2 tuần, giúp bạn thấy được kết quả cụ thể sau mỗi giai đoạn. Dự án nhỏ có thể hoàn thành trong 2-3 sprint, trong khi dự án lớn hơn có thể cần 6-12 sprint để hoàn thành.',
          'Thời gian triển khai phụ thuộc vào phạm vi và độ phức tạp của dự án. Chúng tôi có thể cung cấp bản MVP (Minimum Viable Product) trong vòng 4-6 tuần và tiếp tục phát triển các tính năng bổ sung trong các đợt cập nhật tiếp theo.'
        ];
      
      case 'technology':
        return [
          'Chúng tôi sử dụng nhiều công nghệ hiện đại như AI/ML cho chatbot, Python và Node.js cho tự động hóa, React/Angular/Vue cho frontend, cùng với các framework backend như Express, Django. Chúng tôi luôn cập nhật các công nghệ mới nhất để đảm bảo sản phẩm chất lượng cao.',
          'Đối với dự án chatbot, chúng tôi sử dụng các công nghệ NLP như TensorFlow, BERT, và các API của Google Dialogflow hoặc Microsoft Bot Framework. Đối với tự động hóa web, chúng tôi sử dụng Python với Selenium, Puppeteer hoặc Beautiful Soup. Cho phát triển phần mềm, chúng tôi sử dụng stack MERN (MongoDB, Express, React, Node.js) hoặc MEAN (MongoDB, Express, Angular, Node.js).',
          'Tech stack của chúng tôi bao gồm: Frontend (React, Vue.js, Angular), Backend (Node.js, Express, Django, Laravel), Database (MongoDB, PostgreSQL, MySQL), Cloud (AWS, Google Cloud, Azure), và các công nghệ AI/ML (TensorFlow, PyTorch, NLTK) tùy thuộc vào nhu cầu dự án.',
          'Chúng tôi luôn cập nhật và sử dụng các công nghệ tiên tiến nhất. Hiện tại, chúng tôi đang áp dụng các công nghệ như Kubernetes cho container orchestration, GraphQL cho API, NextJS cho server-side rendering, và các mô hình AI tiên tiến như GPT cho chatbot thông minh.',
          'Công nghệ chúng tôi sử dụng phụ thuộc vào yêu cầu cụ thể của dự án. Tuy nhiên, chúng tôi thường làm việc với JavaScript/TypeScript (Node.js, React, Vue), Python (Django, Flask, Scikit-learn), SQL và NoSQL databases, và các công nghệ cloud hiện đại. Chúng tôi luôn đảm bảo sử dụng các practices tốt nhất về bảo mật và hiệu suất.'
        ];
      
      case 'support':
        return [
          'Chúng tôi cung cấp hỗ trợ kỹ thuật 24/7 cho các vấn đề khẩn cấp và hỗ trợ trong giờ làm việc cho các vấn đề thông thường. Bạn có thể liên hệ qua email support@tectonicdevs.com hoặc hotline 0123.456.789.',
          'Đội ngũ hỗ trợ kỹ thuật của chúng tôi luôn sẵn sàng giải quyết mọi vấn đề. Chúng tôi cung cấp các gói hỗ trợ khác nhau: Basic (giờ hành chính), Premium (12 giờ/ngày), và Enterprise (24/7) tùy theo nhu cầu của doanh nghiệp.',
          'Chúng tôi cung cấp nhiều kênh hỗ trợ khác nhau: email, điện thoại, chat trực tiếp và hệ thống ticket. Thời gian phản hồi trung bình của chúng tôi là dưới 2 giờ trong giờ làm việc và dưới 8 giờ ngoài giờ làm việc cho các vấn đề khẩn cấp.',
          'Khi bạn sử dụng dịch vụ của chúng tôi, bạn sẽ nhận được hỗ trợ đầy đủ từ đội ngũ kỹ thuật chuyên nghiệp. Chúng tôi cung cấp hướng dẫn sử dụng chi tiết, hỗ trợ qua điện thoại/email, và dịch vụ bảo trì định kỳ để đảm bảo hệ thống của bạn luôn hoạt động ổn định.',
          'Dịch vụ hỗ trợ của chúng tôi bao gồm: tư vấn kỹ thuật, khắc phục sự cố, cập nhật phần mềm, hướng dẫn sử dụng và đào tạo người dùng. Tất cả các dự án đều được bảo hành tối thiểu 6 tháng và chúng tôi cung cấp các gói bảo trì dài hạn để đảm bảo hệ thống của bạn luôn hoạt động tốt.'
        ];
      
      case 'demo_request':
        return [
          'Chúng tôi rất vui được giới thiệu demo sản phẩm cho bạn. Vui lòng cung cấp thông tin liên hệ qua form trên trang web hoặc gọi điện để đặt lịch demo.',
          'Bạn có thể đăng ký xem demo trực tiếp hoặc online thông qua website của chúng tôi. Sau khi đăng ký, đội ngũ của chúng tôi sẽ liên hệ để sắp xếp thời gian phù hợp cho buổi demo.',
          'Chúng tôi cung cấp các buổi demo miễn phí để giới thiệu về các dịch vụ và giải pháp của chúng tôi. Buổi demo thường kéo dài 30-60 phút và bao gồm phần hỏi đáp. Vui lòng liên hệ với chúng tôi để đặt lịch.',
          'Để xem demo sản phẩm, bạn có thể đặt lịch qua email info@tectonicdevs.com hoặc gọi đến số 0123.456.789. Chúng tôi sẽ chuẩn bị một buổi demo phù hợp với nhu cầu cụ thể của doanh nghiệp bạn.',
          'Chúng tôi tổ chức các buổi demo sản phẩm hàng tuần vào thứ Ba và thứ Năm. Ngoài ra, bạn cũng có thể yêu cầu demo riêng theo lịch của bạn. Hãy liên hệ với chúng tôi để biết thêm chi tiết và đăng ký tham gia.'
        ];
      
      case 'security':
        return [
          'Bảo mật là ưu tiên hàng đầu của chúng tôi. Chúng tôi áp dụng các biện pháp bảo mật tiên tiến như mã hóa SSL, xác thực hai yếu tố, và tuân thủ các tiêu chuẩn bảo mật quốc tế để bảo vệ dữ liệu của khách hàng.',
          'Chúng tôi áp dụng cách tiếp cận bảo mật đa lớp để bảo vệ dữ liệu và hệ thống: mã hóa end-to-end, kiểm soát truy cập nghiêm ngặt, tường lửa và giám sát liên tục. Chúng tôi cũng tiến hành kiểm tra bảo mật định kỳ để đảm bảo hệ thống luôn an toàn.',
          'Đội ngũ bảo mật của chúng tôi liên tục cập nhật và áp dụng các practices tốt nhất trong ngành. Chúng tôi tuân thủ các quy định về bảo vệ dữ liệu như GDPR và CCPA, đồng thời thực hiện đánh giá rủi ro thường xuyên.',
          'Tất cả các giải pháp của chúng tôi đều được xây dựng với nguyên tắc "security by design". Chúng tôi sử dụng các công nghệ bảo mật hiện đại như OAuth 2.0, JWT, HTTPS và mã hóa dữ liệu, đồng thời đào tạo đội ngũ của chúng tôi về các rủi ro bảo mật mới nhất.',
          'Chúng tôi cam kết bảo vệ dữ liệu của bạn với các biện pháp bảo mật nghiêm ngặt như mã hóa dữ liệu, kiểm soát truy cập dựa trên vai trò, sao lưu định kỳ, và giám sát liên tục. Chúng tôi cũng ký NDA (thỏa thuận bảo mật) với tất cả khách hàng để đảm bảo thông tin của bạn được bảo vệ.'
        ];
      
      case 'api':
        return [
          'Chúng tôi cung cấp API linh hoạt cho phép tích hợp dễ dàng với các hệ thống hiện có của bạn. API của chúng tôi được xây dựng theo chuẩn RESTful với tài liệu đầy đủ và các ví dụ code.',
          'API của chúng tôi cho phép bạn tích hợp các dịch vụ của chúng tôi vào bất kỳ ứng dụng hoặc nền tảng nào. Chúng tôi cung cấp đầy đủ tài liệu, các SDK cho nhiều ngôn ngữ lập trình và hỗ trợ kỹ thuật để đảm bảo quá trình tích hợp diễn ra suôn sẻ.',
          'Chúng tôi cung cấp RESTful API và cả GraphQL API để tích hợp với các hệ thống khác. API của chúng tôi hỗ trợ xác thực OAuth 2.0, rate limiting, và có tài liệu đầy đủ với Swagger/OpenAPI. Chúng tôi cũng cung cấp các thư viện client cho PHP, JavaScript, Python và Java.',
          'Với API của chúng tôi, bạn có thể dễ dàng tích hợp chatbot, tự động hóa và các tính năng khác vào hệ thống hiện có. Chúng tôi cung cấp các endpoint đơn giản nhưng mạnh mẽ, với tài liệu chi tiết và môi trường sandbox để bạn có thể thử nghiệm trước khi triển khai.',
          'API của chúng tôi được thiết kế để linh hoạt và dễ sử dụng, cho phép bạn tích hợp các dịch vụ của chúng tôi vào website, ứng dụng di động hoặc bất kỳ hệ thống nào khác. Chúng tôi hỗ trợ nhiều phương thức xác thực và cung cấp webhooks để thông báo theo thời gian thực.'
        ];
      
      case 'maintenance':
        return [
          'Chúng tôi cung cấp dịch vụ bảo trì thường xuyên để đảm bảo hệ thống của bạn luôn hoạt động tốt. Dịch vụ bảo trì bao gồm cập nhật phần mềm, sao lưu dữ liệu, giám sát hiệu suất và khắc phục sự cố kịp thời.',
          'Gói dịch vụ bảo trì của chúng tôi bao gồm: cập nhật bảo mật thường xuyên, sao lưu dữ liệu tự động, giám sát 24/7, báo cáo hiệu suất hàng tháng, và hỗ trợ kỹ thuật ưu tiên. Chúng tôi cung cấp các gói SLA (Service Level Agreement) khác nhau tùy theo nhu cầu của bạn.',
          'Chúng tôi đề xuất hợp đồng bảo trì hàng năm sau khi hoàn thành dự án để đảm bảo hệ thống của bạn luôn cập nhật và an toàn. Dịch vụ bảo trì bao gồm: cập nhật phần mềm, sửa lỗi, tối ưu hóa hiệu suất, giám sát bảo mật, và hỗ trợ kỹ thuật.',
          'Dịch vụ bảo trì của chúng tôi giúp duy trì và cải thiện hiệu suất hệ thống của bạn theo thời gian. Chúng tôi cung cấp các gói bảo trì hàng tháng hoặc hàng năm, bao gồm cập nhật, sao lưu, giám sát hiệu suất, phân tích bảo mật và hỗ trợ kỹ thuật liên tục.',
          'Để đảm bảo hệ thống của bạn luôn hoạt động tối ưu, chúng tôi cung cấp dịch vụ bảo trì toàn diện bao gồm: giám sát hệ thống 24/7, cập nhật phần mềm, sao lưu dữ liệu tự động, khắc phục sự cố khẩn cấp, và báo cáo hiệu suất hàng tháng.'
        ];
      
      case 'feedback':
        return [
          'Chúng tôi luôn đánh giá cao phản hồi từ khách hàng. Bạn có thể gửi góp ý hoặc nhận xét qua form trên website, email, hoặc gọi điện trực tiếp. Mọi ý kiến đóng góp sẽ giúp chúng tôi cải thiện dịch vụ tốt hơn.',
          'Phản hồi của khách hàng rất quan trọng đối với chúng tôi. Chúng tôi sử dụng phản hồi để liên tục cải thiện các sản phẩm và dịch vụ. Bạn có thể chia sẻ ý kiến của mình thông qua khảo sát sau dự án, form góp ý trên website hoặc liên hệ trực tiếp với người quản lý dự án.',
          'Chúng tôi rất mong nhận được phản hồi từ bạn về trải nghiệm với dịch vụ của chúng tôi. Mọi góp ý đều được xem xét nghiêm túc và là động lực để chúng tôi phát triển. Bạn có thể gửi phản hồi qua email feedback@tectonicdevs.com hoặc điền vào form góp ý trên trang web.',
          'Để liên tục cải thiện dịch vụ, chúng tôi rất cần phản hồi của bạn. Bạn có thể đánh giá dịch vụ của chúng tôi thông qua khảo sát hàng quý, gửi email góp ý, hoặc trao đổi trực tiếp với đội ngũ quản lý của chúng tôi.',
          'Chúng tôi xem phản hồi của khách hàng là nguồn thông tin quý giá để cải thiện. Bạn có thể chia sẻ trải nghiệm và đề xuất cải tiến thông qua nhiều kênh: khảo sát trực tuyến, form góp ý, email, hoặc gọi điện trực tiếp. Mọi ý kiến đều được ghi nhận và phản hồi trong thời gian sớm nhất.'
        ];
      
      case 'business_hours':
        return [
          'Chúng tôi làm việc từ 8h30 đến 17h30, từ thứ Hai đến thứ Sáu. Chúng tôi nghỉ vào các ngày lễ và cuối tuần.',
          'Giờ làm việc chính thức của chúng tôi là từ 8h30 đến 17h30, từ thứ Hai đến thứ Sáu. Tuy nhiên, đội ngũ hỗ trợ kỹ thuật luôn sẵn sàng 24/7 cho các trường hợp khẩn cấp.',
          'Văn phòng của chúng tôi mở cửa từ 8h30 đến 17h30 các ngày trong tuần. Chúng tôi nghỉ vào cuối tuần và các ngày lễ chính thức. Tuy nhiên, bạn vẫn có thể gửi email hoặc để lại tin nhắn, và chúng tôi sẽ phản hồi vào ngày làm việc tiếp theo.',
          'Giờ làm việc của chúng tôi: Thứ Hai - Thứ Sáu: 8h30 - 17h30, Thứ Bảy, Chủ Nhật và ngày lễ: nghỉ. Đối với các yêu cầu khẩn cấp ngoài giờ làm việc, bạn có thể liên hệ qua số hotline 0123.456.789.',
          'Chúng tôi phục vụ khách hàng từ 8h30 đến 17h30, từ thứ Hai đến thứ Sáu. Đội ngũ hỗ trợ kỹ thuật của chúng tôi làm việc theo ca và sẵn sàng hỗ trợ các vấn đề khẩn cấp ngoài giờ làm việc thông qua email hỗ trợ hoặc hotline.'
        ];
      
      default:
        return [
          'Cảm ơn bạn đã liên hệ. Tôi có thể giúp bạn tìm hiểu về dịch vụ phát triển website, chatbot thông minh và các giải pháp công nghệ của chúng tôi. Bạn quan tâm đến dịch vụ nào?',
          'Rất vui được trò chuyện với bạn. Tôi có thể cung cấp thông tin về các dịch vụ của TectonicDevs. Bạn muốn tìm hiểu về vấn đề gì?',
          'Tôi là trợ lý ảo của TectonicDevs. Tôi có thể giúp bạn tìm hiểu về dịch vụ của chúng tôi hoặc kết nối bạn với nhân viên hỗ trợ. Bạn cần giúp đỡ gì?',
          'Chào mừng đến với TectonicDevs! Tôi có thể giúp bạn tìm hiểu thêm về các giải pháp công nghệ của chúng tôi. Bạn quan tâm đến lĩnh vực nào?',
          'Cảm ơn bạn đã liên hệ với TectonicDevs. Tôi có thể cung cấp thông tin về dịch vụ, giá cả, thời gian hoặc kết nối bạn với đội ngũ tư vấn. Bạn cần hỗ trợ gì?'
        ];
    }
  }

  public async processMessage(sessionId: string, message: string): Promise<string> {
    const analysis = await this.analyzeMessage(message);
    
    // Get or create conversation context
    let context = this.contexts.get(sessionId);
    if (!context) {
      context = {
        intent: 'unknown',
        topic: '',
        entities: {},
        confidence: 0,
        previousMessages: [],
        requiresHumanSupport: false
      };
      this.contexts.set(sessionId, context);
    }

    // Update context
    context.intent = analysis.intent;
    context.topic = analysis.topic;
    context.entities = { ...context.entities, ...analysis.entities };
    context.confidence = analysis.confidence;
    
    // Add message to context history
    context.previousMessages.push({
      sessionId,
      content: message,
      sender: 'user',
      timestamp: new Date(),
      metadata: {
        intent: analysis.intent,
        confidence: analysis.confidence
      }
    });

    // Trim context history if needed
    if (context.previousMessages.length > this.MAX_CONTEXT_MESSAGES) {
      context.previousMessages = context.previousMessages.slice(-this.MAX_CONTEXT_MESSAGES);
    }

    // Get basic response
    return this.getBasicResponse(analysis.intent);
  }

  public async handleMessage(sessionId: string, message: string): Promise<{ response: string; requiresHumanSupport: boolean }> {
    try {
      // Kiểm tra xem phiên có tồn tại không
      const session = await this.storage.getChatSession(sessionId);

      // Parse metadata để kiểm tra trạng thái nhân viên hỗ trợ
      let sessionMetadata: any = {};
      let isHumanAssigned = false;
      
      if (session?.metadata) {
        try {
          sessionMetadata = JSON.parse(session.metadata);
          isHumanAssigned = Boolean(sessionMetadata.isHumanAssigned);
          console.log(`Chatbot checking session ${sessionId} - isHumanAssigned:`, isHumanAssigned);
          
          // Nếu đã có nhân viên được gán, thì không xử lý thêm với bot
          if (isHumanAssigned) {
            console.log(`Chatbot skipping message processing for session ${sessionId} as human is assigned`);
            return {
              response: "",
              requiresHumanSupport: false
            };
          }
        } catch (e) {
          console.error('Error parsing session metadata in chatbot:', e);
        }
      }

      // Xử lý tin nhắn bình thường
      const response = await this.processMessage(sessionId, message);
      
      // Lấy context 
      const context = this.contexts.get(sessionId);
      
      // Xác định xem có cần chuyển sang nhân viên hỗ trợ
      const requiresHumanSupport = this.shouldTransferToHuman(sessionId, message, context);
      
      return { response, requiresHumanSupport };
      
    } catch (error) {
      console.error('Error handling message:', error);
      return {
        response: 'Xin lỗi, có lỗi xảy ra khi xử lý tin nhắn của bạn. Vui lòng thử lại sau.',
        requiresHumanSupport: true
      };
    }
  }
  
  // Kiểm tra xem có nên chuyển sang nhân viên hỗ trợ không
  private shouldTransferToHuman(sessionId: string, message: string, context?: any): boolean {
    // Nếu người dùng yêu cầu gặp nhân viên rõ ràng
    if (
      message.toLowerCase().includes('nhân viên') ||
      message.toLowerCase().includes('người') || 
      message.toLowerCase().includes('tư vấn') ||
      message.toLowerCase().includes('hỗ trợ') ||
      message.toLowerCase().includes('gặp')
    ) {
      return true;
    }
    
    // Dựa vào context nếu có
    if (context) {
      return (
        context.intent === 'human_support' ||
        context.confidence < 0.3 ||
        context.previousMessages.filter((msg: any) => 
          msg.metadata?.intent === 'unknown'
        ).length >= 2 ||
        (context.intent === 'question' && context.previousMessages.length > 3)
      );
    }
    
    return false;
  }

  public async getMessageContext(sessionId: string): Promise<ConversationContext | undefined> {
    return this.contexts.get(sessionId);
  }
} 