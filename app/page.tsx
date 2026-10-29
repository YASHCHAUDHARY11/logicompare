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
import { PDFDocument } from "pdf-lib";

// ============================================================================
// 1. SUPABASE CLIENT SETUP (LOCAL INSTANCE)
// ============================================================================
const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// 2. TYPESCRIPT DATA CONTRACTS & INTERFACES (LOCAL DECLARATIONS)
// ============================================================================
type RoleType = "shipper" | "carrier" | "vendor" | "admin";
type ModeEnv = "demo" | "live";
type BillingCycle = "weekly" | "monthly";
type InvoiceStatus = "Pending" | "Paid" | "Overdue";
type CarrierTabType = "loads" | "bids" | "tracking" | "rates" | "billing" | "earnings" | "credit";
type ShipperTabType = "search" | "matrix" | "shipments" | "history" | "rfq" | "address" | "credit";
type CreditStatus = "Not_Applied" | "Pending_Review" | "Approved" | "Rejected";

interface CreditAgreement {
  id: string;
  shipper_id: string;
  shipper_name: string;
  carrier_id: string;
  carrier_name: string;
  document_url: string;
  document_name: string;
  requested_limit: number;
  approved_limit: number;
  utilized_amount: number;
  status: CreditStatus;
  payment_terms_days: number;
  submitted_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
  is_demo?: boolean;
}

interface CreditLedgerEntry {
  id: string;
  booking_id: string;
  order_ref: string;
  carrier_docket_no: string;
  shipper_id: string;
  shipper_name: string;
  carrier_id: string;
  carrier_name: string;
  amount: number;
  due_date: string;
  status: "Unpaid" | "Settled" | "Overdue";
  settled_at?: string;
  payment_ref?: string;
  created_at: string;
  is_demo?: boolean;
}

interface CreditLedgerSummary {
  total_credit_limit: number;
  utilized_credit: number;
  available_credit: number;
  outstanding_balance: number;
  overdue_amount: number;
  active_agreements_count: number;
}

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
  is_demo?: boolean;
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
  custom_tracking_url?: string;
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
  credit_agreement_id?: string;
}

