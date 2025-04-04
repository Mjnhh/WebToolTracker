import { ChatbotService } from './services/chatbot';
import { storage } from './storage';

export const chatbotService = new ChatbotService(storage); 