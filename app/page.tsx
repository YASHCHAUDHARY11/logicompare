"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase client initialization
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==========================================
// 1. DOMAIN DATA INTERFACES & PLATFORM SPECS
// ==========================================
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
  operatingHours: "Monday to Saturday, 09:00 AM – 07:00 PM IST",
  platformFeePct: 2,
  minPlatformFeeINR: 25
};

const DEMO_INIT_ORDER_ID = "LC-894210";
const DEMO_INIT_CARRIER_DOCKET = "148920194821";

interface BoxItem {
  id: string;
  qty: number;
  weight: number;
  length: number;
  width: number;
  height: number;
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
  role: "shipper" | "vendor";
  vendor_id?: string;
  isRealUser?: boolean;
}

interface PinLookupResult {
  city: string;
  state: string;
  hub: string;
  loading: boolean;
  error?: string;
}

// Fallback Masters
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
  role: "vendor",
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

// Helper Functions
const formatINR = (val: number) => {
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
  if (p3 === "110") return { city: "Delhi NCR", state: "Delhi", hub: "DEL-NORTH-01" };
  if (p3 === "121" || p3 === "122") return { city: "Gurugram / FBD", state: "Haryana", hub: "GGN-GATEWAY" };
  if (p3 === "141") return { city: "Ludhiana", state: "Punjab", hub: "LDH-IND-HUB" };
  if (p3 === "160") return { city: "Chandigarh", state: "Chandigarh", hub: "CHD-CENTRAL" };
  if (p3 === "400" || p3 === "401") return { city: "Mumbai MMR", state: "Maharashtra", hub: "BOM-CENTRAL" };
  if (p3 === "560") return { city: "Bengaluru", state: "Karnataka", hub: "BLR-SOUTH-MAIN" };
  if (p3 === "500") return { city: "Hyderabad", state: "Telangana", hub: "HYD-HUB-01" };
  if (p3 === "600") return { city: "Chennai", state: "Tamil Nadu", hub: "MAA-AIR-SEA" };
  if (p3 === "700") return { city: "Kolkata", state: "West Bengal", hub: "CCU-EAST-PORT" };
  return { city: `Zone ${pin.substring(0, 2)}XX`, state: "Regional Hub", hub: `HUB-${pin.substring(0, 2)}X` };
}

function calculateQuotesForShipment(
  originPin: string,
  destPin: string,
  boxes: BoxItem[],
  declaredValue: number,
  mode: "all" | "surface" | "air" | "ftl",
  isOda: boolean,
  rateCardsList: RateCard[],
  vendorsList: Vendor[]
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
      return acc + ((b.length * b.width * b.height) / divisor) * (Number(b.qty) || 1);
    }, 0);

    const billableWeight = Math.max(actualWeight, Math.round(volumetricWeight * 10) / 10, card.min_weight_kg);
    const v = card.vendors || vendorsList.find((vend) => vend.id === card.vendor_id) || vendorsList[0];

    const baseFreight = Number(card.base_rate) + billableWeight * Number(card.per_kg_rate);
    const fuelSurcharge = (baseFreight * Number(card.fuel_surcharge_pct)) / 100;
    const docket = Number(card.docket_charge);
    const fov = Math.max(50, (Number(declaredValue) * Number(card.fov_pct)) / 100);
    const handling = billableWeight * Number(card.handling_per_kg);
    const oda = isOda ? Number(card.oda_charge) : 0;

    const subtotal = baseFreight + fuelSurcharge + docket + fov + handling + oda;
    const gst = subtotal * 0.18;
    const freightDirectTotal = subtotal + gst;

    const convenienceFee = Math.max(MERCHANT_DETAILS.minPlatformFeeINR, Math.round((freightDirectTotal * MERCHANT_DETAILS.platformFeePct) / 100));

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

// ==========================================
// 2. INLINE SVG ICONS
// ==========================================
const TruckIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
  </svg>
);
const PlaneIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);
const BoxIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
const PrinterIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);
const SearchIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const PlusIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const TrashIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const CheckCircleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const XMarkIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const ChevronDownIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);
const BoltIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