interface CalculatedQuote {
  rateCard: RateCard;
  vendor: Vendor;
  actualWeight: number;
  volumetricWeight: number;
  billableWeight: number;
  isDeadWeightCalculated: boolean;
  breakdown: CostBreakdown;
  creditAvailable?: boolean;
  creditAgreement?: CreditAgreement;
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
  is_demo?: boolean;
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
  is_demo?: boolean;
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
  custom_tracking_url?: string;
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
// 3. MATHEMATICAL ENGINE, LOCAL RESOLVERS & UTILITIES
// ============================================================================
const formatINR = (val: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(val || 0);
};

function getOfficialCarrierTrackingUrl(carrier: Vendor | string, docketNumber: string): string {
  if (!docketNumber) return "#";
  const cleanDocket = docketNumber.trim();

  if (typeof carrier === "object" && carrier !== null) {
    if (carrier.custom_tracking_url && carrier.custom_tracking_url.trim()) {
      const base = carrier.custom_tracking_url.trim();
      return base.includes("=") || base.endsWith("/")
        ? `${base}${encodeURIComponent(cleanDocket)}`
        : `${base}/${encodeURIComponent(cleanDocket)}`;
    }
    if (carrier.tracking_base_url && carrier.tracking_base_url.trim()) {
      const base = carrier.tracking_base_url.trim();
      return base.includes("=") || base.endsWith("/")
        ? `${base}${encodeURIComponent(cleanDocket)}`
        : `${base}/${encodeURIComponent(cleanDocket)}`;
    }
  }

  const name = (typeof carrier === "string" ? carrier : carrier?.name || "").toLowerCase();
  if (name.includes("delhivery")) return `https://www.delhivery.com/track/package/${encodeURIComponent(cleanDocket)}`;
  if (name.includes("blue dart")) return `https://www.bluedart.com/tracking?trackNo=${encodeURIComponent(cleanDocket)}`;
  if (name.includes("safexpress")) return `http://www.safexpress.com/track-waybill?waybill=${encodeURIComponent(cleanDocket)}`;
  if (name.includes("gati")) return `https://www.gati.com/track-shipment/?docket=${encodeURIComponent(cleanDocket)}`;
  if (name.includes("tci")) return `https://www.tcifreight.com/tracking/${encodeURIComponent(cleanDocket)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} consignment tracking ${cleanDocket}`)}`;
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

function calculatePlatformFee(freightTotal: number, feePercentage: number = 2, minFloorINR: number = 25): number {
  const dynamicFee = (freightTotal * feePercentage) / 100;
  return Math.max(minFloorINR, Math.round(dynamicFee));
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
  feeConfig: FeeConfig,
  agreementsList: CreditAgreement[] = []
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

  const activeCards = matchedCards.length > 0 ? matchedCards : rateCardsList;

  return activeCards.map((card) => {
    const divisor = card.mode === "air" ? 5000 : 4500;
    
    // Strict optional dimensions handling: if dimensions are missing or 0, volumetric weight is 0
    let volumetricWeight = 0;
    if (hasDimensions) {
      volumetricWeight = boxes.reduce((acc, b) => {
        if (!b.length || !b.width || !b.height || Number(b.length) <= 0 || Number(b.width) <= 0 || Number(b.height) <= 0) {
          return acc;
        }
        const volKg = (Number(b.length) * Number(b.width) * Number(b.height)) / divisor;
        return acc + volKg * (Number(b.qty) || 1);
      }, 0);
    }

    const billableWeight = hasDimensions
      ? Math.max(actualWeight, Math.round(volumetricWeight * 10) / 10, card.min_weight_kg)
      : Math.max(actualWeight, card.min_weight_kg);

    const v = card.vendors || vendorsList.find((vend) => vend.id === card.vendor_id) || vendorsList[0] || {
      id: card.vendor_id,
      name: "Carrier Logistics",
      badge: "Verified Carrier",
      rating: 4.5,
      gstin: "07AAACB0000A1Z1",
      fleet_types: ["Surface Express"]
    };

    const baseFreight = Number(card.base_rate) + billableWeight * Number(card.per_kg_rate);
    const fuelSurcharge = (baseFreight * Number(card.fuel_surcharge_pct)) / 100;
    const docket = Number(card.docket_charge);
    const fov = Math.max(50, (Number(declaredValue) * Number(card.fov_pct || feeConfig.fovPercentage)) / 100);
    const handling = billableWeight * Number(card.handling_per_kg || 0);
    const oda = isOda ? Number(card.oda_charge || feeConfig.odaFlatCharge) : 0;

    const subtotal = baseFreight + fuelSurcharge + docket + fov + handling + oda;
    const gst = subtotal * (feeConfig.taxPercentage / 100);
    const freightDirectTotal = subtotal + gst;

    const convenienceFee = calculatePlatformFee(freightDirectTotal, feeConfig.percentage, feeConfig.minFloorINR);

    const matchingAgreement = agreementsList.find(
      (a) => a.carrier_id === v.id && a.status === "Approved"
    );
    const creditAvailable = Boolean(
      matchingAgreement && (matchingAgreement.approved_limit - matchingAgreement.utilized_amount) >= (freightDirectTotal + convenienceFee)
    );

    return {
      rateCard: card,
      vendor: v,
      actualWeight: Math.round(actualWeight * 10) / 10,
      volumetricWeight: Math.round(volumetricWeight * 10) / 10,
      billableWeight: Math.round(billableWeight * 10) / 10,
      isDeadWeightCalculated: !hasDimensions,
      creditAvailable,
      creditAgreement: matchingAgreement,
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

async function compressAgreementFile(file: File): Promise<{
  file: File;
  originalSizeKB: number;
  compressedSizeKB: number;
  savedKB: number;
}> {
  const originalSizeKB = Math.round(file.size / 1024);

  if (file.type.startsWith("image/")) {
    const compressedImage = await compressImageFile(file);
    const compressedSizeKB = Math.round(compressedImage.size / 1024);
    return {
      file: compressedImage,
      originalSizeKB,
      compressedSizeKB,
      savedKB: Math.max(0, originalSizeKB - compressedSizeKB)
    };
  }

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
      const blob = new Blob([compressedBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      
      const compressedFile = new File([blob], file.name, {
        type: "application/pdf",
        lastModified: Date.now()
      });

      const compressedSizeKB = Math.round(compressedFile.size / 1024);
      const isSmaller = compressedFile.size < file.size;

      return {
        file: isSmaller ? compressedFile : file,
        originalSizeKB,
        compressedSizeKB: isSmaller ? compressedSizeKB : originalSizeKB,
        savedKB: isSmaller ? Math.max(0, originalSizeKB - compressedSizeKB) : 0
      };
    } catch (err) {
      console.warn("Client-side PDF minification fallback:", err);
    }
  }

  return { file, originalSizeKB, compressedSizeKB: originalSizeKB, savedKB: 0 };
}
// ============================================================================
// 4. MERCHANT CONFIGURATION & DEFAULT FALLBACK MASTERS
// ============================================================================
const MERCHANT_DETAILS: Record<string, any> = {
  proprietor: "Yash Chaudhary",
  beneficiaryName: "Yash Chaudhary Enterprises",
  platformName: "LogiCompare Pro",
  category: "B2B Freight Discovery & Consignment Marketplace",
  email: "yash963957@gmail.com",
  phone: "+91 8194017660",
  vpa: "yash963957@icici",
  accountNumber: "50200088910001",
  ifsc: "HDFC0000240",
  gstin: "07AAACY1234A1Z1",
  address: "House No. S-175/219, B Block, Rangpuri Pahari Nala, New Delhi - 110037, India",
  jurisdiction: "New Delhi, Delhi, India",
  defaultOriginPin: "110037",
  defaultWarehouseAddress: "House No. S-175/219, B Block, Rangpuri Pahari Nala, New Delhi - 110037",
  operatingHours: "Monday to Saturday, 09:00 AM – 07:00 PM IST",
  platformFeePct: 2,
  minPlatformFeeINR: 25
};

const DEFAULT_FEE_CONFIG: FeeConfig = {
  percentage: 2,
  minFloorINR: 25,
  taxPercentage: 18,
  fovPercentage: 0.20,
  odaFlatCharge: 450
};

const DEMO_INIT_ORDER_ID = "LC-894210";
const DEMO_INIT_CARRIER_DOCKET = "148920194821";

// Demo Sandbox Entities (Strictly isolated to Demo Mode only)
const DEMO_SHIPPER_ADDRESS: AddressProfile = {
  id: "addr-demo-origin",
  label: "Demo Central Logistics Hub",
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

const DEMO_SHIPPER: UserProfile = {
  id: "demo-shipper-uuid",
  email: "dispatch@apexlogistics.in",
  full_name: "Vikram Malhotra",
  company_name: "Apex Retail Solutions Pvt Ltd",
  gstin: "07AAACA1234A1Z5",
  phone: "+91 98110 23456",
  role: "shipper",
  isRealUser: false,
  saved_addresses: [DEMO_SHIPPER_ADDRESS]
};

const DEMO_CARRIER: UserProfile = {
  id: "demo-carrier-uuid",
  email: "ops@delhiveryb2b.com",
  full_name: "Ramesh Sharma",
  company_name: "Delhivery B2B Cargo Hub",
  gstin: "06AAACD9876Q1ZB",
  phone: "+91 98991 76543",
  role: "carrier",
  vendor_id: "11111111-1111-1111-1111-111111111111",
  isRealUser: false,
  custom_tracking_url: "https://www.delhivery.com/track/package/"
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
    tracking_base_url: "https://www.delhivery.com/track/package/",
    custom_tracking_url: "https://www.delhivery.com/track/package/"
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
    tracking_base_url: "https://www.bluedart.com/tracking?trackNo=",
    custom_tracking_url: "https://www.bluedart.com/tracking?trackNo="
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
    tracking_base_url: "https://www.tcifreight.com/tracking/",
    custom_tracking_url: "https://www.tcifreight.com/tracking/"
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
    tracking_base_url: "https://www.gati.com/track-shipment/?docket=",
    custom_tracking_url: "https://www.gati.com/track-shipment/?docket="
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
    tracking_base_url: "http://www.safexpress.com/track-waybill?waybill=",
    custom_tracking_url: "http://www.safexpress.com/track-waybill?waybill="
  }
];

const DEMO_RATE_CARDS: RateCard[] = [
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
    payment_method: "Direct NetBanking",
    is_demo: true
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
    due_date: "2026-10-29",
    is_demo: true
  }
];

const INITIAL_MOCK_CREDIT_AGREEMENTS: CreditAgreement[] = [
  {
    id: "ca-apex-delhivery-01",
    shipper_id: "demo-shipper-uuid",
    shipper_name: "Apex Retail Solutions Pvt Ltd",
    carrier_id: "11111111-1111-1111-1111-111111111111",
    carrier_name: "Delhivery B2B Express",
    document_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    document_name: "Apex_Delhivery_B2B_Credit_Agreement_2026.pdf",
    requested_limit: 500000,
    approved_limit: 350000,
    utilized_amount: 142800,
    status: "Approved",
    payment_terms_days: 15,
    submitted_at: "2026-09-15T10:30:00Z",
    reviewed_at: "2026-09-17T14:20:00Z",
    is_demo: true
  }
];

const INITIAL_MOCK_CREDIT_LEDGER: CreditLedgerEntry[] = [
  {
    id: "c-led-01",
    booking_id: "book-demo-01",
    order_ref: "LC-894210",
    carrier_docket_no: "148920194821",
    shipper_id: "demo-shipper-uuid",
    shipper_name: "Apex Retail Solutions Pvt Ltd",
    carrier_id: "11111111-1111-1111-1111-111111111111",
    carrier_name: "Delhivery B2B Express",
    amount: 38400,
    due_date: "2026-11-05",
    status: "Unpaid",
    created_at: "2026-10-21T11:00:00Z",
    is_demo: true
  }
];

// ============================================================================
// 5. INLINE VECTOR ICONS SYSTEM
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

const ClockIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DocumentCheckIcon: FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-12m-9.375-6.375L19.5 7.5m-9.375-5.25v5.25h5.25m-6.75 6.75l2.25 2.25 4.5-4.5" />
  </svg>
);

// ============================================================================
// 6. REAL AUTHENTICATION & FORGOT PASSWORD MODAL (ISOLATED WORKFLOW)
// ============================================================================
interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (profile: UserProfile) => void;
  onClose: () => void;
}

const AuthModal: FC<AuthModalProps> = ({ isOpen, onSuccess, onClose }) => {
  const [viewMode, setViewMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"shipper" | "carrier">("shipper");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (viewMode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined
        });
        if (error) throw error;
        setSuccessMsg("Password reset link has been dispatched to your business email. Please check your inbox/spam.");
      } else if (viewMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password
        });
        if (error) throw error;
        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email: email.trim(),
            full_name: fullName.trim() || "Enterprise Admin",
            company_name: companyName.trim() || "Logistics Commercial Corp",
            gstin: gstin.trim().toUpperCase() || "07AAACA1234A1Z5",
            phone: phone.trim() || "+91 98110 23456",
            role: role,
            vendor_id: role === "carrier" ? data.user.id : undefined,
            isRealUser: true,
            saved_addresses: []
          };
          await supabase.from("profiles").upsert([profile]);
          onSuccess(profile);
          onClose();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
        if (data.user) {
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
          if (pData) {
            const resolvedRole: RoleType = (pData.role === "vendor" || pData.role === "carrier") ? "carrier" : pData.role;
            onSuccess({
              ...(pData as UserProfile),
              role: resolvedRole,
              isRealUser: true,
              saved_addresses: pData.saved_addresses || []
            });
          } else {
            onSuccess({
              id: data.user.id,
              email: data.user.email || email.trim(),
              full_name: "Verified Business User",
              company_name: "Verified Freight Corp",
              gstin: "07AAACA1234A1Z5",
              phone: "+91 98110 23456",
              role: "shipper",
              isRealUser: true,
              saved_addresses: []
            });
          }
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An authentication error occurred.");
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
              {viewMode === "login" && "Live Account Sign In"}
              {viewMode === "signup" && "Register Logistics Enterprise"}
              {viewMode === "forgot" && "Recover Account Password"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">Production Supabase Identity Guard</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold">{errorMsg}</p>}
        {successMsg && <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-300 p-2.5 rounded-xl font-bold">{successMsg}</p>}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Business Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@enterprise.in"
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {viewMode !== "forgot" && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-slate-700 font-bold">Password</label>
                {viewMode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg("");
                      setSuccessMsg("");
                      setViewMode("forgot");
                    }}
                    className="text-[11px] text-indigo-600 hover:underline font-bold"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
          )}

          {viewMode === "signup" && (
            <>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Vikram Malhotra"
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
                  placeholder="Apex Retail Solutions Pvt Ltd"
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
                <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98110 23456"
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Primary Operational Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "shipper" | "carrier")}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
                >
                  <option value="shipper">Shipper (Manufacturer / Retailer / Trader)</option>
                  <option value="carrier">Carrier (Transporter / Fleet Operator)</option>
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl text-xs transition shadow-md disabled:opacity-50"
          >
            {loading
              ? "Processing Request..."
              : viewMode === "login"
              ? "Sign In To Live Platform"
              : viewMode === "signup"
              ? "Create Enterprise Account"
              : "Send Password Recovery Link"}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100 space-y-1.5">
          {viewMode === "login" && (
            <p>
              Don&apos;t have a live enterprise account?{" "}
              <button
                type="button"
                onClick={() => {
                  setErrorMsg("");
                  setSuccessMsg("");
                  setViewMode("signup");
                }}
                className="text-indigo-600 font-bold hover:underline"
              >
                Register here
              </button>
            </p>
          )}

          {viewMode === "signup" && (
            <p>
              Already registered with LogiCompare?{" "}
              <button
                type="button"
                onClick={() => {
                  setErrorMsg("");
                  setSuccessMsg("");
                  setViewMode("login");
                }}
                className="text-indigo-600 font-bold hover:underline"
              >
                Sign in
              </button>
            </p>
          )}

          {viewMode === "forgot" && (
            <p>
              Remembered your credentials?{" "}
              <button
                type="button"
                onClick={() => {
                  setErrorMsg("");
                  setSuccessMsg("");
                  setViewMode("login");
                }}
                className="text-indigo-600 font-bold hover:underline"
              >
                Back to Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. PERSISTENT APPLICATION STATE ENGINE HOOK CONTROLLER
// ============================================================================
function useAppEngine() {
  // Navigation & Role State
  const [activeRole, setActiveRole] = useState<RoleType | "landing">("landing");
  const [modeEnv, setModeEnv] = useState<ModeEnv>("demo");
  const [highVolumeMode, setHighVolumeMode] = useState<boolean>(true);
  const [isAuthRestoring, setIsAuthRestoring] = useState<boolean>(true);

  // Sub-Navigation Tabs
  const [shipperTab, setShipperTab] = useState<ShipperTabType>("search");
  const [carrierTab, setCarrierTab] = useState<CarrierTabType>("tracking");

  // Authentication & Users
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_SHIPPER);
  const [authSession, setAuthSession] = useState<Session | null>(null);

  // Carrier Specific Public Tracking Portal URL State
  const [carrierCustomTrackingUrl, setCarrierCustomTrackingUrl] = useState<string>("https://www.delhivery.com/track/package/");

  // Dynamic Address Profile State
  const [shipperAddresses, setShipperAddresses] = useState<AddressProfile[]>([DEMO_SHIPPER_ADDRESS]);
  const [activeOriginAddress, setActiveOriginAddress] = useState<AddressProfile | null>(DEMO_SHIPPER_ADDRESS);
  const [showAddressModal, setShowAddressModal] = useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<AddressProfile | null>(null);

  // Credit Agreements & Ledger
  const [creditAgreements, setCreditAgreements] = useState<CreditAgreement[]>(INITIAL_MOCK_CREDIT_AGREEMENTS);
  const [creditLedger, setCreditLedger] = useState<CreditLedgerEntry[]>(INITIAL_MOCK_CREDIT_LEDGER);
  const [showCreditApplyModal, setShowCreditApplyModal] = useState<boolean>(false);

  // Platform Fee Billing & Invoice Ledger
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("weekly");
  const [invoices, setInvoices] = useState<PlatformInvoice[]>(INITIAL_MOCK_INVOICES);
  const [showPayFeeModal, setShowPayFeeModal] = useState<boolean>(false);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<PlatformInvoice | null>(null);
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(DEFAULT_FEE_CONFIG);

  // Master Tariffs and Vendors
  const [rateCards, setRateCards] = useState<RateCard[]>(DEMO_RATE_CARDS);
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

  // Rate Calculator Parameters
  const [originPin, setOriginPin] = useState<string>("110020");
  const [destPin, setDestPin] = useState<string>("400001");
  const [isOda, setIsOda] = useState<boolean>(false);
  const [declaredValue, setDeclaredValue] = useState<number>(75000);
  const [selectedMode, setSelectedMode] = useState<"all" | "surface" | "air" | "ftl">("all");
  const [boxes, setBoxes] = useState<BoxItem[]>([
    { id: "box-1", qty: 2, weight: 20, length: 45, width: 35, height: 30 },
    { id: "box-2", qty: 1, weight: 15, length: null, width: null, height: null }
  ]);
  const [selectedBoxFor3D, setSelectedBoxFor3D] = useState<number>(0);
  const [pickupAddress, setPickupAddress] = useState<string>("Plot 42, Okhla Industrial Area Phase-III, South Delhi - 110020");

  // Bulk CSV Dispatch Matrix State
  const [bulkManifestList, setBulkManifestList] = useState<BulkManifestRow[]>([]);
  const [bulkCsvFileName, setBulkCsvFileName] = useState<string>("");
  const [bulkUploadError, setBulkUploadError] = useState<string>("");
  const [bulkSettlementMethod, setBulkSettlementMethod] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");
  const [bulkConsolidatedUtr, setBulkConsolidatedUtr] = useState<string>("");
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);

  // Tracking and Global Search
  const [globalSearchInput, setGlobalSearchInput] = useState<string>("");
  const [landingTrackingInput, setLandingTrackingInput] = useState<string>("");
  const [activeTrackingAwb, setActiveTrackingAwb] = useState<string>(DEMO_INIT_ORDER_ID);
  const [trackingSearchInput, setTrackingSearchInput] = useState<string>(DEMO_INIT_ORDER_ID);

  // Zone Lookups
  const [originZoneData, setOriginZoneData] = useState<PinLookupResult>({
    city: "Delhi NCR",
    state: "Delhi",
    hub: "DEL-NORTH-01",
    loading: false
  });
  const [destZoneData, setDestZoneData] = useState<PinLookupResult>({
    city: "Mumbai",
    state: "Maharashtra",
    hub: "BOM-CENTRAL",
    loading: false
  });

  const [statusUpdateMap, setStatusUpdateMap] = useState<
    Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>
  >({});

  const applyOriginAddress = useCallback((addr: AddressProfile | null) => {
    if (!addr) {
      setActiveOriginAddress(null);
      setOriginPin("");
      setPickupAddress("");
      setOriginZoneData({ city: "No address selected", state: "", hub: "NONE", loading: false });
      return;
    }
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

  const handleSaveAddress = async (address: AddressProfile) => {
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
    if (address.is_default || !activeOriginAddress || activeOriginAddress.id === address.id) {
      applyOriginAddress(address);
    }

    if (currentUser.isRealUser) {
      try {
        await supabase.from("profiles").update({ saved_addresses: updatedList }).eq("id", currentUser.id);
      } catch (err) {
        console.warn("Failed to persist address profile to Supabase:", err);
      }
    }
  };

  // Sync Master Data from Supabase
  const fetchLiveDatabaseData = useCallback(async () => {
    try {
      const { data: vData } = await supabase.from("vendors").select("*");
      if (vData && vData.length > 0) setVendors(vData);

      const { data: rData } = await supabase.from("rate_cards").select("*, vendors(*)").eq("is_active", true);
      if (rData) setRateCards(rData as RateCard[]);

      const { data: bData } = await supabase.from("bookings").select("*, vendors(*)").order("created_at", { ascending: false });
      if (bData) setBookings(bData as Booking[]);

      const { data: qData } = await supabase.from("rfq_bids").select("*").order("created_at", { ascending: false });
      if (qData) setRfqList(qData as RfqBid[]);

      const { data: agData } = await supabase.from("credit_agreements").select("*").order("submitted_at", { ascending: false });
      if (agData) setCreditAgreements(agData as CreditAgreement[]);

      const { data: clData } = await supabase.from("credit_ledger").select("*").order("created_at", { ascending: false });
      if (clData) setCreditLedger(clData as CreditLedgerEntry[]);

      const { data: invData } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
      if (invData) setInvoices(invData as PlatformInvoice[]);
    } catch (err) {
      console.warn("Database sync notice:", err);
    }
  }, []);

  // 1. Persistent Auth Session Handler (Prevents logouts on page refresh)
  useEffect(() => {
    let isMounted = true;

    const restoreUserSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session && session.user && isMounted) {
          setAuthSession(session);
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();

          if (pData) {
            const rawRole: string = pData.role || "shipper";
            const isCarrierRole = rawRole === "carrier" || rawRole === "vendor";
            const resolvedRole: RoleType = isCarrierRole ? "carrier" : "shipper";

            const userProfile: UserProfile = {
              id: session.user.id,
              email: session.user.email || pData.email || "",
              full_name: pData.full_name || "Enterprise Admin",
              company_name: pData.company_name || "Registered Enterprise",
              gstin: pData.gstin || "07AAACA1234A1Z5",
              phone: pData.phone || "+91 98110 23456",
              role: resolvedRole,
              vendor_id: isCarrierRole ? session.user.id : undefined,
              isRealUser: true,
              saved_addresses: pData.saved_addresses || [],
              custom_tracking_url: pData.custom_tracking_url || ""
            };

            setCurrentUser(userProfile);
            setModeEnv("live");
            setActiveRole(resolvedRole);

            if (userProfile.saved_addresses && userProfile.saved_addresses.length > 0) {
              setShipperAddresses(userProfile.saved_addresses);
              const defaultAddr = userProfile.saved_addresses.find((a) => a.is_default) || userProfile.saved_addresses[0];
              applyOriginAddress(defaultAddr);
            } else {
              setShipperAddresses([]);
              applyOriginAddress(null);
            }

            if (pData.custom_tracking_url) {
              setCarrierCustomTrackingUrl(pData.custom_tracking_url);
            }
          }
          await fetchLiveDatabaseData();
        } else if (isMounted) {
          // No active live session: fallback safely to demo sandbox
          setCurrentUser(DEMO_SHIPPER);
          setModeEnv("demo");
          setActiveRole("landing");
          setShipperAddresses([DEMO_SHIPPER_ADDRESS]);
          applyOriginAddress(DEMO_SHIPPER_ADDRESS);
          setRateCards(DEMO_RATE_CARDS);
        }
      } catch (err) {
        console.warn("Persistent session restore notice:", err);
      } finally {
        if (isMounted) setIsAuthRestoring(false);
      }
    };

    restoreUserSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      setAuthSession(session);

      if (event === "SIGNED_IN" && session?.user) {
        setIsAuthRestoring(true);
        const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        const rawRole: string = pData?.role || "shipper";
        const isCarrierRole = rawRole === "carrier" || rawRole === "vendor";
        const resolvedRole: RoleType = isCarrierRole ? "carrier" : "shipper";

        const profile: UserProfile = {
          id: session.user.id,
          email: session.user.email || pData?.email || "",
          full_name: pData?.full_name || "Enterprise Admin",
          company_name: pData?.company_name || "Registered Enterprise",
          gstin: pData?.gstin || "07AAACA1234A1Z5",
          phone: pData?.phone || "+91 98110 23456",
          role: resolvedRole,
          vendor_id: isCarrierRole ? session.user.id : undefined,
          isRealUser: true,
          saved_addresses: pData?.saved_addresses || [],
          custom_tracking_url: pData?.custom_tracking_url || ""
        };

        setCurrentUser(profile);
        setModeEnv("live");
        setActiveRole(resolvedRole);

        if (profile.saved_addresses && profile.saved_addresses.length > 0) {
          setShipperAddresses(profile.saved_addresses);
          const defaultAddr = profile.saved_addresses.find((a) => a.is_default) || profile.saved_addresses[0];
          applyOriginAddress(defaultAddr);
        } else {
          setShipperAddresses([]);
          applyOriginAddress(null);
        }

        await fetchLiveDatabaseData();
        setIsAuthRestoring(false);
      } else if (event === "SIGNED_OUT") {
        setCurrentUser(DEMO_SHIPPER);
        setModeEnv("demo");
        setActiveRole("landing");
        setShipperAddresses([DEMO_SHIPPER_ADDRESS]);
        applyOriginAddress(DEMO_SHIPPER_ADDRESS);
        setRateCards(DEMO_RATE_CARDS);
        setInvoices(INITIAL_MOCK_INVOICES);
        setCreditAgreements(INITIAL_MOCK_CREDIT_AGREEMENTS);
        setCreditLedger(INITIAL_MOCK_CREDIT_LEDGER);
        setIsAuthRestoring(false);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [applyOriginAddress, fetchLiveDatabaseData]);

  // Handle Explicit Logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Logout error:", err);
    }
    setAuthSession(null);
    setCurrentUser(DEMO_SHIPPER);
    setModeEnv("demo");
    setActiveRole("landing");
    setShipperAddresses([DEMO_SHIPPER_ADDRESS]);
    applyOriginAddress(DEMO_SHIPPER_ADDRESS);
  };

  // PIN Zone Lookup Resolvers
  useEffect(() => {
    if (originPin && originPin.trim().length === 6) {
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
    if (destPin && destPin.trim().length === 6) {
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

  // Global Tracking Search
  const handleGlobalSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!globalSearchInput.trim()) return;
    setActiveTrackingAwb(globalSearchInput.trim());
    setTrackingSearchInput(globalSearchInput.trim());
    setActiveRole("shipper");
    setShipperTab("history");
    setGlobalSearchInput("");
  };

  // Role Navigation with Strict Live Auth Lock
  const handleRoleSwitch = (role: RoleType | "landing") => {
    if (modeEnv === "live" && currentUser.isRealUser) {
      if (role !== "landing" && role !== "admin" && role !== currentUser.role) {
        alert(`Access Restricted: Your verified account is locked to the ${currentUser.role.toUpperCase()} console.`);
        return;
      }
    }
    setActiveRole(role);
    if (modeEnv === "demo") {
      if (role === "shipper") setCurrentUser(DEMO_SHIPPER);
      if (role === "carrier" || role === "vendor") setCurrentUser(DEMO_CARRIER);
    }
  };

  // Live Rates Strict Filtering: NEVER leak demo cards in live mode
  const activeRateCards = useMemo(() => {
    if (modeEnv === "live") {
      return rateCards.filter((c) => !c.id.startsWith("rc-del-") && !c.id.startsWith("rc-bd-") && !c.id.startsWith("rc-safe-") && !c.id.startsWith("rc-gati-"));
    }
    return rateCards;
  }, [rateCards, modeEnv]);

  // Rate Quotes Calculation Memo
  const calculatedQuotes = useMemo(() => {
    if (!originPin || !destPin || activeRateCards.length === 0) return [];
    return calculateQuotesForShipment(
      originPin,
      destPin,
      boxes,
      declaredValue,
      selectedMode,
      isOda,
      activeRateCards,
      vendors,
      feeConfig,
      creditAgreements
    );
  }, [originPin, destPin, boxes, declaredValue, selectedMode, isOda, activeRateCards, vendors, feeConfig, creditAgreements]);

  return {
    state: {
      activeRole, setActiveRole,
      modeEnv, setModeEnv,
      highVolumeMode, setHighVolumeMode,
      isAuthRestoring,
      shipperTab, setShipperTab,
      carrierTab, setCarrierTab,
      currentUser, setCurrentUser,
      authSession,
      carrierCustomTrackingUrl, setCarrierCustomTrackingUrl,
      shipperAddresses, setShipperAddresses,
      activeOriginAddress, setActiveOriginAddress,
      showAddressModal, setShowAddressModal,
      editingAddress, setEditingAddress,
      creditAgreements, setCreditAgreements,
      creditLedger, setCreditLedger,
      showCreditApplyModal, setShowCreditApplyModal,
      billingCycle, setBillingCycle,
      invoices, setInvoices,
      showPayFeeModal, setShowPayFeeModal,
      selectedInvoiceToPay, setSelectedInvoiceToPay,
      feeConfig, setFeeConfig,
      rateCards: activeRateCards, setRateCards,
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
      isBatchProcessing, setIsBatchProcessing,
      globalSearchInput, setGlobalSearchInput,
      landingTrackingInput, setLandingTrackingInput,
      activeTrackingAwb, setActiveTrackingAwb,
      trackingSearchInput, setTrackingSearchInput,
      originZoneData, destZoneData,
      statusUpdateMap, setStatusUpdateMap,
      calculatedQuotes
    },
    handlers: {
      handleGlobalSearch,
      handleRoleSwitch,
      handleLogout,
      handleSaveAddress,
      applyOriginAddress,
      fetchLiveDatabaseData
    }
  };
}
// ============================================================================
// 8. 3D INTERACTIVE CARTOON & TRAJECTORY ENGINES (LOCAL COMPONENTS)
// ============================================================================
interface Interactive3DBoxProps {
  length?: number | null;
  width?: number | null;
  height?: number | null;
}

const Interactive3DBox: FC<Interactive3DBoxProps> = ({ length, width, height }) => {
  const [rotX, setRotX] = useState(-20);
  const [rotY, setRotY] = useState(35);
  const [isDragging, setIsDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const lastPos = useRef({ x: 0, y: 0 });

  const safeL = Number(length) > 0 ? Number(length) : 30;
  const safeW = Number(width) > 0 ? Number(width) : 30;
  const safeH = Number(height) > 0 ? Number(height) : 30;

  useEffect(() => {
    if (!autoRotate || isDragging) return;
    const interval = setInterval(() => {
      setRotY((prev) => (prev + 0.6) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, [autoRotate, isDragging]);

  const maxDim = Math.max(safeL, safeW, safeH, 20);
  const scale = 110 / maxDim;
  const l = Math.max(45, Math.min(150, safeL * scale));
  const w = Math.max(45, Math.min(150, safeW * scale));
  const h = Math.max(45, Math.min(150, safeH * scale));

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
                {safeL}×{safeW}×{safeH} CM
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
            <span className="text-[7px] font-bold rotate-90 opacity-75">WIDTH: {safeW}cm</span>
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
            <span className="text-[7px] font-bold -rotate-90 opacity-75">HT: {safeH}cm</span>
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
      <span className="text-[9px] text-slate-400 mt-1 font-mono">Drag with mouse to inspect package volume</span>
    </div>
  );
};

interface RouteTrajectory3DProps {
  originHub: string;
  destHub: string;
}

const RouteTrajectory3D: FC<RouteTrajectory3DProps> = ({ originHub, destHub }) => {
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

      ctx.save();
      ctx.fillStyle = "rgba(99, 102, 241, 0.05)";
      ctx.beginPath();
      ctx.ellipse(w / 2, h - 30, w / 2 - 20, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(cp.x, cp.y, p2.x, p2.y);
      ctx.stroke();
      ctx.restore();

      progress = (progress + 0.008) % 1;
      const t = progress;
      const bx = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cp.x + t * t * p2.x;
      const by = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cp.y + t * t * p2.y;

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

      ctx.save();
      ctx.fillStyle = "#6366f1";
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 9, 0, Math.PI * 2);
      ctx.stroke();

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
};

// ============================================================================
// 9. DYNAMIC ORIGIN WAREHOUSE ADDRESS MODAL
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
  const [label, setLabel] = useState(initialAddress?.label || "Primary Warehouse Facility");
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
      company_name: companyName.trim() || "Consignor Business Hub",
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
              {initialAddress ? "Edit Dispatch Warehouse Facility" : "Add Origin Pickup Warehouse"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Configure dynamic dispatch locations across India with automatic postal zoning.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Facility Label *</label>
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
              <label className="block text-slate-700 font-bold mb-1">Company / Facility Name</label>
              <input
                type="text"
                placeholder="Consignor Corporate Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Dispatch Lead Name</label>
              <input
                type="text"
                required
                placeholder="Manager Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Phone Helpline</label>
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
            <label className="block text-slate-700 font-bold mb-1">Address Line 1 (Street / Plot No.) *</label>
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
            <label className="block text-slate-700 font-bold mb-1">Address Line 2 (Landmark / Gate / Yard)</label>
            <input
              type="text"
              placeholder="Near Gate No. 2, Behind Container Staging Area"
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                PIN Code * {isLookingUpPin && <span className="text-indigo-600 text-[10px] animate-pulse">(Lookup...)</span>}
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
              <label className="block text-slate-700 font-bold mb-1">City / District *</label>
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
              <label className="block text-slate-700 font-bold mb-1">State *</label>
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
              Set as Primary Origin Facility (Auto-loads into rate cards and 50/day bulk dispatches)
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
              Save Warehouse Facility
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 10. SHIPPER ADDRESS PROFILE MANAGER SECTION
// ============================================================================
interface ShipperAddressSectionProps {
  addresses: AddressProfile[];
  activeAddress: AddressProfile | null;
  onSelectAddress: (address: AddressProfile) => void;
  onAddNewAddress: () => void;
  onEditAddress: (address: AddressProfile) => void;
  isRealUser?: boolean;
}

const ShipperAddressSection: FC<ShipperAddressSectionProps> = ({
  addresses,
  activeAddress,
  onSelectAddress,
  onAddNewAddress,
  onEditAddress,
  isRealUser
}) => {
  return (
    <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <BuildingOfficeIcon className="w-5 h-5 text-indigo-600" />
            <span>Pickup Warehouse & Origin Facilities</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isRealUser
              ? "Your authenticated corporate pickup locations. Configure your facility PINs for direct linehaul carrier dispatch."
              : "Demo Dispatch facilities for live sandbox testing across Indian logistics corridors."}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddNewAddress}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add Warehouse Facility</span>
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-2xl space-y-3">
          <BuildingOfficeIcon className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="font-bold text-slate-700">No pickup warehouse facilities registered yet.</p>
          <p className="text-slate-400">Add your warehouse or factory dispatch address to unlock linehaul rate searches.</p>
          <button
            type="button"
            onClick={onAddNewAddress}
            className="bg-indigo-600 text-white font-black px-4 py-2 rounded-xl text-xs shadow-sm hover:bg-indigo-700 transition"
          >
            + Add First Pickup Facility
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {addresses.map((addr) => {
            const isActive = activeAddress?.id === addr.id;
            return (
              <div
                key={addr.id}
                onClick={() => onSelectAddress(addr)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition relative flex flex-col justify-between ${
                  isActive
                    ? "bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-200 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-xs text-slate-900">{addr.label}</span>
                    {addr.is_default && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                        Default Origin
                      </span>
                    )}
                  </div>
                  <strong className="block text-xs text-slate-800">{addr.company_name}</strong>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    {addr.address_line1}
                    {addr.address_line2 ? `, ${addr.address_line2}` : ""}
                  </p>
                  <p className="text-[11px] font-bold text-slate-800 mt-0.5">
                    {addr.city}, {addr.state} - <span className="font-mono text-indigo-700">{addr.pincode}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    Contact: {addr.contact_name} ({addr.phone})
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                  <span className={`text-[10px] font-bold ${isActive ? "text-indigo-700" : "text-slate-400"}`}>
                    {isActive ? "✓ Selected Origin" : "Click to select"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditAddress(addr);
                    }}
                    className="text-slate-600 hover:text-indigo-600 font-bold text-[11px] underline"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 11. SHIPPER SINGLE RATE FORM (STRICTLY OPTIONAL DIMENSIONS L x W x H)
// ============================================================================
interface ShipperSingleCalculatorSectionProps {
  highVolumeMode: boolean;
  activeOriginAddress: AddressProfile | null;
  onChangeAddressTrigger: () => void;
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
  onOpenCreditApplyModal: () => void;
  isRealUser?: boolean;
}

const ShipperSingleCalculatorSection: FC<ShipperSingleCalculatorSectionProps> = ({
  highVolumeMode,
  activeOriginAddress,
  onChangeAddressTrigger,
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
  onSelectQuoteForBooking,
  onOpenCreditApplyModal,
  isRealUser
}) => {
  const hasDimensions = useMemo(() => {
    return boxes.some(
      (b) => b.length && b.width && b.height && Number(b.length) > 0 && Number(b.width) > 0 && Number(b.height) > 0
    );
  }, [boxes]);

  const totalActualWeight = useMemo(() => {
    return boxes.reduce((acc, b) => acc + (Number(b.weight) || 0) * (Number(b.qty) || 1), 0);
  }, [boxes]);

  const totalVolumetricWeight = useMemo(() => {
    if (!hasDimensions) return 0;
    const divisor = selectedMode === "air" ? 5000 : 4500;
    return boxes.reduce((acc, b) => {
      if (!b.length || !b.width || !b.height || Number(b.length) <= 0 || Number(b.width) <= 0 || Number(b.height) <= 0) return acc;
      const volKg = (Number(b.length) * Number(b.width) * Number(b.height)) / divisor;
      return acc + volKg * (Number(b.qty) || 1);
    }, 0);
  }, [boxes, selectedMode, hasDimensions]);

  const billableWeight = useMemo(() => {
    if (!hasDimensions) return totalActualWeight;
    return Math.max(totalActualWeight, Math.round(totalVolumetricWeight * 10) / 10);
  }, [totalActualWeight, totalVolumetricWeight, hasDimensions]);

  const addBox = () => {
    setBoxes([...boxes, { id: `box-${Date.now()}`, qty: 1, weight: 10, length: null, width: null, height: null }]);
  };

  const removeBox = (id: string) => {
    if (boxes.length <= 1) return;
    setBoxes(boxes.filter((b) => b.id !== id));
  };

  const updateBox = (id: string, field: keyof BoxItem, value: any) => {
    setBoxes(boxes.map((b) => (b.id === id ? { ...b, [field]: value === "" ? null : Number(value) } : b)));
  };

  const currentBox3D = boxes[selectedBoxFor3D] || boxes[0];

  return (
    <div className="space-y-6">
      {/* 1. Dynamic Origin Warehouse Facility Banner */}
      {activeOriginAddress ? (
        <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-xs uppercase tracking-wider text-slate-300">Active Dispatch Facility:</span>
              <span className="font-black text-sm text-white">{activeOriginAddress.label}</span>
            </div>
            <p className="text-xs text-slate-300 font-medium">
              {activeOriginAddress.address_line1}, {activeOriginAddress.city} -{" "}
              <span className="font-mono font-bold text-emerald-400">{activeOriginAddress.pincode}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onChangeAddressTrigger}
            className="bg-white hover:bg-slate-100 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-sm transition"
          >
            Manage Facilities
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-black text-sm">No Origin Pickup Address Selected</h4>
            <p className="text-xs text-amber-800">
              Please register or select a verified pickup warehouse address to populate origin PIN and calculate linehaul tariffs.
            </p>
          </div>
          <button
            type="button"
            onClick={onChangeAddressTrigger}
            className="bg-amber-700 hover:bg-amber-800 text-white font-black px-4 py-2 rounded-xl text-xs shadow-sm transition"
          >
            + Set Origin Warehouse
          </button>
        </div>
      )}

      {/* 2. Route & Consignment Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Origin PIN */}
        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-black text-indigo-950 uppercase tracking-wider">Origin PIN</label>
            <button
              type="button"
              onClick={() => onOpenCityModal("origin")}
              className="text-[11px] text-indigo-700 hover:underline font-bold flex items-center space-x-1"
            >
              <MapPinIcon className="w-3.5 h-3.5" />
              <span>Lookup</span>
            </button>
          </div>
          <input
            type="text"
            maxLength={6}
            value={originPin}
            onChange={(e) => setOriginPin(e.target.value)}
            placeholder="110020"
            className="w-full bg-white border-2 border-indigo-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none"
          />
          <div className="mt-2 text-[11px] font-bold text-indigo-800 truncate">
            📍 {originZoneData.loading ? "Checking..." : `${originZoneData.city} (${originZoneData.hub})`}
          </div>
        </div>

        {/* Destination PIN */}
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-black text-emerald-950 uppercase tracking-wider">Destination PIN</label>
            <button
              type="button"
              onClick={() => onOpenCityModal("dest")}
              className="text-[11px] text-emerald-700 hover:underline font-bold flex items-center space-x-1"
            >
              <MapPinIcon className="w-3.5 h-3.5" />
              <span>Lookup</span>
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
          <div className="mt-2 text-[11px] font-bold text-emerald-800 truncate">
            🎯 {destZoneData.loading ? "Checking..." : `${destZoneData.city} (${destZoneData.hub})`}
          </div>
        </div>

        {/* Declared Value */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
            Declared Value (₹) FOV
          </label>
          <input
            type="number"
            value={declaredValue}
            onChange={(e) => setDeclaredValue(Number(e.target.value))}
            className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500 mt-2 font-medium">0.20% FOV insurance risk coverage</p>
        </div>

        {/* Transport Mode & ODA */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
              Transport Mode
            </label>
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
            <span className="text-xs text-slate-800 font-bold">Out of Delivery Area (+₹450)</span>
          </label>
        </div>
      </div>

      {/* 3. Parabolic Trajectory Canvas */}
      {!highVolumeMode && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <RouteTrajectory3D originHub={originZoneData.hub} destHub={destZoneData.hub} />
        </div>
      )}

      {/* 4. Multi-Box Carton Specifications with Strictly Optional Dimensions */}
      <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/70 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              Carton Specs ({boxes.length} Box Type{boxes.length > 1 ? "s" : ""})
            </span>
            <p className="text-[11px] text-slate-500 font-medium">
              Length, width, and height are completely optional. Dead weight alone calculates freight tariffs when left blank.
            </p>
          </div>
          <button
            type="button"
            onClick={addBox}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-black flex items-center space-x-1"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Another Carton Type</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
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
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Weight (Kg/box) *</span>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={box.weight}
                    onChange={(e) => updateBox(box.id, "weight", parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Length (cm)</span>
                  <input
                    type="number"
                    placeholder="Optional"
                    value={box.length ?? ""}
                    onChange={(e) => updateBox(box.id, "length", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono"
                  />
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Width (cm)</span>
                  <input
                    type="number"
                    placeholder="Optional"
                    value={box.width ?? ""}
                    onChange={(e) => updateBox(box.id, "width", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono"
                  />
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Height (cm)</span>
                  <input
                    type="number"
                    placeholder="Optional"
                    value={box.height ?? ""}
                    onChange={(e) => updateBox(box.id, "height", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-end space-x-2 pt-2 sm:pt-0">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {box.length && box.width && box.height
                      ? `${(((box.length * box.width * box.height) / (selectedMode === "air" ? 5000 : 4500)) * box.qty).toFixed(1)}kg vol`
                      : "Dead wt"}
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

        {/* Calculation Summary Ribbon */}
        <div className="flex flex-wrap items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs">
          <div className="flex flex-wrap gap-6 font-medium">
            <div>
              <span className="text-slate-500">Dead Actual Weight: </span>
              <span className="font-mono font-black text-slate-900">{totalActualWeight.toFixed(1)} kg</span>
            </div>
            <div>
              <span className="text-slate-500">Volumetric Weight: </span>
              <span className="font-mono font-black text-indigo-700">
                {hasDimensions ? `${totalVolumetricWeight.toFixed(1)} kg` : "Omitted (0 kg)"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Billable Chargeable: </span>
              <span className="font-mono font-black text-emerald-700 text-sm">{billableWeight.toFixed(1)} kg</span>
            </div>
          </div>
          {!hasDimensions && (
            <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-bold">
              Dead Weight Pricing Applied
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
// ============================================================================
// 12. SHIPPER LIVE RATE COMPARISON CARDS (STRICT ISOLATION & LINE ITEMS)
// ============================================================================
interface ShipperRateComparisonCardsProps {
  quotes: CalculatedQuote[];
  isRealUser?: boolean;
  modeEnv: ModeEnv;
  originPin: string;
  destPin: string;
  onSelectQuoteForBooking: (q: CalculatedQuote) => void;
  onOpenCreditApplyModal: () => void;
}

const ShipperRateComparisonCards: FC<ShipperRateComparisonCardsProps> = ({
  quotes,
  isRealUser,
  modeEnv,
  originPin,
  destPin,
  onSelectQuoteForBooking,
  onOpenCreditApplyModal
}) => {
  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-slate-900">
            {modeEnv === "live" ? "Verified Direct Carrier Tariffs" : "Sandbox Direct Carrier Freight Tariffs"}
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Lane: <span className="font-mono font-bold text-slate-800">{originPin || "---"}</span> → <span className="font-mono font-bold text-slate-800">{destPin || "---"}</span>
          </p>
        </div>

        <span className="text-xs bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-1 rounded-full font-black">
          {quotes.length} Carrier Route{quotes.length === 1 ? "" : "s"} Available
        </span>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-3">
          <TruckIcon className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No verified carrier rates found for this route yet.</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {modeEnv === "live"
              ? "None of our active partner carriers have published a rate tariff covering this specific origin/destination PIN pair. Try alternative pincodes or post an RFQ."
              : "No demo rate cards match the entered pincode prefixes."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {quotes.map((quote) => (
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
                      <span>{quote.rateCard.mode} Linehaul</span>
                    </span>
                    <span>•</span>
                    <span>Transit SLA: <strong className="text-slate-900">{quote.rateCard.sla_days} Days</strong></span>
                    <span>•</span>
                    <span>Billable Wt: <strong className="text-slate-900">{quote.billableWeight} kg</strong></span>
                    <span>•</span>
                    <span className="font-mono text-emerald-800 font-bold">Carrier UPI: {quote.vendor.upi_id || "Available at Checkout"}</span>
                  </div>

                  {/* Credit Facility Status Indicator */}
                  <div className="pt-1">
                    {quote.creditAvailable ? (
                      <span className="inline-flex items-center space-x-1.5 text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-lg font-bold">
                        <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Corporate Credit Approved ({formatINR((quote.creditAgreement?.approved_limit || 0) - (quote.creditAgreement?.utilized_amount || 0))} Available)</span>
                      </span>
                    ) : quote.creditAgreement?.status === "Pending_Review" ? (
                      <span className="inline-flex items-center space-x-1.5 text-[11px] bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-lg font-bold">
                        <ClockIcon className="w-3.5 h-3.5 text-amber-600" />
                        <span>Credit Application Underwriting in Progress by Carrier</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenCreditApplyModal}
                        className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold underline inline-flex items-center space-x-1"
                      >
                        <DocumentCheckIcon className="w-3.5 h-3.5" />
                        <span>Apply for B2B Monthly Credit Facility with {quote.vendor.name}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Line Item Fee Breakdown Matrix */}
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

                {/* Direct Booking Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Total Consignment Cost</span>
                    <span className="text-xl font-black text-emerald-700">{formatINR(quote.breakdown.total)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectQuoteForBooking(quote)}
                    className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition flex items-center space-x-1.5 shadow-sm"
                  >
                    <span>Direct Book Consignment</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 13. CLIENT-SIDE COMPRESSED PDF CREDIT APPLICATION MODAL
// ============================================================================
interface CreditApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  carriers: Vendor[];
  currentShipper: UserProfile;
  onSubmitApplication: (
    carrierId: string,
    limit: number,
    termsDays: number,
    file: File,
    docName: string,
    storageUrl?: string
  ) => void;
}

const CreditApplyModal: FC<CreditApplyModalProps> = ({
  isOpen,
  onClose,
  carriers,
  currentShipper,
  onSubmitApplication
}) => {
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>(carriers[0]?.id || "");
  const [requestedLimit, setRequestedLimit] = useState<number>(300000);
  const [termsDays, setTermsDays] = useState<number>(15);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>("");
  const [statusType, setStatusType] = useState<"idle" | "optimizing" | "uploading" | "success" | "error">("idle");

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Please upload an executed B2B Credit Agreement or KYC document (PDF).");
      return;
    }
    if (requestedLimit <= 0) {
      alert("Please enter a valid requested credit ceiling amount.");
      return;
    }

    setIsSubmitting(true);

    try {
      let fileToUpload = selectedFile;
      let savingsInfo = "";

      // 1. Minify PDF using pdf-lib if file size exceeds 1MB
      if (selectedFile.size > 1024 * 1024) {
        setStatusType("optimizing");
        setUploadStatusText("Optimizing PDF with object streams...");
        
        const result = await compressAgreementFile(selectedFile);
        fileToUpload = result.file;
        if (result.savedKB > 0) {
          savingsInfo = ` (Saved ${result.savedKB} KB)`;
        }
      }

      // 2. Upload to Supabase Storage 'agreements' bucket
      setStatusType("uploading");
      setUploadStatusText("Uploading to secure agreements storage...");

      const safeFileName = `${Date.now()}-${fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = `credit-agreements/${currentShipper.id}/${safeFileName}`;

      let publicUrl = "";
      const { data, error } = await supabase.storage.from("agreements").upload(filePath, fileToUpload, {
        cacheControl: "3600",
        upsert: true
      });

      if (!error && data) {
        const { data: urlData } = supabase.storage.from("agreements").getPublicUrl(filePath);
        publicUrl = urlData.publicUrl;
      } else {
        // Fallback to local Object URL if bucket upload is unprovisioned
        publicUrl = URL.createObjectURL(fileToUpload);
      }

      // 3. Visual Confirmation
      setStatusType("success");
      setUploadStatusText(`Uploaded successfully${savingsInfo}`);

      onSubmitApplication(
        selectedCarrierId,
        requestedLimit,
        termsDays,
        fileToUpload,
        fileToUpload.name,
        publicUrl
      );

      setTimeout(() => {
        setIsSubmitting(false);
        setUploadStatusText("");
        setStatusType("idle");
        onClose();
      }, 1200);

    } catch (err) {
      console.error("Submission failed:", err);
      setStatusType("error");
      setUploadStatusText("Failed to process document. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Apply for Carrier Credit Facility</h3>
            <p className="text-xs text-slate-500 font-medium">
              Submit signed credit agreement / KYC documents for transporter underwriting approval.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="text-slate-400 hover:text-slate-700 p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Select Target Transporter *</label>
            <select
              disabled={isSubmitting}
              value={selectedCarrierId}
              onChange={(e) => setSelectedCarrierId(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
            >
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (GSTIN: {c.gstin})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Requested Credit Ceiling (₹) *</label>
              <input
                type="number"
                step={10000}
                required
                disabled={isSubmitting}
                value={requestedLimit}
                onChange={(e) => setRequestedLimit(Number(e.target.value))}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Requested Billing Terms</label>
              <select
                disabled={isSubmitting}
                value={termsDays}
                onChange={(e) => setTermsDays(Number(e.target.value))}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              >
                <option value={7}>7-Day Rolling Payout</option>
                <option value={15}>15-Day Net Bi-Monthly</option>
                <option value={30}>30-Day Monthly Net Credit</option>
              </select>
            </div>
          </div>

          {/* Compressed Agreement PDF Upload */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Upload Signed Agreement / GST KYC (PDF or Scan) *
            </label>
            <div className="border-2 border-dashed border-indigo-300 rounded-2xl p-4 bg-indigo-50/40 text-center space-y-2">
              <input
                type="file"
                id="credit_agreement_doc_upload"
                accept=".pdf,image/*"
                disabled={isSubmitting}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                }}
                className="hidden"
              />
              <label
                htmlFor="credit_agreement_doc_upload"
                className={`bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 shadow-xs ${
                  isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                }`}
              >
                <UploadIcon className="w-4 h-4" />
                <span>
                  {selectedFile
                    ? `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`
                    : "Select Agreement Document (PDF)"}
                </span>
              </label>

              {uploadStatusText && (
                <div className="pt-1.5">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black ${
                      statusType === "optimizing"
                        ? "bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
                        : statusType === "uploading"
                        ? "bg-indigo-100 text-indigo-900 border border-indigo-300 animate-pulse"
                        : statusType === "success"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : "bg-rose-100 text-rose-900 border border-rose-300"
                    }`}
                  >
                    {statusType === "success" ? "✓ " : "⏳ "}
                    {uploadStatusText}
                  </span>
                </div>
              )}

              <p className="text-[10px] text-slate-500 font-medium">
                PDFs over 1MB are automatically minified in-browser using pdf-lib object streams.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-600">
            <p><strong>Applying Entity:</strong> {currentShipper.company_name} ({currentShipper.gstin})</p>
            <p><strong>Authorized Signatory:</strong> {currentShipper.full_name} ({currentShipper.phone})</p>
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
            >
              {isSubmitting ? "Processing Upload..." : "Submit Credit Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 14. SHIPPER FORMAL CREDIT AGREEMENTS STATUS DASHBOARD
// ============================================================================
interface ShipperCreditStatusSectionProps {
  agreements: CreditAgreement[];
  onApplyNewCredit: () => void;
  isRealUser?: boolean;
}

const ShipperCreditStatusSection: FC<ShipperCreditStatusSectionProps> = ({
  agreements,
  onApplyNewCredit,
  isRealUser
}) => {
  return (
    <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <DocumentCheckIcon className="w-5 h-5 text-indigo-600" />
            <span>Carrier Credit Agreements & KYC Facilities</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Credit facility applications require signed agreements on company letterhead and transporter underwriting review.
          </p>
        </div>
        <button
          type="button"
          onClick={onApplyNewCredit}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Apply for New Carrier Facility</span>
        </button>
      </div>

      {agreements.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-2xl space-y-2">
          <p className="font-bold text-slate-700">No active credit agreements found.</p>
          <p>Shippers cannot book on credit without an approved transporter underwriting agreement.</p>
          <button
            type="button"
            onClick={onApplyNewCredit}
            className="text-indigo-600 font-bold underline"
          >
            Submit an application and upload signed agreement PDF
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agreements.map((agreement) => {
            const availableLimit = Math.max(0, agreement.approved_limit - agreement.utilized_amount);
            const utilizationPct = agreement.approved_limit > 0
              ? Math.min(100, Math.round((agreement.utilized_amount / agreement.approved_limit) * 100))
              : 0;

            return (
              <div key={agreement.id} className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-slate-900">{agreement.carrier_name}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      agreement.status === "Approved"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : agreement.status === "Pending_Review"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-rose-100 text-rose-800 border-rose-300"
                    }`}
                  >
                    {agreement.status.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Approved Limit</span>
                    <strong className="font-mono text-slate-900">{formatINR(agreement.approved_limit)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Utilized Dues</span>
                    <strong className="font-mono text-rose-600">{formatINR(agreement.utilized_amount)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Available Balance</span>
                    <strong className="font-mono text-emerald-600">{formatINR(availableLimit)}</strong>
                  </div>
                </div>

                {agreement.status === "Approved" && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                      <span>Limit Utilization</span>
                      <span>{utilizationPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          utilizationPct > 85 ? "bg-rose-500" : utilizationPct > 60 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${utilizationPct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  <span>Terms: <strong>{agreement.payment_terms_days} Days Net</strong></span>
                  <a
                    href={agreement.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center space-x-1"
                  >
                    <DocumentIcon className="w-3.5 h-3.5" />
                    <span>View Agreement Document</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
// ============================================================================
// 15. CARRIER AVAILABLE LOADS BOARD & REVERSE AUCTION BIDDING CONSOLE
// ============================================================================
interface CarrierBidsSectionProps {
  currentUser: UserProfile;
  rfqList: RfqBid[];
  setRfqList: React.Dispatch<React.SetStateAction<RfqBid[]>>;
}

const CarrierBidsSection: FC<CarrierBidsSectionProps> = ({
  currentUser,
  rfqList,
  setRfqList
}) => {
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
      notes: form.notes || "Dedicated container trailer ready at linehaul hub.",
      created_at: new Date().toISOString()
    };

    const updatedBids = [...(rfq.bids || []), newBidObj];

    try {
      await supabase.from("rfq_bids").update({ bids: updatedBids }).eq("id", rfqId);
      setRfqList(rfqList.map((r) => (r.id === rfqId ? { ...r, bids: updatedBids } : r)));
      setBidFormMap({ ...bidFormMap, [rfqId]: { amount: 0, days: 0, notes: "" } });
      alert("Bid placed successfully on the live reverse auction exchange!");
    } catch (err) {
      console.warn("Direct DB sync fallback:", err);
      setRfqList(rfqList.map((r) => (r.id === rfqId ? { ...r, bids: updatedBids } : r)));
      setBidFormMap({ ...bidFormMap, [rfqId]: { amount: 0, days: 0, notes: "" } });
      alert("Bid recorded in local session ledger!");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-slate-900">Available Loads & Reverse Auction Board</h2>
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
                      <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold uppercase">
                        {rfq.status}
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

                {/* Submit Bid Form */}
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
};

// ============================================================================
// 16. CARRIER CUSTOM PUBLIC TRACKING PORTAL URL CONFIGURATION
// ============================================================================
interface CarrierTrackingUrlConfigProps {
  currentUrl: string;
  onSave: (newUrl: string) => void;
}

const CarrierTrackingUrlConfigSection: FC<CarrierTrackingUrlConfigProps> = ({
  currentUrl,
  onSave
}) => {
  const [urlInput, setUrlInput] = useState(currentUrl || "");
  const [testDocket, setTestDocket] = useState("148920194821");

  const previewResolvedUrl = useMemo(() => {
    if (!urlInput.trim()) return "Configure a tracking URL to see the live resolution preview";
    const base = urlInput.trim();
    return base.includes("=") || base.endsWith("/")
      ? `${base}${encodeURIComponent(testDocket.trim())}`
      : `${base}/${encodeURIComponent(testDocket.trim())}`;
  }, [urlInput, testDocket]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim().startsWith("http://") && !urlInput.trim().startsWith("https://")) {
      alert("Tracking portal URL must start with http:// or https://");
      return;
    }
    onSave(urlInput.trim());
  };

  return (
    <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
          <ExternalLinkIcon className="w-5 h-5 text-indigo-600" />
          <span>Carrier-Specific Public Tracking Portal URL</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure your official fleet tracking website. When shippers or consignees click &quot;Carrier Portal (↗)&quot;, they will be automatically redirected to your customized tracking URL with their AWB number appended.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-700 font-bold mb-1">
            Tracking Endpoint Base URL *
          </label>
          <input
            type="url"
            required
            placeholder="e.g. https://www.yourdomain.com/track?awb= or https://tracking.carrier.in/"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono text-slate-900 font-bold focus:bg-white focus:border-indigo-600 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Ensure your URL ends with an equals sign (<code className="font-mono text-indigo-700 font-bold">?awb=</code>) or trailing slash (<code className="font-mono text-indigo-700 font-bold">/</code>) so the docket number appends accurately.
          </p>
        </div>

        {/* Live Simulator Preview */}
        <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 border border-slate-800">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
            Real-Time Redirection Simulator
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">Sample Docket:</span>
            <input
              type="text"
              value={testDocket}
              onChange={(e) => setTestDocket(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-bold text-white max-w-xs focus:outline-none"
            />
          </div>
          <div className="pt-1">
            <span className="text-[11px] text-slate-400 block mb-0.5">Generated Destination Link:</span>
            <span className="font-mono text-xs text-indigo-300 break-all select-all block bg-slate-950 p-2 rounded-lg border border-slate-800">
              {previewResolvedUrl}
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-2.5 rounded-xl shadow-md transition"
          >
            Save Public Tracking Portal
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================================
// 17. CARRIER FLEET DISPATCH CONSOLE & AUTO-COMPRESSED BILTY UPLOAD
// ============================================================================
interface CarrierOrdersSectionProps {
  currentUser: UserProfile;
  bookings: Booking[];
  statusUpdateMap: Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>;
  setStatusUpdateMap: React.Dispatch<React.SetStateAction<Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>>>;
  onUploadDocketFile: (bookingId: string, file: File) => Promise<void>;
  onUpdateShipmentStatus: (bookingId: string) => Promise<void>;
}

const CarrierOrdersSection: FC<CarrierOrdersSectionProps> = ({
  currentUser,
  bookings,
  statusUpdateMap,
  setStatusUpdateMap,
  onUploadDocketFile,
  onUpdateShipmentStatus
}) => {
  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900">Fleet Tracking & Bilty Dispatch Console</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operating Fleet: <strong className="text-emerald-700 font-bold">{currentUser.company_name}</strong>
          </p>
        </div>
      </div>

      {/* Dispatches Data Cards */}
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
                      {booking.mode} Linehaul
                    </span>
                    <span className="text-xs font-mono text-slate-600 font-bold">
                      {booking.origin_pin} → {booking.dest_pin}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-500 font-medium">Settlement:</span>
                    <span className="font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      {booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}
                    </span>
                  </div>
                </div>

                {/* Bilty Entry & Photo Upload Form */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Carrier Docket / LR Input */}
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

                    {/* Transit Milestone Status */}
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
};
// ============================================================================
// 18. CARRIER CREDIT AGREEMENT REVIEW & APPROVAL CONSOLE
// ============================================================================
interface CarrierCreditApprovalSectionProps {
  agreements: CreditAgreement[];
  onReviewAgreement: (
    agreementId: string,
    status: "Approved" | "Rejected",
    approvedLimit?: number,
    reason?: string
  ) => void;
}

const CarrierCreditApprovalSection: FC<CarrierCreditApprovalSectionProps> = ({
  agreements,
  onReviewAgreement
}) => {
  const [filter, setFilter] = useState<"All" | "Pending_Review" | "Approved" | "Rejected">("Pending_Review");
  const [approvalLimitInput, setApprovalLimitInput] = useState<Record<string, number>>({});
  const [rejectionReasonInput, setRejectionReasonInput] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    if (filter === "All") return agreements;
    return agreements.filter((a) => a.status === filter);
  }, [agreements, filter]);

  const totalCreditExposure = useMemo(() => {
    return agreements
      .filter((a) => a.status === "Approved")
      .reduce((sum, a) => sum + a.approved_limit, 0);
  }, [agreements]);

  const totalActiveExposureDues = useMemo(() => {
    return agreements
      .filter((a) => a.status === "Approved")
      .reduce((sum, a) => sum + a.utilized_amount, 0);
  }, [agreements]);

  return (
    <div className="space-y-6">
      {/* Header and Risk Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <DocumentCheckIcon className="w-5 h-5 text-emerald-600" />
            <span>Shipper Credit Facility Underwriting & KYC Approval</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review signed B2B credit agreements, authorize revolving billing limits, and manage counterparty risk.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl text-xs font-bold text-white">
          {(["Pending_Review", "Approved", "Rejected", "All"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === tab ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Credit Risk Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Authorized Credit Line</span>
          <span className="text-2xl font-black text-slate-900 font-mono">{formatINR(totalCreditExposure)}</span>
          <p className="text-[10px] text-slate-400">Total approved exposure across shippers</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Active Utilized Credit</span>
          <span className="text-2xl font-black text-indigo-700 font-mono">{formatINR(totalActiveExposureDues)}</span>
          <p className="text-[10px] text-slate-400">Outstanding freight unbilled or awaiting invoice terms</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Pending Requests</span>
          <span className="text-2xl font-black text-amber-600 font-mono">
            {agreements.filter((a) => a.status === "Pending_Review").length}
          </span>
          <p className="text-[10px] text-slate-400">Awaiting underwriting KYC verification</p>
        </div>
      </div>

      {/* Agreements Cards Grid */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-xs shadow-sm">
            No credit applications found matching this status filter.
          </div>
        ) : (
          filtered.map((agreement) => {
            const currentLimit = approvalLimitInput[agreement.id] !== undefined
              ? approvalLimitInput[agreement.id]
              : (agreement.approved_limit > 0 ? agreement.approved_limit : agreement.requested_limit);
            const currentReason = rejectionReasonInput[agreement.id] || "";

            return (
              <div key={agreement.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-sm text-slate-900">{agreement.shipper_name}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          agreement.status === "Approved"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : agreement.status === "Pending_Review"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}
                      >
                        {agreement.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Application ID: <span className="font-mono font-bold text-slate-700">{agreement.id}</span> • Terms: <strong>{agreement.payment_terms_days} Days Net Credit</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Requested Facility Limit</span>
                    <span className="text-xl font-black text-indigo-700 font-mono">{formatINR(agreement.requested_limit)}</span>
                  </div>
                </div>

                {/* Uploaded Agreement PDF Link & Submission Details */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <DocumentIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 block">{agreement.document_name}</span>
                      <span className="text-[10px] text-slate-500">Submitted on: {new Date(agreement.submitted_at).toLocaleDateString("en-IN")}</span>
                    </div>
                  </div>

                  <a
                    href={agreement.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-xl font-bold flex items-center space-x-1 shadow-xs transition"
                  >
                    <span>View Executed Agreement PDF</span>
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Approval & Rejection Actions for Pending Items */}
                {agreement.status === "Pending_Review" && (
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 space-y-3 text-xs">
                    <span className="font-black text-indigo-950 uppercase tracking-wider block">
                      Underwriting & KYC Verification Decision
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Approved Credit Limit (₹)</label>
                        <input
                          type="number"
                          step={10000}
                          value={currentLimit}
                          onChange={(e) =>
                            setApprovalLimitInput({
                              ...approvalLimitInput,
                              [agreement.id]: Number(e.target.value)
                            })
                          }
                          className="w-full bg-white border-2 border-indigo-300 rounded-xl p-2 font-mono font-bold text-slate-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Rejection Reason (If rejecting)</label>
                        <input
                          type="text"
                          placeholder="e.g. Incomplete GST filing history"
                          value={currentReason}
                          onChange={(e) =>
                            setRejectionReasonInput({
                              ...rejectionReasonInput,
                              [agreement.id]: e.target.value
                            })
                          }
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2 border-t border-indigo-100">
                      <button
                        type="button"
                        onClick={() =>
                          onReviewAgreement(
                            agreement.id,
                            "Rejected",
                            0,
                            currentReason || "Underwriting criteria not satisfied"
                          )
                        }
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-4 py-2 rounded-xl font-black transition"
                      >
                        Reject Application
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onReviewAgreement(
                            agreement.id,
                            "Approved",
                            currentLimit
                          )
                        }
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-black shadow-sm transition"
                      >
                        Authorize & Approve Credit Facility
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 19. COMBINED B2B CREDIT RISK & COUNTERPARTY LEDGER
// ============================================================================
interface CombinedCreditLedgerSectionProps {
  role: RoleType;
  currentUser: UserProfile;
  creditAgreements: CreditAgreement[];
  creditLedger: CreditLedgerEntry[];
  onSettleLedgerEntry?: (entryId: string, ref: string) => void;
}

const CombinedCreditLedgerSection: FC<CombinedCreditLedgerSectionProps> = ({
  role,
  currentUser,
  creditAgreements,
  creditLedger,
  onSettleLedgerEntry
}) => {
  const [filter, setFilter] = useState<"All" | "Unpaid" | "Settled" | "Overdue">("Unpaid");
  const [settleRefInput, setSettleRefInput] = useState<Record<string, string>>({});

  const isShipper = role === "shipper";

  // Filtered ledger entries based on role
  const relevantLedger = useMemo(() => {
    return creditLedger.filter((entry) => {
      if (isShipper) {
        return entry.shipper_id === currentUser.id;
      }
      return entry.carrier_id === (currentUser.vendor_id || "11111111-1111-1111-1111-111111111111");
    });
  }, [creditLedger, isShipper, currentUser]);

  const filteredEntries = useMemo(() => {
    if (filter === "All") return relevantLedger;
    return relevantLedger.filter((e) => e.status === filter);
  }, [relevantLedger, filter]);

  // Aggregate Financial Metrics
  const summary: CreditLedgerSummary = useMemo(() => {
    const relevantAgreements = creditAgreements.filter((a) => {
      if (isShipper) return a.shipper_id === currentUser.id;
      return a.carrier_id === (currentUser.vendor_id || "11111111-1111-1111-1111-111111111111");
    });

    const totalLimit = relevantAgreements
      .filter((a) => a.status === "Approved")
      .reduce((sum, a) => sum + a.approved_limit, 0);

    const totalUtilized = relevantAgreements
      .filter((a) => a.status === "Approved")
      .reduce((sum, a) => sum + a.utilized_amount, 0);

    const outstanding = relevantLedger
      .filter((e) => e.status === "Unpaid")
      .reduce((sum, e) => sum + e.amount, 0);

    const overdue = relevantLedger
      .filter((e) => e.status === "Overdue")
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      total_credit_limit: totalLimit,
      utilized_credit: totalUtilized,
      available_credit: Math.max(0, totalLimit - totalUtilized),
      outstanding_balance: outstanding,
      overdue_amount: overdue,
      active_agreements_count: relevantAgreements.filter((a) => a.status === "Approved").length
    };
  }, [creditAgreements, relevantLedger, isShipper, currentUser]);

  const handleSettle = (entryId: string) => {
    const ref = settleRefInput[entryId] || `UTR-RECON-${Date.now().toString().slice(-6)}`;
    if (onSettleLedgerEntry) {
      onSettleLedgerEntry(entryId, ref);
      alert(`Ledger entry marked as Settled with reference: ${ref}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <DocumentCheckIcon className="w-5 h-5 text-indigo-600" />
            <span>
              {isShipper
                ? "B2B Credit Facility & Outstanding Balance Ledger"
                : "Receivables & Shipper Counterparty Credit Risk Ledger"}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isShipper
              ? "Track your authorized corporate credit limits, unbilled dues, and carrier repayment schedules."
              : "Monitor extended credit exposure, utilized limits by shippers, and outstanding receivables."}
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl text-xs font-bold text-white shadow-sm">
          {(["Unpaid", "Overdue", "Settled", "All"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === tab ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            {isShipper ? "Total Approved Limit" : "Total Extended Exposure"}
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono">
            {formatINR(summary.total_credit_limit)}
          </span>
          <p className="text-[10px] text-slate-400">
            Across {summary.active_agreements_count} active counterparty facilities
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            {isShipper ? "Utilized Balance (Dues)" : "Active Shipper Dues"}
          </span>
          <span className="text-2xl font-black text-indigo-700 font-mono">
            {formatINR(summary.utilized_credit)}
          </span>
          <p className="text-[10px] text-slate-400">Consignments booked on credit terms</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            {isShipper ? "Available Credit Buffer" : "Unutilized Buffer"}
          </span>
          <span className="text-2xl font-black text-emerald-600 font-mono">
            {formatINR(summary.available_credit)}
          </span>
          <p className="text-[10px] text-slate-400">Ready for instant load dispatching</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Overdue / Critical Dues
          </span>
          <span className={`text-2xl font-black font-mono ${summary.overdue_amount > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {formatINR(summary.overdue_amount)}
          </span>
          <p className="text-[10px] text-slate-400">Past agreed net payment due dates</p>
        </div>
      </div>

      {/* Detailed Credit Ledger Table */}
      <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
            Consignment Credit Ledger ({filteredEntries.length} Records)
          </h3>
          <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
            Carriage by Road Act Net Terms
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No credit ledger entries match the selected status filter.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white uppercase font-black text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">Order Ref</th>
                  <th className="py-3 px-3.5">Carrier Docket</th>
                  <th className="py-3 px-3.5">{isShipper ? "Transporter" : "Shipper Entity"}</th>
                  <th className="py-3 px-3.5">Amount (₹)</th>
                  <th className="py-3 px-3.5">Due Date</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Reconciliation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3.5 font-mono font-black text-indigo-700">{entry.order_ref}</td>
                    <td className="py-3 px-3.5 font-mono text-slate-900 font-bold">{entry.carrier_docket_no}</td>
                    <td className="py-3 px-3.5 font-bold text-slate-800">
                      {isShipper ? entry.carrier_name : entry.shipper_name}
                    </td>
                    <td className="py-3 px-3.5 font-mono font-black text-slate-900 text-sm">
                      {formatINR(entry.amount)}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-600 text-[11px]">{entry.due_date}</td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          entry.status === "Settled"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : entry.status === "Overdue"
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      {entry.status === "Unpaid" ? (
                        <div className="inline-flex items-center space-x-1.5">
                          <input
                            type="text"
                            placeholder="UTR Ref"
                            value={settleRefInput[entry.id] || ""}
                            onChange={(e) =>
                              setSettleRefInput({ ...settleRefInput, [entry.id]: e.target.value })
                            }
                            className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-[11px] font-mono max-w-[100px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSettle(entry.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[11px] transition"
                          >
                            Mark Settled
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400">
                          {entry.payment_ref || "Settled via Term Payout"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 20. CARRIER PLATFORM FEE INVOICING ENGINE & COMMISSION LEDGER
// ============================================================================
interface CarrierBillingSectionProps {
  currentUser: UserProfile;
  invoices: PlatformInvoice[];
  billingCycle: BillingCycle;
  setBillingCycle: (cycle: BillingCycle) => void;
  onOpenPayFeeModal: (invoice: PlatformInvoice) => void;
}

const CarrierBillingSection: FC<CarrierBillingSectionProps> = ({
  currentUser,
  invoices,
  billingCycle,
  setBillingCycle,
  onOpenPayFeeModal
}) => {
  const filteredInvoices = invoices.filter((inv) => inv.billing_cycle === billingCycle);

  const totalOutstanding = useMemo(() => {
    return filteredInvoices
      .filter((inv) => inv.status === "Pending" || inv.status === "Overdue")
      .reduce((sum, inv) => sum + inv.platform_fee_total, 0);
  }, [filteredInvoices]);

  const totalPaid = useMemo(() => {
    return filteredInvoices
      .filter((inv) => inv.status === "Paid")
      .reduce((sum, inv) => sum + inv.platform_fee_total, 0);
  }, [filteredInvoices]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            <span>Platform Fee Billing & Commission Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent weekly and monthly commission settlements (2% per load, min ₹25 floor cap).
          </p>
        </div>

        {/* Weekly / Monthly Cycle Toggle */}
        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl text-xs font-bold text-white shadow-sm">
          <button
            type="button"
            onClick={() => setBillingCycle("weekly")}
            className={`px-3 py-1.5 rounded-lg transition ${
              billingCycle === "weekly" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Weekly Billing
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`px-3 py-1.5 rounded-lg transition ${
              billingCycle === "monthly" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Monthly Billing
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Pending Platform Dues</span>
          <span className="text-2xl font-black text-rose-600 font-mono">{formatINR(totalOutstanding)}</span>
          <p className="text-[10px] text-slate-400">Current cycle commission payable</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Settled Fees</span>
          <span className="text-2xl font-black text-emerald-600 font-mono">{formatINR(totalPaid)}</span>
          <p className="text-[10px] text-slate-400">Fully reconciled platform payouts</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Commission Structure</span>
          <span className="text-2xl font-black text-slate-900 font-mono">2.00%</span>
          <p className="text-[10px] text-slate-400">Fixed rate with ₹25 floor cap per consignment</p>
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
            {billingCycle === "weekly" ? "Weekly Invoices & Statements" : "Monthly Consolidated Invoices"}
          </h3>
          <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
            {filteredInvoices.length} Invoices
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-950 text-white uppercase font-black text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-3.5">Invoice No</th>
                <th className="py-3 px-3.5">Billing Period</th>
                <th className="py-3 px-3.5">Consignments</th>
                <th className="py-3 px-3.5">Gross Freight</th>
                <th className="py-3 px-3.5">Commission (2%)</th>
                <th className="py-3 px-3.5">Due Date</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3.5 font-mono font-black text-indigo-700">{inv.invoice_number}</td>
                  <td className="py-3 px-3.5 text-slate-600 font-mono text-[11px]">
                    {inv.period_start} to {inv.period_end}
                  </td>
                  <td className="py-3 px-3.5 font-bold text-slate-900">{inv.total_consignments} Loads</td>
                  <td className="py-3 px-3.5 font-mono text-slate-900 font-bold">{formatINR(inv.gross_freight)}</td>
                  <td className="py-3 px-3.5 font-mono font-black text-indigo-900 text-sm">{formatINR(inv.platform_fee_total)}</td>
                  <td className="py-3 px-3.5 font-mono text-slate-500 text-[11px]">{inv.due_date}</td>
                  <td className="py-3 px-3.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        inv.status === "Paid"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-amber-100 text-amber-800 border-amber-300"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    {inv.status === "Pending" ? (
                      <button
                        type="button"
                        onClick={() => onOpenPayFeeModal(inv)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3.5 py-1.5 rounded-lg text-xs shadow-sm transition"
                      >
                        Settle Dues
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-500 font-bold">
                        Paid ({inv.payment_ref ? inv.payment_ref.substring(0, 12) : "UTR Reconciled"})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 21. PLATFORM FEE COMMISSION SETTLEMENT & INVOICE PAYMENT MODAL
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
      onPaySuccess(
        invoice.id,
        utrNumber.trim(),
        method === "upi" ? "UPI VPA" : method === "netbanking" ? "Corporate NetBanking" : "Corporate Debit Card"
      );
      setIsProcessing(false);
      onClose();
      alert(`Platform Fee Payment of ${formatINR(invoice.platform_fee_total)} verified! Invoice marked as Paid.`);
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

        <form onSubmit={handlePay} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-800 font-bold mb-1">Select Payment Mode</label>
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
            <p className="text-slate-600"><strong>Platform VPA:</strong> {MERCHANT_DETAILS.vpa}</p>
            <p className="text-slate-600"><strong>Bank Account:</strong> {MERCHANT_DETAILS.accountNumber} (IFSC: {MERCHANT_DETAILS.ifsc})</p>
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Bank Payment Reference / UTR Number *</label>
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
// 22. SHIPPER BULK CSV DISPATCH MATRIX (50/DAY MULTI-LANE CAPACITY)
// ============================================================================
interface ShipperBulkCsvSectionProps {
  highVolumeMode: boolean;
  activeOriginAddress: AddressProfile | null;
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
  handleBulkCsvUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  bulkCsvFileName: string;
  bulkUploadError: string;
}

const ShipperBulkCsvSection: FC<ShipperBulkCsvSectionProps> = ({
  activeOriginAddress,
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
}) => {
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBulkTemplate = () => {
    const csvHeader = "dest_pin,consignee_name,consignee_phone,delivery_address,total_boxes,box_weights,box_dimensions,declared_value\n";
    const sampleRows = [
      "400001,Prime Retailers Mumbai,9820044556,Shop 4 Crawford Market Mumbai,2,18; 12,45x35x30; 30x25x20,45000",
      "560001,Apex Tech Electronics,9845012345,7th Cross Electronic City Bengaluru,3,25; 10; 10,,65000",
      "700001,East Coast Traders,9830098765,Strand Road Burrabazar Kolkata,1,30,50x50x40,30000",
      "600001,South Goods Depot,9840011223,Parrys Corner George Town Chennai,2,15; 15,,25000",
      "500001,Deccan Pharma Hub,9849033445,Abids Circle Hyderabad,4,10; 10; 10; 10,,95000"
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
      {/* Dynamic Origin Dispatch Banner */}
      {activeOriginAddress ? (
        <div className="bg-slate-950 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-black text-sm uppercase tracking-wide">Origin Dispatch Facility:</span>
              <span className="font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded text-xs font-bold">
                {activeOriginAddress.label} (PIN: {activeOriginAddress.pincode})
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              {activeOriginAddress.address_line1}, {activeOriginAddress.city} - {activeOriginAddress.pincode}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadBulkTemplate}
            className="bg-white hover:bg-slate-100 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-md shrink-0 transition"
          >
            <DownloadIcon className="w-4 h-4 text-indigo-600" />
            <span>Download CSV Template</span>
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 p-4 rounded-2xl text-xs font-bold">
          Please select or register a pickup facility in the &quot;Dispatch Facilities&quot; tab before batch booking.
        </div>
      )}

      {/* CSV Drag-and-Drop Area */}
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
            <span>{bulkCsvFileName ? `Replace Manifest File (${bulkCsvFileName})` : "Select Bulk Consignment CSV (40-50 Locations)"}</span>
          </label>
          <p className="text-xs text-slate-600 font-medium">
            Box dimensions are optional. Semicolon-delimited carton weights are supported (e.g. <code className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 rounded font-mono font-bold">25; 10; 10</code>).
          </p>
        </div>

        {bulkUploadError && (
          <div className="text-xs text-rose-800 bg-rose-50 border border-rose-300 p-3 rounded-xl font-bold max-w-lg mx-auto">
            {bulkUploadError}
          </div>
        )}
      </div>

      {/* Manifest Preview Table */}
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
              <p className="text-xs text-slate-500 mt-1">Multi-carrier quotes calculated client-side with 0ms server latency.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onAutoSelectCheapest}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
              >
                <span>⚡ Auto-Select Lowest Price</span>
              </button>
              <button
                type="button"
                onClick={onAutoSelectFastest}
                className="bg-sky-600 hover:bg-sky-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
              >
                <span>🚀 Auto-Select Fastest SLA</span>
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
                  <th className="py-3 px-3.5">Carrier Tariff</th>
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
                            title="Dead weight applied since box dimensions were omitted."
                          >
                            Dead Wt Applied
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

          {/* Consolidated Settlement Form */}
          <div className="bg-slate-950 text-white p-6 rounded-2xl shadow-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-sm font-black uppercase text-indigo-400 block tracking-wide">
                  Consolidated Settlement Method ({bulkManifestList.length} Shipments)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">100% of freight is settled directly with transporters. Platform fee is 2% (min ₹25/consignment).</p>
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
                  🏢 Monthly Corporate Credit
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
                disabled={isBatchProcessing || !activeOriginAddress}
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
};

// ============================================================================
// 23. CONTINUOUS 4x6 THERMAL MULTI-BOX LABEL & HANDOVER MANIFEST MODAL
// ============================================================================
interface ThermalPrintModalProps {
  printableBooking: Booking | null;
  batchPrintBookings: Booking[] | null;
  onClose: () => void;
}

const ThermalPrintModal: FC<ThermalPrintModalProps> = ({
  printableBooking,
  batchPrintBookings,
  onClose
}) => {
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
              Continuous thermal page layout calibrated for standard 4x6 label printers with simulated barcodes.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
            >
              <PrinterIcon className="w-4 h-4" />
              <span>Print All Labels (4x6)</span>
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
                    length: null,
                    width: null,
                    height: null
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
                            {box.length && box.width && box.height ? `${box.length}x${box.width}x${box.height}` : "DEAD WT"}
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

          {/* Master Pickup Handover Manifest Sheet */}
          {batchPrintBookings && (
            <div className="manifest-sheet bg-white text-black p-6 border-4 border-black font-sans space-y-5 rounded-sm">
              <div className="flex justify-between border-b-2 border-black pb-3">
                <div>
                  <h2 className="text-lg font-black tracking-tight">MASTER PICKUP HANDOVER MANIFEST</h2>
                  <p className="text-xs text-slate-700 font-medium">Shipper Dispatch Facility: {MERCHANT_DETAILS.defaultWarehouseAddress}</p>
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
};

// ============================================================================
// 24. 2D CANVAS ANIMATED HERO TRUCK
// ============================================================================
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

      // Highway Road Center Dashed Line
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

      // Chassis Drop Shadow
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 30, 85, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Vehicle Body Assembly
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

      // Corrugated Container Vertical Ribs
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

      // Front Headlight Beam
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
      for (let wIdx = 0; wIdx < wheelPositions.length; wIdx++) {
        const wx = wheelPositions[wIdx];
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
        ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
        ctx.moveTo(0, -5); ctx.lineTo(0, 5);
        ctx.stroke();
        ctx.restore();
      }

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

// ============================================================================
// 25. COMPLETE CONVERTING LANDING VIEW
// ============================================================================
interface LandingViewProps {
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

const LandingView: FC<LandingViewProps> = ({
  highVolumeMode,
  vendors,
  landingTrackingInput,
  setLandingTrackingInput,
  onQuickTrack,
  onJumpToCompare,
  onJumpToBulk,
  onSwitchShipperDemo,
  onSwitchCarrierDemo
}) => {
  const [workflowTab, setWorkflowTab] = useState<"shipper" | "vendor">("shipper");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="flex-1 flex flex-col space-y-16 pb-16">
      {/* SECTION 1: HERO & LIVE TRACKER */}
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
              <span>Hybrid Dual-ID Consignment Discovery & Automated Dispatches</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              One-Click Bulk Freight Booking & Multi-Box 4x6 Thermal Labels.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
              Compare Delhivery, Blue Dart, Safexpress, TCI, and Gati rates across India. Upload semicolon-delimited CSVs, auto-assign lowest rates, manage approved corporate credit lines, and print continuous thermal labels with driver handover manifests.
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
                <span>Carrier Sandbox (Demo)</span>
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
                  Direct settlements via To-Pay POD, UPI, and Pre-Approved B2B Credit with 0% markups.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Universal Tracking Quick Lookups */}
        <div className="pt-10 max-w-xl mx-auto relative z-10">
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-2xl flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center space-x-2 px-3 py-1.5 text-slate-300 w-full sm:w-auto flex-1">
              <SearchIcon className="w-4 h-4 text-indigo-400 shrink-0" />
              <input
                type="text"
                value={landingTrackingInput}
                onChange={(e) => setLandingTrackingInput(e.target.value)}
                placeholder="Enter Order Ref (LC-...) or Carrier Docket..."
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
            <span>Sample Tracking Identifiers:</span>
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

      {/* SECTION 2: STATS & CARRIER STRIP */}
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
            <p className="text-[11px] text-slate-500">To-Pay / Direct UPI / B2B Credit</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-3xl font-black text-amber-500">2%</span>
            <p className="text-xs font-bold text-slate-900 mt-1">Flat Verification Platform Fee</p>
            <p className="text-[11px] text-slate-500">Min ₹25 floor cap per booking</p>
          </div>
        </div>

        <div className="pt-8 text-center space-y-4">
          <span className="text-xs uppercase font-black text-slate-500 tracking-widest block">
            Integrated National Logistics Transporters
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

      {/* SECTION 3: WORKFLOW ARCHITECTURE */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full">
            Operational Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">How LogiCompare Pro Works</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Consolidating platform transparency with real-world carrier waybill and corporate credit standards.
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
              🚛 For Logistics Fleets & Carriers
            </button>
          </div>
        </div>

        {workflowTab === "shipper" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">1</span>
              <h3 className="font-bold text-slate-900 text-sm">PIN & Optional Dimensions</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Enter single destination PINs or upload a 50-location CSV. Dimensions are strictly optional—dead weight calculates freight when omitted.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">2</span>
              <h3 className="font-bold text-slate-900 text-sm">Compare Rates & Credit</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Inspect transparent line-item pricing: Base, Fuel %, Docket, ODA, FOV, GST. View approved B2B credit lines per carrier.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">3</span>
              <h3 className="font-bold text-slate-900 text-sm">One-Click Dual-ID Booking</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Settle freight via To-Pay, direct UPI, or approved corporate net credit. Receive internal Ref (`LC-XXXXXX`) and official AWB docket.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">4</span>
              <h3 className="font-bold text-slate-900 text-sm">Continuous 4x6 Labels</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Print multi-box Box X of Y thermal labels and generate a Master Handover Manifest with driver signature sign-off blocks.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">1</span>
              <h3 className="font-bold text-slate-900 text-sm">Onboard Fleet & Custom URL</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Register as a verified transporter, configure bank settlement details, and specify your company&apos;s custom public tracking portal.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">2</span>
              <h3 className="font-bold text-slate-900 text-sm">Underwrite Credit Agreements</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Review signed credit applications and KYC documents from enterprise shippers. Approve or reject credit ceilings with custom net terms.
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">3</span>
              <h3 className="font-bold text-slate-900 text-sm">Weekly / Monthly Billing</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Track platform fee dues transparently with cycle breakdown, due dates, and one-click UTR payment reconciliation.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4: ENTERPRISE CAPABILITIES */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full">
            Enterprise Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Engineered for Indian Logistics Complexity</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><LayersIcon className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-900 text-base">Multi-Box Volumetric Engine</h3>
            <p className="text-xs text-slate-600 leading-relaxed">Calculates actual weight vs. volumetric weight across multiple cartons using standard 4500 and 5000 divisors. Dead weight alone applies when dimensions are omitted.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CurrencyRupeeIcon className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-900 text-base">Zero Hidden Surcharges</h3>
            <p className="text-xs text-slate-600 leading-relaxed">Transparent breakdown: Base freight, Fuel Surcharge %, Docket AWB charge, Handling per kg, ODA fee, and 18% GST.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><ShieldCheckIcon className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-900 text-base">FOV Cargo Risk Insurance</h3>
            <p className="text-xs text-slate-600 leading-relaxed">Built-in 0.20% Freight On Value (FOV) risk coverage calculator ensuring high-value electronic and pharmaceutical shipments are protected.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><PrinterIcon className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-900 text-base">4x6 Thermal Label Printing</h3>
            <p className="text-xs text-slate-600 leading-relaxed">Continuous print engine for multi-box labels with barcode and docket, ending with a driver handover sign-off manifest.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><TruckIcon className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-900 text-base">Carrier-Configured Tracking URLs</h3>
            <p className="text-xs text-slate-600 leading-relaxed">Deep dynamic redirection to each transporter&apos;s custom public tracking portal with docket numbers appended automatically.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><CreditCardIcon className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-900 text-base">Formal B2B Credit Agreements</h3>
            <p className="text-xs text-slate-600 leading-relaxed">Execute KYC agreements on company letterhead to unlock approved revolving credit balances with net payment term schedules.</p>
          </div>
        </div>
      </section>

      {/* SECTION 5: FAQ ACCORDION */}
      <section className="max-w-4xl mx-auto px-4 lg:px-8 w-full space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full">
            FAQ & Knowledge Base
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "What is the difference between Order Ref (LC-XXXXXX) and Carrier Docket?",
              a: "The Order Ref is LogiCompare Pro's internal reference number used for platform invoices and receipts. The Carrier Docket is the transporter's official waybill used by drivers and freight hubs."
            },
            {
              q: "Can I book shipments if I don't know the exact box dimensions?",
              a: "Yes! Length, width, and height are strictly optional. When dimensions are omitted, our rate calculation engine applies dead actual weight alone to generate instant carrier quotes."
            },
            {
              q: "How does the formal B2B Credit Facility work?",
              a: "Shippers cannot book on credit by default. You must apply for credit by uploading an executed credit agreement on company letterhead. Once the carrier underwrites and approves your limit, the credit option becomes available at checkout."
            },
            {
              q: "How does the weekly and monthly Platform Fee billing work?",
              a: "100% of freight is collected directly by carriers. LogiCompare generates an itemized weekly or monthly invoice for the 2% platform convenience fee (min ₹25/load), which carriers reconcile via UPI or NetBanking."
            },
            {
              q: "Where does the physical Bilty / LR slip photo get saved?",
              a: "Documents are stored in a dedicated Supabase Object Storage bucket, auto-compressed to ~100KB to retain full text legibility while eliminating storage waste."
            }
          ].map((faq, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 text-left font-black text-sm text-slate-900 flex items-center justify-between hover:bg-slate-50"
              >
                <span>{faq.q}</span>
                <ChevronDownIcon className={`w-4 h-4 text-slate-500 transition-transform ${openFaq === idx ? "rotate-180 text-indigo-600" : ""}`} />
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

      {/* SECTION 6: BOTTOM CALL TO ACTION */}
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
            Switch to the Freight Matrix Dashboard to calculate live rates, print certified carrier labels, and manage approved credit agreements across India.
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
};

// ============================================================================
// 26. THE MASTER NEXT.JS SINGLE DEFAULT EXPORT: Page()
// ============================================================================
export default function Page() {
  const { state, handlers } = useAppEngine();

  // Strict live user authentication flags
  const isRealAuthLive = state.modeEnv === "live" && state.currentUser.isRealUser;
  const isShipper = state.currentUser.role === "shipper";
  const isCarrier = state.currentUser.role === "carrier" || state.currentUser.role === "vendor";

  // Prevent flash of demo state during initial session restoration
  if (state.isAuthRestoring) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-mono font-bold tracking-wider text-slate-300">
          RESTORING VERIFIED ENTERPRISE SESSION...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* 1. Global Navigation Command Bar */}
      <header className="sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Platform Brand */}
          <div
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => handlers.handleRoleSwitch("landing")}
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

          {/* Global Search Input */}
          <form onSubmit={handlers.handleGlobalSearch} className="hidden md:flex items-center max-w-sm w-full relative">
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={state.globalSearchInput}
              onChange={(e) => state.setGlobalSearchInput(e.target.value)}
              placeholder="Search Order Ref (LC-...) or Docket..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </form>

          {/* Role Navigation with Strict Live Auth Lock */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => handlers.handleRoleSwitch("landing")}
              className={`px-3 py-1.5 rounded-lg transition ${
                state.activeRole === "landing" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Overview
            </button>

            {isRealAuthLive ? (
              <>
                {isShipper && (
                  <button
                    type="button"
                    onClick={() => handlers.handleRoleSwitch("shipper")}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      state.activeRole === "shipper" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Shipper Console
                  </button>
                )}
                {isCarrier && (
                  <button
                    type="button"
                    onClick={() => handlers.handleRoleSwitch("carrier")}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      state.activeRole === "carrier" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Carrier Hub
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handlers.handleRoleSwitch("shipper")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    state.activeRole === "shipper" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Shipper
                </button>
                <button
                  type="button"
                  onClick={() => handlers.handleRoleSwitch("carrier")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    state.activeRole === "carrier" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Carrier
                </button>
                <button
                  type="button"
                  onClick={() => handlers.handleRoleSwitch("admin")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    state.activeRole === "admin" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Admin
                </button>
              </>
            )}
          </div>

          {/* User Profile & Session Controls */}
          <div className="flex items-center space-x-2.5">
            {/* Demo Sandbox Toggles (Isolated to Demo Mode only) */}
            {!isRealAuthLive && (
              <div className="hidden lg:flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-black px-1.5 text-amber-400">Sandbox:</span>
                <button
                  type="button"
                  onClick={() => {
                    state.setCurrentUser(DEMO_SHIPPER);
                    state.setActiveRole("shipper");
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                    state.currentUser.role === "shipper" && state.activeRole === "shipper"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>⚡ Apex</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    state.setCurrentUser(DEMO_CARRIER);
                    state.setActiveRole("carrier");
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                    (state.currentUser.role === "carrier" || state.currentUser.role === "vendor") && state.activeRole === "carrier"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>🚛 Delhivery</span>
                </button>
              </div>
            )}

            {/* Authenticated State Display */}
            {isRealAuthLive ? (
              <div className="flex items-center space-x-2">
                <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center space-x-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-white max-w-[130px] truncate">
                      {state.currentUser.company_name || state.currentUser.full_name}
                    </span>
                    <span className="text-[9px] text-slate-400 truncate max-w-[130px]">
                      {state.currentUser.email}
                    </span>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono uppercase font-bold">
                    {state.currentUser.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handlers.handleLogout}
                  className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => state.setShowAuthModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition"
              >
                Sign In / Register
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Workspace Content Routing */}
      <div className="flex-1">
        {/* VIEW A: LANDING PAGE */}
        {state.activeRole === "landing" && (
          <LandingView
            highVolumeMode={state.highVolumeMode}
            vendors={state.vendors}
            landingTrackingInput={state.landingTrackingInput}
            setLandingTrackingInput={state.setLandingTrackingInput}
            onQuickTrack={(val) => {
              const target = val || state.landingTrackingInput || DEMO_INIT_ORDER_ID;
              state.setActiveTrackingAwb(target);
              state.setTrackingSearchInput(target);
              handlers.handleRoleSwitch("shipper");
              state.setShipperTab("history");
            }}
            onJumpToCompare={() => {
              handlers.handleRoleSwitch("shipper");
              state.setShipperTab("search");
            }}
            onJumpToBulk={() => {
              handlers.handleRoleSwitch("shipper");
              state.setShipperTab("matrix");
            }}
            onSwitchShipperDemo={() => {
              handlers.handleRoleSwitch("shipper");
              state.setCurrentUser(DEMO_SHIPPER);
              state.setModeEnv("demo");
            }}
            onSwitchCarrierDemo={() => {
              handlers.handleRoleSwitch("carrier");
              state.setCurrentUser(DEMO_CARRIER);
              state.setModeEnv("demo");
            }}
          />
        )}

        {/* VIEW B: SHIPPER CONSOLE */}
        {state.activeRole === "shipper" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shipper Console</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consignment Matrix & Dispatches • Active Organization: <strong className="text-slate-800">{state.currentUser.company_name}</strong>
                </p>
              </div>

              {/* 50/Day High-Volume Speed Toggle */}
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

            {/* Sub-Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
              {[
                { id: "search", label: "🔍 New Rate Search" },
                { id: "matrix", label: "⚡ Rate Matrix (50/Day Bulk)" },
                { id: "shipments", label: "📦 Active Shipments" },
                { id: "history", label: "📍 History & Live Track" },
                { id: "rfq", label: "⚖️ Load Auction (RFQ)" },
                { id: "address", label: "🏢 Dispatch Facilities" },
                { id: "credit", label: "💳 B2B Credit Agreements" }
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

            {/* Tab 1: Single Rate Calculator */}
            {state.shipperTab === "search" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <ShipperSingleCalculatorSection
                  highVolumeMode={state.highVolumeMode}
                  activeOriginAddress={state.activeOriginAddress}
                  onChangeAddressTrigger={() => state.setShipperTab("address")}
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
                  onOpenCreditApplyModal={() => state.setShowCreditApplyModal(true)}
                  isRealUser={isRealAuthLive}
                />
                <ShipperRateComparisonCards
                  quotes={state.calculatedQuotes}
                  isRealUser={isRealAuthLive}
                  modeEnv={state.modeEnv}
                  originPin={state.originPin}
                  destPin={state.destPin}
                  onSelectQuoteForBooking={(q) => state.setSelectedQuoteForBooking(q)}
                  onOpenCreditApplyModal={() => state.setShowCreditApplyModal(true)}
                />
              </div>
            )}

            {/* Tab 2: Rate Matrix (50/Day Bulk CSV) */}
            {state.shipperTab === "matrix" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <ShipperBulkCsvSection
                  highVolumeMode={state.highVolumeMode}
                  activeOriginAddress={state.activeOriginAddress}
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
                  onConfirmBatchBooking={async () => {
                    if (state.bulkManifestList.length === 0) return;
                    state.setIsBatchProcessing(true);

                    const newBookings: Booking[] = state.bulkManifestList.map((row, idx) => {
                      const quote = row.selectedQuote || row.quotes[0];
                      const officialDocket = generateCarrierDocket(quote.vendor.name);
                      const platformOrderId = `LC-${Math.floor(100000 + Math.random() * 900000)}`;
                      return {
                        id: `bulk-booking-${Date.now()}-${idx}`,
                        order_id: platformOrderId,
                        awb_number: officialDocket,
                        carrier_docket_no: officialDocket,
                        carrier_portal_url: getOfficialCarrierTrackingUrl(quote.vendor, officialDocket),
                        shipper_id: state.currentUser.id,
                        vendor_id: quote.vendor.id,
                        rate_card_id: quote.rateCard.id,
                        shipper_name: state.currentUser.company_name || state.currentUser.full_name,
                        shipper_phone: state.currentUser.phone,
                        shipper_email: state.currentUser.email,
                        shipper_gstin: state.currentUser.gstin,
                        pickup_address: state.pickupAddress,
                        pickup_pincode: state.originPin,
                        consignee_name: row.consignee_name,
                        consignee_phone: row.consignee_phone,
                        consignee_gstin: row.consignee_gstin,
                        delivery_address: row.delivery_address,
                        origin_pin: state.originPin,
                        dest_pin: row.dest_pin,
                        mode: quote.rateCard.mode,
                        boxes: row.boxes,
                        declared_value: row.declared_value,
                        actual_weight: row.actualWeight,
                        volumetric_weight: row.volumetricWeight,
                        billable_weight: row.billableWeight,
                        cost_breakdown: {
                          ...quote.breakdown,
                          settlement_type: state.bulkSettlementMethod,
                          payment_ref: state.bulkConsolidatedUtr || "BULK-SETTLEMENT"
                        },
                        final_total: quote.breakdown.total,
                        status: "Booked",
                        tracking_history: [
                          {
                            status: "Booked",
                            location: `${state.originZoneData.city} Hub (${state.originPin})`,
                            timestamp: new Date().toISOString(),
                            remarks: `Batch consignment booked with Waybill ${officialDocket}`
                          }
                        ],
                        created_at: new Date().toISOString(),
                        vendors: quote.vendor
                      };
                    });

                    state.setBookings([...newBookings, ...state.bookings]);
                    state.setBatchPrintBookings(newBookings);
                    state.setBulkManifestList([]);
                    state.setIsBatchProcessing(false);
                    state.setShipperTab("shipments");
                    alert(`Batch booked successfully! ${newBookings.length} consignments assigned.`);
                  }}
                  isBatchProcessing={state.isBatchProcessing}
                  handleBulkCsvUpload={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    state.setBulkCsvFileName(file.name);
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const text = event.target?.result as string;
                        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
                        if (lines.length <= 1) throw new Error("CSV contains no data rows.");
                        const rows: BulkManifestRow[] = [];

                        for (let i = 1; i < lines.length; i++) {
                          const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
                          if (cols.length < 5) continue;
                          const [dPin, cName, cPhone, dAddr, bQtyStr, bWtsStr, bDimsStr, dValStr] = cols;
                          const bQty = Math.max(1, parseInt(bQtyStr, 10) || 1);
                          const dVal = parseFloat(dValStr) || 50000;
                          const parsedWts = bWtsStr ? bWtsStr.split(";").map((w) => parseFloat(w.trim())).filter((n) => !isNaN(n) && n > 0) : [];
                          const parsedDims = bDimsStr ? bDimsStr.split(";").map((d) => d.trim()).filter((d) => d.length > 0) : [];
                          const hasOmittedDimensions = parsedDims.length === 0;

                          const boxItems: BoxItem[] = [];
                          for (let b = 0; b < bQty; b++) {
                            const wt = parsedWts[b] || parsedWts[0] || 10;
                            let l: number | null = null, w: number | null = null, h: number | null = null;
                            if (parsedDims[b]) {
                              const p = parsedDims[b].toLowerCase().split("x").map((x) => parseFloat(x.trim()));
                              if (p.length === 3 && !p.some(isNaN)) { l = p[0]; w = p[1]; h = p[2]; }
                            }
                            boxItems.push({ id: `b-${i}-${b}`, qty: 1, weight: wt, length: l, width: w, height: h });
                          }

                          const aWeight = boxItems.reduce((acc, bi) => acc + bi.weight, 0);
                          const vWeight = hasOmittedDimensions ? 0 : boxItems.reduce((acc, bi) => acc + (((bi.length || 0) * (bi.width || 0) * (bi.height || 0)) / 4500), 0);
                          const bWeight = hasOmittedDimensions ? aWeight : Math.max(aWeight, Math.round(vWeight * 10) / 10);

                          const quotes = calculateQuotesForShipment(
                            state.originPin,
                            dPin,
                            boxItems,
                            dVal,
                            "surface",
                            false,
                            state.rateCards,
                            state.vendors,
                            state.feeConfig,
                            state.creditAgreements
                          );
                          const sorted = [...quotes].sort((a, b) => a.breakdown.total - b.breakdown.total);

                          rows.push({
                            rowId: `row-${i}-${Date.now()}`,
                            dest_pin: dPin,
                            consignee_name: cName,
                            consignee_phone: cPhone,
                            delivery_address: dAddr,
                            consignee_gstin: "27AAACP9988G1ZK",
                            total_boxes: bQty,
                            boxes: boxItems,
                            declared_value: dVal,
                            hasOmittedDimensions,
                            actualWeight: Math.round(aWeight * 10) / 10,
                            volumetricWeight: Math.round(vWeight * 10) / 10,
                            billableWeight: Math.round(bWeight * 10) / 10,
                            quotes,
                            selectedQuote: sorted[0] || null
                          });
                        }
                        state.setBulkManifestList(rows);
                      } catch (err: any) {
                        state.setBulkUploadError(err.message || "Failed to process bulk CSV.");
                      }
                    };
                    reader.readAsText(file);
                  }}
                  bulkCsvFileName={state.bulkCsvFileName}
                  bulkUploadError={state.bulkUploadError}
                />
              </div>
            )}

            {/* Tab 3: Active Shipments */}
            {state.shipperTab === "shipments" && (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
      <div>
        <h3 className="text-base font-bold text-slate-800">My Shipments</h3>
        <p className="text-xs text-slate-500">Live booking records and dockets</p>
      </div>
      <button
        onClick={handlers.fetchLiveDatabaseData}
        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
      >
        Refresh
      </button>
    </div>

    {state.bookings.length === 0 ? (
      <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
        No shipments booked yet.
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold uppercase">
            <tr>
              <th className="p-3">Order / AWB</th>
              <th className="p-3">Destination</th>
              <th className="p-3">Carrier / Docket</th>
              <th className="p-3">Status</th>
              <th className="p-3">Amount</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.bookings.map((b: any) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-900">
                  <div>{b.order_id || b.id}</div>
                  <div className="text-[10px] text-slate-400">{b.awb_number}</div>
                </td>
                <td className="p-3">
                  <div>{b.consignee_name}</div>
                  <div className="text-[10px] text-slate-400">{b.dest_pin}</div>
                </td>
                <td className="p-3">
                  <div>{b.vendors?.name || "Carrier"}</div>
                  <div className="text-[10px] text-blue-600 font-mono">{b.carrier_docket_no || "Pending"}</div>
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {b.status}
                  </span>
                </td>
                <td className="p-3 font-semibold text-slate-800">
                  {formatINR(b.final_total)}
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => state.setPrintableBooking(b)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 text-white rounded hover:bg-slate-700 transition"
                  >
                    Print Label
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}


            {/* Tab 4: History & Live Tracker */}
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

            {/* Tab 5: Heavy Load Reverse Auction (RFQ) */}
            {state.shipperTab === "rfq" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <ShipperRfqSection
                  currentUser={state.currentUser}
                  rfqList={state.rfqList}
                  setRfqList={state.setRfqList}
                />
              </div>
            )}

            {/* Tab 6: Dynamic Origin Address Manager */}
            {state.shipperTab === "address" && (
              <ShipperAddressSection
                addresses={state.shipperAddresses}
                activeAddress={state.activeOriginAddress}
                onSelectAddress={(addr) => handlers.applyOriginAddress(addr)}
                onAddNewAddress={() => {
                  state.setEditingAddress(null);
                  state.setShowAddressModal(true);
                }}
                onEditAddress={(addr) => {
                  state.setEditingAddress(addr);
                  state.setShowAddressModal(true);
                }}
                isRealUser={isRealAuthLive}
              />
            )}

            {/* Tab 7: B2B Credit Agreements & KYC Facilities */}
            {state.shipperTab === "credit" && (
              <div className="space-y-6">
                <ShipperCreditStatusSection
                  agreements={state.creditAgreements}
                  onApplyNewCredit={() => state.setShowCreditApplyModal(true)}
                  isRealUser={isRealAuthLive}
                />
                <CombinedCreditLedgerSection
                  role="shipper"
                  currentUser={state.currentUser}
                  creditAgreements={state.creditAgreements}
                  creditLedger={state.creditLedger}
                />
              </div>
            )}
          </div>
        )}

        {/* VIEW C: CARRIER OPERATIONS HUB */}
        {(state.activeRole === "carrier" || state.activeRole === "vendor") && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Carrier Operations Hub</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Operating Fleet: <strong className="text-emerald-700 font-bold">{state.currentUser.company_name}</strong>
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

            {/* Carrier Sub-Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
              {[
                { id: "loads", label: "🎯 Available Loads (RFQs)" },
                { id: "tracking", label: "📋 Fleet Tracking & Bilty" },
                { id: "rates", label: "🏷️ Commercial Rate Cards" },
                { id: "billing", label: "💳 Platform Fee Billing" },
                { id: "credit", label: "📑 Credit Approvals & Exposure" },
                { id: "earnings", label: "🏦 Settlement Bank Profile" }
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
              <div className="space-y-6">
                <CarrierTrackingUrlConfigSection
                  currentUrl={state.carrierCustomTrackingUrl}
                  onSave={async (customUrl) => {
                    state.setCarrierCustomTrackingUrl(customUrl);
                    if (state.currentUser.isRealUser) {
                      await supabase.from("profiles").update({ custom_tracking_url: customUrl }).eq("id", state.currentUser.id);
                    }
                    alert("Tracking portal URL saved!");
                  }}
                />
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <CarrierOrdersSection
                    currentUser={state.currentUser}
                    bookings={state.bookings}
                    statusUpdateMap={state.statusUpdateMap}
                    setStatusUpdateMap={state.setStatusUpdateMap}
                    onUploadDocketFile={async (bId, file) => {
                      const compressed = await compressImageFile(file);
                      const path = `dockets/bilty-${bId}-${Date.now()}.jpg`;
                      const { data } = await supabase.storage.from("dockets").upload(path, compressed, { upsert: true });
                      const publicUrl = data ? supabase.storage.from("dockets").getPublicUrl(path).data.publicUrl : URL.createObjectURL(compressed);
                      state.setBookings(state.bookings.map((b) => b.id === bId ? { ...b, carrier_docket_doc_url: publicUrl } : b));
                      alert("Bilty uploaded successfully!");
                    }}
                    onUpdateShipmentStatus={async (bId) => {
                      const updateData = state.statusUpdateMap[bId];
                      if (!updateData) return;
                      state.setBookings(state.bookings.map((b) => b.id === bId ? { ...b, status: (updateData.status as any) || b.status } : b));
                      alert("Status updated!");
                    }}
                  />
                </div>
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

            {state.carrierTab === "billing" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <CarrierBillingSection
                  currentUser={state.currentUser}
                  invoices={state.invoices}
                  billingCycle={state.billingCycle}
                  setBillingCycle={state.setBillingCycle}
                  onOpenPayFeeModal={(inv) => {
                    state.setSelectedInvoiceToPay(inv);
                    state.setShowPayFeeModal(true);
                  }}
                />
              </div>
            )}

            {state.carrierTab === "credit" && (
              <div className="space-y-6">
                <CarrierCreditApprovalSection
                  agreements={state.creditAgreements}
                  onReviewAgreement={(aId, status, limit, reason) => {
                    state.setCreditAgreements(state.creditAgreements.map((a) => a.id === aId ? {
                      ...a, status, approved_limit: limit || a.requested_limit, rejection_reason: reason
                    } : a));
                    alert(`Agreement ${status}!`);
                  }}
                />
                <CombinedCreditLedgerSection
                  role="carrier"
                  currentUser={state.currentUser}
                  creditAgreements={state.creditAgreements}
                  creditLedger={state.creditLedger}
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

        {/* VIEW D: ADMIN SUPERVISORY OVERVIEW */}
        {state.activeRole === "admin" && !isRealAuthLive && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <AdminOverviewSection
              bookings={state.bookings}
              vendors={state.vendors}
              rateCards={state.rateCards}
            />
          </div>
        )}
      </div>

      {/* 3. Global Modals */}
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
          onOpenCreditApplyModal={() => state.setShowCreditApplyModal(true)}
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

      {state.showAddressModal && (
        <AddressModal
          isOpen={state.showAddressModal}
          onClose={() => {
            state.setShowAddressModal(false);
            state.setEditingAddress(null);
          }}
          onSave={handlers.handleSaveAddress}
          initialAddress={state.editingAddress}
        />
      )}

      {state.showCreditApplyModal && (
        <CreditApplyModal
          isOpen={state.showCreditApplyModal}
          onClose={() => state.setShowCreditApplyModal(false)}
          carriers={state.vendors}
          currentShipper={state.currentUser}
          onSubmitApplication={(carrierId, limit, termsDays, file, docName, storageUrl) => {
            const targetCarrier = state.vendors.find((v) => v.id === carrierId);
            const newAg: CreditAgreement = {
              id: `ca-${Date.now()}`,
              shipper_id: state.currentUser.id,
              shipper_name: state.currentUser.company_name || state.currentUser.full_name,
              carrier_id: carrierId,
              carrier_name: targetCarrier?.name || "National Transporter",
              document_url: storageUrl || URL.createObjectURL(file),
              document_name: docName,
              requested_limit: limit,
              approved_limit: 0,
              utilized_amount: 0,
              status: "Pending_Review",
              payment_terms_days: termsDays,
              submitted_at: new Date().toISOString()
            };
            state.setCreditAgreements([newAg, ...state.creditAgreements]);
          }}
        />
      )}

      {state.showPayFeeModal && state.selectedInvoiceToPay && (
        <PayPlatformFeeModal
          isOpen={state.showPayFeeModal}
          onClose={() => {
            state.setShowPayFeeModal(false);
            state.setSelectedInvoiceToPay(null);
          }}
          invoice={state.selectedInvoiceToPay}
          onPaySuccess={(invId, utr, method) => {
            state.setInvoices(state.invoices.map((inv) => inv.id === invId ? {
              ...inv,
              status: "Paid",
              payment_date: new Date().toISOString().split("T")[0],
              payment_ref: utr,
              payment_method: method
            } : inv));
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
          isOpen={state.showAuthModal}
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

      {/* 4. Global Statutory Compliance Footer */}
      <FooterSection
        openLegalModal={(tab) => {
          state.setLegalModalTab(tab);
          state.setShowLegalModal(true);
        }}
      />
    </div>
  );
}
