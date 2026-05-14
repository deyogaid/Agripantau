export enum CommodityType {
  BERAS = "Beras",
  CABAI_MERAH = "Cabai Merah",
  BAWANG_MERAH = "Bawang Merah",
  TELUR_AYAM = "Telur Ayam",
  DAGING_AYAM = "Daging Ayam",
}

export interface PricePoint {
  time: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Market {
  id: string;
  name: string;
  location: string;
  province?: string;
}

export interface CommodityPrice {
  id: string;
  type: CommodityType;
  currentPrice: number;
  previousPrice: number;
  unit: string;
  trend: "up" | "down" | "stable";
  market: Market;
  lastUpdated: string;
  history: PricePoint[];
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  hasPhoto?: boolean;
  isGpsVerified?: boolean;
}

export interface PriceReport {
  id?: string;
  commodity: CommodityType;
  price: number;
  unit: string;
  marketName: string;
  location: string;
  userId: string;
  userName: string;
  timestamp: any;
  verified?: boolean;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  hasPhoto?: boolean;
  isGpsVerified?: boolean;
}

export interface Transaction {
  id: string;
  commodity: CommodityType;
  amount: number;
  unit: string;
  totalPrice: number;
  status: "pending" | "completed" | "cancelled";
  timestamp: string;
  partner: string;
}
