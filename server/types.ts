export interface ChatMessage {
  id?: number;
  sessionId: string;
  content: string;
  sender: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    entities?: Record<string, any>;
    sentiment?: number;
    [key: string]: any;
  };
}

export interface StoredChatMessage extends ChatMessage {
  id: number;
}

export interface ChatSession {
  id: string;
  userId: number | null;
  metadata: string | null;
  startedAt: Date;
  lastActivity: Date;
  isHumanAssigned?: boolean;
  assignedTo?: number;
}

export interface InsertChatSession {
  id: string;
  userId?: number;
  metadata?: string;
} 