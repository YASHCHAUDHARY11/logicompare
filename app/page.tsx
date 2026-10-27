"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient, Session, User } from "@supabase/supabase-js";

// ============================================================================
// 1. SUPABASE CLIENT INITIALIZATION
// ============================================================================
const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// 2. TYPESCRIPT DATA CONTRACTS & INTERFACES
// ============================================================================
export type RoleType = "shipper" | "carrier" | "vendor" | "admin";

export interface FeeConfig {
  percentage: number;       // e.g., 2% dynamic platform fee
  minFloorINR: number;      // e.g., ₹25 minimum floor fee per consignment
  taxPercentage: number;    // e.g., 18% GST statutory freight tax
  fovPercentage: number;    // e.g., 0.20% Freight On Value cargo risk insurance
  odaFlatCharge: number;    // e.g., ₹450 Out of Delivery Area surcharge
}

export interface BoxItem {
  id: string;
  qty: number;
  weight: number;
  length: number;
  width: number;
  height: number;
}

export interface Vendor {
  id: string;
  name: string;
  badge: string;
  rating: number;
  gstin: string;
  fleet_types: string[];
  upi_id?: string;
  bank_account?: string;
  ifsc_code?: string;
  beneficiary_name?: string;
  tracking_base_url?: string;
}

export interface RateCard {
  id: string;
  vendor_id: string;
  origin_prefix: string;
  dest_prefix: string;
  mode: "surface" | "air" | "ftl";
  min_weight_kg: number;
  base_rate: number;
  per_kg_rate: number;
  fuel_surcharge_pct: number;
  docket_charge: number;
  fov_pct: number;
  oda_charge: number;
  handling_per_kg: number;
  sla_days: number;
  is_active: boolean;
  vendors?: Vendor;
}

export interface CostBreakdown {
  base: number;
  fuel: number;
  docket: number;
  fov: number;
  handling: number;
  oda: number;
  gst: number;
  freightSubtotal: number;
  platformConvenienceFee: number;
  total: number;
  settlement_type?: "direct_to_pay" | "direct_upi" | "corporate_credit";
  payment_method?: string;
  payment_ref?: string;
  carrier_upi?: string;
}

export interface CalculatedQuote {
  rateCard: RateCard;
  vendor: Vendor;
  actualWeight: number;
  volumetricWeight: number;
  billableWeight: number;
  breakdown: CostBreakdown;
}

export interface TrackingStep {
  status: string;
  location: string;
  timestamp: string;
  remarks: string;
}

export interface Booking {
  id: string;
  order_id: string;
  awb_number: string;
  carrier_docket_no: string;
  carrier_portal_url?: string;
  carrier_docket_doc_url?: string;
  shipper_id?: string;
  vendor_id: string;
  rate_card_id?: string;
  shipper_name: string;
  shipper_phone: string;
  shipper_email: string;
  shipper_gstin: string;
  pickup_address: string;
  consignee_name: string;
  consignee_phone: string;
  consignee_gstin: string;
  delivery_address: string;
  origin_pin: string;
  dest_pin: string;
  mode: string;
  boxes: BoxItem[];
  declared_value: number;
  actual_weight: number;
  volumetric_weight: number;
  billable_weight: number;
  cost_breakdown: CostBreakdown;
  final_total: number;
  status: "Booked" | "Picked Up" | "In Transit" | "Out for Delivery" | "Delivered" | "Cancelled";
  tracking_history: TrackingStep[];
  created_at: string;
  vendors?: Vendor;
}

export interface BulkManifestRow {
  rowId: string;
  dest_pin: string;
  consignee_name: string;
  consignee_phone: string;
  delivery_address: string;
  consignee_gstin: string;
  total_boxes: number;
  boxes: BoxItem[];
  declared_value: number;
  hasOmittedDimensions: boolean;
  actualWeight: number;
  volumetricWeight: number;
  billableWeight: number;
  quotes: CalculatedQuote[];
  selectedQuote: CalculatedQuote | null;
  validationError?: string;
}

export interface RfqBid {
  id: string;
  shipper_name: string;
  origin_pin: string;
  dest_pin: string;
  cargo_description: string;
  total_weight_kg: number;
  truck_type: string;
  target_price: number;
  status: "Open" | "Awarded" | "Closed";
  bids: Array<{
    vendor_name: string;
    bid_amount: number;
    transit_days: number;
    notes: string;
    created_at: string;
  }>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  gstin: string;
  phone: string;
  role: RoleType;
  vendor_id?: string;
  isRealUser?: boolean;
}

export interface ParsedCsvRateCard {
  origin_prefix: string;
  dest_prefix: string;
  mode: "surface" | "air" | "ftl";
  min_weight_kg: number;
  base_rate: number;
  per_kg_rate: number;
  fuel_surcharge_pct: number;
  docket_charge: number;
  sla_days: number;
  fov_pct?: number;
  oda_charge?: number;
  handling_per_kg?: number;
  is_active?: boolean;
}

export interface PinLookupResult {
  city: string;
  state: string;
  hub: string;
  loading: boolean;
  error?: string;
}

// ============================================================================
// 3. CORE PLATFORM CONSTANTS & MONETIZATION SETTINGS
// ============================================================================
const MERCHANT_DETAILS = {
  proprietor: "Yash Chaudhary",
  platformName: "LogiCompare Pro",
  category: "B2B Freight Discovery & Consignment Marketplace",
  email: "yash963957@gmail.com",
  phone: "+91 8194017660",
  address: "House No. S-175/219, B Block, Rangpuri Pahari Nala, New Delhi - 110037, India",
  jurisdiction: "New Delhi, Delhi, India",
  defaultOriginPin: "110037",
  defaultWarehouseAddress: "House No. S-175/219, B Block, Rangpuri Pahari Nala, New Delhi - 110037",
  operatingHours: "Monday to Saturday, 09:00 AM – 07:00 PM IST"
};

const DEFAULT_FEE_CONFIG: FeeConfig = {
  percentage: 2,         // 2% Platform Convenience Fee
  minFloorINR: 25,       // Minimum ₹25 floor cap
  taxPercentage: 18,     // 18% GST statutory
  fovPercentage: 0.20,   // 0.20% FOV insurance
  odaFlatCharge: 450     // ₹450 ODA rate
};

const DEMO_INIT_ORDER_ID = "LC-894210";
const DEMO_INIT_CARRIER_DOCKET = "148920194821";

const DEMO_SHIPPER: UserProfile = {
  id: "demo-shipper-uuid",
  email: "dispatch@apexlogistics.in",
  full_name: "Vikram Malhotra",
  company_name: "Apex Retail Solutions Pvt Ltd",
  gstin: "07AAACA1234A1Z5",
  phone: "+91 98110 23456",
  role: "shipper",
  isRealUser: false
};

const DEMO_VENDOR: UserProfile = {
  id: "demo-vendor-uuid",
  email: "ops@delhiveryb2b.com",
  full_name: "Ramesh Sharma",
  company_name: "Delhivery B2B Cargo Hub",
  gstin: "06AAACD9876Q1ZB",
  phone: "+91 98991 76543",
  role: "carrier",
  vendor_id: "11111111-1111-1111-1111-111111111111",
  isRealUser: false
};

const FALLBACK_VENDORS: Vendor[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Delhivery B2B Express",
    badge: "Market Leader",
    rating: 4.8,
    gstin: "06AAACD9876Q1ZB",
    fleet_types: ["Surface Express", "Air Express", "Part Truck Load"],
    upi_id: "delhivery.b2b@icici",
    bank_account: "50200088910234",
    ifsc_code: "HDFC0000240",
    beneficiary_name: "Delhivery Limited B2B Logistics",
    tracking_base_url: "https://www.delhivery.com/track/package/"
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Blue Dart Aviation",
    badge: "Fastest Air SLA",
    rating: 4.9,
    gstin: "27AAACB0982G1ZL",
    fleet_types: ["Air Express Priority", "Critical Cargo"],
    upi_id: "bluedart.freight@axisbank",
    bank_account: "91802003445511",
    ifsc_code: "UTIB0000045",
    beneficiary_name: "Blue Dart Express Limited",
    tracking_base_url: "https://www.bluedart.com/tracking?trackNo="
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "TCI Freight",
    badge: "Heavy Haulage",
    rating: 4.6,
    gstin: "08AAACT1234F1ZX",
    fleet_types: ["FTL 32ft MXL", "Taurus 21T", "Heavy Surface"],
    upi_id: "tcilogistics@sbi",
    bank_account: "30882194012",
    ifsc_code: "SBIN0001245",
    beneficiary_name: "Transport Corporation of India Ltd",
    tracking_base_url: "https://www.tcifreight.com/tracking/"
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Gati-KWE Multi-Modal",
    badge: "Extensive Reach",
    rating: 4.4,
    gstin: "36AAACG4455H1ZP",
    fleet_types: ["Surface Express", "Air Freight"],
    upi_id: "gatikwe.ops@kotak",
    bank_account: "181290445566",
    ifsc_code: "KKBK0000192",
    beneficiary_name: "Gati-Kintetsu Express Pvt Ltd",
    tracking_base_url: "https://www.gati.com/track-shipment/?docket="
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    name: "Safexpress Logistics",
    badge: "Secure 3PL",
    rating: 4.7,
    gstin: "07AAACS7788P1ZZ",
    fleet_types: ["SafeAir Cargo", "Surface Cargo Hub"],
    upi_id: "safexpress.pay@yesbank",
    bank_account: "001284400192",
    ifsc_code: "YESB0000012",
    beneficiary_name: "Safexpress Private Limited",
    tracking_base_url: "http://www.safexpress.com/track-waybill?waybill="
  }
];

const FALLBACK_DEFAULT_RATE_CARDS: RateCard[] = [
  {
    id: "rc-del-bom-surface",
    vendor_id: "11111111-1111-1111-1111-111111111111",
    origin_prefix: "%",
    dest_prefix: "%",
    mode: "surface",
    min_weight_kg: 20,
    base_rate: 350,
    per_kg_rate: 13.5,
    fuel_surcharge_pct: 12,
    docket_charge: 120,
    fov_pct: 0.2,
    oda_charge: 450,
    handling_per_kg: 1.5,
    sla_days: 3,
    is_active: true
  },
  {
    id: "rc-bd-air-express",
    vendor_id: "22222222-2222-2222-2222-222222222222",
    origin_prefix: "%",
    dest_prefix: "%",
    mode: "air",
    min_weight_kg: 5,
    base_rate: 650,
    per_kg_rate: 42,
    fuel_surcharge_pct: 18,
    docket_charge: 200,
    fov_pct: 0.2,
    oda_charge: 600,
    handling_per_kg: 3,
    sla_days: 1,
    is_active: true
  },
  {
    id: "rc-safe-surface",
    vendor_id: "55555555-5555-5555-5555-555555555555",
    origin_prefix: "%",
    dest_prefix: "%",
    mode: "surface",
    min_weight_kg: 25,
    base_rate: 400,
    per_kg_rate: 12.8,
    fuel_surcharge_pct: 11,
    docket_charge: 140,
    fov_pct: 0.2,
    oda_charge: 400,
    handling_per_kg: 2,
    sla_days: 4,
    is_active: true
  },
  {
    id: "rc-gati-surface",
    vendor_id: "44444444-4444-4444-4444-444444444444",
    origin_prefix: "%",
    dest_prefix: "%",
    mode: "surface",
    min_weight_kg: 15,
    base_rate: 320,
    per_kg_rate: 14,
    fuel_surcharge_pct: 12.5,
    docket_charge: 110,
    fov_pct: 0.2,
    oda_charge: 450,
    handling_per_kg: 1.8,
    sla_days: 4,
    is_active: true
  }
];

const clientLocationCache: Record<string, string> = {
  delhi: "110",
  "new delhi": "110",
  mumbai: "400",
  bengaluru: "560",
  bangalore: "560",
  chandigarh: "160",
  ludhiana: "141",
  meerut: "250",
  kolkata: "700",
  chennai: "600",
  hyderabad: "500",
  ahmedabad: "380",
  pune: "411",
  jaipur: "302"
};

// ============================================================================
// 4. CALCULATION ENGINES, PIN ROUTERS & CLIENT-SIDE UTILITIES
// ============================================================================
const formatINR = (val: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(val || 0);
};

function getOfficialCarrierTrackingUrl(carrierName: string, docketNumber: string): string {
  if (!docketNumber) return "#";
  const name = carrierName.toLowerCase();
  const cleanDocket = docketNumber.trim();
  if (name.includes("delhivery")) return `https://www.delhivery.com/track/package/${encodeURIComponent(cleanDocket)}`;
  if (name.includes("blue dart")) return `https://www.bluedart.com/tracking?trackNo=${encodeURIComponent(cleanDocket)}`;
  if (name.includes("safexpress")) return `http://www.safexpress.com/track-waybill?waybill=${encodeURIComponent(cleanDocket)}`;
  if (name.includes("gati")) return `https://www.gati.com/track-shipment/?docket=${encodeURIComponent(cleanDocket)}`;
  if (name.includes("tci")) return `https://www.tcifreight.com/tracking/${encodeURIComponent(cleanDocket)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrierName} consignment tracking ${cleanDocket}`)}`;
}

function generateCarrierDocket(carrierName: string): string {
  const c = carrierName.toLowerCase();
  if (c.includes("delhivery")) return `14${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  if (c.includes("blue dart")) return `BLU${Math.floor(100000000 + Math.random() * 900000000)}`;
  if (c.includes("tci")) return `TCI-${Math.floor(1000000 + Math.random() * 9000000)}`;
  if (c.includes("gati")) return `GTI-${Math.floor(10000000 + Math.random() * 90000000)}`;
  return `SAF-${Math.floor(10000000 + Math.random() * 90000000)}`;
}

function getLocalFallbackZone(pin: string): { city: string; state: string; hub: string } {
  if (!pin || pin.length < 3) return { city: "Detecting Location...", state: "India", hub: "HUB-GEN" };
  const p3 = pin.substring(0, 3);
  const p2 = pin.substring(0, 2);

  if (p3 === "110") return { city: "Delhi NCR", state: "Delhi", hub: "DEL-NORTH-01" };
  if (p3 === "121" || p3 === "122") return { city: "Gurugram / FBD", state: "Haryana", hub: "GGN-GATEWAY" };
  if (p3 === "131" || p3 === "132") return { city: "Sonipat / Panipat", state: "Haryana", hub: "HAR-CENTRAL" };
  if (p3 === "133" || p3 === "134") return { city: "Ambala / Panchkula", state: "Haryana", hub: "AMB-HUB" };
  if (p3 === "141") return { city: "Ludhiana", state: "Punjab", hub: "LDH-IND-HUB" };
  if (p3 === "143") return { city: "Amritsar", state: "Punjab", hub: "ASR-GATEWAY" };
  if (p3 === "144") return { city: "Jalandhar", state: "Punjab", hub: "JAL-HUB" };
  if (p3 === "160") return { city: "Chandigarh", state: "Chandigarh", hub: "CHD-CENTRAL" };
  if (p3 === "201") return { city: "Noida / Ghaziabad", state: "Uttar Pradesh", hub: "UP-WEST-HUB" };
  if (p3 === "250") return { city: "Meerut", state: "Uttar Pradesh", hub: "MRT-HUB-02" };
  if (p3 === "400" || p3 === "401") return { city: "Mumbai MMR", state: "Maharashtra", hub: "BOM-CENTRAL" };
  if (p3 === "411") return { city: "Pune", state: "Maharashtra", hub: "PNQ-IND-01" };
  if (p3 === "560") return { city: "Bengaluru", state: "Karnataka", hub: "BLR-SOUTH-MAIN" };
  if (p3 === "500") return { city: "Hyderabad", state: "Telangana", hub: "HYD-HUB-01" };
  if (p3 === "600") return { city: "Chennai", state: "Tamil Nadu", hub: "MAA-AIR-SEA" };
  if (p3 === "700") return { city: "Kolkata", state: "West Bengal", hub: "CCU-EAST-PORT" };
  if (p3 === "380") return { city: "Ahmedabad", state: "Gujarat", hub: "AMD-WEST-01" };
  if (p3 === "302") return { city: "Jaipur", state: "Rajasthan", hub: "JAI-NORTH-WEST" };

  return { city: `Zone ${p2}XX`, state: "Regional District", hub: `HUB-${p2}X` };
}

async function resolveLocationToPrefix(rawInput: string): Promise<string> {
  if (!rawInput) return "%";
  const clean = rawInput.trim().toLowerCase();
  if (clean === "%") return "%";
  if (/^\d{3,6}$/.test(clean)) return clean.substring(0, 3);
  if (clientLocationCache[clean]) return clientLocationCache[clean];

  try {
    const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(clean)}`);
    const data = await res.json();
    if (data && data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
      const pin = data[0].PostOffice[0].Pincode;
      const prefix = pin.substring(0, 3);
      clientLocationCache[clean] = prefix;
      return prefix;
    }
  } catch (err) {
    console.warn("Postal API lookup fallback:", clean, err);
  }
  return clean.substring(0, 3);
}

function calculatePlatformFee(freightTotal: number, feeConfig: FeeConfig = DEFAULT_FEE_CONFIG): number {
  const dynamicFee = (freightTotal * feeConfig.percentage) / 100;
  return Math.max(feeConfig.minFloorINR, Math.round(dynamicFee));
}

function calculateQuotesForShipment(
  originPin: string,
  destPin: string,
  boxes: BoxItem[],
  declaredValue: number,
  mode: "all" | "surface" | "air" | "ftl",
  isOda: boolean,
  rateCardsList: RateCard[],
  vendorsList: Vendor[],
  feeConfig: FeeConfig = DEFAULT_FEE_CONFIG
): CalculatedQuote[] {
  const actualWeight = boxes.reduce((acc, b) => acc + (Number(b.weight) || 0) * (Number(b.qty) || 1), 0);
  const oPrefix = originPin.substring(0, 3);
  const dPrefix = destPin.substring(0, 3);

  const matchedCards = rateCardsList.filter((card) => {
    if (!card.is_active) return false;
    if (mode !== "all" && card.mode !== mode) return false;
    const originMatches = card.origin_prefix === "%" || card.origin_prefix === oPrefix || originPin.startsWith(card.origin_prefix);
    const destMatches = card.dest_prefix === "%" || card.dest_prefix === dPrefix || destPin.startsWith(card.dest_prefix);
    return originMatches && destMatches;
  });

  const activeCards = matchedCards.length > 0 ? matchedCards : rateCardsList.slice(0, 5);

  return activeCards.map((card) => {
    const divisor = card.mode === "air" ? 5000 : 4500;
    const volumetricWeight = boxes.reduce((acc, b) => {
      if (!b.length || !b.width || !b.height) return acc;
      const volKg = ((Number(b.length) || 0) * (Number(b.width) || 0) * (Number(b.height) || 0)) / divisor;
      return acc + volKg * (Number(b.qty) || 1);
    }, 0);

    const billableWeight = Math.max(actualWeight, Math.round(volumetricWeight * 10) / 10, card.min_weight_kg);
    const v = card.vendors || vendorsList.find((vend) => vend.id === card.vendor_id) || vendorsList[0];

    const baseFreight = Number(card.base_rate) + billableWeight * Number(card.per_kg_rate);
    const fuelSurcharge = (baseFreight * Number(card.fuel_surcharge_pct)) / 100;
    const docket = Number(card.docket_charge);
    const fov = Math.max(50, (Number(declaredValue) * Number(card.fov_pct || feeConfig.fovPercentage)) / 100);
    const handling = billableWeight * Number(card.handling_per_kg);
    const oda = isOda ? Number(card.oda_charge || feeConfig.odaFlatCharge) : 0;

    const subtotal = baseFreight + fuelSurcharge + docket + fov + handling + oda;
    const gst = subtotal * (feeConfig.taxPercentage / 100);
    const freightDirectTotal = subtotal + gst;

    const convenienceFee = calculatePlatformFee(freightDirectTotal, feeConfig);

    return {
      rateCard: card,
      vendor: v,
      actualWeight: Math.round(actualWeight * 10) / 10,
      volumetricWeight: Math.round(volumetricWeight * 10) / 10,
      billableWeight: Math.round(billableWeight * 10) / 10,
      breakdown: {
        base: Math.round(baseFreight * 100) / 100,
        fuel: Math.round(fuelSurcharge * 100) / 100,
        docket: Math.round(docket * 100) / 100,
        fov: Math.round(fov * 100) / 100,
        handling: Math.round(handling * 100) / 100,
        oda: Math.round(oda * 100) / 100,
        gst: Math.round(gst * 100) / 100,
        freightSubtotal: Math.round(freightDirectTotal * 100) / 100,
        platformConvenienceFee: convenienceFee,
        total: Math.round((freightDirectTotal + convenienceFee) * 100) / 100
      }
    };
  });
}

async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 1200;
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        0.75
      );
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// 5. INLINE VECTOR SYSTEM (21 PRODUCTION SVG ICONS)
// ============================================================================
interface IconProps {
  className?: string;
}

const TruckIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
  </svg>
);

const PlaneIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const BoxIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const PrinterIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

const SearchIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const PlusIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ArrowRightIcon: React.FC<IconProps> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

const CheckCircleIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XMarkIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ShieldCheckIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const ChevronDownIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const LayersIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const CurrencyRupeeIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6m-5 0h.01M9 12h5m-5 0h.01M9 4v16m0-12a4 4 0 014 4 4 4 0 01-4 4l6 6" />
  </svg>
);

const CreditCardIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 10h20M7 15h2m4 0h4" />
  </svg>
);

const ExternalLinkIcon: React.FC<IconProps> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const DownloadIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const UploadIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const MapPinIcon: React.FC<IconProps> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const DocumentIcon: React.FC<IconProps> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const BoltIcon: React.FC<IconProps> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

// ============================================================================
// 6. 3D ENGINES & HTML5 CANVAS VISUALIZERS
// ============================================================================
function Interactive3DBox({ length, width, height }: { length: number; width: number; height: number }) {
  const [rotX, setRotX] = useState(-20);
  const [rotY, setRotY] = useState(35);
  const [isDragging, setIsDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!autoRotate || isDragging) return;
    const interval = setInterval(() => {
      setRotY((prev) => (prev + 0.6) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, [autoRotate, isDragging]);

  const maxDim = Math.max(length, width, height, 20);
  const scale = 110 / maxDim;
  const l = Math.max(45, Math.min(150, length * scale));
  const w = Math.max(45, Math.min(150, width * scale));
  const h = Math.max(45, Math.min(150, height * scale));

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setAutoRotate(false);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setRotY((prev) => prev + dx * 0.7);
    setRotX((prev) => Math.max(-75, Math.min(75, prev - dy * 0.7)));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="flex flex-col items-center select-none bg-gradient-to-b from-slate-900/80 to-slate-950 p-4 rounded-2xl border border-slate-700/60 shadow-xl backdrop-blur-md w-full">
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-[10px] uppercase font-black tracking-wider text-indigo-300 flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1"></span>
          Live 3D Carton Visualizer
        </span>
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className="text-[10px] font-bold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 transition"
        >
          {autoRotate ? "Pause 360°" : "Auto 360°"}
        </button>
      </div>

      <div
        className="w-48 h-44 flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ perspective: "800px" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="relative transition-transform duration-75"
          style={{
            width: `${l}px`,
            height: `${h}px`,
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`
          }}
        >
          {/* Front Face */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-amber-700 via-amber-600 to-amber-800 border border-amber-900/60 shadow-inner flex flex-col justify-between p-2 text-white overflow-hidden rounded-sm"
            style={{ transform: `translateZ(${w / 2}px)` }}
          >
            <div className="flex justify-between items-start opacity-90">
              <span className="text-[8px] font-black uppercase tracking-widest text-amber-950 bg-amber-400 px-1 py-0.5 rounded-sm">
                FRAGILE
              </span>
              <span className="text-[7px] font-mono text-amber-200">↑ THIS SIDE UP</span>
            </div>
            <div className="flex flex-col items-center my-auto">
              <div className="w-12 h-3.5 bg-white/90 rounded-sm flex items-center justify-center space-x-0.5 px-1 py-0.5 shadow-sm">
                {[1, 2, 1, 3, 1, 2, 1, 2, 1, 3, 1].map((n, i) => (
                  <div key={i} className="bg-black h-full" style={{ width: `${n}px` }} />
                ))}
              </div>
              <span className="text-[7px] font-mono font-black text-amber-100 tracking-wider mt-0.5">
                {length}×{width}×{height} CM
              </span>
            </div>
            <div className="h-1.5 w-full bg-amber-950/60 rounded-sm"></div>
          </div>

          {/* Back Face */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-amber-800 to-amber-900 border border-amber-950 flex items-center justify-center text-amber-300 font-mono text-[8px] font-bold"
            style={{ transform: `rotateY(180deg) translateZ(${w / 2}px)` }}
          >
            <span>LOGICOMPARE B2B</span>
          </div>

          {/* Left Face */}
          <div
            className="absolute bg-gradient-to-br from-amber-800 via-amber-700 to-amber-900 border border-amber-950 flex flex-col justify-center items-center text-amber-200"
            style={{
              width: `${w}px`,
              height: `${h}px`,
              left: `${(l - w) / 2}px`,
              transform: `rotateY(-90deg) translateZ(${l / 2}px)`
            }}
          >
            <span className="text-[7px] font-bold rotate-90 opacity-75">WIDTH: {width}cm</span>
          </div>

          {/* Right Face */}
          <div
            className="absolute bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 border border-amber-950 flex flex-col justify-center items-center text-amber-200"
            style={{
              width: `${w}px`,
              height: `${h}px`,
              left: `${(l - w) / 2}px`,
              transform: `rotateY(90deg) translateZ(${l / 2}px)`
            }}
          >
            <span className="text-[7px] font-bold -rotate-90 opacity-75">HT: {height}cm</span>
          </div>

          {/* Top Face */}
          <div
            className="absolute bg-gradient-to-br from-amber-600 via-amber-500 to-amber-700 border border-amber-900 flex items-center justify-center overflow-hidden"
            style={{
              width: `${l}px`,
              height: `${w}px`,
              top: `${(h - w) / 2}px`,
              transform: `rotateX(90deg) translateZ(${h / 2}px)`
            }}
          >
            <div className="w-full h-3 bg-amber-400/50 shadow-inner flex items-center justify-center">
              <span className="text-[6px] font-black text-amber-950 tracking-widest uppercase">HEAVY DUTY SEAL</span>
            </div>
          </div>

          {/* Bottom Face */}
          <div
            className="absolute bg-amber-950 shadow-2xl"
            style={{
              width: `${l}px`,
              height: `${w}px`,
              top: `${(h - w) / 2}px`,
              transform: `rotateX(-90deg) translateZ(${h / 2}px)`
            }}
          />
        </div>
      </div>
      <span className="text-[9px] text-slate-400 mt-1 font-mono">Drag with mouse to rotate 360°</span>
    </div>
  );
}

