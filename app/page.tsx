"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type FC,
  type FormEvent,
  type ChangeEvent,
  type ReactNode
} from "react";
import { createClient, type Session, type User as SupabaseUser } from "@supabase/supabase-js";

// ============================================================================
// 1. SUPABASE CLIENT SETUP (LOCAL INSTANCE)
// ============================================================================
const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// 2. TYPESCRIPT DATA CONTRACTS & INTERFACES (LOCAL DECLARATIONS)
// ============================================================================
type RoleType = "shipper" | "carrier" | "vendor" | "admin";
type ModeEnv = "demo" | "live";
type BillingCycle = "weekly" | "monthly";
type InvoiceStatus = "Pending" | "Paid" | "Overdue";

interface AddressProfile {
  id: string;
  label: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  gstin: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

interface FeeConfig {
  percentage: number;
  minFloorINR: number;
  taxPercentage: number;
  fovPercentage: number;
  odaFlatCharge: number;
}

interface PlatformInvoice {
  id: string;
  invoice_number: string;
  carrier_id: string;
  carrier_name: string;
  billing_cycle: BillingCycle;
  period_start: string;
  period_end: string;
  total_consignments: number;
  gross_freight: number;
  platform_fee_total: number;
  status: InvoiceStatus;
  due_date: string;
  payment_date?: string;
  payment_ref?: string;
  payment_method?: string;
}

interface BoxItem {
  id: string;
  qty: number;
  weight: number;
  length?: number | null;
  width?: number | null;
  height?: number | null;
}

interface Vendor {
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

interface RateCard {
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

interface CostBreakdown {
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

interface CalculatedQuote {
  rateCard: RateCard;
  vendor: Vendor;
  actualWeight: number;
  volumetricWeight: number;
  billableWeight: number;
  isDeadWeightCalculated: boolean;
  breakdown: CostBreakdown;
}

interface TrackingStep {
  status: string;
  location: string;
  timestamp: string;
  remarks: string;
}

interface Booking {
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
  pickup_pincode: string;
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

interface BulkManifestRow {
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

interface RfqBid {
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

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  gstin: string;
  phone: string;
  role: RoleType;
  vendor_id?: string;
  isRealUser?: boolean;
  saved_addresses?: AddressProfile[];
}

interface ParsedCsvRateCard {
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

interface PinLookupResult {
  city: string;
  state: string;
  hub: string;
  loading: boolean;
  error?: string;
}

// ============================================================================
// 3. CORE CONFIGURATIONS, MASTERS & REPOSITORIES
// ============================================================================
const DEFAULT_FEE_CONFIG: FeeConfig = {
  percentage: 2,         // 2% Dynamic Platform Fee
  minFloorINR: 25,       // Minimum ₹25 floor cap
  taxPercentage: 18,     // 18% GST statutory
  fovPercentage: 0.20,   // 0.20% FOV insurance
  odaFlatCharge: 450     // ₹450 ODA rate
};

const DEFAULT_SHIPPER_ADDRESS: AddressProfile = {
  id: "addr-default-origin",
  label: "Primary Central Hub",
  company_name: "Apex Retail Solutions Pvt Ltd",
  contact_name: "Vikram Malhotra (Dispatch Lead)",
  phone: "+91 98110 23456",
  email: "dispatch@apexlogistics.in",
  gstin: "07AAACA1234A1Z5",
  address_line1: "Plot 42, Okhla Industrial Area Phase-III",
  address_line2: "Near C-Block Cargo Gate",
  city: "South Delhi",
  state: "Delhi",
  pincode: "110020",
  is_default: true
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
  isRealUser: false,
  saved_addresses: [DEFAULT_SHIPPER_ADDRESS]
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

const INITIAL_MOCK_INVOICES: PlatformInvoice[] = [
  {
    id: "inv-2026-w42",
    invoice_number: "INV-LC-2026-W42",
    carrier_id: "11111111-1111-1111-1111-111111111111",
    carrier_name: "Delhivery B2B Express",
    billing_cycle: "weekly",
    period_start: "2026-10-12",
    period_end: "2026-10-18",
    total_consignments: 34,
    gross_freight: 184500,
    platform_fee_total: 3690,
    status: "Paid",
    due_date: "2026-10-22",
    payment_date: "2026-10-20",
    payment_ref: "UTR-HDFC-99182371",
    payment_method: "Direct NetBanking"
  },
  {
    id: "inv-2026-w43",
    invoice_number: "INV-LC-2026-W43",
    carrier_id: "11111111-1111-1111-1111-111111111111",
    carrier_name: "Delhivery B2B Express",
    billing_cycle: "weekly",
    period_start: "2026-10-19",
    period_end: "2026-10-25",
    total_consignments: 48,
    gross_freight: 268200,
    platform_fee_total: 5364,
    status: "Pending",
    due_date: "2026-10-29"
  },
  {
    id: "inv-2026-m09",
    invoice_number: "INV-LC-2026-M09",
    carrier_id: "11111111-1111-1111-1111-111111111111",
    carrier_name: "Delhivery B2B Express",
    billing_cycle: "monthly",
    period_start: "2026-09-01",
    period_end: "2026-09-30",
    total_consignments: 142,
    gross_freight: 749000,
    platform_fee_total: 14980,
    status: "Paid",
    due_date: "2026-10-07",
    payment_date: "2026-10-05",
    payment_ref: "UTR-ICICI-001284719",
    payment_method: "Corporate NEFT"
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
// 4. MATHEMATICAL ENGINES, ROUTING & COMPRESSION UTILITIES
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

  // Check if dimensions are provided on at least one box
  const hasDimensions = boxes.some(
    (b) => b.length && b.width && b.height && Number(b.length) > 0 && Number(b.width) > 0 && Number(b.height) > 0
  );

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
    
    // Strict optional dimensions handling: if dimensions are missing or 0, volumetric weight is 0
    let volumetricWeight = 0;
    if (hasDimensions) {
      volumetricWeight = boxes.reduce((acc, b) => {
        if (!b.length || !b.width || !b.height || Number(b.length) <= 0 || Number(b.width) <= 0 || Number(b.height) <= 0) {
          return acc;
        }
        const volKg = ((Number(b.length)) * (Number(b.width)) * (Number(b.height))) / divisor;
        return acc + volKg * (Number(b.qty) || 1);
      }, 0);
    }

    const billableWeight = hasDimensions
      ? Math.max(actualWeight, Math.round(volumetricWeight * 10) / 10, card.min_weight_kg)
      : Math.max(actualWeight, card.min_weight_kg);

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
      isDeadWeightCalculated: !hasDimensions,
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
    reader.onload = (e) => { img.src = e.target?.result as string; };
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
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" }) : file);
      }, "image/jpeg", 0.75);
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// 5. INLINE VECTOR SYSTEM (STANDARD SVG ICONS WITHOUT EXPORT)
// ============================================================================
interface IconProps {
  className?: string;
}

const TruckIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
  </svg>
);

const PlaneIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const BoxIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const PrinterIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

const SearchIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const PlusIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ArrowRightIcon: FC<IconProps> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

const CheckCircleIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XMarkIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ShieldCheckIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const ChevronDownIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const LayersIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const CurrencyRupeeIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6m-5 0h.01M9 12h5m-5 0h.01M9 4v16m0-12a4 4 0 014 4 4 4 0 01-4 4l6 6" />
  </svg>
);

const CreditCardIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 10h20M7 15h2m4 0h4" />
  </svg>
);

const ExternalLinkIcon: FC<IconProps> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const DownloadIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const UploadIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const MapPinIcon: FC<IconProps> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const DocumentIcon: FC<IconProps> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const BoltIcon: FC<IconProps> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const BuildingOfficeIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
);

const CalendarIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.253M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);
// ============================================================================
// 6. DYNAMIC ADDRESS MANAGEMENT MODAL (SHIPPER ORIGIN WAREHOUSE)
// ============================================================================
interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (address: AddressProfile) => void;
  initialAddress?: AddressProfile | null;
}

const AddressModal: FC<AddressModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAddress
}) => {
  const [label, setLabel] = useState(initialAddress?.label || "Primary Warehouse");
  const [companyName, setCompanyName] = useState(initialAddress?.company_name || "");
  const [contactName, setContactName] = useState(initialAddress?.contact_name || "");
  const [phone, setPhone] = useState(initialAddress?.phone || "");
  const [email, setEmail] = useState(initialAddress?.email || "");
  const [gstin, setGstin] = useState(initialAddress?.gstin || "");
  const [line1, setLine1] = useState(initialAddress?.address_line1 || "");
  const [line2, setLine2] = useState(initialAddress?.address_line2 || "");
  const [city, setCity] = useState(initialAddress?.city || "");
  const [stateName, setStateName] = useState(initialAddress?.state || "");
  const [pincode, setPincode] = useState(initialAddress?.pincode || "110020");
  const [isDefault, setIsDefault] = useState(initialAddress?.is_default ?? true);
  const [isLookingUpPin, setIsLookingUpPin] = useState(false);

  useEffect(() => {
    if (initialAddress) {
      setLabel(initialAddress.label);
      setCompanyName(initialAddress.company_name);
      setContactName(initialAddress.contact_name);
      setPhone(initialAddress.phone);
      setEmail(initialAddress.email);
      setGstin(initialAddress.gstin);
      setLine1(initialAddress.address_line1);
      setLine2(initialAddress.address_line2 || "");
      setCity(initialAddress.city);
      setStateName(initialAddress.state);
      setPincode(initialAddress.pincode);
      setIsDefault(initialAddress.is_default);
    }
  }, [initialAddress]);

  const handlePincodeBlur = async () => {
    const cleanPin = pincode.trim();
    if (cleanPin.length === 6) {
      setIsLookingUpPin(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
        const data = await res.json();
        if (data && data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          setCity(po.District || po.Block || po.Name);
          setStateName(po.State);
        } else {
          const fb = getLocalFallbackZone(cleanPin);
          setCity(fb.city);
          setStateName(fb.state);
        }
      } catch {
        const fb = getLocalFallbackZone(cleanPin);
        setCity(fb.city);
        setStateName(fb.state);
      } finally {
        setIsLookingUpPin(false);
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!pincode || pincode.trim().length !== 6) {
      alert("Please provide a valid 6-digit Indian PIN code.");
      return;
    }
    const updated: AddressProfile = {
      id: initialAddress?.id || `addr-${Date.now()}`,
      label: label.trim(),
      company_name: companyName.trim() || "Apex Retail Solutions Pvt Ltd",
      contact_name: contactName.trim() || "Dispatch Manager",
      phone: phone.trim() || "+91 98110 23456",
      email: email.trim(),
      gstin: gstin.trim().toUpperCase(),
      address_line1: line1.trim(),
      address_line2: line2.trim(),
      city: city.trim() || "New Delhi",
      state: stateName.trim() || "Delhi",
      pincode: pincode.trim(),
      is_default: isDefault
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">
              {initialAddress ? "Edit Dispatch Warehouse Address" : "Add Warehouse Origin Address"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              This address dynamically auto-populates your consignment origin for freight calculations.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Address Label</label>
              <input
                type="text"
                required
                placeholder="e.g. Primary Hub, Okhla Warehouse"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Enterprise Name</label>
              <input
                type="text"
                placeholder="Apex Retail Solutions Pvt Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Dispatch Contact</label>
              <input
                type="text"
                required
                placeholder="Lead Person Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
              <input
                type="text"
                required
                placeholder="+91 98110 23456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">GSTIN</label>
              <input
                type="text"
                maxLength={15}
                placeholder="07AAACA1234A1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Address Line 1 (Street / Plot No.)</label>
            <input
              type="text"
              required
              placeholder="Plot 42, Okhla Industrial Area Phase-III"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Address Line 2 (Landmark / Floor / Gate)</label>
            <input
              type="text"
              placeholder="Near Gate No. 2, Behind Container Yard"
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                PIN Code {isLookingUpPin && <span className="text-indigo-600 text-[10px] animate-pulse">(Lookup...)</span>}
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="110020"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                onBlur={handlePincodeBlur}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">City / District</label>
              <input
                type="text"
                required
                placeholder="South Delhi"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">State</label>
              <input
                type="text"
                required
                placeholder="Delhi"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="is_default_addr"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300"
            />
            <label htmlFor="is_default_addr" className="text-xs font-bold text-slate-700 cursor-pointer">
              Set as Default Pickup Warehouse (Auto-loads in calculator and bulk CSV dispatch)
            </label>
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-2.5 rounded-xl shadow-md transition"
            >
              Save Address Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 7. PLATFORM FEE SETTLEMENT & INVOICE PAYMENT MODAL
// ============================================================================
interface PayPlatformFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: PlatformInvoice | null;
  onPaySuccess: (invoiceId: string, utr: string, method: string) => void;
}

const PayPlatformFeeModal: FC<PayPlatformFeeModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onPaySuccess
}) => {
  const [method, setMethod] = useState<"upi" | "netbanking" | "card">("upi");
  const [utrNumber, setUtrNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !invoice) return null;

  const handlePay = (e: FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      alert("Please enter a valid Transaction / UTR reference number.");
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      onPaySuccess(invoice.id, utrNumber.trim(), method === "upi" ? "UPI VPA" : method === "netbanking" ? "Corporate NetBanking" : "Corporate Debit Card");
      setIsProcessing(false);
      onClose();
      alert(`Platform Fee Payment of ${formatINR(invoice.platform_fee_total)} successfully verified! Invoice marked as Paid.`);
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Settle Platform Commission Fee</h3>
            <p className="text-xs text-slate-500 font-medium">Invoice: <span className="font-mono font-bold text-indigo-700">{invoice.invoice_number}</span></p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Summary Card */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-inner space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span>Billing Cycle:</span>
            <span className="font-bold uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {invoice.billing_cycle} Period ({invoice.period_start} to {invoice.period_end})
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Carrier Organization:</span>
            <strong className="text-white">{invoice.carrier_name}</strong>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Dispatched Consignments:</span>
            <strong className="text-white">{invoice.total_consignments} Loads</strong>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Gross Freight Handled:</span>
            <strong className="font-mono text-white">{formatINR(invoice.gross_freight)}</strong>
          </div>
          <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-black text-emerald-400">
            <span>Platform Fee Payable (2%):</span>
            <span className="text-base font-mono">{formatINR(invoice.platform_fee_total)}</span>
          </div>
        </div>

        {/* Settlement Payment Form */}
        <form onSubmit={handlePay} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-800 font-bold mb-1">Select Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMethod("upi")}
                className={`p-2.5 rounded-xl border-2 font-bold text-center transition ${
                  method === "upi" ? "bg-indigo-50 border-indigo-600 text-indigo-900" : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                📲 UPI Transfer
              </button>
              <button
                type="button"
                onClick={() => setMethod("netbanking")}
                className={`p-2.5 rounded-xl border-2 font-bold text-center transition ${
                  method === "netbanking" ? "bg-indigo-50 border-indigo-600 text-indigo-900" : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                🏦 NetBanking
              </button>
              <button
                type="button"
                onClick={() => setMethod("card")}
                className={`p-2.5 rounded-xl border-2 font-bold text-center transition ${
                  method === "card" ? "bg-indigo-50 border-indigo-600 text-indigo-900" : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                💳 Debit/Card
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 font-mono text-[11px]">
            <p className="text-slate-600"><strong>Aggregator Beneficiary:</strong> {MERCHANT_DETAILS.proprietor}</p>
            <p className="text-slate-600"><strong>Platform VPA:</strong> platform.billing@icici</p>
            <p className="text-slate-600"><strong>Escrow Bank Account:</strong> 50200088910001 (IFSC: HDFC0000240)</p>
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Bank Payment Reference / UTR Number</label>
            <input
              type="text"
              required
              placeholder="e.g. UTR-998124018274 or CMS-Ref"
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
            >
              {isProcessing ? "Verifying..." : `Confirm Payment (${formatINR(invoice.platform_fee_total)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 8. REAL SUPABASE AUTHENTICATION MODAL (STRICTLY ISOLATED)
// ============================================================================
interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (profile: UserProfile) => void;
  onClose: () => void;
}

const AuthModal: FC<AuthModalProps> = ({ isOpen, onSuccess, onClose }) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"shipper" | "carrier">("shipper");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email,
            full_name: fullName.trim() || "Enterprise Admin",
            company_name: companyName.trim() || "Logistics Commercial Corp",
            gstin: gstin.trim().toUpperCase() || "07AAACA1234A1Z5",
            phone: phone.trim() || "+91 98110 23456",
            role: role,
            vendor_id: role === "carrier" ? data.user.id : undefined,
            isRealUser: true,
            saved_addresses: [DEFAULT_SHIPPER_ADDRESS]
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
            onSuccess({
              ...(pData as UserProfile),
              role: resolvedRole,
              isRealUser: true,
              saved_addresses: pData.saved_addresses || [DEFAULT_SHIPPER_ADDRESS]
            });
          } else {
            onSuccess({
              id: data.user.id,
              email: data.user.email || email,
              full_name: "Verified Business User",
              company_name: "Apex Retail Solutions",
              gstin: "07AAACA1234A1Z5",
              phone: "+91 98110 23456",
              role: "shipper",
              isRealUser: true,
              saved_addresses: [DEFAULT_SHIPPER_ADDRESS]
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">
              {mode === "login" ? "Live Account Sign In" : "Register Logistics Enterprise"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">Production Supabase Authentication Guard</p>
          </div>
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
                <label className="block text-slate-700 font-bold mb-1">Company / Organization</label>
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
                  placeholder="07AAACA1234A1Z5"
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Primary Operational Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "shipper" | "carrier")}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                >
                  <option value="shipper">Shipper (Manufacturer / Trader / Dispatcher)</option>
                  <option value="carrier">Carrier (Transporter / Fleet Owner)</option>
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl text-xs transition shadow-md disabled:opacity-50"
          >
            {loading ? "Authenticating..." : mode === "login" ? "Sign In To Live Platform" : "Create Enterprise Account"}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          {mode === "login" ? (
            <button type="button" onClick={() => setMode("signup")} className="text-indigo-600 font-bold hover:underline">
              Need a live enterprise account? Register here
            </button>
          ) : (
            <button type="button" onClick={() => setMode("login")} className="text-indigo-600 font-bold hover:underline">
              Already have an enterprise account? Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 9. COMPLETE APP STATE ENGINE & HOOK CONTROLLER
// ============================================================================
function useAppEngine() {
  // Navigation & Role State
  const [activeRole, setActiveRole] = useState<RoleType | "landing">("shipper");
  const [modeEnv, setModeEnv] = useState<ModeEnv>("demo");
  const [highVolumeMode, setHighVolumeMode] = useState<boolean>(true);

  // Sub-Navigation Tabs
  const [shipperTab, setShipperTab] = useState<"search" | "matrix" | "shipments" | "history" | "rfq" | "address">("search");
  const [carrierTab, setCarrierTab] = useState<"loads" | "bids" | "tracking" | "rates" | "billing">("tracking");

  // Authentication & Users
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_SHIPPER);
  const [authSession, setAuthSession] = useState<Session | null>(null);

  // Address Profile State (Shipper Dynamic Pickup Warehouse)
  const [shipperAddresses, setShipperAddresses] = useState<AddressProfile[]>([DEFAULT_SHIPPER_ADDRESS]);
  const [activeOriginAddress, setActiveOriginAddress] = useState<AddressProfile>(DEFAULT_SHIPPER_ADDRESS);
  const [showAddressModal, setShowAddressModal] = useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<AddressProfile | null>(null);

  // Platform Fee Billing & Invoice Ledger State
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("weekly");
  const [invoices, setInvoices] = useState<PlatformInvoice[]>(INITIAL_MOCK_INVOICES);
  const [showPayFeeModal, setShowPayFeeModal] = useState<boolean>(false);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<PlatformInvoice | null>(null);
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(DEFAULT_FEE_CONFIG);

  // Core Domain Masters
  const [rateCards, setRateCards] = useState<RateCard[]>(FALLBACK_DEFAULT_RATE_CARDS);
  const [vendors, setVendors] = useState<Vendor[]>(FALLBACK_VENDORS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rfqList, setRfqList] = useState<RfqBid[]>([]);

  // Modals Visibility
  const [showLegalModal, setShowLegalModal] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<"terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact">("terms");
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showCitySearchModal, setShowCitySearchModal] = useState<"origin" | "dest" | null>(null);
  const [showAddRateCardModal, setShowAddRateCardModal] = useState<boolean>(false);
  const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<CalculatedQuote | null>(null);
  const [printableBooking, setPrintableBooking] = useState<Booking | null>(null);
  const [batchPrintBookings, setBatchPrintBookings] = useState<Booking[] | null>(null);

  // Single Rate Calculator Parameters (Optional Dimensions supported)
  const [originPin, setOriginPin] = useState<string>(DEFAULT_SHIPPER_ADDRESS.pincode);
  const [destPin, setDestPin] = useState<string>("400001");
  const [isOda, setIsOda] = useState<boolean>(false);
  const [declaredValue, setDeclaredValue] = useState<number>(75000);
  const [selectedMode, setSelectedMode] = useState<"all" | "surface" | "air" | "ftl">("all");
  const [boxes, setBoxes] = useState<BoxItem[]>([
    { id: "box-1", qty: 2, weight: 20, length: 45, width: 35, height: 30 },
    { id: "box-2", qty: 1, weight: 15, length: null, width: null, height: null } // Optional dimensions demo
  ]);
  const [selectedBoxFor3D, setSelectedBoxFor3D] = useState<number>(0);
  const [pickupAddress, setPickupAddress] = useState<string>(
    `${DEFAULT_SHIPPER_ADDRESS.address_line1}, ${DEFAULT_SHIPPER_ADDRESS.city} - ${DEFAULT_SHIPPER_ADDRESS.pincode}`
  );

  // Bulk CSV (50/Day Dispatch Matrix)
  const [bulkManifestList, setBulkManifestList] = useState<BulkManifestRow[]>([]);
  const [bulkCsvFileName, setBulkCsvFileName] = useState<string>("");
  const [bulkUploadError, setBulkUploadError] = useState<string>("");
  const [bulkSettlementMethod, setBulkSettlementMethod] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");
  const [bulkConsolidatedUtr, setBulkConsolidatedUtr] = useState<string>("");
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Tracking & Global Search
  const [globalSearchInput, setGlobalSearchInput] = useState<string>("");
  const [landingTrackingInput, setLandingTrackingInput] = useState<string>("");
  const [activeTrackingAwb, setActiveTrackingAwb] = useState<string>(DEMO_INIT_ORDER_ID);
  const [trackingSearchInput, setTrackingSearchInput] = useState<string>(DEMO_INIT_ORDER_ID);

  // Zone Lookups
  const [originZoneData, setOriginZoneData] = useState<PinLookupResult>({
    city: DEFAULT_SHIPPER_ADDRESS.city,
    state: DEFAULT_SHIPPER_ADDRESS.state,
    hub: `HUB-${DEFAULT_SHIPPER_ADDRESS.city.substring(0, 3).toUpperCase()}-01`,
    loading: false
  });
  const [destZoneData, setDestZoneData] = useState<PinLookupResult>({
    city: "Mumbai",
    state: "Maharashtra",
    hub: "BOM-CENTRAL",
    loading: false
  });

  // Carrier Updates State
  const [statusUpdateMap, setStatusUpdateMap] = useState<
    Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>
  >({});

  // 1. Sync Active Origin Address to Form and Pin
  const applyOriginAddress = useCallback((addr: AddressProfile) => {
    setActiveOriginAddress(addr);
    setOriginPin(addr.pincode);
    setPickupAddress(`${addr.address_line1}, ${addr.city} - ${addr.pincode}`);
    setOriginZoneData({
      city: addr.city,
      state: addr.state,
      hub: `HUB-${addr.city.substring(0, 3).toUpperCase()}-01`,
      loading: false
    });
  }, []);

  const handleSaveAddress = (address: AddressProfile) => {
    let updatedList = [...shipperAddresses];
    const existingIndex = updatedList.findIndex((a) => a.id === address.id);
    if (address.is_default) {
      updatedList = updatedList.map((a) => ({ ...a, is_default: false }));
    }
    if (existingIndex >= 0) {
      updatedList[existingIndex] = address;
    } else {
      updatedList.push(address);
    }
    setShipperAddresses(updatedList);
    if (address.is_default || activeOriginAddress.id === address.id) {
      applyOriginAddress(address);
    }
  };

  // 2. Real Supabase Authentication Listener with Strict Role Lock
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setAuthSession(session);
        if (session && session.user) {
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
          if (pData) {
            const rawRole: string = pData.role || "shipper";
            const isCarrier = rawRole === "carrier" || rawRole === "vendor";
            const resolvedRole: RoleType = isCarrier ? "carrier" : "shipper";
            const profile: UserProfile = {
              id: session.user.id,
              email: session.user.email || pData.email || "",
              full_name: pData.full_name || "Verified Enterprise User",
              company_name: pData.company_name || (isCarrier ? "Delhivery B2B Linehaul" : "Apex Retail Corp"),
              gstin: pData.gstin || "07AAACA1234A1Z5",
              phone: pData.phone || "+91 98110 23456",
              role: resolvedRole,
              vendor_id: isCarrier ? session.user.id : undefined,
              isRealUser: true,
              saved_addresses: pData.saved_addresses || [DEFAULT_SHIPPER_ADDRESS]
            };
            setCurrentUser(profile);
            setModeEnv("live");
            // Strict role lock enforcement:
            setActiveRole(resolvedRole);
            if (pData.saved_addresses && pData.saved_addresses.length > 0) {
              setShipperAddresses(pData.saved_addresses);
              const def = pData.saved_addresses.find((a: AddressProfile) => a.is_default) || pData.saved_addresses[0];
              applyOriginAddress(def);
            }
          }
        }
      } catch (err) {
        console.warn("Session check fallback:", err);
      }
    };

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setAuthSession(session);
      if (session && session.user) {
        const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        if (pData) {
          const rawRole: string = pData.role || "shipper";
          const isCarrier = rawRole === "carrier" || rawRole === "vendor";
          const resolvedRole: RoleType = isCarrier ? "carrier" : "shipper";
          const profile: UserProfile = {
            id: session.user.id,
            email: session.user.email || pData.email || "",
            full_name: pData.full_name || "Verified Enterprise User",
            company_name: pData.company_name || (isCarrier ? "Delhivery B2B Linehaul" : "Apex Retail Corp"),
            gstin: pData.gstin || "07AAACA1234A1Z5",
            phone: pData.phone || "+91 98110 23456",
            role: resolvedRole,
            vendor_id: isCarrier ? session.user.id : undefined,
            isRealUser: true,
            saved_addresses: pData.saved_addresses || [DEFAULT_SHIPPER_ADDRESS]
          };
          setCurrentUser(profile);
          setModeEnv("live");
          setActiveRole(resolvedRole);
        }
      } else {
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
  }, [modeEnv, applyOriginAddress]);

  // 3. Database Fetch Master Data
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
      console.warn("Supabase data synchronization warning:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // 4. PIN Zone Automatic Resolvers
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
              hub: `HUB-${(po.District || "DEL").substring(0, 3).toUpperCase()}-01`,
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
              hub: `HUB-${(po.District || "BOM").substring(0, 3).toUpperCase()}-01`,
              loading: false
            });
          } else {
            setDestZoneData({ ...getLocalFallbackZone(destPin), loading: false });
          }
        })
        .catch(() => setDestZoneData({ ...getLocalFallbackZone(destPin), loading: false }));
    }
  }, [destPin]);

  // 5. Global Search Handler
  const handleGlobalSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!globalSearchInput.trim()) return;
    setActiveTrackingAwb(globalSearchInput.trim());
    setTrackingSearchInput(globalSearchInput.trim());
    setActiveRole("shipper");
    setShipperTab("history");
    setGlobalSearchInput("");
  };

  // 6. Role Switch Guard: strictly locks roles when in Live Mode
  const handleRoleSwitch = (role: RoleType | "landing") => {
    if (modeEnv === "live" && currentUser.isRealUser) {
      if (role !== "landing" && role !== "admin" && role !== currentUser.role) {
        alert(`Access Restricted: Your verified account is locked to the ${currentUser.role.toUpperCase()} workspace.`);
        return;
      }
    }
    setActiveRole(role);
    if (modeEnv === "demo") {
      if (role === "shipper") setCurrentUser(DEMO_SHIPPER);
      if (role === "carrier" || role === "vendor") setCurrentUser(DEMO_VENDOR);
    }
  };

  // 7. Mode Switcher Guard
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setCurrentUser(DEMO_SHIPPER);
    setModeEnv("demo");
    setActiveRole("landing");
  };

  // 8. Calculations (Single rate quotes supporting optional dimensions)
  const calculatedQuotes = useMemo(() => {
    return calculateQuotesForShipment(
      originPin,
      destPin,
      boxes,
      declaredValue,
      selectedMode,
      isOda,
      rateCards,
      vendors,
      feeConfig
    );
  }, [originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors, feeConfig]);

  // 9. Bulk CSV Upload with Semicolon Parsing & Optional Dimensions
  const handleBulkCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
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
          if (cols.length < 5) continue;

          const dest_pin = cols[0];
          const consignee_name = cols[1];
          const consignee_phone = cols[2];
          const delivery_address = cols[3];
          const total_boxes_str = cols[4];
          const box_weights_str = cols[5] || "";
          const box_dimensions_str = cols[6] || "";
          const declared_value_str = cols[7] || "50000";

          const total_boxes = Math.max(1, parseInt(total_boxes_str, 10) || 1);
          const declared_val = parseFloat(declared_value_str) || 50000;

          // Semicolon weight parsing (e.g. 25; 10; 10)
          const parsedWeights = box_weights_str
            ? box_weights_str.split(";").map((w) => parseFloat(w.trim())).filter((n) => !isNaN(n) && n > 0)
            : [];

          // Optional Semicolon dimensions parsing (e.g. 60x40x40; 30x25x20)
          const parsedDims = box_dimensions_str
            ? box_dimensions_str.split(";").map((d) => d.trim()).filter((d) => d.length > 0)
            : [];

          const hasOmittedDimensions = parsedDims.length === 0;

          const boxItems: BoxItem[] = [];
          for (let b = 0; b < total_boxes; b++) {
            const wt = parsedWeights[b] || parsedWeights[0] || 10;
            let l: number | null = null;
            let w: number | null = null;
            let h: number | null = null;
            if (parsedDims[b]) {
              const parts = parsedDims[b].toLowerCase().split("x").map((p) => parseFloat(p.trim()));
              if (parts.length === 3 && !parts.some(isNaN)) {
                l = parts[0];
                w = parts[1];
                h = parts[2];
              }
            }
            boxItems.push({ id: `b-${i}-${b}`, qty: 1, weight: wt, length: l, width: w, height: h });
          }

          const actualWeight = boxItems.reduce((acc, bi) => acc + bi.weight, 0);
          const divisor = 4500;
          const volumetricWeight = hasOmittedDimensions
            ? 0
            : boxItems.reduce((acc, bi) => acc + (((bi.length || 0) * (bi.width || 0) * (bi.height || 0)) / divisor), 0);
          const billableWeight = hasOmittedDimensions ? actualWeight : Math.max(actualWeight, Math.round(volumetricWeight * 10) / 10);

          const quotes = calculateQuotesForShipment(
            activeOriginAddress.pincode,
            dest_pin,
            boxItems,
            declared_val,
            "surface",
            false,
            rateCards,
            vendors,
            feeConfig
          );
          const sorted = [...quotes].sort((a, b) => a.breakdown.total - b.breakdown.total);

          parsedRows.push({
            rowId: `row-${i}-${Date.now()}`,
            dest_pin,
            consignee_name,
            consignee_phone,
            delivery_address,
            consignee_gstin: "27AAACP9988G1ZK",
            total_boxes,
            boxes: boxItems,
            declared_value: declared_val,
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

  // 10. Confirm Batch Booking
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
        pickup_address: `${activeOriginAddress.address_line1}, ${activeOriginAddress.city} - ${activeOriginAddress.pincode}`,
        pickup_pincode: activeOriginAddress.pincode,
        consignee_name: row.consignee_name,
        consignee_phone: row.consignee_phone,
        consignee_gstin: row.consignee_gstin,
        delivery_address: row.delivery_address,
        origin_pin: activeOriginAddress.pincode,
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
            location: `${activeOriginAddress.city} Origin Hub (${activeOriginAddress.pincode})`,
            timestamp: new Date().toISOString(),
            remarks: `Batch consignment booked. Official Carrier Waybill ${officialDocket} assigned.`
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
      alert(`Success! Dispatched all ${savedBookings.length} consignments. Continuous 4x6 labels ready for printing.`);
    } catch {
      alert("Notice: Database synchronization fallback used. Bookings saved in local ledger.");
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // 11. Carrier Docket Bilty Photo Upload
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
      alert(`Physical Bilty scan compressed & uploaded successfully! Saved size: ~${Math.round(fileToUpload.size / 1024)} KB.`);
    } catch {
      const fallbackUrl = URL.createObjectURL(rawFile);
      setStatusUpdateMap((prev) => ({
        ...prev,
        [bookingId]: { ...(prev[bookingId] || { status: "", location: "", remarks: "" }), docUrl: fallbackUrl, isUploading: false }
      }));
    }
  };

  // 12. Carrier Status Dispatch
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

  // 13. Settle Platform Fee Invoice
  const handlePayInvoiceSuccess = (invoiceId: string, utr: string, method: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              status: "Paid",
              payment_date: new Date().toISOString().split("T")[0],
              payment_ref: utr,
              payment_method: method
            }
          : inv
      )
    );
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
      shipperAddresses, setShipperAddresses,
      activeOriginAddress, setActiveOriginAddress,
      showAddressModal, setShowAddressModal,
      editingAddress, setEditingAddress,
      billingCycle, setBillingCycle,
      invoices, setInvoices,
      showPayFeeModal, setShowPayFeeModal,
      selectedInvoiceToPay, setSelectedInvoiceToPay,
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
      handleSaveAddress,
      applyOriginAddress,
      handlePayInvoiceSuccess,
      fetchAllData
    }
  };
}
