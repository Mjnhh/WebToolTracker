export interface Voucher {
  id: number;
  code: string;
  discountPercent: number;
  expiresAt: Date;
  isUsed: boolean;
  usedAt?: Date;
  createdAt: Date;
}

export interface InsertVoucher {
  code: string;
  discountPercent: number;
  expiresAt: Date;
} 