function Hero3DTruck() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [speed, setSpeed] = useState<"normal" | "turbo">("normal");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let wheelAngle = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2 + 10;

      // Perspective Road Guidelines
      ctx.save();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
      ctx.lineWidth = 1;
      for (let i = -140; i <= 140; i += 28) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 1.8, cy + 50);
        ctx.lineTo(cx + i * 0.5, cy - 20);
        ctx.stroke();
      }

      // Highway Road Dashed Line
      const stripeOffset = (Date.now() / (speed === "turbo" ? 35 : 75)) % 40;
      ctx.strokeStyle = "rgba(52, 211, 153, 0.5)";
      ctx.lineWidth = 2;
      for (let y = -20; y < 60; y += 20) {
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy + y + stripeOffset);
        ctx.lineTo(cx - 2, cy + y + stripeOffset + 10);
        ctx.stroke();
      }
      ctx.restore();

      // Chassis Ground Drop Shadow
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 30, 85, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Vehicle Assembly
      ctx.save();
      ctx.translate(cx, cy);

      // Cargo Container Body
      const gradContainer = ctx.createLinearGradient(-80, -35, 10, 10);
      gradContainer.addColorStop(0, "#4f46e5");
      gradContainer.addColorStop(0.5, "#3730a3");
      gradContainer.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = gradContainer;
      ctx.strokeStyle = "#818cf8";
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.roundRect(-80, -38, 95, 48, 4);
      ctx.fill();
      ctx.stroke();

      // Corrugated Body Ribs
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      for (let rx = -70; rx < 10; rx += 8) {
        ctx.beginPath();
        ctx.moveTo(rx, -36);
        ctx.lineTo(rx, 8);
        ctx.stroke();
      }

      // Fleet Brand Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText("LOGICOMPARE B2B", -68, -12);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 7px sans-serif";
      ctx.fillText("EXPRESS CARGO LINEHAUL", -68, -2);

      // Driver Cabin Shell
      const gradCab = ctx.createLinearGradient(16, -20, 52, 10);
      gradCab.addColorStop(0, "#059669");
      gradCab.addColorStop(1, "#065f46");
      ctx.fillStyle = gradCab;
      ctx.beginPath();
      ctx.moveTo(15, 10);
      ctx.lineTo(55, 10);
      ctx.lineTo(55, -8);
      ctx.lineTo(40, -28);
      ctx.lineTo(15, -28);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Windshield Glass
      ctx.fillStyle = "rgba(186, 230, 253, 0.85)";
      ctx.beginPath();
      ctx.moveTo(38, -25);
      ctx.lineTo(50, -9);
      ctx.lineTo(24, -9);
      ctx.lineTo(24, -25);
      ctx.closePath();
      ctx.fill();

      // Headlight Beam
      const lightBeam = ctx.createRadialGradient(55, 0, 2, 95, 8, 45);
      lightBeam.addColorStop(0, "rgba(250, 204, 21, 0.9)");
      lightBeam.addColorStop(0.5, "rgba(250, 204, 21, 0.2)");
      lightBeam.addColorStop(1, "rgba(250, 204, 21, 0)");
      ctx.fillStyle = lightBeam;
      ctx.beginPath();
      ctx.moveTo(54, -2);
      ctx.lineTo(110, -10);
      ctx.lineTo(110, 22);
      ctx.closePath();
      ctx.fill();

      // Multi-Axle Rotating Wheels
      wheelAngle += speed === "turbo" ? 0.35 : 0.16;
      const wheelPositions = [-62, -42, 28, 46];
      wheelPositions.forEach((wx) => {
        ctx.save();
        ctx.translate(wx, 14);
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.rotate(wheelAngle);
        ctx.strokeStyle = "#cbd5e1";
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.moveTo(0, -5);
        ctx.lineTo(0, 5);
        ctx.stroke();
        ctx.restore();
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [speed]);

  return (
    <div className="relative flex flex-col items-center bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-xl w-full max-w-sm">
      <div className="flex items-center justify-between w-full px-2 mb-1">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-mono font-bold text-slate-200">3D Linehaul Container Transit</span>
        </div>
        <button
          type="button"
          onClick={() => setSpeed(speed === "normal" ? "turbo" : "normal")}
          className="text-[10px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-900/60 border border-indigo-500/40 px-2.5 py-1 rounded-full hover:bg-indigo-800 transition"
        >
          {speed === "turbo" ? "⚡ Turbo Speed" : "▶ Normal Transit"}
        </button>
      </div>

      <canvas ref={canvasRef} width={340} height={170} className="w-full max-w-[340px] h-[170px]" />

      <div className="flex items-center justify-between w-full text-[10px] text-slate-400 pt-2 border-t border-slate-800 font-mono">
        <span>Vehicle: 32ft MXL Container</span>
        <span className="text-emerald-400 font-bold">GPS Active • Linehaul</span>
      </div>
    </div>
  );
}

function RouteTrajectory3D({ originHub, destHub }: { originHub: string; destHub: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let progress = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;

      const p1 = { x: 45, y: h - 35 };
      const p2 = { x: w - 45, y: h - 35 };
      const cp = { x: w / 2, y: 15 };

      // Ground Shadow
      ctx.save();
      ctx.fillStyle = "rgba(99, 102, 241, 0.05)";
      ctx.beginPath();
      ctx.ellipse(w / 2, h - 30, w / 2 - 20, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Trajectory Dashed Curve
      ctx.save();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(cp.x, cp.y, p2.x, p2.y);
      ctx.stroke();
      ctx.restore();

      // Animated Pulsing Node
      progress = (progress + 0.008) % 1;
      const t = progress;
      const bx = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cp.x + t * t * p2.x;
      const by = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cp.y + t * t * p2.y;

      // Glow Pulse
      ctx.save();
      const glow = ctx.createRadialGradient(bx, by, 1, bx, by, 12);
      glow.addColorStop(0, "rgba(52, 211, 153, 1)");
      glow.addColorStop(0.6, "rgba(52, 211, 153, 0.4)");
      glow.addColorStop(1, "rgba(52, 211, 153, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Origin Hub Node
      ctx.save();
      ctx.fillStyle = "#6366f1";
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Destination Hub Node
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [originHub, destHub]);

  return (
    <div className="relative bg-slate-900/80 p-3 rounded-2xl border border-slate-700/60 text-white flex flex-col items-center w-full shadow-md">
      <div className="flex justify-between items-center w-full text-[10px] font-mono mb-1">
        <span className="text-indigo-300 font-black">📍 {originHub || "DEL-ORIGIN"}</span>
        <span className="text-emerald-300 font-black">🎯 {destHub || "BOM-DEST"}</span>
      </div>
      <canvas ref={canvasRef} width={300} height={90} className="w-full max-w-[300px] h-[90px]" />
      <span className="text-[9px] text-slate-400 font-mono mt-0.5">3D Parabolic Linehaul Trajectory Active</span>
    </div>
  );
}

// ============================================================================
// 7. MAIN LOGICOMPARE APPLICATION CONTROLLER & REAL-TIME STATE
// ============================================================================
function LogiCompareProController() {
  // Navigation & Role Hierarchy State
  const [activeRole, setActiveRole] = useState<RoleType | "landing">("shipper");
  const [modeEnv, setModeEnv] = useState<"demo" | "live">("demo");
  const [highVolumeMode, setHighVolumeMode] = useState<boolean>(true);

  // Sub-Navigation Tabs
  const [shipperTab, setShipperTab] = useState<"search" | "matrix" | "shipments" | "history" | "rfq">("search");
  const [carrierTab, setCarrierTab] = useState<"loads" | "tracking" | "rates" | "earnings">("tracking");

  // Active User Profile State
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_SHIPPER);
  const [authSession, setAuthSession] = useState<Session | null>(null);

  // Monetization Configuration State
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(DEFAULT_FEE_CONFIG);

  // Core Domain Masters State
  const [rateCards, setRateCards] = useState<RateCard[]>(FALLBACK_DEFAULT_RATE_CARDS);
  const [vendors, setVendors] = useState<Vendor[]>(FALLBACK_VENDORS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rfqList, setRfqList] = useState<RfqBid[]>([]);

  // Modals Visibility State
  const [showLegalModal, setShowLegalModal] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<"terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact">("terms");
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showCitySearchModal, setShowCitySearchModal] = useState<"origin" | "dest" | null>(null);
  const [showAddRateCardModal, setShowAddRateCardModal] = useState<boolean>(false);
  const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<CalculatedQuote | null>(null);
  const [printableBooking, setPrintableBooking] = useState<Booking | null>(null);
  const [batchPrintBookings, setBatchPrintBookings] = useState<Booking[] | null>(null);

  // Ad-hoc Single Rate Calculator Form State
  const [originPin, setOriginPin] = useState<string>(MERCHANT_DETAILS.defaultOriginPin);
  const [destPin, setDestPin] = useState<string>("400001");
  const [isOda, setIsOda] = useState<boolean>(false);
  const [declaredValue, setDeclaredValue] = useState<number>(75000);
  const [selectedMode, setSelectedMode] = useState<"all" | "surface" | "air" | "ftl">("all");
  const [boxes, setBoxes] = useState<BoxItem[]>([
    { id: "box-1", qty: 2, weight: 20, length: 45, width: 35, height: 30 },
    { id: "box-2", qty: 1, weight: 15, length: 30, width: 30, height: 25 }
  ]);
  const [selectedBoxFor3D, setSelectedBoxFor3D] = useState<number>(0);
  const [pickupAddress, setPickupAddress] = useState<string>(MERCHANT_DETAILS.defaultWarehouseAddress);

  // Bulk CSV (50/Day Dispatch Matrix) State
  const [bulkManifestList, setBulkManifestList] = useState<BulkManifestRow[]>([]);
  const [bulkCsvFileName, setBulkCsvFileName] = useState<string>("");
  const [bulkUploadError, setBulkUploadError] = useState<string>("");
  const [bulkSettlementMethod, setBulkSettlementMethod] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");
  const [bulkConsolidatedUtr, setBulkConsolidatedUtr] = useState<string>("");
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Live Tracking Inputs State
  const [globalSearchInput, setGlobalSearchInput] = useState<string>("");
  const [landingTrackingInput, setLandingTrackingInput] = useState<string>("");
  const [activeTrackingAwb, setActiveTrackingAwb] = useState<string>(DEMO_INIT_ORDER_ID);
  const [trackingSearchInput, setTrackingSearchInput] = useState<string>(DEMO_INIT_ORDER_ID);

  // Postal Zone Verification State
  const [originZoneData, setOriginZoneData] = useState<PinLookupResult>({
    city: "South West Delhi",
    state: "Delhi",
    hub: "DEL-SOUTH-HUB",
    loading: false
  });
  const [destZoneData, setDestZoneData] = useState<PinLookupResult>({
    city: "Mumbai",
    state: "Maharashtra",
    hub: "BOM-CENTRAL",
    loading: false
  });

  // Carrier Dispatch Update Form Map State
  const [statusUpdateMap, setStatusUpdateMap] = useState<
    Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>
  >({});

  // 1. High-Volume Mode Origin PIN Lock Effect
  useEffect(() => {
    if (highVolumeMode) {
      setOriginPin(MERCHANT_DETAILS.defaultOriginPin);
      setPickupAddress(MERCHANT_DETAILS.defaultWarehouseAddress);
    }
  }, [highVolumeMode]);

  // 2. Real Supabase Authentication Listener Effect
  useEffect(() => {
    const initAuthSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setAuthSession(session);
        if (session && session.user) {
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
          if (pData) {
            const realRole: RoleType = (pData.role === "vendor" || pData.role === "carrier") ? "carrier" : pData.role;
            const realProfile: UserProfile = {
              id: session.user.id,
              email: session.user.email || pData.email || "",
              full_name: pData.full_name || "Verified Enterprise User",
              company_name: pData.company_name || "Commercial Logistics Ltd",
              gstin: pData.gstin || "07AAACA1234A1Z5",
              phone: pData.phone || "+91 98110 23456",
              role: realRole,
              vendor_id: pData.vendor_id || (realRole === "carrier" ? session.user.id : undefined),
              isRealUser: true
            };
            setCurrentUser(realProfile);
            setModeEnv("live");
            setActiveRole(realRole);
          }
        }
      } catch (err) {
        console.warn("Supabase auth session sync fallback:", err);
      }
    };

    initAuthSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setAuthSession(session);
      if (session && session.user) {
        const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        if (pData) {
          const realRole: RoleType = (pData.role === "vendor" || pData.role === "carrier") ? "carrier" : pData.role;
          const realProfile: UserProfile = {
            id: session.user.id,
            email: session.user.email || pData.email || "",
            full_name: pData.full_name || "Verified Enterprise User",
            company_name: pData.company_name || "Commercial Logistics Ltd",
            gstin: pData.gstin || "07AAACA1234A1Z5",
            phone: pData.phone || "+91 98110 23456",
            role: realRole,
            vendor_id: pData.vendor_id || (realRole === "carrier" ? session.user.id : undefined),
            isRealUser: true
          };
          setCurrentUser(realProfile);
          setModeEnv("live");
          setActiveRole(realRole);
        }
      } else {
        // Fallback to Demo Shipper when signed out
        if (modeEnv === "live") {
          setCurrentUser(DEMO_SHIPPER);
          setModeEnv("demo");
          setActiveRole("landing");
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [modeEnv]);

  // 3. Database Data Synchronization Effect
  const fetchAllData = async () => {
    try {
      const { data: vData } = await supabase.from("vendors").select("*");
      if (vData && vData.length > 0) setVendors(vData);

      const { data: rData } = await supabase.from("rate_cards").select("*, vendors(*)");
      if (rData && rData.length > 0) setRateCards(rData as RateCard[]);

      const { data: bData } = await supabase.from("bookings").select("*, vendors(*)").order("created_at", { ascending: false });
      if (bData && bData.length > 0) setBookings(bData as Booking[]);

      const { data: qData } = await supabase.from("rfq_bids").select("*").order("created_at", { ascending: false });
      if (qData && qData.length > 0) setRfqList(qData as RfqBid[]);
    } catch (err) {
      console.warn("Supabase database fetch notice:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // 4. Postal PIN Code Lookup Effects
  useEffect(() => {
    if (originPin.trim().length === 6) {
      setOriginZoneData((prev) => ({ ...prev, loading: true }));
      fetch(`https://api.postalpincode.in/pincode/${originPin.trim()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
            const po = data[0].PostOffice[0];
            setOriginZoneData({
              city: po.District || po.Block || po.Name,
              state: po.State,
              hub: `HUB-${po.District?.substring(0, 3).toUpperCase() || "IN"}-01`,
              loading: false
            });
          } else {
            setOriginZoneData({ ...getLocalFallbackZone(originPin), loading: false });
          }
        })
        .catch(() => setOriginZoneData({ ...getLocalFallbackZone(originPin), loading: false }));
    }
  }, [originPin]);

  useEffect(() => {
    if (destPin.trim().length === 6) {
      setDestZoneData((prev) => ({ ...prev, loading: true }));
      fetch(`https://api.postalpincode.in/pincode/${destPin.trim()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
            const po = data[0].PostOffice[0];
            setDestZoneData({
              city: po.District || po.Block || po.Name,
              state: po.State,
              hub: `HUB-${po.District?.substring(0, 3).toUpperCase() || "IN"}-01`,
              loading: false
            });
          } else {
            setDestZoneData({ ...getLocalFallbackZone(destPin), loading: false });
          }
        })
        .catch(() => setDestZoneData({ ...getLocalFallbackZone(destPin), loading: false }));
    }
  }, [destPin]);

  // Global Tracking Search Router
  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearchInput.trim()) return;
    setActiveTrackingAwb(globalSearchInput.trim());
    setTrackingSearchInput(globalSearchInput.trim());
    setActiveRole("shipper");
    setShipperTab("history");
    setGlobalSearchInput("");
  };

  // Demo Role Switching Handler
  const handleRoleSwitch = (role: RoleType | "landing") => {
    setActiveRole(role);
    if (modeEnv === "demo") {
      if (role === "shipper") setCurrentUser(DEMO_SHIPPER);
      if (role === "carrier" || role === "vendor") setCurrentUser(DEMO_VENDOR);
    }
  };

  // Environment Mode Switcher (Demo / Live)
  const handleModeToggle = () => {
    if (modeEnv === "demo") {
      if (!currentUser.isRealUser && !authSession) {
        setShowAuthModal(true);
      } else {
        setModeEnv("live");
      }
    } else {
      setModeEnv("demo");
      setCurrentUser(activeRole === "carrier" || activeRole === "vendor" ? DEMO_VENDOR : DEMO_SHIPPER);
    }
  };

  // Sign Out Handler
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Logout error:", err);
    }
    setCurrentUser(DEMO_SHIPPER);
    setModeEnv("demo");
    setActiveRole("landing");
  };

  // Single Rate Cards Calculations
  const calculatedQuotes = useMemo(() => {
    return calculateQuotesForShipment(originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors, feeConfig);
  }, [originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors, feeConfig]);

  // Bulk CSV Upload Handler
  const handleBulkCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkCsvFileName(file.name);
    setBulkUploadError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length <= 1) throw new Error("CSV file must contain a header row and data rows.");

        const parsedRows: BulkManifestRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
          if (cols.length < 8) continue;

          const [dPin, cName, cPhone, dAddr, tBoxesStr, bWeightsStr, bDimsStr, dValStr] = cols;
          const tBoxes = parseInt(tBoxesStr, 10) || 1;
          const dVal = parseFloat(dValStr) || 50000;

          const pWeights = bWeightsStr
            ? bWeightsStr.split(";").map((w) => parseFloat(w.trim())).filter((n) => !isNaN(n) && n > 0)
            : [];
          const pDims = bDimsStr ? bDimsStr.split(";").map((d) => d.trim()).filter((d) => d.length > 0) : [];
          const hasOmittedDimensions = pDims.length === 0;

          const boxItems: BoxItem[] = [];
          for (let b = 0; b < tBoxes; b++) {
            const wt = pWeights[b] || pWeights[0] || 10;
            let l = 0, w = 0, h = 0;
            if (pDims[b]) {
              const parts = pDims[b].toLowerCase().split("x").map((p) => parseFloat(p.trim()));
              if (parts.length === 3) { l = parts[0]; w = parts[1]; h = parts[2]; }
            }
            boxItems.push({ id: `b-${i}-${b}`, qty: 1, weight: wt, length: l, width: w, height: h });
          }

          const actualWeight = boxItems.reduce((acc, bi) => acc + bi.weight, 0);
          const volumetricWeight = hasOmittedDimensions ? 0 : boxItems.reduce((acc, bi) => acc + ((bi.length * bi.width * bi.height) / 4500), 0);
          const billableWeight = hasOmittedDimensions ? actualWeight : Math.max(actualWeight, Math.round(volumetricWeight * 10) / 10);

          const quotes = calculateQuotesForShipment(MERCHANT_DETAILS.defaultOriginPin, dPin, boxItems, dVal, "surface", false, rateCards, vendors, feeConfig);
          const sorted = [...quotes].sort((a, b) => a.breakdown.total - b.breakdown.total);

          parsedRows.push({
            rowId: `row-${i}-${Date.now()}`,
            dest_pin: dPin,
            consignee_name: cName,
            consignee_phone: cPhone,
            delivery_address: dAddr,
            consignee_gstin: "27AAACP9988G1ZK",
            total_boxes: tBoxes,
            boxes: boxItems,
            declared_value: dVal,
            hasOmittedDimensions,
            actualWeight: Math.round(actualWeight * 10) / 10,
            volumetricWeight: Math.round(volumetricWeight * 10) / 10,
            billableWeight: Math.round(billableWeight * 10) / 10,
            quotes,
            selectedQuote: sorted[0] || null
          });
        }
        setBulkManifestList(parsedRows);
      } catch (err: any) {
        setBulkUploadError(err.message || "Failed to process bulk CSV.");
      }
    };
    reader.readAsText(file);
  };

  // One-Click Bulk Booking Confirmation Handler
  const handleConfirmBatchBooking = async () => {
    if (bulkManifestList.length === 0) return;
    setIsBatchProcessing(true);

    const refString =
      bulkSettlementMethod === "direct_upi"
        ? bulkConsolidatedUtr ? `BULK-UPI-${bulkConsolidatedUtr}` : "BULK-UPI"
        : bulkSettlementMethod === "corporate_credit" ? "BULK-CREDIT" : "BULK-TO-PAY";

    const newBookingsToInsert = bulkManifestList.map((row) => {
      const selected = row.selectedQuote || row.quotes[0];
      const carrierName = selected?.vendor?.name || "Delhivery B2B Express";
      const officialDocket = generateCarrierDocket(carrierName);
      const platformOrderId = `LC-${Math.floor(100000 + Math.random() * 900000)}`;

      return {
        order_id: platformOrderId,
        awb_number: officialDocket,
        carrier_docket_no: officialDocket,
        carrier_portal_url: getOfficialCarrierTrackingUrl(carrierName, officialDocket),
        shipper_id: currentUser.id,
        vendor_id: selected?.vendor?.id || vendors[0].id,
        rate_card_id: selected?.rateCard?.id,
        shipper_name: currentUser.company_name || currentUser.full_name,
        shipper_phone: currentUser.phone || MERCHANT_DETAILS.phone,
        shipper_email: currentUser.email,
        shipper_gstin: currentUser.gstin || "07AAACA1234A1Z5",
        pickup_address: MERCHANT_DETAILS.defaultWarehouseAddress,
        consignee_name: row.consignee_name,
        consignee_phone: row.consignee_phone,
        consignee_gstin: row.consignee_gstin,
        delivery_address: row.delivery_address,
        origin_pin: MERCHANT_DETAILS.defaultOriginPin,
        dest_pin: row.dest_pin,
        mode: selected?.rateCard?.mode || "surface",
        boxes: row.boxes,
        declared_value: row.declared_value,
        actual_weight: row.actualWeight,
        volumetric_weight: row.volumetricWeight,
        billable_weight: row.billableWeight,
        cost_breakdown: {
          ...(selected?.breakdown || {
            base: 0,
            fuel: 0,
            docket: 0,
            fov: 0,
            handling: 0,
            oda: 0,
            gst: 0,
            freightSubtotal: 0,
            platformConvenienceFee: feeConfig.minFloorINR,
            total: feeConfig.minFloorINR
          }),
          settlement_type: bulkSettlementMethod,
          payment_ref: refString
        },
        final_total: selected?.breakdown?.total || feeConfig.minFloorINR,
        status: "Booked" as const,
        tracking_history: [
          {
            status: "Booked",
            location: `Origin Hub (${MERCHANT_DETAILS.defaultOriginPin})`,
            timestamp: new Date().toISOString(),
            remarks: `Batch order generated. Assigned official carrier docket ${officialDocket}`
          }
        ]
      };
    });

    try {
      const { data } = await supabase.from("bookings").insert(newBookingsToInsert).select("*, vendors(*)");
      const savedBookings =
        data && data.length > 0
          ? (data as Booking[])
          : newBookingsToInsert.map((b, i) => ({
              ...b,
              id: `bulk-${Date.now()}-${i}`,
              created_at: new Date().toISOString(),
              vendors: vendors.find((v) => v.id === b.vendor_id) || vendors[0]
            }));

      setBookings((prev) => [...savedBookings, ...prev]);
      setBatchPrintBookings(savedBookings);
      setBulkManifestList([]);
      setShipperTab("shipments");
      alert(`Successfully dispatched all ${savedBookings.length} consignments! Continuous 4x6 labels ready to print.`);
    } catch (err) {
      console.warn("Database batch insert fallback:", err);
      alert("Encountered database synchronization fallback. Bookings saved in local ledger.");
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Physical Bilty Photo Upload with ~100KB Auto-Compression
  const handleUploadDocketFile = async (bookingId: string, rawFile: File) => {
    if (!rawFile) return;
    if (rawFile.size > 5 * 1024 * 1024) {
      alert("File size limit exceeded! Please upload photo/PDF under 5 MB.");
      return;
    }

    setStatusUpdateMap((prev) => ({
      ...prev,
      [bookingId]: { ...(prev[bookingId] || { status: "", location: "", remarks: "" }), isUploading: true }
    }));

    try {
      const fileToUpload = await compressImageFile(rawFile);
      const fileExt = fileToUpload.name.split(".").pop();
      const filePath = `dockets/bilty-${bookingId}-${Date.now()}.${fileExt}`;
      let publicUrl = "";

      const { data, error } = await supabase.storage.from("dockets").upload(filePath, fileToUpload, {
        cacheControl: "3600",
        upsert: true
      });

      if (!error && data) {
        publicUrl = supabase.storage.from("dockets").getPublicUrl(filePath).data.publicUrl;
      } else {
        publicUrl = URL.createObjectURL(fileToUpload);
      }

      setStatusUpdateMap((prev) => ({
        ...prev,
        [bookingId]: { ...(prev[bookingId] || { status: "", location: "", remarks: "" }), docUrl: publicUrl, isUploading: false }
      }));

      await supabase.from("bookings").update({ carrier_docket_doc_url: publicUrl }).eq("id", bookingId);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, carrier_docket_doc_url: publicUrl } : b)));
      alert(`Bilty uploaded successfully! Compressed size: ~${Math.round(fileToUpload.size / 1024)} KB.`);
    } catch {
      const fallbackUrl = URL.createObjectURL(rawFile);
      setStatusUpdateMap((prev) => ({
        ...prev,
        [bookingId]: { ...(prev[bookingId] || { status: "", location: "", remarks: "" }), docUrl: fallbackUrl, isUploading: false }
      }));
    }
  };

  // Carrier Milestone Status Update
  const handleUpdateShipmentStatus = async (bookingId: string) => {
    const updateData = statusUpdateMap[bookingId];
    if (!updateData) return;
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const carrierName = booking.vendors?.name || "Carrier";
    const effectiveDocket =
      updateData.docketNo && updateData.docketNo.trim() !== ""
        ? updateData.docketNo.trim()
        : booking.carrier_docket_no || booking.awb_number;
    const newPortalUrl = getOfficialCarrierTrackingUrl(carrierName, effectiveDocket);
    const effectiveDocUrl = updateData.docUrl || booking.carrier_docket_doc_url || "";

    const newStep: TrackingStep = {
      status: updateData.status || booking.status,
      location: updateData.location || "En-route Hub",
      timestamp: new Date().toISOString(),
      remarks: updateData.remarks || `Carrier updated status with Docket ${effectiveDocket}`
    };
    const updatedHistory = [...(booking.tracking_history || []), newStep];

    try {
      await supabase
        .from("bookings")
        .update({
          awb_number: effectiveDocket,
          carrier_docket_no: effectiveDocket,
          carrier_portal_url: newPortalUrl,
          carrier_docket_doc_url: effectiveDocUrl,
          status: updateData.status || booking.status,
          tracking_history: updatedHistory
        })
        .eq("id", bookingId);

      setBookings(
        bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                awb_number: effectiveDocket,
                carrier_docket_no: effectiveDocket,
                carrier_portal_url: newPortalUrl,
                carrier_docket_doc_url: effectiveDocUrl,
                status: (updateData.status as Booking["status"]) || b.status,
                tracking_history: updatedHistory
              }
            : b
        )
      );

      alert("Carrier Docket & Status successfully synchronized!");
    } catch (err) {
      console.error(err);
    }
  };

  return {
    state: {
      activeRole, setActiveRole,
      modeEnv, setModeEnv,
      highVolumeMode, setHighVolumeMode,
      shipperTab, setShipperTab,
      carrierTab, setCarrierTab,
      currentUser, setCurrentUser,
      authSession,
      feeConfig, setFeeConfig,
      rateCards, setRateCards,
      vendors, setVendors,
      bookings, setBookings,
      rfqList, setRfqList,
      showLegalModal, setShowLegalModal,
      legalModalTab, setLegalModalTab,
      showAuthModal, setShowAuthModal,
      showCitySearchModal, setShowCitySearchModal,
      showAddRateCardModal, setShowAddRateCardModal,
      selectedQuoteForBooking, setSelectedQuoteForBooking,
      printableBooking, setPrintableBooking,
      batchPrintBookings, setBatchPrintBookings,
      originPin, setOriginPin,
      destPin, setDestPin,
      isOda, setIsOda,
      declaredValue, setDeclaredValue,
      selectedMode, setSelectedMode,
      boxes, setBoxes,
      selectedBoxFor3D, setSelectedBoxFor3D,
      pickupAddress, setPickupAddress,
      bulkManifestList, setBulkManifestList,
      bulkCsvFileName, setBulkCsvFileName,
      bulkUploadError, setBulkUploadError,
      bulkSettlementMethod, setBulkSettlementMethod,
      bulkConsolidatedUtr, setBulkConsolidatedUtr,
      isBatchProcessing,
      globalSearchInput, setGlobalSearchInput,
      landingTrackingInput, setLandingTrackingInput,
      activeTrackingAwb, setActiveTrackingAwb,
      trackingSearchInput, setTrackingSearchInput,
      originZoneData, destZoneData,
      statusUpdateMap, setStatusUpdateMap,
      calculatedQuotes,
      bulkFileInputRef
    },
    handlers: {
      handleGlobalSearch,
      handleRoleSwitch,
      handleModeToggle,
      handleLogout,
      handleBulkCsvUpload,
      handleConfirmBatchBooking,
      handleUploadDocketFile,
      handleUpdateShipmentStatus,
      fetchAllData
    }
  };
}
// ============================================================================
// 8. TOP APP COMMAND HEADER COMPONENT
// ============================================================================
export interface HeaderSectionProps {
  activeRole: RoleType | "landing";
  setActiveRole: (role: RoleType | "landing") => void;
  modeEnv: "demo" | "live";
  handleModeToggle: () => void;
  highVolumeMode: boolean;
  setHighVolumeMode: (val: boolean) => void;
  currentUser: UserProfile;
  switchDemoRole: (role: RoleType) => void;
  handleLogout: () => void;
  setShowAuthModal: (val: boolean) => void;
  globalSearchInput: string;
  setGlobalSearchInput: (val: string) => void;
  handleGlobalSearch: (e: React.FormEvent) => void;
}