// ==========================================
// 3. MASTER COORDINATOR COMPONENT
// ==========================================
export default function LogiComparePro() {
  const [activeView, setActiveView] = useState<"landing" | "dashboard">("landing");
  const [highVolumeMode, setHighVolumeMode] = useState<boolean>(true);

  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_SHIPPER);
  const [activePortal, setActivePortal] = useState<"shipper" | "vendor">("shipper");
  const [shipperSubTab, setShipperSubTab] = useState<"bulk" | "compare" | "shipments" | "tracker" | "rfq">("bulk");
  const [vendorSubTab, setVendorSubTab] = useState<"orders" | "rates" | "bids" | "bank">("orders");

  const [rateCards, setRateCards] = useState<RateCard[]>(FALLBACK_DEFAULT_RATE_CARDS);
  const [vendors, setVendors] = useState<Vendor[]>(FALLBACK_VENDORS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rfqList, setRfqList] = useState<RfqBid[]>([]);

  // Modals state
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<"terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact">("terms");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [printableBooking, setPrintableBooking] = useState<Booking | null>(null);
  const [batchPrintBookings, setBatchPrintBookings] = useState<Booking[] | null>(null);
  const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<CalculatedQuote | null>(null);

  // Single ad-hoc calculation state
  const [originPin, setOriginPin] = useState(MERCHANT_DETAILS.defaultOriginPin);
  const [destPin, setDestPin] = useState("400001");
  const [isOda, setIsOda] = useState(false);
  const [declaredValue, setDeclaredValue] = useState<number>(75000);
  const [selectedMode, setSelectedMode] = useState<"all" | "surface" | "air" | "ftl">("all");
  const [boxes, setBoxes] = useState<BoxItem[]>([
    { id: "box-1", qty: 2, weight: 20, length: 45, width: 35, height: 30 },
    { id: "box-2", qty: 1, weight: 15, length: 30, width: 30, height: 25 }
  ]);
  const [pickupAddress, setPickupAddress] = useState(MERCHANT_DETAILS.defaultWarehouseAddress);
  const [consigneeName, setConsigneeName] = useState("Prime Electronics Retail");
  const [consigneePhone, setConsigneePhone] = useState("+91 98200 44556");
  const [deliveryAddress, setDeliveryAddress] = useState("Warehouse 4B, Bhiwandi Logistics Park, Mumbai");
  const [settlementType, setSettlementType] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");

  // Bulk CSV state
  const [bulkManifestList, setBulkManifestList] = useState<BulkManifestRow[]>([]);
  const [bulkCsvFileName, setBulkCsvFileName] = useState("");
  const [bulkUploadError, setBulkUploadError] = useState("");
  const [bulkSettlementMethod, setBulkSettlementMethod] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");
  const [bulkConsolidatedUtr, setBulkConsolidatedUtr] = useState("");
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Tracking state
  const [landingTrackingInput, setLandingTrackingInput] = useState(DEMO_INIT_ORDER_ID);
  const [activeTrackingAwb, setActiveTrackingAwb] = useState(DEMO_INIT_ORDER_ID);
  const [trackingSearchInput, setTrackingSearchInput] = useState(DEMO_INIT_ORDER_ID);

  // RFQ state
  const [rfqOrigin, setRfqOrigin] = useState("110001");
  const [rfqDest, setRfqDest] = useState("560001");
  const [rfqDesc, setRfqDesc] = useState("Industrial Gearboxes and Heavy Machinery Parts");
  const [rfqWeight, setRfqWeight] = useState(8500);
  const [rfqTruck, setRfqTruck] = useState("32ft Multi-Axle Trailer (MXL)");
  const [rfqBudget, setRfqBudget] = useState(65000);

  // Carrier bank state
  const [vendorUpiInput, setVendorUpiInput] = useState("delhivery.b2b@icici");
  const [vendorBankAccInput, setVendorBankAccInput] = useState("50200088910234");
  const [vendorIfscInput, setVendorIfscInput] = useState("HDFC0000240");
  const [vendorBeneficiaryInput, setVendorBeneficiaryInput] = useState("Delhivery Limited B2B Logistics");
  const [statusUpdateMap, setStatusUpdateMap] = useState<Record<string, { status: string; location: string; remarks: string; docketNo?: string }>>({});

  // Sync Supabase data
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
      console.warn("Supabase sync warning:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

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

          const pWeights = bWeightsStr ? bWeightsStr.split(";").map((w) => parseFloat(w.trim())).filter((n) => !isNaN(n) && n > 0) : [];
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

          const quotes = calculateQuotesForShipment(MERCHANT_DETAILS.defaultOriginPin, dPin, boxItems, dVal, "surface", false, rateCards, vendors);
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
        setBulkUploadError(err.message || "Failed to process bulk CSV");
      }
    };
    reader.readAsText(file);
  };

  // Batch Booking Handler
  const handleConfirmBatchBooking = async () => {
    if (bulkManifestList.length === 0) return;
    setIsBatchProcessing(true);

    const refString = bulkSettlementMethod === "direct_upi"
      ? (bulkConsolidatedUtr ? `BULK-UPI-${bulkConsolidatedUtr}` : "BULK-UPI")
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
        cost_breakdown: { ...(selected?.breakdown || { base: 0, fuel: 0, docket: 0, fov: 0, handling: 0, oda: 0, gst: 0, freightSubtotal: 0, platformConvenienceFee: 25, total: 25 }), settlement_type: bulkSettlementMethod, payment_ref: refString },
        final_total: selected?.breakdown?.total || 25,
        status: "Booked" as const,
        tracking_history: [{ status: "Booked", location: `Delhi Hub (${MERCHANT_DETAILS.defaultOriginPin})`, timestamp: new Date().toISOString(), remarks: `Batch order assigned docket ${officialDocket}` }]
      };
    });

    try {
      const { data } = await supabase.from("bookings").insert(newBookingsToInsert).select("*, vendors(*)");
      const savedBookings = data && data.length > 0 ? (data as Booking[]) : newBookingsToInsert.map((b, i) => ({ ...b, id: `bulk-${Date.now()}-${i}`, created_at: new Date().toISOString(), vendors: vendors.find((v) => v.id === b.vendor_id) || vendors[0] }));
      setBookings((prev) => [...savedBookings, ...prev]);
      setBatchPrintBookings(savedBookings);
      setBulkManifestList([]);
      alert(`🎉 Successfully booked all ${savedBookings.length} consignments in batch! Thermal labels ready to print.`);
    } catch {
      alert("Error booking batch. Local fallback created.");
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const calculatedSingleQuotes = useMemo(() => {
    return calculateQuotesForShipment(originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors);
  }, [originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors]);

  const activeTrackShipment = useMemo(() => {
    const term = activeTrackingAwb.trim().toLowerCase();
    return bookings.find((b) => b.order_id?.toLowerCase() === term || b.carrier_docket_no?.toLowerCase() === term || b.awb_number?.toLowerCase() === term);
  }, [bookings, activeTrackingAwb]);

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* 4x6 THERMAL PRINTER STYLES */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; color: black !important; padding: 0 !important; }
          header, footer, nav, button, .no-print { display: none !important; }
          .thermal-page-break { page-break-after: always !important; break-after: page !important; }
          .thermal-label-container {
            width: 4in !important; height: 6in !important; padding: 0.15in !important;
            box-sizing: border-box !important; border: 3px solid black !important; margin: 0 auto !important;
          }
          .manifest-sheet { width: 100% !important; page-break-before: always !important; break-before: page !important; }
        }
      `}} />

      {/* GLOBAL SLATE-900 HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setActiveView("landing")}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md shadow-indigo-500/30">
              <TruckIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-xl tracking-tight text-white">LogiCompare</span>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Pro B2B Enterprise
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Pan-India Multi-Carrier Consignment Network</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 shadow-inner">
            <span className="text-xs font-bold text-slate-300 flex items-center space-x-1">
              <BoltIcon className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>50/Day High-Volume:</span>
            </span>
            <button
              onClick={() => setHighVolumeMode(!highVolumeMode)}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                highVolumeMode ? "bg-emerald-500 text-slate-950 font-black shadow-xs" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {highVolumeMode ? "⚡ ACTIVE (60FPS)" : "OFF"}
            </button>
          </div>

          <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveView("landing")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeView === "landing" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
              }`}
            >
              🏠 Home
            </button>
            <button
              onClick={() => setActiveView("dashboard")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeView === "dashboard" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
              }`}
            >
              🚀 Console
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setCurrentUser(currentUser.role === "shipper" ? DEMO_VENDOR : DEMO_SHIPPER);
                setActivePortal(currentUser.role === "shipper" ? "vendor" : "shipper");
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition"
            >
              Switch: {currentUser.role === "shipper" ? "🚛 Carrier Mode" : "📦 Shipper Mode"}
            </button>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition"
            >
              Account / Login
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* VIEW 1: LANDING OVERVIEW PAGE */}
      {/* ============================================================== */}
      {activeView === "landing" ? (
        <div className="flex-1 flex flex-col space-y-16 pb-16">
          <section className="relative overflow-hidden bg-slate-950 text-white pt-16 pb-24 px-4 lg:px-8 border-b border-slate-800">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 px-4 py-1.5 rounded-full text-xs font-bold">
                  <span>🇮🇳</span>
                  <span>Hybrid Dual-ID Consignment Discovery & Dispatches</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                  One-Click Bulk Freight Booking & Multi-Box 4x6 Thermal Labels.
                </h1>
                <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                  Compare Delhivery, Blue Dart, Safexpress, TCI, and Gati rates across India. Upload semicolon-delimited CSVs, auto-assign lowest rates, and print continuous thermal labels with driver handover manifests.
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <button
                    onClick={() => { setActiveView("dashboard"); setActivePortal("shipper"); setShipperSubTab("bulk"); }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-7 py-3.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30"
                  >
                    Launch 50/Day Bulk Shipper Console
                  </button>
                  <button
                    onClick={() => { setActiveView("dashboard"); setActivePortal("shipper"); setShipperSubTab("compare"); }}
                    className="bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 font-bold px-6 py-3.5 rounded-xl text-sm"
                  >
                    Single Shipment Calculator
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 flex justify-center">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-3 shadow-2xl">
                  <span className="text-5xl">⚡</span>
                  <h3 className="text-white font-black text-lg">High-Speed Consignment Hub</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Direct settlements via To-Pay POD, UPI, and Monthly GST Credit with 0% markups.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Track Search */}
            <div className="pt-10 max-w-xl mx-auto">
              <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-2xl flex flex-col sm:flex-row items-center gap-2">
                <div className="flex items-center space-x-2 px-3 py-1.5 text-slate-300 w-full sm:w-auto flex-1">
                  <SearchIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={landingTrackingInput}
                    onChange={(e) => setLandingTrackingInput(e.target.value)}
                    placeholder="Enter Order Ref or Carrier Docket..."
                    className="bg-transparent font-mono text-sm text-white font-bold focus:outline-none w-full"
                  />
                </div>
                <button
                  onClick={() => {
                    setActiveTrackingAwb(landingTrackingInput);
                    setActiveView("dashboard");
                    setActivePortal("shipper");
                    setShipperSubTab("tracker");
                  }}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-6 py-3 rounded-xl transition"
                >
                  Track Shipment
                </button>
              </div>
            </div>
          </section>

          {/* Metrics & Carriers */}
          <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-8 border-b border-slate-200">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-3xl font-black text-indigo-600">5+</span>
                <p className="text-xs font-bold text-slate-900 mt-1">Verified National Fleets</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-3xl font-black text-emerald-600">19,000+</span>
                <p className="text-xs font-bold text-slate-900 mt-1">Serviceable PIN Codes</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-3xl font-black text-slate-900">100%</span>
                <p className="text-xs font-bold text-slate-900 mt-1">Direct Carrier Settlement</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-3xl font-black text-amber-500">2%</span>
                <p className="text-xs font-bold text-slate-900 mt-1">Flat Platform Verification Fee</p>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* ============================================================== */
        /* VIEW 2: HIGH-CONTRAST DASHBOARD MATRIX */
        /* ============================================================== */
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 space-y-6">
          {/* Dashboard Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-300 pb-4 gap-4">
            <div className="flex items-center space-x-1.5 bg-slate-900 p-1.5 rounded-2xl shadow-sm">
              <button
                onClick={() => setActivePortal("shipper")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                  activePortal === "shipper" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                }`}
              >
                Shipper Portal
              </button>
              <button
                onClick={() => setActivePortal("vendor")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                  activePortal === "vendor" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                }`}
              >
                Carrier Hub
              </button>
            </div>

            {activePortal === "shipper" ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { id: "bulk", label: "⚡ High-Volume Bulk CSV (50/Day)" },
                  { id: "compare", label: "🔍 Single Shipment Calculator" },
                  { id: "shipments", label: "📦 Manifests & Thermal Labels" },
                  { id: "tracker", label: "📍 Universal Carrier Tracker" },
                  { id: "rfq", label: "⚖️ Heavy Cargo Reverse Auction" }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setShipperSubTab(t.id as any)}
                    className={`px-3.5 py-2 rounded-xl font-black transition shadow-xs ${
                      shipperSubTab === t.id
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { id: "orders", label: "📋 Incoming Orders & Bilty Entry" },
                  { id: "rates", label: "🏷️ Commercial Rate Cards" },
                  { id: "bids", label: "🎯 Live Reverse Auction Bids" },
                  { id: "bank", label: "🏦 Settlement Bank Profile" }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setVendorSubTab(t.id as any)}
                    className={`px-3.5 py-2 rounded-xl font-black transition shadow-xs ${
                      vendorSubTab === t.id
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SHIPPER SUB-TAB 1: HIGH-VOLUME BULK CSV */}
          {activePortal === "shipper" && shipperSubTab === "bulk" && (
            <div className="space-y-6">
              {/* Origin Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-indigo-900 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="font-black text-sm uppercase">Shipper Dispatch Warehouse Origin:</span>
                    <span className="font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded text-xs font-bold">
                      PIN {MERCHANT_DETAILS.defaultOriginPin} (DEL-NORTH-01)
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 font-medium">{MERCHANT_DETAILS.defaultWarehouseAddress}</p>
                </div>
                <button
                  onClick={() => {
                    const csvHeader = "dest_pin,consignee_name,consignee_phone,delivery_address,total_boxes,box_weights,box_dimensions,declared_value\n";
                    const sampleRows = "400001,Prime Retailers,9820044556,Shop 4 Crawford Market Mumbai,2,18; 12,45x35x30; 30x25x20,45000\n560001,Apex Tech,9845012345,Electronic City Bengaluru,3,25; 10; 10,,65000\n700001,East Traders,9830098765,Strand Road Kolkata,1,30,50x50x40,30000";
                    const blob = new Blob([csvHeader + sampleRows], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.setAttribute("download", "logicompare_bulk_template.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="bg-white hover:bg-slate-100 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow-md transition"
                >
                  📥 Download Bulk Template (.csv)
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="bg-white border-2 border-dashed border-indigo-300 rounded-2xl p-8 text-center space-y-4 shadow-sm hover:border-indigo-500 transition">
                <input type="file" ref={bulkFileInputRef} accept=".csv,text/csv" onChange={handleBulkCsvUpload} className="hidden" id="bulk-csv-input" />
                <div className="max-w-lg mx-auto space-y-2">
                  <label htmlFor="bulk-csv-input" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-xl text-xs cursor-pointer inline-flex items-center space-x-2 shadow-md transition">
                    <span>{bulkCsvFileName ? `Replace (${bulkCsvFileName})` : "Select Bulk Consignment CSV (40-50 Rows)"}</span>
                  </label>
                  <p className="text-xs text-slate-600 font-medium">Supports semicolon weights (e.g. 25; 10; 10) and optional dimensions (e.g. 60x40x40; 30x25x20).</p>
                </div>
                {bulkUploadError && <div className="text-xs text-rose-800 bg-rose-50 border border-rose-300 p-2.5 rounded-xl font-bold max-w-md mx-auto">{bulkUploadError}</div>}
              </div>

              {/* Manifest Table */}
              {bulkManifestList.length > 0 && (
                <div className="bg-white border border-slate-300 rounded-2xl shadow-md overflow-hidden space-y-5 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                        <span>Bulk Consignment Manifest</span>
                        <span className="bg-indigo-600 text-white text-xs px-3 py-0.5 rounded-full font-bold">{bulkManifestList.length} Destinations</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Multi-carrier quotes calculated client-side with 0ms server latency.</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setBulkManifestList(prev => prev.map(r => ({ ...r, selectedQuote: [...r.quotes].sort((a,b) => a.breakdown.total - b.breakdown.total)[0] })))}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-sm"
                      >
                        ⚡ Auto-Select Lowest Price
                      </button>
                      <button
                        onClick={() => setBulkManifestList(prev => prev.map(r => ({ ...r, selectedQuote: [...r.quotes].sort((a,b) => a.rateCard.sla_days - b.rateCard.sla_days)[0] })))}
                        className="bg-sky-600 hover:bg-sky-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-sm"
                      >
                        🚀 Auto-Select Fastest SLA
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-900 text-white uppercase font-black text-[11px] tracking-wider">
                        <tr>
                          <th className="py-3 px-3.5">#</th>
                          <th className="py-3 px-3.5">Dest PIN / City</th>
                          <th className="py-3 px-3.5">Consignee</th>
                          <th className="py-3 px-3.5">Packages</th>
                          <th className="py-3 px-3.5">Billable Wt</th>
                          <th className="py-3 px-3.5">Carrier</th>
                          <th className="py-3 px-3.5">Freight</th>
                          <th className="py-3 px-3.5">2% Fee</th>
                          <th className="py-3 px-3.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {bulkManifestList.map((row, idx) => {
                          const quote = row.selectedQuote || row.quotes[0];
                          return (
                            <tr key={row.rowId} className={idx % 2 === 0 ? "bg-white hover:bg-indigo-50/50" : "bg-slate-50/80 hover:bg-indigo-50/50"}>
                              <td className="py-3 px-3.5 font-mono font-bold text-slate-500">{idx + 1}</td>
                              <td className="py-3 px-3.5 font-bold font-mono">{row.dest_pin} <span className="text-[11px] text-slate-500 block font-sans">{getLocalFallbackZone(row.dest_pin).city}</span></td>
                              <td className="py-3 px-3.5 font-bold">{row.consignee_name}</td>
                              <td className="py-3 px-3.5 font-black text-indigo-700">{row.total_boxes} Box(es)</td>
                              <td className="py-3 px-3.5 font-mono font-black">{row.billableWeight} kg {row.hasOmittedDimensions && <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-black block">⚠️ Dead Wt</span>}</td>
                              <td className="py-3 px-3.5">
                                <select
                                  value={quote?.vendor?.id || ""}
                                  onChange={(e) => setBulkManifestList(prev => prev.map(r => r.rowId === row.rowId ? { ...r, selectedQuote: r.quotes.find(q => q.vendor.id === e.target.value) || r.quotes[0] } : r))}
                                  className="bg-white border-2 border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold"
                                >
                                  {row.quotes.map(q => <option key={q.vendor.id} value={q.vendor.id}>{q.vendor.name} ({q.rateCard.sla_days}d - {formatINR(q.breakdown.total)})</option>)}
                                </select>
                              </td>
                              <td className="py-3 px-3.5 font-mono font-bold">{formatINR(quote?.breakdown?.freightSubtotal || 0)}</td>
                              <td className="py-3 px-3.5 font-mono text-indigo-700 font-bold">₹{quote?.breakdown?.platformConvenienceFee || 25}</td>
                              <td className="py-3 px-3.5 font-mono font-black text-right text-emerald-800 text-sm">{formatINR(quote?.breakdown?.total || 0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Batch Settlement Form */}
                  <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-sm font-black uppercase text-indigo-400 block tracking-wide">Single Consolidated Settlement Method ({bulkManifestList.length} Shipments)</span>
                        <p className="text-xs text-slate-400 mt-0.5">100% of freight is settled directly with transporters. Platform fee is 2% (min ₹25).</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <label className={`px-4 py-2 rounded-xl border cursor-pointer font-bold ${bulkSettlementMethod === "direct_to_pay" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-slate-800 text-slate-300 border-slate-700"}`}>
                          <input type="radio" checked={bulkSettlementMethod === "direct_to_pay"} onChange={() => setBulkSettlementMethod("direct_to_pay")} className="hidden" />
                          💵 To-Pay POD
                        </label>
                        <label className={`px-4 py-2 rounded-xl border cursor-pointer font-bold ${bulkSettlementMethod === "direct_upi" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-slate-800 text-slate-300 border-slate-700"}`}>
                          <input type="radio" checked={bulkSettlementMethod === "direct_upi"} onChange={() => setBulkSettlementMethod("direct_upi")} className="hidden" />
                          📲 Direct Carrier UPI
                        </label>
                        <label className={`px-4 py-2 rounded-xl border cursor-pointer font-bold ${bulkSettlementMethod === "corporate_credit" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-slate-800 text-slate-300 border-slate-700"}`}>
                          <input type="radio" checked={bulkSettlementMethod === "corporate_credit"} onChange={() => setBulkSettlementMethod("corporate_credit")} className="hidden" />
                          🏢 Monthly Credit
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                      <div className="text-xs">
                        <span className="text-slate-400">Total Outlay: </span>
                        <strong className="text-xl text-emerald-400 font-mono font-black ml-2">
                          {formatINR(bulkManifestList.reduce((acc, r) => acc + (r.selectedQuote?.breakdown?.total || 0), 0))}
                        </strong>
                      </div>
                      <button
                        disabled={isBatchProcessing}
                        onClick={handleConfirmBatchBooking}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-7 py-3.5 rounded-xl text-xs transition shadow-lg flex items-center space-x-2"
                      >
                        <CheckCircleIcon className="w-5 h-5 text-slate-950" />
                        <span>{isBatchProcessing ? "Assigning Carrier Dockets..." : `Confirm & Book All ${bulkManifestList.length} Shipments`}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SHIPPER SUB-TAB 2: SINGLE SHIPMENT CALCULATOR */}
          {activePortal === "shipper" && shipperSubTab === "compare" && (
            <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Single Consignment Commercial Rate Card Calculator</h2>
                  <p className="text-xs text-slate-500">Calculate live freight quotes for individual consignments</p>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full border border-emerald-300">
                  100% Direct Settlement
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200">
                  <label className="text-xs font-black text-indigo-950 uppercase tracking-wider block mb-1">Origin PIN (Pickup)</label>
                  <input type="text" maxLength={6} value={originPin} onChange={(e) => setOriginPin(e.target.value)} className="w-full border-2 border-indigo-300 rounded-lg px-3 py-2 text-sm font-mono font-bold" />
                  <span className="text-[11px] font-bold text-indigo-800 mt-1 block">📍 {getLocalFallbackZone(originPin).city}</span>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
                  <label className="text-xs font-black text-emerald-950 uppercase tracking-wider block mb-1">Dest PIN (Delivery)</label>
                  <input type="text" maxLength={6} value={destPin} onChange={(e) => setDestPin(e.target.value)} className="w-full border-2 border-emerald-300 rounded-lg px-3 py-2 text-sm font-mono font-bold" />
                  <span className="text-[11px] font-bold text-emerald-800 mt-1 block">🎯 {getLocalFallbackZone(destPin).city}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">Declared Value (₹)</label>
                  <input type="number" value={declaredValue} onChange={(e) => setDeclaredValue(Number(e.target.value))} className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold" />
                  <span className="text-[11px] text-slate-500 mt-1 block font-medium">0.2% FOV transit coverage</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">Transport Mode</label>
                  <select value={selectedMode} onChange={(e) => setSelectedMode(e.target.value as any)} className="w-full border-2 border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold">
                    <option value="all">All Modes</option>
                    <option value="surface">Surface Express Only</option>
                    <option value="air">Air Cargo Only</option>
                  </select>
                </div>
              </div>

              {/* Box Specifications */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/70 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">Carton Specifications</span>
                  <button onClick={() => setBoxes([...boxes, { id: `box-${Date.now()}`, qty: 1, weight: 10, length: 30, width: 30, height: 30 }])} className="text-xs text-indigo-600 font-black flex items-center space-x-1">
                    <PlusIcon className="w-4 h-4" /> <span>Add Box Type</span>
                  </button>
                </div>
                {boxes.map((box) => (
                  <div key={box.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 p-3 rounded-xl border border-slate-200 bg-white items-center text-xs">
                    <div><span className="text-[10px] text-slate-500 font-bold block">Qty</span><input type="number" value={box.qty} onChange={(e) => setBoxes(boxes.map(b => b.id === box.id ? { ...b, qty: parseInt(e.target.value) || 1 } : b))} className="w-full border rounded px-2 py-1 font-mono font-bold" /></div>
                    <div><span className="text-[10px] text-slate-500 font-bold block">Weight (kg)</span><input type="number" value={box.weight} onChange={(e) => setBoxes(boxes.map(b => b.id === box.id ? { ...b, weight: parseFloat(e.target.value) || 0 } : b))} className="w-full border rounded px-2 py-1 font-mono font-bold" /></div>
                    <div><span className="text-[10px] text-slate-500 font-bold block">Length (cm)</span><input type="number" value={box.length} onChange={(e) => setBoxes(boxes.map(b => b.id === box.id ? { ...b, length: parseFloat(e.target.value) || 0 } : b))} className="w-full border rounded px-2 py-1 font-mono font-bold" /></div>
                    <div><span className="text-[10px] text-slate-500 font-bold block">Width (cm)</span><input type="number" value={box.width} onChange={(e) => setBoxes(boxes.map(b => b.id === box.id ? { ...b, width: parseFloat(e.target.value) || 0 } : b))} className="w-full border rounded px-2 py-1 font-mono font-bold" /></div>
                    <div><span className="text-[10px] text-slate-500 font-bold block">Height (cm)</span><input type="number" value={box.height} onChange={(e) => setBoxes(boxes.map(b => b.id === box.id ? { ...b, height: parseFloat(e.target.value) || 0 } : b))} className="w-full border rounded px-2 py-1 font-mono font-bold" /></div>
                    <div className="flex justify-end">{boxes.length > 1 && <button onClick={() => setBoxes(boxes.filter(b => b.id !== box.id))} className="text-rose-500"><TrashIcon className="w-4 h-4" /></button>}</div>
                  </div>
                ))}
              </div>

              {/* Carrier Quotes Comparison Cards */}
              <div className="space-y-4 pt-2">
                <h3 className="text-base font-black text-slate-900">Direct Carrier Freight Comparison</h3>
                <div className="grid grid-cols-1 gap-4">
                  {calculatedSingleQuotes.map((quote) => (
                    <div key={quote.rateCard.id} className="bg-white border-2 border-slate-200 hover:border-indigo-500 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition">
                      <div>
                        <div className="flex items-center space-x-3">
                          <span className="text-base font-black text-slate-900">{quote.vendor.name}</span>
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black px-2.5 py-0.5 rounded-full">{quote.vendor.badge}</span>
                          <span className="text-amber-500 text-xs font-black">★ {quote.vendor.rating}</span>
                        </div>
                        <div className="text-xs text-slate-600 font-medium mt-1 flex gap-3">
                          <span>SLA: <strong>{quote.rateCard.sla_days} Days</strong></span>
                          <span>Billable: <strong>{quote.billableWeight} kg</strong></span>
                          <span className="font-mono text-emerald-800 font-bold">UPI: {quote.vendor.upi_id}</span>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 font-black uppercase block">Consignment Cost</span>
                          <span className="text-xl font-black text-emerald-700">{formatINR(quote.breakdown.total)}</span>
                        </div>
                        <button
                          onClick={() => setSelectedQuoteForBooking(quote)}
                          className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition shadow-sm"
                        >
                          Direct Book Consignment
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SHIPPER SUB-TAB 3: MANIFESTS & LABELS */}
          {activePortal === "shipper" && shipperSubTab === "shipments" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Consignment Manifests & 4x6 Thermal Labels</h2>
                  <p className="text-xs text-slate-500">Access carrier waybills, live tracking links, and batch continuous thermal print sheets</p>
                </div>
                {bookings.length > 0 && (
                  <button
                    onClick={() => setBatchPrintBookings(bookings.slice(0, 50))}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-black px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-xs transition"
                  >
                    <PrinterIcon className="w-4 h-4 text-emerald-400" />
                    <span>🖨️ Batch Print 4x6 Thermal Labels & Manifest</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-900 text-white uppercase font-black text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Order Ref / Carrier Docket</th>
                      <th className="py-3.5 px-4">Carrier</th>
                      <th className="py-3.5 px-4">Route PIN</th>
                      <th className="py-3.5 px-4">Freight</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {bookings.map((booking, idx) => (
                      <tr key={booking.id} className={idx % 2 === 0 ? "bg-white hover:bg-indigo-50/50" : "bg-slate-50/60 hover:bg-indigo-50/50"}>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-black text-indigo-700 block text-xs">{booking.order_id}</span>
                          <span className="font-mono text-[11px] text-slate-600">Docket: <strong>{booking.carrier_docket_no || booking.awb_number}</strong></span>
                        </td>
                        <td className="py-3.5 px-4 font-black text-slate-900">{booking.vendors?.name || "Delhivery B2B"}</td>
                        <td className="py-3.5 px-4 font-mono font-bold">{booking.origin_pin} → {booking.dest_pin}</td>
                        <td className="py-3.5 px-4 font-mono font-black">{formatINR(booking.cost_breakdown?.freightSubtotal || booking.final_total)}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {booking.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button onClick={() => setPrintableBooking(booking)} className="bg-white hover:bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-300">
                            Label
                          </button>
                          <button onClick={() => { setActiveTrackingAwb(booking.order_id); setShipperSubTab("tracker"); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold">
                            Track
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SHIPPER SUB-TAB 4: UNIVERSAL CARRIER TRACKER */}
          {activePortal === "shipper" && shipperSubTab === "tracker" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm">
                <h2 className="text-base font-black text-slate-900 mb-1">Universal Consignment Live Tracker</h2>
                <p className="text-xs text-slate-500 mb-4">Enter either your Platform Order Ref (e.g. {DEMO_INIT_ORDER_ID}) or Carrier Docket No.</p>
                <div className="flex gap-2 max-w-md">
                  <input
                    type="text"
                    value={trackingSearchInput}
                    onChange={(e) => setTrackingSearchInput(e.target.value)}
                    placeholder="Enter Order Ref or Docket..."
                    className="flex-1 border-2 border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold"
                  />
                  <button onClick={() => setActiveTrackingAwb(trackingSearchInput)} className="bg-indigo-600 text-white font-black px-4 py-2 rounded-lg text-xs">
                    Track
                  </button>
                </div>
              </div>

              {activeTrackShipment && (
                <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b pb-4">
                    <div>
                      <span className="text-xl font-mono font-black text-indigo-700">{activeTrackShipment.order_id}</span>
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded ml-2">Docket: {activeTrackShipment.carrier_docket_no}</span>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full uppercase">{activeTrackShipment.status}</span>
                  </div>
                  <div className="space-y-2">
                    {(activeTrackShipment.tracking_history || []).map((step, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                        <strong className="block text-slate-900">{step.status} - {step.location}</strong>
                        <span className="text-[10px] text-slate-500 font-mono">{new Date(step.timestamp).toLocaleString("en-IN")}</span>
                        <p className="text-slate-600 mt-1">{step.remarks}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SHIPPER SUB-TAB 5: HEAVY LOAD REVERSE AUCTION */}
          {activePortal === "shipper" && shipperSubTab === "rfq" && (
            <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-black text-slate-900 mb-1">Post Heavy/FTL Cargo Load for Reverse Auction</h2>
                <p className="text-xs text-slate-500">Fleet operators will bid competitively below your ceiling target budget.</p>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const record = { shipper_name: currentUser.company_name || currentUser.full_name, origin_pin: rfqOrigin, dest_pin: rfqDest, cargo_description: rfqDesc, total_weight_kg: rfqWeight, truck_type: rfqTruck, target_price: rfqBudget, status: "Open" as const, bids: [] };
                await supabase.from("rfq_bids").insert([record]);
                setRfqList([{ ...record, id: `rfq-${Date.now()}`, created_at: new Date().toISOString() }, ...rfqList]);
                alert("Load successfully broadcast to carriers!");
              }} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div><label className="block font-bold mb-1">Origin PIN</label><input type="text" value={rfqOrigin} onChange={e => setRfqOrigin(e.target.value)} className="w-full border rounded p-2" required /></div>
                <div><label className="block font-bold mb-1">Destination PIN</label><input type="text" value={rfqDest} onChange={e => setRfqDest(e.target.value)} className="w-full border rounded p-2" required /></div>
                <div><label className="block font-bold mb-1">Cargo Details</label><input type="text" value={rfqDesc} onChange={e => setRfqDesc(e.target.value)} className="w-full border rounded p-2" required /></div>
                <div><label className="block font-bold mb-1">Weight (Kg)</label><input type="number" value={rfqWeight} onChange={e => setRfqWeight(Number(e.target.value))} className="w-full border rounded p-2" required /></div>
                <div><label className="block font-bold mb-1">Truck Body</label><select value={rfqTruck} onChange={e => setRfqTruck(e.target.value)} className="w-full border rounded p-2"><option value="32ft Multi-Axle Trailer (MXL)">32ft Multi-Axle Trailer (MXL)</option><option value="Taurus 21-Tonner (10-Tyre)">Taurus 21-Tonner (10-Tyre)</option></select></div>
                <div><label className="block font-bold mb-1">Target Ceiling Budget (₹)</label><input type="number" value={rfqBudget} onChange={e => setRfqBudget(Number(e.target.value))} className="w-full border rounded p-2" required /></div>
                <div className="md:col-span-3 flex justify-end"><button type="submit" className="bg-indigo-600 text-white font-black px-6 py-2.5 rounded-xl">Broadcast RFQ Load</button></div>
              </form>
            </div>
          )}

          {/* CARRIER OPERATIONS HUB */}
          {activePortal === "vendor" && vendorSubTab === "orders" && (
            <div className="space-y-4">
              <h2 className="text-lg font-black text-slate-900">Carrier Orders & Physical Docket / Bilty Entry</h2>
              {bookings.map((booking) => {
                const row = statusUpdateMap[booking.id] || { status: "", location: "", remarks: "", docketNo: booking.carrier_docket_no || booking.awb_number };
                return (
                  <div key={booking.id} className="bg-white border border-slate-300 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex justify-between border-b pb-3 text-xs">
                      <span className="font-mono font-bold text-indigo-700">{booking.order_id}</span>
                      <span className="font-bold text-slate-900">Docket: {booking.carrier_docket_no || booking.awb_number}</span>
                      <span>Settlement: <strong>{booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}</strong></span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div><label className="block font-bold mb-1">Carrier Bilty No.</label><input type="text" value={row.docketNo} onChange={e => setStatusUpdateMap({ ...statusUpdateMap, [booking.id]: { ...row, docketNo: e.target.value } })} className="w-full border rounded p-1.5 font-mono" /></div>
                      <div>
                        <label className="block font-bold mb-1">Upload Physical Scan</label>
                        <input type="file" accept="image/*,application/pdf" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const compressed = await compressImageFile(file);
                            const path = `dockets/bilty-${booking.id}-${Date.now()}.jpg`;
                            await supabase.storage.from("dockets").upload(path, compressed);
                            const url = supabase.storage.from("dockets").getPublicUrl(path).data.publicUrl;
                            await supabase.from("bookings").update({ carrier_docket_doc_url: url }).eq("id", booking.id);
                            alert("Bilty scan compressed & uploaded successfully!");
                          }
                        }} className="text-xs" />
                      </div>
                      <div className="flex items-end">
                        <button onClick={async () => {
                          await supabase.from("bookings").update({ carrier_docket_no: row.docketNo, awb_number: row.docketNo }).eq("id", booking.id);
                          alert("Docket successfully saved!");
                        }} className="bg-emerald-600 text-white font-black px-4 py-2 rounded-xl w-full">
                          Save Docket Update
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activePortal === "vendor" && vendorSubTab === "bank" && (
            <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm max-w-xl space-y-4 text-xs">
              <h2 className="text-base font-black text-slate-900">Direct Freight Settlement Profile</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                await supabase.from("vendors").update({ upi_id: vendorUpiInput, bank_account: vendorBankAccInput, ifsc_code: vendorIfscInput, beneficiary_name: vendorBeneficiaryInput }).eq("id", currentUser.vendor_id || "11111111-1111-1111-1111-111111111111");
                alert("Settlement bank details saved!");
              }} className="space-y-3">
                <div><label className="block font-bold mb-1">Carrier UPI Handle</label><input type="text" value={vendorUpiInput} onChange={e => setVendorUpiInput(e.target.value)} className="w-full border rounded p-2" required /></div>
                <div><label className="block font-bold mb-1">Bank Account</label><input type="text" value={vendorBankAccInput} onChange={e => setVendorBankAccInput(e.target.value)} className="w-full border rounded p-2" required /></div>
                <div><label className="block font-bold mb-1">IFSC Code</label><input type="text" value={vendorIfscInput} onChange={e => setVendorIfscInput(e.target.value)} className="w-full border rounded p-2" required /></div>
                <div><label className="block font-bold mb-1">Beneficiary Name</label><input type="text" value={vendorBeneficiaryInput} onChange={e => setVendorBeneficiaryInput(e.target.value)} className="w-full border rounded p-2" required /></div>
                <button type="submit" className="bg-emerald-600 text-white font-black px-5 py-2.5 rounded-xl">Save Settlement Profile</button>
              </form>
            </div>
          )}
        </main>
      )}

      {/* MODAL 1: 4x6 CONTINUOUS THERMAL LABELS & MASTER MANIFEST PRINT */}
      {(printableBooking || batchPrintBookings) && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
          <div className="bg-white text-black rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 print:m-0 print:p-0 print:shadow-none print:w-full">
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <h3 className="text-sm font-bold">4x6 Continuous Thermal Labels + Master Handover Manifest</h3>
              <div className="flex space-x-2">
                <button onClick={() => window.print()} className="bg-indigo-600 text-white font-bold px-4 py-1.5 rounded-lg text-xs">Print Thermal</button>
                <button onClick={() => { setPrintableBooking(null); setBatchPrintBookings(null); }} className="text-slate-400 hover:text-slate-700"><XMarkIcon className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="space-y-6 print:space-y-0">
              {(batchPrintBookings || (printableBooking ? [printableBooking] : [])).map((bk) => {
                const count = bk.boxes?.length || 1;
                return Array.from({ length: count }).map((_, bIdx) => {
                  const bx = bk.boxes?.[bIdx] || { weight: bk.actual_weight, length: 0, width: 0, height: 0 };
                  return (
                    <div key={`${bk.id}-${bIdx}`} className="thermal-label-container thermal-page-break font-sans bg-white text-black border-4 border-black p-3 space-y-2">
                      <div className="flex justify-between border-b-2 border-black pb-1">
                        <div><h2 className="text-lg font-black">{bk.vendors?.name || "DELHIVERY B2B"}</h2><span className="text-[8px] font-bold tracking-widest block uppercase">CARRIER CONSIGNMENT NOTE</span></div>
                        <div className="text-right"><span className="text-base font-black font-mono">HUB-{bk.dest_pin.slice(0, 3)}</span><span className="text-[9px] bg-black text-white px-1 font-bold block mt-0.5">BOX {bIdx + 1} OF {count}</span></div>
                      </div>
                      <div className="text-center py-1 border-b-2 border-black font-mono">
                        <span className="text-sm font-black tracking-widest">DOCKET: {bk.carrier_docket_no || bk.awb_number}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-b-2 border-black pb-1 text-[10px]">
                        <div><strong>SHIPPER:</strong><p>{bk.shipper_name}</p><p className="font-mono">PIN: {bk.origin_pin}</p></div>
                        <div><strong>DELIVER TO:</strong><p>{bk.consignee_name}</p><p className="font-mono">PIN: {bk.dest_pin} • Ph: {bk.consignee_phone}</p></div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center border-b-2 border-black pb-1 text-[10px]">
                        <div><span className="text-[7px] block">THIS BOX</span><strong>{bx.weight} KG</strong></div>
                        <div><span className="text-[7px] block">TOTAL WT</span><strong>{bk.billable_weight} KG</strong></div>
                        <div><span className="text-[7px] block">DIMS</span><strong>{bx.length ? `${bx.length}x${bx.width}x${bx.height}` : "STD"}</strong></div>
                        <div><span className="text-[7px] block">TERMS</span><strong className="uppercase">{bk.cost_breakdown?.payment_ref || "POD"}</strong></div>
                      </div>
                      <div className="flex justify-between text-[8px] font-mono"><span>Carriage by Road Act 2007</span><span>{new Date(bk.created_at).toLocaleDateString("en-IN")}</span></div>
                    </div>
                  );
                });
              })}

              {/* Master Manifest Sheet */}
              {batchPrintBookings && (
                <div className="manifest-sheet bg-white text-black p-4 border-2 border-black font-sans space-y-4">
                  <div className="flex justify-between border-b-2 border-black pb-2">
                    <div><h2 className="text-base font-black">MASTER PICKUP HANDOVER MANIFEST</h2><p className="text-xs">Warehouse: {MERCHANT_DETAILS.defaultWarehouseAddress}</p></div>
                    <div className="text-right font-mono font-bold text-xs"><p>DATE: {new Date().toLocaleDateString("en-IN")}</p><p>DISPATCHES: {batchPrintBookings.length} Consignments</p></div>
                  </div>
                  <table className="w-full text-left text-[10px] border border-black">
                    <thead className="bg-slate-200 border-b border-black font-bold">
                      <tr><th className="p-1 border-r border-black">#</th><th className="p-1 border-r border-black">Order Ref</th><th className="p-1 border-r border-black">Carrier Docket</th><th className="p-1 border-r border-black">Consignee</th><th className="p-1 border-r border-black">Dest PIN</th><th className="p-1 border-r border-black">Boxes</th><th className="p-1 border-r border-black">Wt (kg)</th><th className="p-1">Handover Sign</th></tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {batchPrintBookings.map((b, i) => (
                        <tr key={b.id}>
                          <td className="p-1 border-r border-black font-mono">{i + 1}</td>
                          <td className="p-1 border-r border-black font-mono font-bold">{b.order_id}</td>
                          <td className="p-1 border-r border-black font-mono">{b.carrier_docket_no}</td>
                          <td className="p-1 border-r border-black truncate max-w-[120px]">{b.consignee_name}</td>
                          <td className="p-1 border-r border-black font-mono">{b.dest_pin}</td>
                          <td className="p-1 border-r border-black font-mono">{b.boxes?.length || 1}</td>
                          <td className="p-1 border-r border-black font-mono">{b.billable_weight}</td>
                          <td className="p-1"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-black text-xs font-bold">
                    <p>Shipper Dispatch Sign: _______________________</p>
                    <p>Carrier Driver Handover Sign: ___________________</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DIRECT AD-HOC SINGLE BOOKING */}
      {selectedQuoteForBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex justify-between border-b pb-3"><h3 className="text-base font-bold text-slate-900">Direct Consignment Booking</h3><button onClick={() => setSelectedQuoteForBooking(null)}><XMarkIcon className="w-5 h-5" /></button></div>
            <div className="bg-slate-50 p-3 rounded-xl border space-y-1">
              <div className="flex justify-between"><span>Freight:</span><strong>{formatINR(selectedQuoteForBooking.breakdown.freightSubtotal)}</strong></div>
              <div className="flex justify-between text-indigo-700"><span>Platform 2% Fee:</span><strong>₹{selectedQuoteForBooking.breakdown.platformConvenienceFee}</strong></div>
              <div className="border-t pt-1 flex justify-between text-emerald-800 font-bold"><span>Total Outlay:</span><span>{formatINR(selectedQuoteForBooking.breakdown.total)}</span></div>
            </div>
            <div><label className="block font-bold mb-1">Consignee Name</label><input type="text" value={consigneeName} onChange={e => setConsigneeName(e.target.value)} className="w-full border rounded p-1.5" /></div>
            <div><label className="block font-bold mb-1">Consignee Phone</label><input type="text" value={consigneePhone} onChange={e => setConsigneePhone(e.target.value)} className="w-full border rounded p-1.5" /></div>
            <div><label className="block font-bold mb-1">Destination Address</label><input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="w-full border rounded p-1.5" /></div>
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button onClick={() => setSelectedQuoteForBooking(null)} className="px-3 py-1.5 text-slate-600">Cancel</button>
              <button onClick={async () => {
                const orderId = `LC-${Math.floor(100000 + Math.random() * 900000)}`;
                const docket = generateCarrierDocket(selectedQuoteForBooking.vendor.name);
                const record = {
                  order_id: orderId, awb_number: docket, carrier_docket_no: docket, carrier_portal_url: getOfficialCarrierTrackingUrl(selectedQuoteForBooking.vendor.name, docket),
                  shipper_id: currentUser.id, vendor_id: selectedQuoteForBooking.vendor.id, rate_card_id: selectedQuoteForBooking.rateCard.id,
                  shipper_name: currentUser.company_name || currentUser.full_name, shipper_phone: currentUser.phone || MERCHANT_DETAILS.phone,
                  shipper_email: currentUser.email, shipper_gstin: currentUser.gstin || "07AAACA1234A1Z5", pickup_address: pickupAddress,
                  consignee_name: consigneeName, consignee_phone: consigneePhone, consignee_gstin: "27AAACP9988G1ZK", delivery_address: deliveryAddress,
                  origin_pin: originPin, dest_pin: destPin, mode: selectedQuoteForBooking.rateCard.mode, boxes, declared_value: declaredValue,
                  actual_weight: selectedQuoteForBooking.actualWeight, volumetric_weight: selectedQuoteForBooking.volumetricWeight,
                  billable_weight: selectedQuoteForBooking.billableWeight, cost_breakdown: { ...selectedQuoteForBooking.breakdown, settlement_type: settlementType, payment_ref: "DIRECT-TO-PAY" },
                  final_total: selectedQuoteForBooking.breakdown.total, status: "Booked" as const, tracking_history: [{ status: "Booked", location: `Hub (${originPin})`, timestamp: new Date().toISOString(), remarks: `Assigned Docket: ${docket}` }]
                };
                const { data } = await supabase.from("bookings").insert([record]).select("*, vendors(*)");
                const b = data && data[0] ? (data[0] as Booking) : { ...(record as Booking), id: `book-${Date.now()}`, created_at: new Date().toISOString(), vendors: selectedQuoteForBooking.vendor };
                setBookings([b, ...bookings]);
                setSelectedQuoteForBooking(null);
                setShipperSubTab("shipments");
              }} className="bg-emerald-600 text-white font-black px-4 py-2 rounded-xl">Confirm & Book</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: LEGAL POLICIES COMPLIANCE */}
      {showLegalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex justify-between border-b pb-2"><h3 className="text-base font-bold">Razorpay KYC & Legal Policies</h3><button onClick={() => setShowLegalModal(false)}><XMarkIcon className="w-5 h-5" /></button></div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <p><strong>Merchant Proprietor:</strong> {MERCHANT_DETAILS.proprietor} ({MERCHANT_DETAILS.email})</p>
              <p><strong>Platform:</strong> {MERCHANT_DETAILS.platformName} under jurisdiction of {MERCHANT_DETAILS.jurisdiction}.</p>
              <p><strong>Refunds:</strong> Cancelled consignments before carrier pickup receive 100% refund within 5–7 business days.</p>
              <p><strong>Statutory:</strong> Governed by Carriage by Road Act 2007 and GST 18% GTA guidelines.</p>
            </div>
            <div className="flex justify-end border-t pt-2"><button onClick={() => setShowLegalModal(false)} className="bg-slate-900 text-white font-bold px-4 py-1.5 rounded-lg">Close</button></div>
          </div>
        </div>
      )}

      {/* MODAL 4: AUTHENTICATION */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex justify-between border-b pb-2"><h3 className="text-base font-bold">{authMode === "login" ? "Sign In" : "Register Enterprise"}</h3><button onClick={() => setShowAuthModal(false)}><XMarkIcon className="w-5 h-5" /></button></div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (authMode === "login") {
                  const { data } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
                  if (data.user) {
                    const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
                    if (p) setCurrentUser({ ...(p as UserProfile), isRealUser: true });
                  }
                } else {
                  await supabase.auth.signUp({ email: authEmail, password: authPassword });
                }
                setShowAuthModal(false);
              } catch (err: any) { alert(err.message); }
            }} className="space-y-3">
              <div><label className="block mb-1 font-bold">Email</label><input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full border rounded p-1.5" required /></div>
              <div><label className="block mb-1 font-bold">Password</label><input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full border rounded p-1.5" required /></div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg">{authMode === "login" ? "Sign In" : "Sign Up"}</button>
            </form>
            <div className="text-center"><button onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")} className="text-indigo-600 hover:underline">{authMode === "login" ? "Create an account" : "Already have an account? Sign in"}</button></div>
          </div>
        </div>
      )}

      {/* GLOBAL SLATE-950 FOOTER */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 text-slate-300 text-xs no-print">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 {MERCHANT_DETAILS.platformName} ({MERCHANT_DETAILS.proprietor}). All rights reserved.</p>
          <div className="flex space-x-3 text-slate-400 font-semibold">
            <button onClick={() => { setLegalModalTab("terms"); setShowLegalModal(true); }} className="hover:text-white">Terms</button>
            <span>•</span>
            <button onClick={() => { setLegalModalTab("privacy"); setShowLegalModal(true); }} className="hover:text-white">Privacy</button>
            <span>•</span>
            <button onClick={() => { setLegalModalTab("refund"); setShowLegalModal(true); }} className="hover:text-white">Refunds</button>
            <span>•</span>
            <span>Helpline: {MERCHANT_DETAILS.phone}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