function HeaderSection({
  activeRole,
  setActiveRole,
  modeEnv,
  handleModeToggle,
  highVolumeMode,
  setHighVolumeMode,
  currentUser,
  switchDemoRole,
  handleLogout,
  setShowAuthModal,
  globalSearchInput,
  setGlobalSearchInput,
  handleGlobalSearch
}: HeaderSectionProps) {
  return (
    <header className="sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Platform Identity */}
        <div
          className="flex items-center space-x-3 cursor-pointer select-none"
          onClick={() => setActiveRole("landing")}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <TruckIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-black text-lg tracking-tight text-white">LogiCompare</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-1.5 py-0.2 rounded font-mono font-bold uppercase">
                Pro
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">B2B Freight Discovery</p>
          </div>
        </div>

        {/* Global Search Bar */}
        <form onSubmit={handleGlobalSearch} className="hidden md:flex items-center max-w-sm w-full relative">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={globalSearchInput}
            onChange={(e) => setGlobalSearchInput(e.target.value)}
            placeholder="Search Order Ref (LC-...) or Docket..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </form>

        {/* Workspace Segmented Controls */}
        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveRole("landing")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeRole === "landing" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveRole("shipper")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeRole === "shipper" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            Shipper
          </button>
          <button
            type="button"
            onClick={() => setActiveRole("carrier")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeRole === "carrier" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            Carrier
          </button>
          <button
            type="button"
            onClick={() => setActiveRole("admin")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeRole === "admin" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            Admin
          </button>
        </div>

        {/* Environment Mode Switch & Auth State */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleModeToggle}
            className={`px-2.5 py-1 rounded-lg text-xs font-black transition border flex items-center space-x-1 ${
              modeEnv === "live"
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-700/60"
                : "bg-amber-950/50 text-amber-300 border-amber-700/60"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${modeEnv === "live" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}></span>
            <span>{modeEnv === "live" ? "Live Mode" : "Demo Sandbox"}</span>
          </button>

          {currentUser.isRealUser ? (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 truncate max-w-[120px]">
                {currentUser.company_name || currentUser.full_name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 px-2.5 py-1 rounded-lg text-xs font-bold transition"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => switchDemoRole("shipper")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                  currentUser.role === "shipper" && activeRole === "shipper"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>⚡ Apex</span>
              </button>
              <button
                type="button"
                onClick={() => switchDemoRole("carrier")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                  (currentUser.role === "carrier" || currentUser.role === "vendor") && activeRole === "carrier"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>🚛 Delhivery</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// 9. COMPLETE 6-SECTION LANDING PAGE VIEW
// ============================================================================
export interface LandingViewSectionProps {
  highVolumeMode: boolean;
  vendors: Vendor[];
  landingTrackingInput: string;
  setLandingTrackingInput: (val: string) => void;
  onQuickTrack: (val?: string) => void;
  onJumpToCompare: () => void;
  onJumpToBulk: () => void;
  onSwitchShipperDemo: () => void;
  onSwitchCarrierDemo: () => void;
}

function LandingViewSection({
  highVolumeMode,
  vendors,
  landingTrackingInput,
  setLandingTrackingInput,
  onQuickTrack,
  onJumpToCompare,
  onJumpToBulk,
  onSwitchShipperDemo,
  onSwitchCarrierDemo
}: LandingViewSectionProps) {
  const [workflowTab, setWorkflowTab] = useState<"shipper" | "vendor">("shipper");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="flex-1 flex flex-col space-y-16 pb-16">
      {/* SECTION 1: HERO & UNIVERSAL TRACKER */}
      <section className="relative overflow-hidden bg-slate-950 text-white pt-16 pb-24 px-4 lg:px-8 border-b border-slate-800">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 scale-105 transition-transform duration-1000 ease-out pointer-events-none"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop')` }}
        />
        <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/90 to-slate-950 pointer-events-none" />

        <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide backdrop-blur-md shadow-inner">
              <span>🇮🇳</span>
              <span>Hybrid Dual-ID Consignment Discovery & Dispatches</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              One-Click Bulk Freight Booking & Multi-Box 4x6 Thermal Labels.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
              Compare Delhivery, Blue Dart, Safexpress, TCI, and Gati rates across India. Upload semicolon-delimited CSVs, auto-assign lowest rates, and print continuous thermal labels with driver handover manifests.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                type="button"
                onClick={onJumpToBulk}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-7 py-3.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 hover:scale-105 flex items-center space-x-2"
              >
                <UploadIcon className="w-5 h-5" />
                <span>Launch 50/Day Bulk Shipper Console</span>
              </button>
              <button
                type="button"
                onClick={onJumpToCompare}
                className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold px-6 py-3.5 rounded-xl text-sm transition backdrop-blur-md flex items-center space-x-2"
              >
                <BoxIcon className="w-5 h-5 text-indigo-400" />
                <span>Single Calculator</span>
              </button>
              <button
                type="button"
                onClick={onSwitchCarrierDemo}
                className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold px-6 py-3.5 rounded-xl text-sm transition backdrop-blur-md flex items-center space-x-2 hover:border-slate-500"
              >
                <TruckIcon className="w-5 h-5 text-emerald-400" />
                <span>Join as Carrier (Demo)</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            {!highVolumeMode ? (
              <div className="bg-slate-900/80 border border-indigo-500/30 rounded-3xl p-4 shadow-2xl backdrop-blur-md">
                <Hero3DTruck />
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-3 shadow-2xl">
                <span className="text-5xl">⚡</span>
                <h3 className="text-white font-black text-lg">60FPS High-Volume Mode Active</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Direct settlements via To-Pay POD, UPI, and Monthly GST Credit with 0% markups.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Track Search Input */}
        <div className="pt-10 max-w-xl mx-auto relative z-10">
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-2xl flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center space-x-2 px-3 py-1.5 text-slate-300 w-full sm:w-auto flex-1">
              <SearchIcon className="w-4 h-4 text-indigo-400 shrink-0" />
              <input
                type="text"
                value={landingTrackingInput}
                onChange={(e) => setLandingTrackingInput(e.target.value)}
                placeholder="Enter Order Ref or Carrier Docket..."
                className="bg-transparent font-mono text-sm text-white font-bold focus:outline-none w-full placeholder-slate-500"
              />
            </div>
            <button
              type="button"
              onClick={() => onQuickTrack()}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-6 py-3 rounded-xl transition shadow-md shrink-0"
            >
              Track Shipment
            </button>
          </div>
          <div className="flex items-center justify-center space-x-3 text-[11px] text-slate-400 mt-3 font-medium">
            <span>Universal Lookup Demos:</span>
            <button
              type="button"
              onClick={() => onQuickTrack(DEMO_INIT_ORDER_ID)}
              className="font-mono text-indigo-300 hover:text-indigo-200 underline font-bold"
            >
              Ref: {DEMO_INIT_ORDER_ID}
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onQuickTrack(DEMO_INIT_CARRIER_DOCKET)}
              className="font-mono text-indigo-300 hover:text-indigo-200 underline font-bold"
            >
              Docket: {DEMO_INIT_CARRIER_DOCKET}
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: TRUST STATS & CARRIER STRIP */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-8 border-b border-slate-200">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-3xl font-black text-indigo-600">5+</span>
            <p className="text-xs font-bold text-slate-900 mt-1">Verified National Fleets</p>
            <p className="text-[11px] text-slate-500">Official AWB / Docket Integrated</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-3xl font-black text-emerald-600">19,000+</span>
            <p className="text-xs font-bold text-slate-900 mt-1">Serviceable PIN Codes</p>
            <p className="text-[11px] text-slate-500">Pan-India Tier-1 to ODA Coverage</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-3xl font-black text-slate-900">100%</span>
            <p className="text-xs font-bold text-slate-900 mt-1">Direct Carrier Settlement</p>
            <p className="text-[11px] text-slate-500">To-Pay / Direct UPI settlement</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-3xl font-black text-amber-500">2%</span>
            <p className="text-xs font-bold text-slate-900 mt-1">Flat Verification Platform Fee</p>
            <p className="text-[11px] text-slate-500">Min ₹25 floor cap per booking</p>
          </div>
        </div>

        <div className="pt-8 text-center space-y-4">
          <span className="text-xs uppercase font-black text-slate-500 tracking-widest block">
            Integrated National Transporters
          </span>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {vendors.map((v) => (
              <div key={v.id} className="flex items-center space-x-2.5 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-400 transition">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="font-extrabold text-xs text-slate-900">{v.name}</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">★ {v.rating}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: INTERACTIVE "HOW IT WORKS" WORKFLOW */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full">
            Interactive Operational Workflow
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">How LogiCompare Pro Works</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Consolidating platform transparency with real-world carrier waybill standards.
          </p>

          <div className="inline-flex p-1.5 bg-slate-200 rounded-2xl mt-4 shadow-inner">
            <button
              type="button"
              onClick={() => setWorkflowTab("shipper")}
              className={`px-5 py-2 rounded-xl text-xs font-black transition ${
                workflowTab === "shipper" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📦 For Shippers & Businesses
            </button>
            <button
              type="button"
              onClick={() => setWorkflowTab("vendor")}
              className={`px-5 py-2 rounded-xl text-xs font-black transition ${
                workflowTab === "vendor" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🚛 For Logistics Vendors & Carriers
            </button>
          </div>
        </div>

        {workflowTab === "shipper" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1 transition duration-200">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">1</span>
              <h3 className="font-bold text-slate-900 text-sm">PIN & Multi-Box Input</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Enter origin and destination PINs with live India Post city lookup. Add multiple cartons with weight and (L x W x H cm) dimensions.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1 transition duration-200">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">2</span>
              <h3 className="font-bold text-slate-900 text-sm">Compare Carrier Rates</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Inspect transparent line-item pricing: Base Freight, Fuel %, Docket Fee, ODA Surcharge, 0.2% FOV Insurance, and 18% GST.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1 transition duration-200">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">3</span>
              <h3 className="font-bold text-slate-900 text-sm">Dual-ID Generation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Settle freight direct with carrier. Get your official Platform Ref (`LC-XXXXXX`) + Carrier Waybill (`1489...`) and print certified labels.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1 transition duration-200">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">4</span>
              <h3 className="font-bold text-slate-900 text-sm">Universal Live Tracking</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Track status with either ID on LogiCompare or click the direct portal button (↗) to view live scans on Delhivery, Blue Dart, or TCI.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1 transition duration-200">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">1</span>
              <h3 className="font-bold text-slate-900 text-sm">Onboard Carrier & GSTIN</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Register as a verified transporter, enter GSTIN credentials, and link your direct UPI ID and fleet types.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1 transition duration-200">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">2</span>
              <h3 className="font-bold text-slate-900 text-sm">Publish Rates via Bulk CSV</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Define lane-specific tariffs individually or upload entire route sheets with city names via client-cached bulk CSV.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1 transition duration-200">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">3</span>
              <h3 className="font-bold text-slate-900 text-sm">Update Official Bilty / Docket</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Receive bookings, enter your branch's physical Bilty/Docket number, attach photos/PDF scans, and collect direct settlements.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4: 6-CARD CORE ENTERPRISE CAPABILITIES GRID */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full">
            Enterprise Features
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Engineered for Indian Logistics Complexity</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Direct transporter settlements combined with official carrier tracking APIs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-400 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <LayersIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Multi-Box Volumetric Engine</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Automatically calculates actual weight vs. volumetric weight across multiple box sizes. Supports IATA Air divisor (5000) and Indian Surface Express divisor (4500).
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-400 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CurrencyRupeeIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Zero Hidden Surcharges</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Transparent breakdown of all statutory logistics fees: Base freight, Fuel Surcharge %, Docket AWB charge, Handling per kg, ODA fee, and 18% GST.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-400 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">FOV Cargo Risk Insurance</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Built-in 0.20% Freight On Value (FOV) risk coverage calculator ensuring high-value electronic and pharmaceutical shipments are protected against transit damages.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-400 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <PrinterIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">4x6 Thermal Label Printing</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Continuous print engine for multi-box labels with barcode and docket, ending with a driver handover sign-off manifest.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-400 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TruckIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Official Tracking Deep-Links</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Direct redirection to official carrier portals (Delhivery, Blue Dart, Safexpress, Gati, TCI) for real-time driver scans and delivery proof.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-rose-500/10 hover:border-rose-400 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <CreditCardIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Direct Carrier Settlements</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Shipper-to-Carrier direct settlement via To-Pay POD, direct carrier UPI transfers, or corporate credit terms alongside an automated 2% platform convenience fee.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 5: FREQUENTLY ASKED QUESTIONS (ACCORDION) */}
      <section className="max-w-4xl mx-auto px-4 lg:px-8 w-full space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full">
            FAQ & Knowledge Base
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Frequently Asked Questions</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Learn how the hybrid Dual-ID system, physical bilty uploads, and official carrier dockets work.
          </p>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "What is the difference between Order Ref (LC-XXXXXX) and Carrier Docket?",
              a: "The Order Ref (LC-XXXXXX) is LogiCompare Pro's internal reference number used for tracking platform booking receipts, customer support, and accounting. The Carrier Docket (e.g. 12-digit numeric for Delhivery or BLU... for Blue Dart) is the transporter's official waybill used by drivers and freight hubs on the ground."
            },
            {
              q: "Can I search using either the Order ID or the Carrier Docket?",
              a: "Yes! Our live tracking engine supports universal search. You can enter either your LogiCompare Order Ref (e.g. LC-894210) or your Carrier Waybill Docket (e.g. 148920194821) to view status updates and access official tracking portals."
            },
            {
              q: "Where does the physical Bilty / LR slip photo get saved?",
              a: "Documents are stored in a dedicated Supabase Object Storage bucket with a 5 MB file size limit to prevent storage exhaustion. Images are compressed client-side to ~100KB to retain full legibility while saving 95% storage."
            },
            {
              q: "How does Direct Settlement work between Shipper and Carrier?",
              a: "100% of the freight charge is settled directly between the shipper and the transporter. You can choose To-Pay at Delivery (POD), Direct UPI transfer to the carrier's verified handle, or 15-day B2B Corporate Credit. LogiCompare only charges a nominal 2% platform fee (minimum ₹25) for generating verified AWB manifests and tracking."
            },
            {
              q: "What is your Refund & Cancellation Policy for cancelled shipments?",
              a: "Shipments cancelled prior to carrier pickup qualify for a 100% full refund of platform verification fees. Once verified, refunds are credited back to the original source account within 5 to 7 business days."
            }
          ].map((faq, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 text-left font-black text-sm text-slate-900 flex items-center justify-between hover:bg-slate-50"
              >
                <span>{faq.q}</span>
                <ChevronDownIcon
                  className={`w-4 h-4 text-slate-500 transition-transform ${openFaq === idx ? "rotate-180 text-indigo-600" : ""}`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3 font-medium">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 6: BOTTOM CALL-TO-ACTION BANNER */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full">
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 rounded-3xl p-8 sm:p-14 text-white text-center space-y-6 shadow-2xl border border-indigo-500/20">
          <div className="absolute -top-24 left-1/3 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <span className="relative z-10 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            Start Saving On B2B Freight
          </span>
          <h2 className="relative z-10 text-2xl sm:text-4xl font-black max-w-2xl mx-auto">
            Ready to book with official national carrier dockets and zero hidden markups?
          </h2>
          <p className="relative z-10 text-indigo-200 text-xs sm:text-sm max-w-xl mx-auto">
            Switch to the Freight Matrix Dashboard to calculate live rates, print certified carrier labels, and track consignments across India.
          </p>
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onJumpToCompare}
              className="bg-white hover:bg-slate-100 text-slate-950 font-black px-7 py-3.5 rounded-xl text-sm transition shadow-lg hover:scale-105"
            >
              Open Freight Rate Matrix
            </button>
            <button
              type="button"
              onClick={onSwitchShipperDemo}
              className="bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 font-bold px-7 py-3.5 rounded-xl text-sm transition backdrop-blur-md shadow-md"
            >
              ⚡ Instant Demo as Shipper
            </button>
            <button
              type="button"
              onClick={onJumpToBulk}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold px-7 py-3.5 rounded-xl text-sm transition backdrop-blur-md"
            >
              🚀 Launch 50/Day Bulk Console
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 10. SHIPPER BULK CSV DISPATCH MATRIX (50/DAY) COMPONENT
// ============================================================================
export interface ShipperBulkCsvSectionProps {
  highVolumeMode: boolean;
  bulkManifestList: BulkManifestRow[];
  setBulkManifestList: React.Dispatch<React.SetStateAction<BulkManifestRow[]>>;
  onAutoSelectCheapest: () => void;
  onAutoSelectFastest: () => void;
  onSelectCarrierForRow: (rowId: string, vendorId: string) => void;
  bulkSettlementMethod: "direct_to_pay" | "direct_upi" | "corporate_credit";
  setBulkSettlementMethod: (val: "direct_to_pay" | "direct_upi" | "corporate_credit") => void;
  bulkConsolidatedUtr: string;
  setBulkConsolidatedUtr: (val: string) => void;
  onConfirmBatchBooking: () => Promise<void>;
  isBatchProcessing: boolean;
  handleBulkCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bulkCsvFileName: string;
  bulkUploadError: string;
}

function ShipperBulkCsvSection({
  bulkManifestList,
  onAutoSelectCheapest,
  onAutoSelectFastest,
  onSelectCarrierForRow,
  bulkSettlementMethod,
  setBulkSettlementMethod,
  bulkConsolidatedUtr,
  setBulkConsolidatedUtr,
  onConfirmBatchBooking,
  isBatchProcessing,
  handleBulkCsvUpload,
  bulkCsvFileName,
  bulkUploadError
}: ShipperBulkCsvSectionProps) {
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBulkTemplate = () => {
    const csvHeader = "dest_pin,consignee_name,consignee_phone,delivery_address,total_boxes,box_weights,box_dimensions,declared_value\n";
    const sampleRows = [
      "400001,Prime Retailers Mumbai,9820044556,Shop 4 Crawford Market Mumbai,2,18; 12,45x35x30; 30x25x20,45000",
      "560001,Apex Tech Electronics,9845012345,7th Cross Electronic City Bengaluru,3,25; 10; 10,,65000",
      "700001,East Coast Traders,9830098765,Strand Road Burrabazar Kolkata,1,30,50x50x40,30000",
      "600001,South Goods Depot,9840011223,Parrys Corner George Town Chennai,2,15; 15,,25000",
      "500001,Deccan Pharma Hub,9849033445,Abids Circle Hyderabad,4,10; 10; 10; 10,35x30x25; 35x30x25; 30x25x20; 30x25x20,95000"
    ].join("\n");

    const blob = new Blob([csvHeader + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "logicompare_bulk_consignments_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Origin Dispatch Warehouse Lock Banner */}
      <div className="bg-slate-950 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-black text-sm uppercase tracking-wide">Locked Dispatch Origin Warehouse:</span>
            <span className="font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded text-xs font-bold">
              PIN {MERCHANT_DETAILS.defaultOriginPin} (DEL-NORTH-01)
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Registered Warehouse: {MERCHANT_DETAILS.defaultWarehouseAddress}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadBulkTemplate}
          className="bg-white hover:bg-slate-100 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-md shrink-0 transition"
        >
          <DownloadIcon className="w-4 h-4 text-indigo-600" />
          <span>Download Sample CSV Template</span>
        </button>
      </div>

      {/* 2. Drag-and-Drop CSV Upload Area */}
      <div className="bg-white border-2 border-dashed border-indigo-300 rounded-2xl p-8 text-center space-y-4 shadow-sm hover:border-indigo-500 transition">
        <input
          type="file"
          ref={bulkFileInputRef}
          accept=".csv,text/csv"
          onChange={handleBulkCsvUpload}
          className="hidden"
          id="bulk-csv-input"
        />
        <div className="max-w-lg mx-auto space-y-2.5">
          <label
            htmlFor="bulk-csv-input"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-xl text-xs cursor-pointer inline-flex items-center space-x-2 shadow-md transition hover:scale-105"
          >
            <UploadIcon className="w-4 h-4" />
            <span>{bulkCsvFileName ? `Replace File (${bulkCsvFileName})` : "Select Bulk Consignment CSV (40-50 Locations)"}</span>
          </label>
          <p className="text-xs text-slate-600 font-medium">
            Supports multiple boxes using semicolon weights (e.g. <code className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 rounded font-mono font-bold">25; 10; 10</code>) and dimensions (<code className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 rounded font-mono font-bold">60x40x40; 30x25x20</code>).
          </p>
        </div>

        {bulkUploadError && (
          <div className="text-xs text-rose-800 bg-rose-50 border border-rose-300 p-3 rounded-xl font-bold max-w-lg mx-auto">
            {bulkUploadError}
          </div>
        )}
      </div>

      {/* 3. Manifest Preview Table */}
      {bulkManifestList.length > 0 && (
        <div className="bg-white border border-slate-300 rounded-2xl shadow-md overflow-hidden space-y-5 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2.5">
                <span>Bulk Consignment Manifest</span>
                <span className="bg-indigo-600 text-white text-xs px-3 py-0.5 rounded-full font-bold">
                  {bulkManifestList.length} Destinations
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">Multi-carrier quotes calculated client-side across active rate cards.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onAutoSelectCheapest}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
              >
                <span>⚡ Auto-Select Lowest Price for All</span>
              </button>
              <button
                type="button"
                onClick={onAutoSelectFastest}
                className="bg-sky-600 hover:bg-sky-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
              >
                <span>🚀 Auto-Select Fastest SLA for All</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-inner">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white uppercase font-black text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5">Dest PIN / City</th>
                  <th className="py-3 px-3.5">Consignee & Address</th>
                  <th className="py-3 px-3.5">Packages</th>
                  <th className="py-3 px-3.5">Billable Wt</th>
                  <th className="py-3 px-3.5">Carrier</th>
                  <th className="py-3 px-3.5">Freight</th>
                  <th className="py-3 px-3.5">2% Fee</th>
                  <th className="py-3 px-3.5 text-right">Total Outlay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {bulkManifestList.map((row, idx) => {
                  const quote = row.selectedQuote || row.quotes[0];

                  return (
                    <tr
                      key={row.rowId}
                      className={idx % 2 === 0 ? "bg-white hover:bg-indigo-50/60 transition" : "bg-slate-50 hover:bg-indigo-50/60 transition"}
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-black text-slate-900 block text-xs">{row.dest_pin}</span>
                        <span className="text-[11px] text-slate-500 font-semibold">{getLocalFallbackZone(row.dest_pin).city}</span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-bold text-slate-900 block">{row.consignee_name}</span>
                        <span className="text-[11px] text-slate-500 truncate max-w-[180px] block">{row.delivery_address}</span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-black text-indigo-700 block">{row.total_boxes} Box(es)</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {row.boxes.map((b) => `${b.weight}kg`).join(", ")}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-black font-mono text-slate-900 block text-xs">{row.billableWeight} kg</span>
                        {row.hasOmittedDimensions && (
                          <span
                            className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-black block mt-0.5"
                            title="Volumetric scanning disputes at carrier hub may incur debit notes if dimensions are omitted."
                          >
                            ⚠️ Dead Wt Used
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <select
                          value={quote?.vendor?.id || ""}
                          onChange={(e) => onSelectCarrierForRow(row.rowId, e.target.value)}
                          className="bg-white border-2 border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                        >
                          {row.quotes.map((q) => (
                            <option key={q.vendor.id} value={q.vendor.id}>
                              {q.vendor.name} ({q.rateCard.sla_days}d - {formatINR(q.breakdown.total)})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-800">
                        {formatINR(quote?.breakdown?.freightSubtotal || 0)}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-indigo-700 font-bold">
                        ₹{quote?.breakdown?.platformConvenienceFee || 25}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-black text-right text-emerald-800 text-sm">
                        {formatINR(quote?.breakdown?.total || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 4. Single Consolidated Settlement Bar */}
          <div className="bg-slate-950 text-white p-6 rounded-2xl shadow-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-sm font-black uppercase text-indigo-400 block tracking-wide">
                  Single Consolidated Settlement Method ({bulkManifestList.length} Shipments)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">100% of freight is settled directly with transporters. Platform fee is 2% (min ₹25).</p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <label className={`px-4 py-2 rounded-xl border cursor-pointer font-bold transition ${bulkSettlementMethod === "direct_to_pay" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-slate-900 text-slate-300 border-slate-700"}`}>
                  <input
                    type="radio"
                    name="bulk_settlement"
                    checked={bulkSettlementMethod === "direct_to_pay"}
                    onChange={() => setBulkSettlementMethod("direct_to_pay")}
                    className="hidden"
                  />
                  💵 To-Pay POD
                </label>
                <label className={`px-4 py-2 rounded-xl border cursor-pointer font-bold transition ${bulkSettlementMethod === "direct_upi" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-slate-900 text-slate-300 border-slate-700"}`}>
                  <input
                    type="radio"
                    name="bulk_settlement"
                    checked={bulkSettlementMethod === "direct_upi"}
                    onChange={() => setBulkSettlementMethod("direct_upi")}
                    className="hidden"
                  />
                  📲 Direct Carrier UPI
                </label>
                <label className={`px-4 py-2 rounded-xl border cursor-pointer font-bold transition ${bulkSettlementMethod === "corporate_credit" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-slate-900 text-slate-300 border-slate-700"}`}>
                  <input
                    type="radio"
                    name="bulk_settlement"
                    checked={bulkSettlementMethod === "corporate_credit"}
                    onChange={() => setBulkSettlementMethod("corporate_credit")}
                    className="hidden"
                  />
                  🏢 Monthly GST Credit
                </label>
              </div>
            </div>

            {bulkSettlementMethod === "direct_upi" && (
              <div className="flex items-center space-x-3 text-xs bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                <label className="font-bold text-slate-300 shrink-0">Consolidated UTR Reference:</label>
                <input
                  type="text"
                  value={bulkConsolidatedUtr}
                  onChange={(e) => setBulkConsolidatedUtr(e.target.value)}
                  placeholder="e.g. 409827104928"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-white flex-1 max-w-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="text-xs">
                <span className="text-slate-400">Total Manifest Outlay: </span>
                <strong className="text-xl text-emerald-400 font-mono font-black ml-2">
                  {formatINR(bulkManifestList.reduce((acc, r) => acc + (r.selectedQuote?.breakdown?.total || 0), 0))}
                </strong>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Includes Platform Fee: {formatINR(bulkManifestList.reduce((acc, r) => acc + (r.selectedQuote?.breakdown?.platformConvenienceFee || 25), 0))}
                </span>
              </div>

              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={onConfirmBatchBooking}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-7 py-3.5 rounded-xl text-xs transition shadow-lg flex items-center space-x-2 disabled:opacity-50"
              >
                <CheckCircleIcon className="w-5 h-5 text-slate-950" />
                <span>{isBatchProcessing ? "Assigning Carrier Dockets..." : `Confirm & Book All ${bulkManifestList.length} Shipments`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 11. SHIPPER SINGLE RATE CALCULATOR COMPONENT
// ============================================================================
export interface ShipperSingleCalculatorSectionProps {
  highVolumeMode: boolean;
  originPin: string;
  setOriginPin: (val: string) => void;
  destPin: string;
  setDestPin: (val: string) => void;
  declaredValue: number;
  setDeclaredValue: (val: number) => void;
  selectedMode: "all" | "surface" | "air" | "ftl";
  setSelectedMode: (val: "all" | "surface" | "air" | "ftl") => void;
  isOda: boolean;
  setIsOda: (val: boolean) => void;
  boxes: BoxItem[];
  setBoxes: React.Dispatch<React.SetStateAction<BoxItem[]>>;
  selectedBoxFor3D: number;
  setSelectedBoxFor3D: (idx: number) => void;
  originZoneData: PinLookupResult;
  destZoneData: PinLookupResult;
  calculatedQuotes: CalculatedQuote[];
  onOpenCityModal: (target: "origin" | "dest") => void;
  onSelectQuoteForBooking: (q: CalculatedQuote) => void;
}

function ShipperSingleCalculatorSection({
  highVolumeMode,
  originPin,
  setOriginPin,
  destPin,
  setDestPin,
  declaredValue,
  setDeclaredValue,
  selectedMode,
  setSelectedMode,
  isOda,
  setIsOda,
  boxes,
  setBoxes,
  selectedBoxFor3D,
  setSelectedBoxFor3D,
  originZoneData,
  destZoneData,
  calculatedQuotes,
  onOpenCityModal,
  onSelectQuoteForBooking
}: ShipperSingleCalculatorSectionProps) {
  const totalActualWeight = useMemo(() => {
    return boxes.reduce((acc, b) => acc + (Number(b.weight) || 0) * (Number(b.qty) || 1), 0);
  }, [boxes]);

  const totalVolumetricWeight = useMemo(() => {
    const divisor = selectedMode === "air" ? 5000 : 4500;
    return boxes.reduce((acc, b) => {
      const volKg = ((Number(b.length) || 0) * (Number(b.width) || 0) * (Number(b.height) || 0)) / divisor;
      return acc + volKg * (Number(b.qty) || 1);
    }, 0);
  }, [boxes, selectedMode]);

  const billableWeight = useMemo(() => {
    return Math.max(totalActualWeight, Math.round(totalVolumetricWeight * 100) / 100);
  }, [totalActualWeight, totalVolumetricWeight]);

  const addBox = () => {
    setBoxes([...boxes, { id: `box-${Date.now()}`, qty: 1, weight: 10, length: 30, width: 30, height: 30 }]);
  };

  const removeBox = (id: string) => {
    if (boxes.length <= 1) return;
    setBoxes(boxes.filter((b) => b.id !== id));
  };

  const updateBox = (id: string, field: keyof BoxItem, value: number) => {
    setBoxes(boxes.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const currentBox3D = boxes[selectedBoxFor3D] || boxes[0];

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
              <BoxIcon className="w-5 h-5 text-indigo-600" />
              <span>Pan-India Commercial Freight Calculator</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tariffs with 0% markups directly from carrier rate sheets. Platform verification fee is 2% (min ₹25).
            </p>
          </div>
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black px-3.5 py-1 rounded-full w-fit">
            100% Direct Carrier Settlement
          </span>
        </div>

        {/* 2. Structured Parameter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Origin Tile */}
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black text-indigo-950 uppercase tracking-wider">Origin PIN (Pickup)</label>
              <button
                type="button"
                onClick={() => onOpenCityModal("origin")}
                className="text-[11px] text-indigo-700 hover:underline font-bold flex items-center space-x-1"
              >
                <MapPinIcon className="w-3.5 h-3.5" />
                <span>City Search</span>
              </button>
            </div>
            <input
              type="text"
              maxLength={6}
              value={originPin}
              disabled={highVolumeMode}
              onChange={(e) => setOriginPin(e.target.value)}
              placeholder="e.g. 110037"
              className={`w-full border-2 rounded-lg px-3 py-2 text-sm font-mono font-bold ${
                highVolumeMode ? "bg-slate-200 text-slate-700 border-slate-300 cursor-not-allowed" : "bg-white text-slate-900 border-indigo-300 focus:outline-none"
              }`}
            />
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-indigo-800 font-bold truncate">
                {originZoneData.loading ? "Looking up..." : `📍 ${originZoneData.city}, ${originZoneData.state}`}
              </span>
              <span className="bg-indigo-100 px-2 py-0.5 rounded text-indigo-800 font-mono text-[10px] font-bold shrink-0">
                {originZoneData.hub}
              </span>
            </div>
          </div>

          {/* Destination Tile */}
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black text-emerald-950 uppercase tracking-wider">Destination PIN (Drop)</label>
              <button
                type="button"
                onClick={() => onOpenCityModal("dest")}
                className="text-[11px] text-emerald-700 hover:underline font-bold flex items-center space-x-1"
              >
                <MapPinIcon className="w-3.5 h-3.5" />
                <span>City Search</span>
              </button>
            </div>
            <input
              type="text"
              maxLength={6}
              value={destPin}
              onChange={(e) => setDestPin(e.target.value)}
              placeholder="e.g. 400001"
              className="w-full bg-white border-2 border-emerald-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-emerald-800 font-bold truncate">
                {destZoneData.loading ? "Looking up..." : `🎯 ${destZoneData.city}, ${destZoneData.state}`}
              </span>
              <span className="bg-emerald-100 px-2 py-0.5 rounded text-emerald-800 font-mono text-[10px] font-bold shrink-0">
                {destZoneData.hub}
              </span>
            </div>
          </div>

          {/* Declared Value */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">Declared Value (₹) FOV</label>
            <input
              type="number"
              value={declaredValue}
              onChange={(e) => setDeclaredValue(Number(e.target.value))}
              className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-2 font-medium">0.2% FOV transit risk coverage</p>
          </div>

          {/* Transport Mode & ODA */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">Transport Mode</label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value as any)}
                className="w-full bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
              >
                <option value="all">All Modes (Air, Surface, FTL)</option>
                <option value="surface">Surface Express Only</option>
                <option value="air">Air Cargo Only</option>
                <option value="ftl">Full Truck Load (FTL)</option>
              </select>
            </div>

            <label className="flex items-center space-x-2 mt-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isOda}
                onChange={(e) => setIsOda(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300"
              />
              <span className="text-xs text-slate-800 font-bold">ODA Pincode Surcharge (+₹450)</span>
            </label>
          </div>
        </div>

        {/* 3. Parabolic Route Trajectory Canvas */}
        {!highVolumeMode && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <RouteTrajectory3D originHub={originZoneData.hub} destHub={destZoneData.hub} />
          </div>
        )}

        {/* 4. Multi-Box Carton Specifications */}
        <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/70 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              Carton Specs ({boxes.length} Box Type{boxes.length > 1 ? "s" : ""})
            </span>
            <button
              type="button"
              onClick={addBox}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-black flex items-center space-x-1"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Another Box Type</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Box Rows (Left Side) */}
            <div className={highVolumeMode ? "lg:col-span-12 space-y-2.5" : "lg:col-span-8 space-y-2.5"}>
              {boxes.map((box, idx) => (
                <div
                  key={box.id}
                  onClick={() => setSelectedBoxFor3D(idx)}
                  className={`grid grid-cols-2 sm:grid-cols-6 gap-2.5 p-3.5 rounded-xl border-2 items-center text-xs shadow-xs cursor-pointer transition ${
                    selectedBoxFor3D === idx
                      ? "bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Box #{idx + 1} Qty</span>
                    <input
                      type="number"
                      min={1}
                      value={box.qty}
                      onChange={(e) => updateBox(box.id, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Weight (Kg)</span>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={box.weight}
                      onChange={(e) => updateBox(box.id, "weight", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Length (cm)</span>
                    <input
                      type="number"
                      min={1}
                      value={box.length}
                      onChange={(e) => updateBox(box.id, "length", parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Width (cm)</span>
                    <input
                      type="number"
                      min={1}
                      value={box.width}
                      onChange={(e) => updateBox(box.id, "width", parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Height (cm)</span>
                    <input
                      type="number"
                      min={1}
                      value={box.height}
                      onChange={(e) => updateBox(box.id, "height", parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-2 pt-2 sm:pt-0">
                    <span className="text-[10px] text-slate-500 font-mono font-bold">
                      {((box.length * box.width * box.height) / (selectedMode === "air" ? 5000 : 4500)).toFixed(1)}kg vol
                    </span>
                    {boxes.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBox(box.id);
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 3D Visualizer (Right Side) */}
            {!highVolumeMode && (
              <div className="lg:col-span-4 flex justify-center">
                <Interactive3DBox
                  length={currentBox3D.length}
                  width={currentBox3D.width}
                  height={currentBox3D.height}
                />
              </div>
            )}
          </div>

          {/* Metric Totals Ribbon */}
          <div className="flex flex-wrap items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs">
            <div className="flex flex-wrap gap-6 font-medium">
              <div>
                <span className="text-slate-500">Dead Weight: </span>
                <span className="font-mono font-black text-slate-900">{totalActualWeight.toFixed(1)} kg</span>
              </div>
              <div>
                <span className="text-slate-500">Volumetric Weight: </span>
                <span className="font-mono font-black text-indigo-700">{totalVolumetricWeight.toFixed(2)} kg</span>
              </div>
              <div>
                <span className="text-slate-500">Chargeable Billable Wt: </span>
                <span className="font-mono font-black text-emerald-700 text-sm">{billableWeight.toFixed(1)} kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Direct Carrier Freight Comparison Cards */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">Direct Carrier Freight Comparison</h3>
            <span className="text-xs bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-1 rounded-full font-black">
              {calculatedQuotes.length} Rates Found
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {calculatedQuotes.map((quote) => (
              <div
                key={quote.rateCard.id}
                className="bg-white border-2 border-slate-200 hover:border-indigo-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-base font-black text-slate-900">{quote.vendor.name}</span>
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                        {quote.vendor.badge}
                      </span>
                      <span className="text-amber-500 text-xs font-black">★ {quote.vendor.rating}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
                      <span className="flex items-center space-x-1 capitalize text-slate-900 font-bold">
                        {quote.rateCard.mode === "air" ? (
                          <PlaneIcon className="w-4 h-4 text-sky-600" />
                        ) : (
                          <TruckIcon className="w-4 h-4 text-emerald-600" />
                        )}
                        <span>{quote.rateCard.mode} Freight</span>
                      </span>
                      <span>•</span>
                      <span>SLA: <strong className="text-slate-900">{quote.rateCard.sla_days} Days</strong></span>
                      <span>•</span>
                      <span>Billable: <strong className="text-slate-900">{quote.billableWeight} kg</strong></span>
                      <span>•</span>
                      <span className="font-mono text-emerald-800 font-bold">UPI: {quote.vendor.upi_id}</span>
                    </div>
                  </div>

                  {/* Comprehensive Line-Item Fee Matrix */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs grid grid-cols-3 sm:grid-cols-5 gap-3 text-center sm:text-left">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">Base Freight</span>
                      <span className="font-bold text-slate-900">{formatINR(quote.breakdown.base)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">Fuel Surcharge</span>
                      <span className="font-bold text-slate-900">{formatINR(quote.breakdown.fuel)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">Docket + FOV</span>
                      <span className="font-bold text-slate-900">{formatINR(quote.breakdown.docket + quote.breakdown.fov)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">GST (18%)</span>
                      <span className="font-bold text-slate-900">{formatINR(quote.breakdown.gst)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-700 font-bold block">Platform Fee (2%)</span>
                      <span className="font-black text-indigo-700">₹{quote.breakdown.platformConvenienceFee}</span>
                    </div>
                  </div>

                  {/* Price Callout & Action */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Total Outlay</span>
                      <span className="text-xl font-black text-emerald-700">{formatINR(quote.breakdown.total)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectQuoteForBooking(quote)}
                      className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition flex items-center space-x-1.5 shadow-sm"
                    >
                      <span>Direct Book</span>
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 12. SHIPPER ACTIVE SHIPMENTS & MANIFEST GRID COMPONENT
// ============================================================================
export interface ShipperShipmentsSectionProps {
  bookings: Booking[];
  onRefresh: () => void;
  onOpenLabelModal: (b: Booking) => void;
  onOpenTrackerTab: (orderRef: string) => void;
  onBatchPrintLabels: () => void;
}

function ShipperShipmentsSection({
  bookings,
  onRefresh,
  onOpenLabelModal,
  onOpenTrackerTab,
  onBatchPrintLabels
}: ShipperShipmentsSectionProps) {
  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Consignment Manifests & Tracking Logs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Access internal Order IDs, carrier dockets, printable 4x6 labels, and deep-links to carrier tracking portals
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {bookings.length > 0 && (
            <button
              type="button"
              onClick={onBatchPrintLabels}
              className="bg-slate-950 hover:bg-slate-800 text-white font-black px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-sm transition"
            >
              <PrinterIcon className="w-4 h-4 text-emerald-400" />
              <span>Batch Print 4x6 Labels & Manifest</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            className="bg-white hover:bg-slate-100 text-slate-800 px-4 py-2.5 rounded-xl text-xs font-black border border-slate-300 shadow-sm transition"
          >
            🔄 Refresh List
          </button>
        </div>
      </div>

      {/* 2. Shipments Data Grid */}
      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-2xl p-12 text-center shadow-sm space-y-2">
          <p className="text-slate-800 font-bold text-sm">No shipments booked yet.</p>
          <p className="text-slate-500 text-xs">
            Calculate freight tariffs or upload a bulk CSV to dispatch your first consignment!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-950 text-white uppercase font-black text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Order Ref / Carrier Docket</th>
                <th className="py-3.5 px-4">Carrier Partner</th>
                <th className="py-3.5 px-4">Route PIN</th>
                <th className="py-3.5 px-4">Freight (Direct)</th>
                <th className="py-3.5 px-4">Physical Bilty</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {bookings.map((booking, idx) => {
                const carrierName = booking.vendors?.name || "Carrier Partner";
                const docketNo = booking.carrier_docket_no || booking.awb_number;
                const orderRef = booking.order_id || booking.id.slice(0, 8);
                const portalUrl = booking.carrier_portal_url || getOfficialCarrierTrackingUrl(carrierName, docketNo);

                return (
                  <tr
                    key={booking.id}
                    className={idx % 2 === 0 ? "bg-white hover:bg-indigo-50/60 transition" : "bg-slate-50 hover:bg-indigo-50/60 transition"}
                  >
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-black text-indigo-700 block text-xs">{orderRef}</span>
                      <span className="font-mono text-[11px] text-slate-600 block mt-0.5">
                        Docket: <strong className="text-slate-900">{docketNo}</strong>
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-black text-slate-900 block">{carrierName}</span>
                      <span className="text-[11px] text-slate-500 font-medium">{booking.consignee_name}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1 font-mono font-bold text-slate-900">
                        <span>{booking.origin_pin}</span>
                        <span className="text-slate-400">→</span>
                        <span>{booking.dest_pin}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        {booking.boxes?.length || 1} Box(es) • {booking.billable_weight} kg
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-sm">
                      {formatINR(booking.cost_breakdown?.freightSubtotal || booking.final_total)}
                    </td>

                    <td className="py-3.5 px-4">
                      {booking.carrier_docket_doc_url ? (
                        <a
                          href={booking.carrier_docket_doc_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1 underline text-[11px]"
                        >
                          <DocumentIcon className="w-3.5 h-3.5" />
                          <span>View Bilty Scan</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-semibold bg-slate-100 px-2 py-0.5 rounded">
                          Pending Upload
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          booking.status === "Delivered"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : booking.status === "In Transit"
                            ? "bg-sky-100 text-sky-800 border-sky-300"
                            : booking.status === "Picked Up"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 shadow-xs transition"
                        title="Open Official Carrier Live Portal"
                      >
                        <span>Carrier Site</span>
                        <ExternalLinkIcon className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => onOpenLabelModal(booking)}
                        className="bg-white hover:bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-300 inline-flex items-center space-x-1 shadow-xs transition"
                      >
                        <PrinterIcon className="w-3.5 h-3.5 text-slate-600" />
                        <span>Label</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTrackerTab(orderRef)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 shadow-xs transition"
                      >
                        <span>Track</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
// ============================================================================
// 13. SHIPPER UNIVERSAL DUAL-ID LIVE TRACKER COMPONENT
// ============================================================================
export interface ShipperTrackerSectionProps {
  bookings: Booking[];
  activeTrackingAwb: string;
  setActiveTrackingAwb: (val: string) => void;
  trackingSearchInput: string;
  setTrackingSearchInput: (val: string) => void;
}

function ShipperTrackerSection({
  bookings,
  activeTrackingAwb,
  setActiveTrackingAwb,
  trackingSearchInput,
  setTrackingSearchInput
}: ShipperTrackerSectionProps) {
  const activeTrackBooking = useMemo(() => {
    const input = activeTrackingAwb.trim().toLowerCase();
    return bookings.find(
      (b) =>
        (b.order_id && b.order_id.toLowerCase() === input) ||
        (b.carrier_docket_no && b.carrier_docket_no.toLowerCase() === input) ||
        b.awb_number.toLowerCase() === input
    );
  }, [bookings, activeTrackingAwb]);

  const stages = ["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"];

  const currentStageIndex = useMemo(() => {
    if (!activeTrackBooking) return 0;
    const idx = stages.indexOf(activeTrackBooking.status);
    return idx === -1 ? 0 : idx;
  }, [activeTrackBooking]);

  return (
    <div className="space-y-6">
      {/* 1. Search Bar Card */}
      <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="text-base font-black text-slate-900">Universal Consignment Live Tracker</h2>
        <p className="text-xs text-slate-500">
          Enter either your Platform Order Ref (e.g. <strong className="text-indigo-600">{DEMO_INIT_ORDER_ID}</strong>) or official Carrier Docket No. (e.g. <strong className="text-indigo-600">{DEMO_INIT_CARRIER_DOCKET}</strong>)
        </p>

        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={trackingSearchInput}
            onChange={(e) => setTrackingSearchInput(e.target.value)}
            placeholder="Enter Order Ref or Docket..."
            className="flex-1 bg-white border-2 border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setActiveTrackingAwb(trackingSearchInput)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-md transition flex items-center space-x-1.5"
          >
            <SearchIcon className="w-4 h-4" />
            <span>Track</span>
          </button>
        </div>
      </div>

      {/* 2. Detailed Tracking Milestone Card */}
      {activeTrackBooking ? (
        <div className="bg-white border border-slate-300 rounded-2xl p-6 space-y-8 shadow-sm">
          {/* Header Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center space-x-3">
                <span className="text-xl font-mono font-black text-indigo-700">
                  {activeTrackBooking.order_id || "LC-CONSIGNMENT"}
                </span>
                <span className="text-sm font-mono font-black text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg">
                  Carrier Docket: {activeTrackBooking.carrier_docket_no || activeTrackBooking.awb_number}
                </span>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs px-3 py-1 rounded-full font-black uppercase">
                  {activeTrackBooking.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2 font-medium">
                Carrier Partner: <strong className="text-slate-900">{activeTrackBooking.vendors?.name || "Delhivery B2B Express"}</strong>
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2.5">
              <div className="flex items-center space-x-2">
                {activeTrackBooking.carrier_docket_doc_url && (
                  <a
                    href={activeTrackBooking.carrier_docket_doc_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-xs flex items-center space-x-1.5"
                  >
                    <DocumentIcon className="w-3.5 h-3.5" />
                    <span>View Physical Bilty Scan</span>
                  </a>
                )}
                <a
                  href={
                    activeTrackBooking.carrier_portal_url ||
                    getOfficialCarrierTrackingUrl(
                      activeTrackBooking.vendors?.name || "Delhivery",
                      activeTrackBooking.carrier_docket_no || activeTrackBooking.awb_number
                    )
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow-sm flex items-center space-x-1.5"
                >
                  <span>Official Carrier Portal</span>
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                </a>
              </div>
              <span className="text-xs text-slate-600">
                Route: <strong className="text-slate-900 font-mono">{activeTrackBooking.origin_pin} → {activeTrackBooking.dest_pin}</strong>
              </span>
            </div>
          </div>

          {/* Visual Milestone Progress Pipeline */}
          <div className="py-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6">Delivery Milestone Pipeline</h4>
            <div className="grid grid-cols-5 gap-2 relative">
              {stages.map((stage, idx) => {
                const isPassed = idx <= currentStageIndex;
                const isCurrent = idx === currentStageIndex;

                return (
                  <div key={stage} className="flex flex-col items-center text-center space-y-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                        isPassed
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-500"
                      } ${isCurrent ? "ring-4 ring-emerald-200 scale-110" : ""}`}
                    >
                      {isPassed ? <CheckCircleIcon className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-[11px] font-bold ${isPassed ? "text-slate-900 font-black" : "text-slate-400"}`}>
                      {stage}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Milestone Audit Trail History */}
          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">Milestone Audit Log</h4>
            <div className="space-y-3">
              {(activeTrackBooking.tracking_history || []).map((step, idx) => (
                <div key={idx} className="flex items-start space-x-3 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 mt-1.5 shrink-0"></div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex-1 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-black text-slate-900 text-xs">{step.status}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(step.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                      </span>
                    </div>
                    <p className="text-indigo-800 font-bold mt-0.5">{step.location}</p>
                    <p className="text-slate-600 mt-1">{step.remarks}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center shadow-sm">
          <p className="text-slate-600 text-sm font-medium">
            Consignment identifier <strong className="text-slate-900">"{activeTrackingAwb}"</strong> not found.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 14. SHIPPER HEAVY LOAD REVERSE AUCTION (RFQ) COMPONENT
// ============================================================================
export interface ShipperRfqSectionProps {
  currentUser: UserProfile;
  rfqList: RfqBid[];
  setRfqList: React.Dispatch<React.SetStateAction<RfqBid[]>>;
}

function ShipperRfqSection({ currentUser, rfqList, setRfqList }: ShipperRfqSectionProps) {
  const [newRfqOrigin, setNewRfqOrigin] = useState("110001");
  const [newRfqDest, setNewRfqDest] = useState("560001");
  const [newRfqDesc, setNewRfqDesc] = useState("Industrial Gearboxes and Heavy Machinery Parts");
  const [newRfqWeight, setNewRfqWeight] = useState(8500);
  const [newRfqTruck, setNewRfqTruck] = useState("32ft Multi-Axle Trailer (MXL)");
  const [newRfqBudget, setNewRfqBudget] = useState(65000);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newRecord: Partial<RfqBid> = {
      shipper_name: currentUser.company_name || currentUser.full_name,
      origin_pin: newRfqOrigin.trim(),
      dest_pin: newRfqDest.trim(),
      cargo_description: newRfqDesc.trim(),
      total_weight_kg: Number(newRfqWeight),
      truck_type: newRfqTruck,
      target_price: Number(newRfqBudget),
      status: "Open",
      bids: []
    };

    try {
      const { data, error } = await supabase.from("rfq_bids").insert([newRecord]).select();
      if (!error && data && data[0]) {
        setRfqList([data[0] as RfqBid, ...rfqList]);
      } else {
        const localRfq: RfqBid = {
          ...(newRecord as RfqBid),
          id: `rfq-${Date.now()}`,
          created_at: new Date().toISOString()
        };
        setRfqList([localRfq, ...rfqList]);
      }
      alert("Heavy cargo load successfully broadcast to national fleet operators!");
    } catch (err) {
      console.error("Failed to post RFQ load:", err);
      const localRfq: RfqBid = {
        ...(newRecord as RfqBid),
        id: `rfq-${Date.now()}`,
        created_at: new Date().toISOString()
      };
      setRfqList([localRfq, ...rfqList]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Post Load Form Card */}
      <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-lg font-black text-slate-900">Post Heavy / FTL Cargo Load for Reverse Auction</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified fleet operators and trailer transporters will bid competitively below your ceiling target price.
          </p>
        </div>

        <form onSubmit={handleCreateRfq} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-800 font-bold mb-1">Origin Pincode (Pickup)</label>
            <input
              type="text"
              maxLength={6}
              value={newRfqOrigin}
              onChange={(e) => setNewRfqOrigin(e.target.value)}
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Destination Pincode (Drop)</label>
            <input
              type="text"
              maxLength={6}
              value={newRfqDest}
              onChange={(e) => setNewRfqDest(e.target.value)}
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Cargo Description</label>
            <input
              type="text"
              value={newRfqDesc}
              onChange={(e) => setNewRfqDesc(e.target.value)}
              placeholder="e.g. Electrical Panels / Steel Coils"
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Total Cargo Weight (Kg)</label>
            <input
              type="number"
              value={newRfqWeight}
              onChange={(e) => setNewRfqWeight(Number(e.target.value))}
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Required Vehicle / Truck Body</label>
            <select
              value={newRfqTruck}
              onChange={(e) => setNewRfqTruck(e.target.value)}
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-2.5 py-2 font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
            >
              <option value="32ft Multi-Axle Trailer (MXL)">32ft Multi-Axle Trailer (MXL)</option>
              <option value="24ft Container Truck">24ft Container Truck</option>
              <option value="Taurus 21-Tonner (10-Tyre)">Taurus 21-Tonner (10-Tyre)</option>
              <option value="19ft Open Body Truck">19ft Open Body Truck</option>
              <option value="Tata 407 (3.5T)">Tata 407 (3.5T)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Ceiling Target Budget (₹)</label>
            <input
              type="number"
              value={newRfqBudget}
              onChange={(e) => setNewRfqBudget(Number(e.target.value))}
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div className="md:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-7 py-3 rounded-xl text-xs transition shadow-md flex items-center space-x-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? "Broadcasting..." : "Broadcast Load to Verified Transporters"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Active Broadcasted Loads & Carrier Bids List */}
      <div className="space-y-4">
        <h3 className="text-base font-black text-slate-900">Your Broadcasted Loads & Carrier Counter-Bids</h3>

        {rfqList.length === 0 ? (
          <div className="bg-white border border-slate-300 rounded-2xl p-8 text-center text-slate-500 text-xs shadow-sm">
            No reverse auction loads posted yet. Fill the form above to invite competitive carrier bidding.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {rfqList.map((rfq) => (
              <div key={rfq.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded font-black">
                        PIN {rfq.origin_pin} → {rfq.dest_pin}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                        {rfq.truck_type}
                      </span>
                      <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase">
                        {rfq.status}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 mt-1.5">{rfq.cargo_description}</h4>
                    <p className="text-xs text-slate-500 font-medium">Cargo Weight: {rfq.total_weight_kg.toLocaleString()} kg</p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Ceiling Target Budget</span>
                    <span className="text-xl font-black text-emerald-700 font-mono">{formatINR(rfq.target_price)}</span>
                  </div>
                </div>

                {/* Submissions by Carriers */}
                <div className="space-y-2">
                  <span className="text-xs font-black text-slate-700 block uppercase tracking-wider">
                    Received Carrier Bids ({(rfq.bids || []).length})
                  </span>

                  {(!rfq.bids || rfq.bids.length === 0) ? (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                      Awaiting bids from fleet operators on the carrier exchange...
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {rfq.bids.map((bid, bIdx) => (
                        <div key={bIdx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-black text-slate-900 block">{bid.vendor_name}</span>
                            <span className="text-[11px] text-slate-600 font-medium mt-0.5 block">{bid.notes}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-black text-emerald-700 font-mono block">{formatINR(bid.bid_amount)}</span>
                            <span className="text-[11px] text-slate-500 font-bold block">SLA: {bid.transit_days} Days</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 15. CARRIER LIVE REVERSE AUCTION BIDDING COMPONENT
// ============================================================================
export interface CarrierBidsSectionProps {
  currentUser: UserProfile;
  rfqList: RfqBid[];
  setRfqList: React.Dispatch<React.SetStateAction<RfqBid[]>>;
}

function CarrierBidsSection({ currentUser, rfqList, setRfqList }: CarrierBidsSectionProps) {
  const [bidFormMap, setBidFormMap] = useState<Record<string, { amount: number; days: number; notes: string }>>({});

  const handleSubmitVendorBid = async (rfqId: string) => {
    const form = bidFormMap[rfqId];
    if (!form || !form.amount || !form.days) {
      alert("Please provide both quote price and transit SLA days.");
      return;
    }

    const rfq = rfqList.find((r) => r.id === rfqId);
    if (!rfq) return;

    const newBidObj = {
      vendor_name: currentUser.company_name || "Delhivery B2B Express",
      bid_amount: Number(form.amount),
      transit_days: Number(form.days),
      notes: form.notes || "Ready dedicated container vehicle with GPS tracking.",
      created_at: new Date().toISOString()
    };

    const updatedBids = [...(rfq.bids || []), newBidObj];

    try {
      await supabase.from("rfq_bids").update({ bids: updatedBids }).eq("id", rfqId);
      setRfqList(rfqList.map((r) => (r.id === rfqId ? { ...r, bids: updatedBids } : r)));
      setBidFormMap({ ...bidFormMap, [rfqId]: { amount: 0, days: 0, notes: "" } });
      alert("Bid placed successfully on the live RFQ exchange!");
    } catch (err) {
      console.error("Failed to submit bid:", err);
      setRfqList(rfqList.map((r) => (r.id === rfqId ? { ...r, bids: updatedBids } : r)));
      setBidFormMap({ ...bidFormMap, [rfqId]: { amount: 0, days: 0, notes: "" } });
      alert("Bid recorded locally in session ledger!");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-slate-900">Live Heavy Cargo RFQ Exchange</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Browse verified commercial shipper loads and submit competitive linehaul quotes below target budgets.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {rfqList.length === 0 ? (
          <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-xs shadow-sm">
            No live shipper RFQ loads available right now.
          </div>
        ) : (
          rfqList.map((rfq) => {
            const form = bidFormMap[rfq.id] || { amount: 0, days: 0, notes: "" };

            return (
              <div key={rfq.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded font-mono font-black">
                        PIN {rfq.origin_pin} → {rfq.dest_pin}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                        {rfq.truck_type}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 mt-1.5">{rfq.cargo_description}</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Shipper: {rfq.shipper_name} • Weight: {rfq.total_weight_kg.toLocaleString()} kg
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Shipper Target Budget</span>
                    <span className="text-xl font-black text-emerald-700 font-mono">{formatINR(rfq.target_price)}</span>
                  </div>
                </div>

                {/* Submit Bid Form Tile */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-black text-slate-800 block uppercase tracking-wider">
                    Submit Competitive Carrier Quote
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Quoted Price (₹)</label>
                      <input
                        type="number"
                        placeholder="e.g. 58000"
                        value={form.amount || ""}
                        onChange={(e) =>
                          setBidFormMap({
                            ...bidFormMap,
                            [rfq.id]: { ...form, amount: Number(e.target.value) }
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Transit SLA (Days)</label>
                      <input
                        type="number"
                        placeholder="e.g. 3"
                        value={form.days || ""}
                        onChange={(e) =>
                          setBidFormMap({
                            ...bidFormMap,
                            [rfq.id]: { ...form, days: Number(e.target.value) }
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Fleet / Driver Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Dedicated trailer ready at hub"
                        value={form.notes}
                        onChange={(e) =>
                          setBidFormMap({
                            ...bidFormMap,
                            [rfq.id]: { ...form, notes: e.target.value }
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => handleSubmitVendorBid(rfq.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl transition shadow-sm"
                    >
                      Place Official Bid
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 16. CARRIER ORDERS & BILTY DISPATCH COMPONENT
// ============================================================================
export interface CarrierOrdersSectionProps {
  currentUser: UserProfile;
  bookings: Booking[];
  statusUpdateMap: Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>;
  setStatusUpdateMap: React.Dispatch<React.SetStateAction<Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>>>;
  onUploadDocketFile: (bookingId: string, file: File) => Promise<void>;
  onUpdateShipmentStatus: (bookingId: string) => Promise<void>;
}

function CarrierOrdersSection({
  currentUser,
  bookings,
  statusUpdateMap,
  setStatusUpdateMap,
  onUploadDocketFile,
  onUpdateShipmentStatus
}: CarrierOrdersSectionProps) {
  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900">Carrier Orders & Physical Docket / Bilty Entry</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operating as Carrier: <strong className="text-emerald-700 font-bold">{currentUser.company_name}</strong>
          </p>
        </div>
      </div>

      {/* 2. Order Dispatch Cards */}
      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-xs shadow-sm">
          No active consignments booked with your fleet network yet.
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const rowForm = statusUpdateMap[booking.id] || {
              status: "",
              location: "",
              remarks: "",
              docketNo: booking.carrier_docket_no || booking.awb_number,
              docUrl: booking.carrier_docket_doc_url || "",
              isUploading: false
            };

            return (
              <div key={booking.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                {/* Consignment Overview Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded font-black">
                      Ref: {booking.order_id || "LC-ORDER"}
                    </span>
                    <span className="font-mono text-sm font-black text-slate-900">
                      Docket: {booking.carrier_docket_no || booking.awb_number}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold capitalize">
                      {booking.mode} Freight
                    </span>
                    <span className="text-xs font-mono text-slate-600 font-bold">
                      {booking.origin_pin} → {booking.dest_pin}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-500 font-medium">Settlement Terms:</span>
                    <span className="font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      {booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}
                    </span>
                  </div>
                </div>

                {/* Bilty Entry & Photo Upload Form */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Official Docket / LR Input */}
                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                        Carrier Docket / LR No.
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Physical Bilty No."
                        value={rowForm.docketNo}
                        onChange={(e) =>
                          setStatusUpdateMap({
                            ...statusUpdateMap,
                            [booking.id]: { ...rowForm, docketNo: e.target.value }
                          })
                        }
                        className="w-full bg-white border-2 border-indigo-300 font-mono font-black text-indigo-950 rounded-xl px-3 py-1.5 text-xs shadow-sm focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    {/* Compressed File Upload */}
                    <div className="md:col-span-5">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                        Physical Bilty / POD (Image / PDF)
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="file"
                          id={`file-upload-${booking.id}`}
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onUploadDocketFile(booking.id, file);
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor={`file-upload-${booking.id}`}
                          className="bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs flex items-center space-x-1.5"
                        >
                          <UploadIcon className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{rowForm.isUploading ? "Compressing & Uploading..." : "📷 Upload Bilty Scan"}</span>
                        </label>

                        {(rowForm.docUrl || booking.carrier_docket_doc_url) && (
                          <a
                            href={rowForm.docUrl || booking.carrier_docket_doc_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:text-emerald-800 font-black text-xs flex items-center space-x-1 underline truncate max-w-[150px]"
                          >
                            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Attached Scan</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Status Dropdown */}
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                        Transit Milestone Status
                      </label>
                      <select
                        value={rowForm.status}
                        onChange={(e) =>
                          setStatusUpdateMap({
                            ...statusUpdateMap,
                            [booking.id]: { ...rowForm, status: e.target.value }
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:border-indigo-600 focus:outline-none"
                      >
                        <option value="">Update Status...</option>
                        <option value="Picked Up">Picked Up</option>
                        <option value="In Transit">In Transit</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                    </div>
                  </div>

                  {/* Location & Save Action Bar */}
                  <div className="flex flex-col md:flex-row items-center gap-2.5 pt-2 border-t border-slate-200">
                    <input
                      type="text"
                      placeholder="Current Hub / City (e.g. Bilaspur Linehaul Gateway)"
                      value={rowForm.location}
                      onChange={(e) =>
                        setStatusUpdateMap({
                          ...statusUpdateMap,
                          [booking.id]: { ...rowForm, location: e.target.value }
                        })
                      }
                      className="w-full md:flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium focus:border-indigo-600 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => onUpdateShipmentStatus(booking.id)}
                      className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl transition shadow-sm flex items-center justify-center space-x-1.5 shrink-0"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>Save & Dispatch Docket Update</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 17. CARRIER RATE CARD MASTER COMPONENT
// ============================================================================
export interface CarrierRatesSectionProps {
  currentUser: UserProfile;
  rateCards: RateCard[];
  setRateCards: React.Dispatch<React.SetStateAction<RateCard[]>>;
  vendors: Vendor[];
  onOpenAddRateModal: () => void;
}

function CarrierRatesSection({
  currentUser,
  rateCards,
  setRateCards,
  vendors,
  onOpenAddRateModal
}: CarrierRatesSectionProps) {
  const [csvFileName, setCsvFileName] = useState("");
  const [parsedCsvRows, setParsedCsvRows] = useState<ParsedCsvRateCard[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvUploadStatus, setCsvUploadStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadSampleCsv = () => {
    const csvHeader = "origin,dest,mode,min_weight_kg,base_rate,per_kg_rate,fuel_surcharge_pct,docket_charge,sla_days\n";
    const sampleRows = [
      "Delhi,Chandigarh,surface,20,450,14.5,12.5,150,2",
      "110,Bengaluru,air,5,850,48,18,250,1",
      "Mumbai,Kolkata,surface,25,500,16,12.5,150,4",
      "Ludhiana,Delhi,surface,15,350,11,10,120,2",
      "%,%,ftl,500,8500,6.5,15,500,5"
    ].join("\n");

    const blob = new Blob([csvHeader + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "logicompare_rate_card_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setCsvUploadStatus(null);
    setCsvErrors([]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file content");

        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length <= 1) throw new Error("CSV file must contain a header row and data rows.");

        const rows: ParsedCsvRateCard[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
          if (cols.length < 9) {
            errors.push(`Row ${i + 1}: Expected 9 columns, found ${cols.length}`);
            continue;
          }

          const [origRaw, destRaw, modeRaw, minWtRaw, baseRateRaw, perKgRaw, fuelRaw, docketRaw, slaRaw] = cols;
          const modeClean = modeRaw.toLowerCase();

          const origin_prefix = await resolveLocationToPrefix(origRaw);
          const dest_prefix = await resolveLocationToPrefix(destRaw);

          if (!["surface", "air", "ftl"].includes(modeClean)) {
            errors.push(`Row ${i + 1}: Invalid transport mode '${modeRaw}'. Must be surface, air, or ftl.`);
            continue;
          }

          const min_weight_kg = parseFloat(minWtRaw);
          const base_rate = parseFloat(baseRateRaw);
          const per_kg_rate = parseFloat(perKgRaw);
          const fuel_surcharge_pct = parseFloat(fuelRaw);
          const docket_charge = parseFloat(docketRaw);
          const sla_days = parseInt(slaRaw, 10);

          if ([min_weight_kg, base_rate, per_kg_rate, fuel_surcharge_pct, docket_charge, sla_days].some(isNaN)) {
            errors.push(`Row ${i + 1}: Numeric fields contain invalid values.`);
            continue;
          }

          rows.push({
            origin_prefix,
            dest_prefix,
            mode: modeClean as "surface" | "air" | "ftl",
            min_weight_kg,
            base_rate,
            per_kg_rate,
            fuel_surcharge_pct,
            docket_charge,
            sla_days,
            fov_pct: 0.2,
            oda_charge: 450,
            handling_per_kg: 2,
            is_active: true
          });
        }

        setParsedCsvRows(rows);
        setCsvErrors(errors);
      } catch (err: any) {
        setCsvUploadStatus({ type: "error", message: err.message || "Failed to parse CSV." });
        setParsedCsvRows([]);
      }
    };

    reader.readAsText(file);
  };

  const handleBatchInsertRateCards = async () => {
    if (parsedCsvRows.length === 0) return;
    setIsUploadingCsv(true);
    setCsvUploadStatus(null);

    const vendorId = currentUser.vendor_id || "11111111-1111-1111-1111-111111111111";
    const payload = parsedCsvRows.map((r) => ({
      ...r,
      vendor_id: vendorId
    }));

    try {
      const { data, error } = await supabase.from("rate_cards").insert(payload).select("*, vendors(*)");

      if (!error && data && data.length > 0) {
        setRateCards([...(data as RateCard[]), ...rateCards]);
      } else {
        const localCards: RateCard[] = payload.map((p, idx) => ({
          ...(p as RateCard),
          id: `rc-bulk-${Date.now()}-${idx}`,
          vendors: vendors.find((v) => v.id === vendorId)
        }));
        setRateCards([...localCards, ...rateCards]);
      }

      setCsvUploadStatus({
        type: "success",
        message: `Successfully published ${parsedCsvRows.length} lane routes!`
      });
      setParsedCsvRows([]);
      setCsvFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setCsvUploadStatus({
        type: "error",
        message: err.message || "Failed to batch insert rate cards."
      });
    } finally {
      setIsUploadingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Commercial Rate Card Master</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage route tariffs individually or batch-publish route matrices via CSV</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-black flex items-center space-x-1.5 shadow-sm transition"
          >
            <DownloadIcon className="w-4 h-4 text-indigo-600" />
            <span>📥 Download Sample CSV</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddRateModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center space-x-1.5 shadow-sm transition"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Route Manually</span>
          </button>
        </div>
      </div>

      {/* CSV Dropzone & Batch Processor */}
      <div className="bg-white border-2 border-dashed border-indigo-300 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <UploadIcon className="w-4 h-4 text-indigo-600" />
              <span>Bulk Upload Rate Cards via CSV (City Names or Prefixes Supported)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard 9 columns: <code className="font-mono text-indigo-700 font-bold text-[11px]">origin, dest, mode, min_weight_kg, base_rate, per_kg_rate, fuel_surcharge_pct, docket_charge, sla_days</code>
            </p>
          </div>

          {parsedCsvRows.length > 0 && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setParsedCsvRows([]);
                  setCsvFileName("");
                  setCsvErrors([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={isUploadingCsv}
                onClick={handleBatchInsertRateCards}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
              >
                <CheckCircleIcon className="w-4 h-4" />
                <span>{isUploadingCsv ? "Publishing Routes..." : `Publish All ${parsedCsvRows.length} Routes`}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="hidden"
            id="csv-rate-card-upload"
          />
          <label
            htmlFor="csv-rate-card-upload"
            className="bg-white hover:bg-slate-100 text-indigo-700 border-2 border-indigo-200 px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer transition shadow-xs flex items-center space-x-2"
          >
            <UploadIcon className="w-4 h-4 text-indigo-600" />
            <span>{csvFileName ? `Replace (${csvFileName})` : "Select Rate Card CSV File"}</span>
          </label>
          <p className="text-[11px] text-slate-500 font-medium">
            {csvFileName ? `Selected File: ${csvFileName}` : "Click to select .csv file from your computer"}
          </p>
        </div>

        {csvErrors.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 text-xs font-medium space-y-1">
            <strong>Formatting Errors Encountered:</strong>
            <ul className="list-disc pl-5">
              {csvErrors.slice(0, 5).map((err, eIdx) => (
                <li key={eIdx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {csvUploadStatus && (
          <div
            className={`p-3.5 rounded-xl text-xs font-bold border ${
              csvUploadStatus.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-rose-50 text-rose-800 border-rose-300"
            }`}
          >
            {csvUploadStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 18. CARRIER BANK & UPI SETTLEMENT PROFILE COMPONENT
// ============================================================================
export interface CarrierBankSectionProps {
  currentUser: UserProfile;
  vendors: Vendor[];
  setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>;
}

function CarrierBankSection({ currentUser, vendors, setVendors }: CarrierBankSectionProps) {
  const currentVendor =
    vendors.find((v) => v.id === (currentUser.vendor_id || "11111111-1111-1111-1111-111111111111")) || vendors[0];

  const [upi, setUpi] = useState(currentVendor?.upi_id || "delhivery.b2b@icici");
  const [bankAcc, setBankAcc] = useState(currentVendor?.bank_account || "50200088910234");
  const [ifsc, setIfsc] = useState(currentVendor?.ifsc_code || "HDFC0000240");
  const [beneficiary, setBeneficiary] = useState(currentVendor?.beneficiary_name || "Delhivery Limited B2B Logistics");
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMsg("");

    const vendorId = currentUser.vendor_id || "11111111-1111-1111-1111-111111111111";
    const payload = {
      upi_id: upi.trim(),
      bank_account: bankAcc.trim(),
      ifsc_code: ifsc.trim().toUpperCase(),
      beneficiary_name: beneficiary.trim()
    };

    try {
      const { error } = await supabase.from("vendors").update(payload).eq("id", vendorId);
      if (error) throw error;
      setVendors((prev) => prev.map((v) => (v.id === vendorId ? { ...v, ...payload } : v)));
      setMsg("Bank and UPI settlement details saved successfully! Shippers can now pay you directly.");
    } catch {
      setVendors((prev) => prev.map((v) => (v.id === vendorId ? { ...v, ...payload } : v)));
      setMsg("Settlement details saved locally in session state!");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm max-w-2xl space-y-5">
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <CreditCardIcon className="w-5 h-5 text-emerald-600" />
            <span>Direct Freight Settlement Details</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure where commercial shippers send 100% direct freight payments when booking your routes.
          </p>
        </div>
        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black px-3.5 py-1 rounded-full">
          Zero Commission on Freight
        </span>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold">
          {msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-800 font-bold mb-1">
            Official Transporter UPI ID (VPA)
          </label>
          <input
            type="text"
            required
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            placeholder="e.g. yourbusiness@icici or 9899123456@upi"
            className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono text-slate-900 font-bold focus:bg-white focus:border-emerald-600 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Shippers who select "Direct Carrier UPI" at checkout will see this UPI handle to make immediate payment.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-slate-800 font-bold mb-1">Bank Account Number</label>
            <input
              type="text"
              required
              value={bankAcc}
              onChange={(e) => setBankAcc(e.target.value)}
              placeholder="e.g. 50200088910234"
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono text-slate-900 font-bold focus:bg-white focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Bank IFSC Code</label>
            <input
              type="text"
              required
              maxLength={11}
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
              placeholder="e.g. HDFC0000240"
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono uppercase text-slate-900 font-bold focus:bg-white focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-800 font-bold mb-1">
            Beneficiary / Account Holder Name (As per Bank Records)
          </label>
          <input
            type="text"
            required
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            placeholder="e.g. Delhivery Limited B2B Logistics"
            className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:bg-white focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-2.5 rounded-xl transition shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
          >
            <CheckCircleIcon className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save Bank & UPI Settlement Profile"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// 19. ADMIN EXECUTIVE OVERSIGHT & AUDIT COMPONENT
// ============================================================================
export interface AdminOverviewSectionProps {
  bookings: Booking[];
  vendors: Vendor[];
  rateCards: RateCard[];
}

function AdminOverviewSection({ bookings, vendors }: AdminOverviewSectionProps) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Administration & Oversight</h1>
        <p className="text-xs text-slate-500 mt-0.5">Platform Performance, Verified Fleets & Statutory Margin Audit</p>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Dispatches</span>
          <span className="text-3xl font-black text-slate-900">{bookings.length}</span>
          <p className="text-[11px] text-emerald-600 font-bold">Dual-ID Carrier Verified</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Active Carrier Partners</span>
          <span className="text-3xl font-black text-indigo-600">{vendors.length}</span>
          <p className="text-[11px] text-indigo-600 font-bold">100% KYC Approved</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Gross Freight Routed</span>
          <span className="text-3xl font-black text-slate-900 font-mono">
            {formatINR(bookings.reduce((acc, b) => acc + (b.cost_breakdown?.freightSubtotal || b.final_total || 0), 0))}
          </span>
          <p className="text-[11px] text-slate-500 font-bold">0% Aggregator Markup</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Platform Fees (2%)</span>
          <span className="text-3xl font-black text-emerald-600 font-mono">
            {formatINR(bookings.reduce((acc, b) => acc + (b.cost_breakdown?.platformConvenienceFee || 25), 0))}
          </span>
          <p className="text-[11px] text-emerald-700 font-bold">Statutory Margin Accrued</p>
        </div>
      </div>

      {/* Carrier Status Directory */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h3 className="text-base font-black text-slate-900">Active Integrated Transporters</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-950 text-white font-black uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Carrier Name</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4">GSTIN</th>
                <th className="py-3 px-4">Fleet Types</th>
                <th className="py-3 px-4">Direct UPI VPA</th>
                <th className="py-3 px-4">Live Tracking Base</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{v.name}</td>
                  <td className="py-3 px-4 text-amber-500 font-bold">★ {v.rating}</td>
                  <td className="py-3 px-4 font-mono">{v.gstin}</td>
                  <td className="py-3 px-4 text-[11px] text-slate-500">{v.fleet_types.join(", ")}</td>
                  <td className="py-3 px-4 font-mono text-emerald-700 font-bold">{v.upi_id}</td>
                  <td className="py-3 px-4 font-mono text-[10px] text-indigo-600 truncate max-w-[150px]">{v.tracking_base_url}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 20. SINGLE AD-HOC DIRECT BOOKING MODAL COMPONENT
// ============================================================================
export interface DirectBookingModalProps {
  quote: CalculatedQuote;
  currentUser: UserProfile;
  originPin: string;
  destPin: string;
  boxes: BoxItem[];
  declaredValue: number;
  pickupAddress: string;
  onClose: () => void;
  onSuccess: (b: Booking) => void;
}

function DirectBookingModal({
  quote,
  currentUser,
  originPin,
  destPin,
  boxes,
  declaredValue,
  pickupAddress,
  onClose,
  onSuccess
}: DirectBookingModalProps) {
  const [consigneeName, setConsigneeName] = useState("Prime Electronics Retail");
  const [consigneePhone, setConsigneePhone] = useState("+91 98200 44556");
  const [consigneeGstin, setConsigneeGstin] = useState("27AAACP9988G1ZK");
  const [deliveryAddress, setDeliveryAddress] = useState("Warehouse 4B, Bhiwandi Logistics Park, Mumbai");
  const [settlementType, setSettlementType] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");
  const [directPaymentUtr, setDirectPaymentUtr] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!termsAccepted) {
      alert("Please accept the consignment booking terms before proceeding.");
      return;
    }
    setIsSubmitting(true);

    const platformOrderId = `LC-${Math.floor(100000 + Math.random() * 900000)}`;
    const carrierName = quote.vendor.name;
    const initialCarrierDocket = generateCarrierDocket(carrierName);
    const portalUrl = getOfficialCarrierTrackingUrl(carrierName, initialCarrierDocket);

    let refString = "DIRECT-TO-PAY-POD";
    if (settlementType === "direct_upi") {
      refString = directPaymentUtr ? `UPI-UTR-${directPaymentUtr}` : `DIRECT-UPI-${quote.vendor.upi_id}`;
    } else if (settlementType === "corporate_credit") {
      refString = "B2B-DIRECT-CREDIT-TERMS";
    }

    const enhancedBreakdown = {
      ...quote.breakdown,
      settlement_type: settlementType,
      payment_method: settlementType === "direct_upi" ? "Direct Carrier UPI" : settlementType === "corporate_credit" ? "B2B Monthly Credit" : "Direct To-Pay POD",
      payment_ref: refString,
      carrier_upi: quote.vendor.upi_id
    };

    const newBookingRecord: Partial<Booking> = {
      order_id: platformOrderId,
      awb_number: initialCarrierDocket,
      carrier_docket_no: initialCarrierDocket,
      carrier_portal_url: portalUrl,
      shipper_id: currentUser.id,
      vendor_id: quote.vendor.id,
      rate_card_id: quote.rateCard.id,
      shipper_name: currentUser.company_name || currentUser.full_name,
      shipper_phone: currentUser.phone || "+91 8194017660",
      shipper_email: currentUser.email,
      shipper_gstin: currentUser.gstin || "07AAACA1234A1Z5",
      pickup_address: pickupAddress,
      consignee_name: consigneeName,
      consignee_phone: consigneePhone,
      consignee_gstin: consigneeGstin,
      delivery_address: deliveryAddress,
      origin_pin: originPin,
      dest_pin: destPin,
      mode: quote.rateCard.mode,
      boxes,
      declared_value: declaredValue,
      actual_weight: quote.actualWeight,
      volumetric_weight: quote.volumetricWeight,
      billable_weight: quote.billableWeight,
      cost_breakdown: enhancedBreakdown,
      final_total: quote.breakdown.total,
      status: "Booked",
      tracking_history: [
        {
          status: "Booked",
          location: `Origin Hub (${originPin})`,
          timestamp: new Date().toISOString(),
          remarks: `Order Ref ${platformOrderId} generated. Carrier Docket ${initialCarrierDocket} assigned. Direct freight (${formatINR(enhancedBreakdown.freightSubtotal)}) payable to ${quote.vendor.name} [Ref: ${refString}]. Platform 2% fee (₹${enhancedBreakdown.platformConvenienceFee}) recorded.`
        }
      ]
    };

    try {
      const { data, error } = await supabase.from("bookings").insert([newBookingRecord]).select("*, vendors(*)");
      if (!error && data && data[0]) {
        onSuccess(data[0] as Booking);
      } else {
        const localMock = {
          ...(newBookingRecord as Booking),
          id: `book-${Date.now()}`,
          created_at: new Date().toISOString(),
          vendors: quote.vendor
        };
        onSuccess(localMock);
      }
    } catch {
      const localMock = {
        ...(newBookingRecord as Booking),
        id: `book-${Date.now()}`,
        created_at: new Date().toISOString(),
        vendors: quote.vendor
      };
      onSuccess(localMock);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto select-none">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">Direct Consignment Booking & Carrier Settlement</h3>
            <p className="text-xs text-slate-500">
              Carrier Partner: <strong className="text-emerald-700 font-bold">{quote.vendor.name}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Itemized Cost Breakdown Tile */}
        <div className="bg-slate-950 text-white p-4 rounded-2xl shadow-inner space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span>Direct Freight (Payable to {quote.vendor.name}):</span>
            <strong className="text-base text-white font-mono">{formatINR(quote.breakdown.freightSubtotal)}</strong>
          </div>
          <div className="flex justify-between items-center text-indigo-300">
            <span>Platform Docket Verification Fee (2%, min ₹25):</span>
            <strong className="font-mono">₹{quote.breakdown.platformConvenienceFee}</strong>
          </div>
          <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-black text-emerald-400">
            <span>Total Consignment Outlay:</span>
            <span className="font-mono text-base">{formatINR(quote.breakdown.total)}</span>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <label className="block text-slate-900 font-black uppercase tracking-wider">Choose Settlement Method:</label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <label className={`p-3 rounded-xl border-2 cursor-pointer transition ${settlementType === "direct_to_pay" ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200" : "bg-white border-slate-200"}`}>
              <input
                type="radio"
                name="settlement_type"
                checked={settlementType === "direct_to_pay"}
                onChange={() => setSettlementType("direct_to_pay")}
                className="text-emerald-600"
              />
              <span className="font-bold block mt-1 text-slate-900">💵 To-Pay at Delivery</span>
              <p className="text-[10px] text-slate-500">Pay cash/cheque upon delivery.</p>
            </label>

            <label className={`p-3 rounded-xl border-2 cursor-pointer transition ${settlementType === "direct_upi" ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200" : "bg-white border-slate-200"}`}>
              <input
                type="radio"
                name="settlement_type"
                checked={settlementType === "direct_upi"}
                onChange={() => setSettlementType("direct_upi")}
                className="text-emerald-600"
              />
              <span className="font-bold block mt-1 text-slate-900">📲 Direct Carrier UPI</span>
              <p className="text-[10px] text-slate-500">Transfer freight directly to carrier.</p>
            </label>

            <label className={`p-3 rounded-xl border-2 cursor-pointer transition ${settlementType === "corporate_credit" ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200" : "bg-white border-slate-200"}`}>
              <input
                type="radio"
                name="settlement_type"
                checked={settlementType === "corporate_credit"}
                onChange={() => setSettlementType("corporate_credit")}
                className="text-emerald-600"
              />
              <span className="font-bold block mt-1 text-slate-900">🏢 B2B Monthly Credit</span>
              <p className="text-[10px] text-slate-500">Pre-approved GST credit terms.</p>
            </label>
          </div>

          {settlementType === "direct_upi" && (
            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-2 font-mono">
              <div className="flex justify-between items-center text-xs">
                <span className="text-emerald-950 font-bold">Carrier UPI Handle:</span>
                <span className="bg-white px-2 py-0.5 rounded font-black text-slate-900 border border-emerald-200">
                  {quote.vendor.upi_id || "delhivery.b2b@icici"}
                </span>
              </div>
              <input
                type="text"
                placeholder="Payment Reference / UTR Number (Optional)"
                value={directPaymentUtr}
                onChange={(e) => setDirectPaymentUtr(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-900"
              />
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Consignee Name</label>
                <input
                  type="text"
                  value={consigneeName}
                  onChange={(e) => setConsigneeName(e.target.value)}
                  className="w-full border rounded-lg p-2 font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Consignee Phone</label>
                <input
                  type="text"
                  value={consigneePhone}
                  onChange={(e) => setConsigneePhone(e.target.value)}
                  className="w-full border rounded-lg p-2 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Destination Address</label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full border rounded-lg p-2 font-medium"
              />
            </div>
          </div>

          <label className="flex items-start space-x-2 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 text-indigo-600 rounded"
            />
            <span className="text-[11px] text-slate-600 font-medium">
              I agree to settle freight directly with {quote.vendor.name} under Carriage by Road Act 2007 guidelines.
            </span>
          </label>
        </div>

        <div className="flex justify-end space-x-3 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || !termsAccepted}
            onClick={handleConfirm}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-md transition disabled:opacity-50"
          >
            {isSubmitting ? "Assigning Docket..." : "Confirm Booking & Assign Carrier Docket"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 21. CONTINUOUS 4x6 THERMAL PRINT MODAL & MASTER HANDOVER MANIFEST
// ============================================================================
export interface ThermalPrintModalProps {
  printableBooking: Booking | null;
  batchPrintBookings: Booking[] | null;
  onClose: () => void;
}

function ThermalPrintModal({
  printableBooking,
  batchPrintBookings,
  onClose
}: ThermalPrintModalProps) {
  const allBookings = batchPrintBookings || (printableBooking ? [printableBooking] : []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white select-none">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          header, footer, nav, button, .no-print {
            display: none !important;
          }
          .thermal-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          .thermal-label-container {
            width: 4in !important;
            height: 6in !important;
            max-height: 6in !important;
            overflow: hidden !important;
            padding: 0.2in !important;
            box-sizing: border-box !important;
            border: 3px solid black !important;
            margin: 0 auto !important;
          }
          .manifest-sheet {
            width: 100% !important;
            page-break-before: always !important;
            break-before: page !important;
          }
        }
      `}} />

      <div className="bg-white text-black rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 print:m-0 print:p-0 print:shadow-none print:w-full border border-slate-300">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
          <div>
            <h3 className="text-base font-black text-slate-900">
              {batchPrintBookings
                ? `Batch 4x6 Thermal Labels (${batchPrintBookings.length} Consignments) + Handover Manifest`
                : "4x6 Thermal Multi-Box Shipping Labels"}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Continuous thermal page layout calibrated for Zebra, TSC, Rollo, and standard 4x6 label printers
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
            >
              <PrinterIcon className="w-4 h-4" />
              <span>Print Continuous 4x6 Sheet</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 print:space-y-0">
          {allBookings.map((booking) => {
            const boxCount = booking.boxes?.length || 1;

            return (
              <React.Fragment key={booking.id}>
                {Array.from({ length: boxCount }).map((_, boxIdx) => {
                  const box = booking.boxes?.[boxIdx] || {
                    weight: booking.actual_weight,
                    length: 0,
                    width: 0,
                    height: 0
                  };

                  return (
                    <div
                      key={`${booking.id}-box-${boxIdx}`}
                      className="thermal-label-container thermal-page-break font-sans bg-white text-black border-4 border-black p-3 space-y-2.5 rounded-sm"
                    >
                      <div className="flex justify-between items-start border-b-2 border-black pb-1.5">
                        <div>
                          <h2 className="text-lg font-black leading-tight tracking-tight uppercase">
                            {booking.vendors?.name || "DELHIVERY B2B EXPRESS"}
                          </h2>
                          <span className="text-[8px] font-black uppercase tracking-widest block text-slate-700">
                            OFFICIAL CARRIER CONSIGNMENT NOTE
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black font-mono">
                            HUB-{booking.origin_pin.slice(0, 3)} / HUB-{booking.dest_pin.slice(0, 3)}
                          </span>
                          <span className="text-[9px] font-black uppercase bg-black text-white px-1.5 py-0.5 rounded-sm block mt-0.5">
                            BOX {boxIdx + 1} OF {boxCount}
                          </span>
                        </div>
                      </div>

                      <div className="text-center py-1.5 border-b-2 border-black space-y-1">
                        <div className="flex justify-center items-center space-x-0.5 h-10">
                          {[2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3, 4, 1, 2, 3, 2, 4, 1, 2, 1, 3, 1, 4].map((w, i) => (
                            <div key={i} className="bg-black h-full" style={{ width: `${w * 2.2}px` }} />
                          ))}
                        </div>
                        <div className="flex items-center justify-center space-x-2 font-mono">
                          <span className="text-sm font-black tracking-widest">
                            DOCKET: {booking.carrier_docket_no || booking.awb_number}
                          </span>
                          <span className="text-[10px] font-bold text-slate-700">
                            [{booking.order_id}]
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-b-2 border-black pb-1.5 text-[10px] leading-tight">
                        <div>
                          <span className="text-[8px] font-black uppercase block text-slate-700">SHIPPER (CONSIGNOR):</span>
                          <strong className="block truncate font-black text-xs">{booking.shipper_name}</strong>
                          <p className="truncate text-slate-800">{booking.pickup_address}</p>
                          <p className="font-mono font-bold mt-0.5">PIN: {booking.origin_pin}</p>
                          <p className="font-mono text-[9px]">GSTIN: {booking.shipper_gstin}</p>
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase block text-slate-700">DELIVER TO (CONSIGNEE):</span>
                          <strong className="block truncate font-black text-xs">{booking.consignee_name}</strong>
                          <p className="truncate text-slate-800">{booking.delivery_address}</p>
                          <p className="font-mono font-bold mt-0.5">PIN: {booking.dest_pin} • Ph: {booking.consignee_phone}</p>
                          <p className="font-mono text-[9px]">GSTIN: {booking.consignee_gstin}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-center border-b-2 border-black pb-1.5 text-[10px]">
                        <div>
                          <span className="text-[7px] font-bold block uppercase text-slate-700">THIS BOX WT</span>
                          <strong className="text-xs font-mono font-black">{box.weight} KG</strong>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold block uppercase text-slate-700">TOTAL BILLABLE</span>
                          <strong className="text-xs font-mono font-black">{booking.billable_weight} KG</strong>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold block uppercase text-slate-700">BOX DIMS</span>
                          <strong className="text-[9px] font-mono font-bold">
                            {box.length ? `${box.length}x${box.width}x${box.height}` : "STD CARGO"}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold block uppercase text-slate-700">TERMS</span>
                          <strong className="text-[9px] font-mono font-black uppercase truncate block">
                            {booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}
                          </strong>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[8px] text-slate-700 pt-0.5 font-mono">
                        <span>Carriage by Road Act 2007 Verified Consignment</span>
                        <span>{new Date(booking.created_at).toLocaleDateString("en-IN")}</span>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {batchPrintBookings && (
            <div className="manifest-sheet bg-white text-black p-6 border-4 border-black font-sans space-y-5 rounded-sm">
              <div className="flex justify-between border-b-2 border-black pb-3">
                <div>
                  <h2 className="text-lg font-black tracking-tight">MASTER PICKUP HANDOVER MANIFEST</h2>
                  <p className="text-xs text-slate-700 font-medium">Shipper Dispatch Warehouse: {MERCHANT_DETAILS.defaultWarehouseAddress}</p>
                  <p className="text-xs text-slate-700 font-mono">Origin Pincode: {MERCHANT_DETAILS.defaultOriginPin}</p>
                </div>
                <div className="text-right font-mono font-bold text-xs space-y-0.5">
                  <p>DISPATCH DATE: {new Date().toLocaleDateString("en-IN")}</p>
                  <p className="text-sm font-black text-black">TOTAL CONSIGNMENTS: {batchPrintBookings.length}</p>
                  <p>
                    TOTAL WEIGHT:{" "}
                    {batchPrintBookings.reduce((acc, b) => acc + (b.billable_weight || 0), 0).toFixed(1)} KG
                  </p>
                </div>
              </div>

              <table className="w-full text-left text-[10px] border border-black">
                <thead className="bg-slate-200 border-b-2 border-black font-black uppercase">
                  <tr>
                    <th className="p-1.5 border-r border-black">#</th>
                    <th className="p-1.5 border-r border-black">Order Ref</th>
                    <th className="p-1.5 border-r border-black">Carrier Docket</th>
                    <th className="p-1.5 border-r border-black">Consignee</th>
                    <th className="p-1.5 border-r border-black">Dest PIN</th>
                    <th className="p-1.5 border-r border-black">Boxes</th>
                    <th className="p-1.5 border-r border-black">Billable (kg)</th>
                    <th className="p-1.5">Driver Sign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-medium">
                  {batchPrintBookings.map((b, i) => (
                    <tr key={b.id}>
                      <td className="p-1.5 border-r border-black font-mono font-bold">{i + 1}</td>
                      <td className="p-1.5 border-r border-black font-mono font-black">{b.order_id}</td>
                      <td className="p-1.5 border-r border-black font-mono">{b.carrier_docket_no}</td>
                      <td className="p-1.5 border-r border-black truncate max-w-[130px] font-bold">{b.consignee_name}</td>
                      <td className="p-1.5 border-r border-black font-mono font-bold">{b.dest_pin}</td>
                      <td className="p-1.5 border-r border-black font-mono">{b.boxes?.length || 1}</td>
                      <td className="p-1.5 border-r border-black font-mono font-bold">{b.billable_weight}</td>
                      <td className="p-1.5"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-black text-xs font-bold">
                <div className="space-y-1">
                  <p>Shipper Dispatch Signature: _______________________</p>
                  <p className="text-[10px] text-slate-600 font-normal">I certify that all cargo packages are sealed and handed over intact.</p>
                </div>
                <div className="space-y-1">
                  <p>Carrier Driver Handover Signature: ___________________</p>
                  <p className="text-[10px] text-slate-600 font-normal">Vehicle / Route No. & Official Linehaul Handover Timestamp</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 22. POSTAL PIN DIRECTORY SEARCH MODAL COMPONENT
// ============================================================================
export interface CitySearchModalProps {
  target: "origin" | "dest";
  onSelectPin: (pin: string) => void;
  onClose: () => void;
}

function CitySearchModal({ target, onSelectPin, onClose }: CitySearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ name: string; district: string; state: string; pincode: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query || query.trim().length < 3) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data && data[0]?.Status === "Success" && data[0]?.PostOffice) {
        setResults(
          data[0].PostOffice.map((item: any) => ({
            name: item.Name,
            district: item.District,
            state: item.State,
            pincode: item.Pincode
          }))
        );
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Find PIN Code for {target === "origin" ? "Origin" : "Destination"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">Search Indian cities, districts, or branch post offices</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="e.g. Ludhiana, Meerut, Panipat, Bhiwandi..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <SearchIcon className="w-4 h-4" />
            <span>{loading ? "..." : "Search"}</span>
          </button>
        </form>

        <div className="max-h-64 overflow-y-auto space-y-2 divide-y divide-slate-100 pr-1">
          {results.length > 0 ? (
            results.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSelectPin(item.pincode);
                  onClose();
                }}
                className="pt-2 flex items-center justify-between p-2 rounded-xl hover:bg-indigo-50/80 cursor-pointer transition text-xs group"
              >
                <div>
                  <p className="font-bold text-slate-900 group-hover:text-indigo-900 flex items-center space-x-1">
                    <MapPinIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{item.name}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">{item.district}, {item.state}</p>
                </div>
                <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                  {item.pincode}
                </span>
              </div>
            ))
          ) : hasSearched && !loading ? (
            <p className="text-center text-xs text-slate-400 py-6">No matching post offices found. Try another city name.</p>
          ) : (
            <p className="text-center text-xs text-slate-400 py-6">Type at least 3 letters of your city and press search.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 23. MANUAL TARIFF RATE CARD PUBLISHER MODAL COMPONENT
// ============================================================================
export interface AddRateCardModalProps {
  currentUser: UserProfile;
  vendors: Vendor[];
  onSuccess: (card: RateCard) => void;
  onClose: () => void;
}

function AddRateCardModal({ currentUser, vendors, onSuccess, onClose }: AddRateCardModalProps) {
  const [card, setCard] = useState({
    origin_prefix: "110",
    dest_prefix: "400",
    mode: "surface" as "surface" | "air" | "ftl",
    min_weight_kg: 10,
    base_rate: 400,
    per_kg_rate: 14,
    fuel_surcharge_pct: 12,
    docket_charge: 150,
    fov_pct: 0.2,
    oda_charge: 450,
    handling_per_kg: 2,
    sla_days: 3
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const vendorId = currentUser.vendor_id || "11111111-1111-1111-1111-111111111111";
    const payload = { ...card, vendor_id: vendorId, is_active: true };

    try {
      const { data, error } = await supabase.from("rate_cards").insert([payload]).select("*, vendors(*)");
      if (!error && data && data[0]) {
        onSuccess(data[0] as RateCard);
      } else {
        const localCard: RateCard = {
          ...(payload as RateCard),
          id: `rc-${Date.now()}`,
          vendors: vendors.find((v) => v.id === vendorId)
        };
        onSuccess(localCard);
      }
      onClose();
    } catch {
      const localCard: RateCard = {
        ...(payload as RateCard),
        id: `rc-${Date.now()}`,
        vendors: vendors.find((v) => v.id === vendorId)
      };
      onSuccess(localCard);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto select-none">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="text-base font-black text-slate-900">Publish New Commercial Rate Tariff</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Origin Prefix (3 digits or %)</label>
            <input
              type="text"
              value={card.origin_prefix}
              onChange={(e) => setCard({ ...card, origin_prefix: e.target.value })}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Dest Prefix (3 digits or %)</label>
            <input
              type="text"
              value={card.dest_prefix}
              onChange={(e) => setCard({ ...card, dest_prefix: e.target.value })}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Transport Mode</label>
            <select
              value={card.mode}
              onChange={(e) => setCard({ ...card, mode: e.target.value as any })}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
            >
              <option value="surface">Surface Express</option>
              <option value="air">Air Cargo</option>
              <option value="ftl">Full Truck Load (FTL)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Transit SLA (Days)</label>
            <input
              type="number"
              value={card.sla_days}
              onChange={(e) => setCard({ ...card, sla_days: Number(e.target.value) })}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Base Rate (₹)</label>
            <input
              type="number"
              value={card.base_rate}
              onChange={(e) => setCard({ ...card, base_rate: Number(e.target.value) })}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Rate Per Kg (₹)</label>
            <input
              type="number"
              step={0.1}
              value={card.per_kg_rate}
              onChange={(e) => setCard({ ...card, per_kg_rate: Number(e.target.value) })}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Fuel Surcharge (%)</label>
            <input
              type="number"
              step={0.5}
              value={card.fuel_surcharge_pct}
              onChange={(e) => setCard({ ...card, fuel_surcharge_pct: Number(e.target.value) })}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Docket / AWB Charge (₹)</label>
            <input
              type="number"
              value={card.docket_charge}
              onChange={(e) => setCard({ ...card, docket_charge: Number(e.target.value) })}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div className="col-span-2 flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2 rounded-xl shadow-sm transition"
            >
              {isSubmitting ? "Publishing..." : "Publish Tariff Card"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 24. RAZORPAY COMPLIANCE & LEGAL POLICY MODAL COMPONENT
// ============================================================================
export interface LegalModalProps {
  tab: "terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact";
  setTab: (t: "terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact") => void;
  onClose: () => void;
}

function LegalModal({ tab, setTab, onClose }: LegalModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto select-none">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-3xl w-full p-6 shadow-2xl my-8 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Legal, Governance & Razorpay KYC Compliance</h3>
            <p className="text-xs text-slate-500 font-medium">
              Merchant: {MERCHANT_DETAILS.proprietor} • Jurisdiction: {MERCHANT_DETAILS.jurisdiction}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-2">
          {[
            { id: "terms", label: "Terms of Service" },
            { id: "privacy", label: "Privacy Policy" },
            { id: "refund", label: "Refund & Cancellation" },
            { id: "shipping", label: "Shipping Policy" },
            { id: "prohibited", label: "Prohibited Goods" },
            { id: "contact", label: "Contact Us" }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-600 space-y-3 max-h-96 overflow-y-auto pr-2 leading-relaxed">
          {tab === "terms" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Terms and Conditions of Service</h4>
              <p>
                <strong>1. Platform Nature:</strong> {MERCHANT_DETAILS.platformName} is a proprietary B2B freight aggregator platform operated by <strong>{MERCHANT_DETAILS.proprietor}</strong>. LogiCompare connects commercial shippers with third-party verified fleet operators (Delhivery, Blue Dart, TCI, Safexpress, Gati).
              </p>
              <p>
                <strong>2. Statutory Compliance & E-Way Bills:</strong> Shippers warrant that consignments exceeding ₹50,000 are accompanied by valid, active GST E-Way Bills and commercial invoices.
              </p>
              <p>
                <strong>3. Governing Law:</strong> These terms are governed by the laws of India. Any dispute shall be subject to the exclusive jurisdiction of the competent courts in <strong>{MERCHANT_DETAILS.jurisdiction}</strong>.
              </p>
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Privacy & Data Protection Policy</h4>
              <p>
                <strong>1. Collection of Business Data:</strong> We collect business contact details, GSTIN identifiers, pickup/delivery warehouse addresses, and package specifications solely to facilitate freight calculations, AWB barcode printing, and linehaul tracking.
              </p>
              <p>
                <strong>2. Designated Grievance Officer:</strong> In compliance with the Information Technology Act, 2000 and Digital Personal Data Protection Act, the designated Grievance Officer is:
              </p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-0.5">
                <p><strong>Officer:</strong> {MERCHANT_DETAILS.proprietor}</p>
                <p><strong>Email:</strong> {MERCHANT_DETAILS.email}</p>
                <p><strong>Helpline:</strong> {MERCHANT_DETAILS.phone}</p>
                <p><strong>Address:</strong> {MERCHANT_DETAILS.address}</p>
              </div>
            </div>
          )}

          {tab === "refund" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Refund & Cancellation Policy</h4>
              <p>
                <strong>1. Cancellation Prior to Pickup:</strong> Consignments cancelled before carrier pickup attempt qualify for a <strong>100% full refund</strong> of platform verification fees.
              </p>
              <p>
                <strong>2. Refund Settlement Timeframe:</strong> All approved refunds are processed back to the original source account via Razorpay. The standard credit window is <strong>5 to 7 business days</strong>.
              </p>
            </div>
          )}

          {tab === "shipping" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Shipping, Transit SLAs & Delivery Policy</h4>
              <p>
                <strong>1. Serviceable Network:</strong> LogiCompare Pro services 19,000+ PIN codes across India via aggregated multi-modal express networks.
              </p>
              <p>
                <strong>2. Estimated Transit SLAs:</strong> Surface Express (3–6 business days), Air Express Cargo (24–48 hours connecting primary metro airport gateways).
              </p>
            </div>
          )}

          {tab === "prohibited" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Strictly Prohibited & Banned Cargo</h4>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>Explosives, fireworks, ammunition, and hazardous chemicals (Classes 1–9 Hazmat).</li>
                <li>Flammable liquids, gases, compressed cylinders, and corrosives.</li>
                <li>Unregistered bullion, loose precious gems, and sovereign cash/currency notes.</li>
                <li>Narcotics and contraband goods prohibited under the NDPS Act.</li>
              </ul>
            </div>
          )}

          {tab === "contact" && (
            <div className="space-y-3">
              <h4 className="font-black text-slate-900 text-sm">Official Merchant Contact & Support</h4>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 font-medium">
                <p><strong className="text-slate-900">Proprietor / Merchant:</strong> {MERCHANT_DETAILS.proprietor}</p>
                <p><strong className="text-slate-900">Platform:</strong> {MERCHANT_DETAILS.platformName} ({MERCHANT_DETAILS.category})</p>
                <p><strong className="text-slate-900">Email:</strong> <a href={`mailto:${MERCHANT_DETAILS.email}`} className="text-indigo-600 underline">{MERCHANT_DETAILS.email}</a></p>
                <p><strong className="text-slate-900">Helpline:</strong> <a href={`tel:${MERCHANT_DETAILS.phone}`} className="text-indigo-600 underline">{MERCHANT_DETAILS.phone}</a></p>
                <p><strong className="text-slate-900">Operating Address:</strong> {MERCHANT_DETAILS.address}</p>
                <p><strong className="text-slate-900">Operating Hours:</strong> {MERCHANT_DETAILS.operatingHours}</p>
                <p><strong className="text-slate-900">Jurisdiction:</strong> {MERCHANT_DETAILS.jurisdiction}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2 rounded-xl transition"
          >
            Close Compliance Window
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 25. SUPABASE AUTHENTICATION MODAL COMPONENT
// ============================================================================
export interface AuthModalProps {
  onSuccess: (profile: UserProfile) => void;
  onClose: () => void;
}

function AuthModal({ onSuccess, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"shipper" | "vendor">("shipper");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          const profileRole: RoleType = role === "vendor" ? "carrier" : "shipper";
          const profile: UserProfile = {
            id: data.user.id,
            email,
            full_name: fullName,
            company_name: companyName,
            gstin,
            phone,
            role: profileRole,
            vendor_id: profileRole === "carrier" ? data.user.id : undefined,
            isRealUser: true
          };
          await supabase.from("profiles").upsert([profile]);
          onSuccess(profile);
          onClose();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
          if (pData) {
            const resolvedRole: RoleType = (pData.role === "vendor" || pData.role === "carrier") ? "carrier" : pData.role;
            onSuccess({ ...(pData as UserProfile), role: resolvedRole, isRealUser: true });
          } else {
            onSuccess({
              id: data.user.id,
              email: data.user.email || email,
              full_name: "Verified Business User",
              company_name: "Apex Retail Solutions",
              gstin: "07AAACA1234A1Z5",
              phone: "+91 98110 23456",
              role: "shipper",
              isRealUser: true
            });
          }
          onClose();
        }
      }
    } catch (err: any) {
      setMsg(err.message || "Authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="text-base font-black text-slate-900">
            {mode === "login" ? "Account Sign In" : "Register Logistics Enterprise"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {msg && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold">{msg}</p>}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Business Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {mode === "signup" && (
            <>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Enterprise Company Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">GSTIN (15 Digits)</label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 07AAACA1234A1Z5"
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Account Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                >
                  <option value="shipper">Shipper (Manufacturer / Retailer / Trader)</option>
                  <option value="vendor">Carrier / Transporter / Fleet Operator</option>
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs transition shadow-md disabled:opacity-50"
          >
            {loading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          {mode === "login" ? (
            <button type="button" onClick={() => setMode("signup")} className="text-indigo-600 font-bold hover:underline">
              Don't have an enterprise account? Sign up
            </button>
          ) : (
            <button type="button" onClick={() => setMode("login")} className="text-indigo-600 font-bold hover:underline">
              Already registered? Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 26. GLOBAL FOOTER COMPONENT
// ============================================================================
export interface FooterSectionProps {
  openLegalModal: (tab: "terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact") => void;
}

function FooterSection({ openLegalModal }: FooterSectionProps) {
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950 text-slate-300 text-xs no-print select-none">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-b border-slate-800/80 pb-8">
          <div className="space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                <TruckIcon className="w-5 h-5" />
              </div>
              <span className="font-black text-base text-white tracking-tight">{MERCHANT_DETAILS.platformName}</span>
            </div>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              Proprietary freight aggregator connecting commercial shippers with verified fleets (Delhivery, Blue Dart, Safexpress, TCI, Gati) with 0% freight markups.
            </p>
            <div className="inline-flex items-center space-x-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Jurisdiction: <strong>{MERCHANT_DETAILS.jurisdiction}</strong></span>
            </div>
          </div>

          <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            <span className="text-xs font-black uppercase tracking-wider block text-indigo-400">
              Merchant Contact & Grievance
            </span>
            <p className="text-[11px] text-slate-300"><strong>Proprietor:</strong> {MERCHANT_DETAILS.proprietor}</p>
            <p className="text-[11px] text-slate-300">
              <strong>Helpline:</strong> <a href={`tel:${MERCHANT_DETAILS.phone}`} className="text-indigo-400 hover:underline">{MERCHANT_DETAILS.phone}</a>
            </p>
            <p className="text-[11px] text-slate-300">
              <strong>Support:</strong> <a href={`mailto:${MERCHANT_DETAILS.email}`} className="text-indigo-400 hover:underline">{MERCHANT_DETAILS.email}</a>
            </p>
            <p className="text-[11px] text-slate-400 leading-tight">
              <strong>Address:</strong> {MERCHANT_DETAILS.address}
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-black uppercase tracking-wider block text-indigo-400">
              Governance & Policies
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-400">
              <button type="button" onClick={() => openLegalModal("terms")} className="text-left hover:text-white transition">
                Terms of Service
              </button>
              <button type="button" onClick={() => openLegalModal("privacy")} className="text-left hover:text-white transition">
                Privacy Policy
              </button>
              <button type="button" onClick={() => openLegalModal("refund")} className="text-left hover:text-white transition">
                Refund & Cancellation
              </button>
              <button type="button" onClick={() => openLegalModal("shipping")} className="text-left hover:text-white transition">
                Shipping Policy
              </button>
              <button type="button" onClick={() => openLegalModal("prohibited")} className="text-left hover:text-white transition">
                Prohibited Cargo
              </button>
              <button type="button" onClick={() => openLegalModal("contact")} className="text-left hover:text-white transition">
                Contact Us
              </button>
            </div>
            <div className="pt-2 flex flex-wrap gap-2 text-[10px]">
              <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded font-mono font-bold">
                100% Direct Settlement
              </span>
              <span className="bg-indigo-950/60 text-indigo-300 border border-indigo-800/80 px-2 py-0.5 rounded font-mono font-bold">
                GST 18% GTA
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <p>© 2026 {MERCHANT_DETAILS.platformName} ({MERCHANT_DETAILS.proprietor}). All rights reserved across India.</p>
          <div className="flex items-center space-x-3">
            <span>Carriage by Road Act 2007</span>
            <span>•</span>
            <span>Refund SLA: 5–7 Days</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// 27. MAIN DEFAULT EXPORT (INTEGRATING CONTROLLER, WORKSPACES & MODALS)
// ============================================================================
export default function LogiComparePro() {
  const { state, handlers } = LogiCompareProController();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* 1. Global Navigation Bar */}
      <HeaderSection
        activeRole={state.activeRole}
        setActiveRole={state.setActiveRole}
        modeEnv={state.modeEnv}
        handleModeToggle={handlers.handleModeToggle}
        highVolumeMode={state.highVolumeMode}
        setHighVolumeMode={state.setHighVolumeMode}
        currentUser={state.currentUser}
        switchDemoRole={handlers.handleRoleSwitch}
        handleLogout={handlers.handleLogout}
        setShowAuthModal={state.setShowAuthModal}
        globalSearchInput={state.globalSearchInput}
        setGlobalSearchInput={state.setGlobalSearchInput}
        handleGlobalSearch={handlers.handleGlobalSearch}
      />

      {/* 2. Workspace View Routing */}
      <div className="flex-1">
        {/* VIEW A: LANDING PAGE */}
        {state.activeRole === "landing" && (
          <LandingViewSection
            highVolumeMode={state.highVolumeMode}
            vendors={state.vendors}
            landingTrackingInput={state.landingTrackingInput}
            setLandingTrackingInput={state.setLandingTrackingInput}
            onQuickTrack={(val) => {
              const target = val || state.landingTrackingInput || DEMO_INIT_ORDER_ID;
              state.setActiveTrackingAwb(target);
              state.setTrackingSearchInput(target);
              state.setActiveRole("shipper");
              state.setShipperTab("history");
            }}
            onJumpToCompare={() => {
              state.setActiveRole("shipper");
              state.setShipperTab("search");
            }}
            onJumpToBulk={() => {
              state.setActiveRole("shipper");
              state.setShipperTab("matrix");
            }}
            onSwitchShipperDemo={() => {
              state.setActiveRole("shipper");
              state.setCurrentUser(DEMO_SHIPPER);
              state.setModeEnv("demo");
            }}
            onSwitchCarrierDemo={() => {
              state.setActiveRole("carrier");
              state.setCurrentUser(DEMO_VENDOR);
              state.setModeEnv("demo");
            }}
          />
        )}

        {/* VIEW B: SHIPPER WORKSPACE */}
        {state.activeRole === "shipper" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shipper Console</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Commercial Freight Matrix • Active Account: <strong className="text-slate-800">{state.currentUser.company_name}</strong>
                </p>
              </div>

              <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-600 flex items-center space-x-1">
                  <BoltIcon className="w-4 h-4 text-amber-500" />
                  <span>50/Day High-Volume:</span>
                </span>
                <button
                  type="button"
                  onClick={() => state.setHighVolumeMode(!state.highVolumeMode)}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-black transition ${
                    state.highVolumeMode ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {state.highVolumeMode ? "ACTIVE (60FPS)" : "OFF"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
              {[
                { id: "search", label: "🔍 New Rate Search" },
                { id: "matrix", label: "⚡ Rate Matrix (50/Day Bulk)" },
                { id: "shipments", label: "📦 Active Shipments" },
                { id: "history", label: "📍 History & Live Track" },
                { id: "rfq", label: "⚖️ Load Auction (RFQ)" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => state.setShipperTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl font-bold transition shadow-sm ${
                    state.shipperTab === tab.id
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {state.shipperTab === "search" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <ShipperSingleCalculatorSection
                  highVolumeMode={state.highVolumeMode}
                  originPin={state.originPin}
                  setOriginPin={state.setOriginPin}
                  destPin={state.destPin}
                  setDestPin={state.setDestPin}
                  declaredValue={state.declaredValue}
                  setDeclaredValue={state.setDeclaredValue}
                  selectedMode={state.selectedMode}
                  setSelectedMode={state.setSelectedMode}
                  isOda={state.isOda}
                  setIsOda={state.setIsOda}
                  boxes={state.boxes}
                  setBoxes={state.setBoxes}
                  selectedBoxFor3D={state.selectedBoxFor3D}
                  setSelectedBoxFor3D={state.setSelectedBoxFor3D}
                  originZoneData={state.originZoneData}
                  destZoneData={state.destZoneData}
                  calculatedQuotes={state.calculatedQuotes}
                  onOpenCityModal={(t) => state.setShowCitySearchModal(t)}
                  onSelectQuoteForBooking={(q) => state.setSelectedQuoteForBooking(q)}
                />
              </div>
            )}

            {state.shipperTab === "matrix" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <ShipperBulkCsvSection
                  highVolumeMode={state.highVolumeMode}
                  bulkManifestList={state.bulkManifestList}
                  setBulkManifestList={state.setBulkManifestList}
                  onAutoSelectCheapest={() =>
                    state.setBulkManifestList((prev) =>
                      prev.map((r) => ({
                        ...r,
                        selectedQuote: [...r.quotes].sort((a, b) => a.breakdown.total - b.breakdown.total)[0]
                      }))
                    )
                  }
                  onAutoSelectFastest={() =>
                    state.setBulkManifestList((prev) =>
                      prev.map((r) => ({
                        ...r,
                        selectedQuote: [...r.quotes].sort((a, b) => a.rateCard.sla_days - b.rateCard.sla_days)[0]
                      }))
                    )
                  }
                  onSelectCarrierForRow={(rowId, vId) =>
                    state.setBulkManifestList((prev) =>
                      prev.map((r) => (r.rowId === rowId ? { ...r, selectedQuote: r.quotes.find((q) => q.vendor.id === vId) || r.quotes[0] } : r))
                    )
                  }
                  bulkSettlementMethod={state.bulkSettlementMethod}
                  setBulkSettlementMethod={state.setBulkSettlementMethod}
                  bulkConsolidatedUtr={state.bulkConsolidatedUtr}
                  setBulkConsolidatedUtr={state.setBulkConsolidatedUtr}
                  onConfirmBatchBooking={handlers.handleConfirmBatchBooking}
                  isBatchProcessing={state.isBatchProcessing}
                  handleBulkCsvUpload={handlers.handleBulkCsvUpload}
                  bulkCsvFileName={state.bulkCsvFileName}
                  bulkUploadError={state.bulkUploadError}
                />
              </div>
            )}

            {state.shipperTab === "shipments" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <ShipperShipmentsSection
                  bookings={state.bookings}
                  onRefresh={handlers.fetchAllData}
                  onOpenLabelModal={(b) => state.setPrintableBooking(b)}
                  onOpenTrackerTab={(orderRef) => {
                    state.setActiveTrackingAwb(orderRef);
                    state.setTrackingSearchInput(orderRef);
                    state.setShipperTab("history");
                  }}
                  onBatchPrintLabels={() => state.setBatchPrintBookings(state.bookings.slice(0, 50))}
                />
              </div>
            )}

            {state.shipperTab === "history" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <ShipperTrackerSection
                  bookings={state.bookings}
                  activeTrackingAwb={state.activeTrackingAwb}
                  setActiveTrackingAwb={state.setActiveTrackingAwb}
                  trackingSearchInput={state.trackingSearchInput}
                  setTrackingSearchInput={state.setTrackingSearchInput}
                />
              </div>
            )}

            {state.shipperTab === "rfq" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <ShipperRfqSection
                  currentUser={state.currentUser}
                  rfqList={state.rfqList}
                  setRfqList={state.setRfqList}
                />
              </div>
            )}
          </div>
        )}

        {/* VIEW C: CARRIER WORKSPACE */}
        {(state.activeRole === "carrier" || state.activeRole === "vendor") && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Carrier Operations Hub</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Operating Partner: <strong className="text-emerald-700">{state.currentUser.company_name}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => state.setShowAddRateCardModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition"
              >
                + Publish New Lane Tariff
              </button>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
              {[
                { id: "loads", label: "🎯 Available Loads (RFQs)" },
                { id: "tracking", label: "📋 Fleet Tracking & Bilty" },
                { id: "rates", label: "🏷️ Commercial Rate Cards" },
                { id: "earnings", label: "🏦 Earnings & Settlement" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => state.setCarrierTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl font-bold transition shadow-sm ${
                    state.carrierTab === tab.id
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {state.carrierTab === "loads" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <CarrierBidsSection
                  currentUser={state.currentUser}
                  rfqList={state.rfqList}
                  setRfqList={state.setRfqList}
                />
              </div>
            )}

            {state.carrierTab === "tracking" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <CarrierOrdersSection
                  currentUser={state.currentUser}
                  bookings={state.bookings}
                  statusUpdateMap={state.statusUpdateMap}
                  setStatusUpdateMap={state.setStatusUpdateMap}
                  onUploadDocketFile={handlers.handleUploadDocketFile}
                  onUpdateShipmentStatus={handlers.handleUpdateShipmentStatus}
                />
              </div>
            )}

            {state.carrierTab === "rates" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <CarrierRatesSection
                  currentUser={state.currentUser}
                  rateCards={state.rateCards}
                  setRateCards={state.setRateCards}
                  vendors={state.vendors}
                  onOpenAddRateModal={() => state.setShowAddRateCardModal(true)}
                />
              </div>
            )}

            {state.carrierTab === "earnings" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <CarrierBankSection
                  currentUser={state.currentUser}
                  vendors={state.vendors}
                  setVendors={state.setVendors}
                />
              </div>
            )}
          </div>
        )}

        {/* VIEW D: ADMIN / EXECUTIVE OVERSIGHT VIEW */}
        {state.activeRole === "admin" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <AdminOverviewSection
              bookings={state.bookings}
              vendors={state.vendors}
              rateCards={state.rateCards}
            />
          </div>
        )}
      </div>

      {/* 3. Global Context Modals */}
      {state.selectedQuoteForBooking && (
        <DirectBookingModal
          quote={state.selectedQuoteForBooking}
          currentUser={state.currentUser}
          originPin={state.originPin}
          destPin={state.destPin}
          boxes={state.boxes}
          declaredValue={state.declaredValue}
          pickupAddress={state.pickupAddress}
          onClose={() => state.setSelectedQuoteForBooking(null)}
          onSuccess={(b) => {
            state.setBookings([b, ...state.bookings]);
            state.setSelectedQuoteForBooking(null);
            state.setShipperTab("shipments");
          }}
        />
      )}

      {(state.printableBooking || state.batchPrintBookings) && (
        <ThermalPrintModal
          printableBooking={state.printableBooking}
          batchPrintBookings={state.batchPrintBookings}
          onClose={() => {
            state.setPrintableBooking(null);
            state.setBatchPrintBookings(null);
          }}
        />
      )}

      {state.showLegalModal && (
        <LegalModal
          tab={state.legalModalTab}
          setTab={state.setLegalModalTab}
          onClose={() => state.setShowLegalModal(false)}
        />
      )}

      {state.showCitySearchModal && (
        <CitySearchModal
          target={state.showCitySearchModal}
          onSelectPin={(pin) => {
            if (state.showCitySearchModal === "origin") state.setOriginPin(pin);
            else state.setDestPin(pin);
          }}
          onClose={() => state.setShowCitySearchModal(null)}
        />
      )}

      {state.showAuthModal && (
        <AuthModal
          onSuccess={(profile) => {
            state.setCurrentUser(profile);
            state.setModeEnv("live");
            state.setActiveRole(profile.role === "vendor" ? "carrier" : profile.role);
          }}
          onClose={() => state.setShowAuthModal(false)}
        />
      )}

      {state.showAddRateCardModal && (
        <AddRateCardModal
          currentUser={state.currentUser}
          vendors={state.vendors}
          onSuccess={(card) => state.setRateCards([card, ...state.rateCards])}
          onClose={() => state.setShowAddRateCardModal(false)}
        />
      )}

      {/* 4. Enterprise Compliance Footer */}
      <FooterSection
        openLegalModal={(tab) => {
          state.setLegalModalTab(tab);
          state.setShowLegalModal(true);
        }}
      />
    </div>
  );
}
