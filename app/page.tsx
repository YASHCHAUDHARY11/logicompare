"use client";

// ============================================================================
// PART 1 OF 7 — IMPORTS, TYPES, LOCAL HELPERS (NO NAMED EXPORTS)
// Requires:  npm install pdf-lib @supabase/supabase-js
// ============================================================================
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
// pdf-lib is loaded lazily inside compressAgreementFile() via dynamic import so it
// never bloats the initial bundle: const { PDFDocument } = await import("pdf-lib");

// ============================================================================
// 1. SUPABASE CLIENT (SESSION PERSISTENCE ENABLED)
// ============================================================================
const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// persistSession  -> keeps the JWT in localStorage so a refresh does NOT log the user out
// autoRefreshToken -> silently renews the access token before it expires
// detectSessionInUrl -> required so the password-recovery email link can sign the user in
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// ============================================================================
// 2. TYPESCRIPT DATA CONTRACTS
// ============================================================================
type RoleType = "shipper" | "carrier" | "vendor" | "admin";
type ModeEnv = "demo" | "live";
type BillingCycle = "weekly" | "monthly";
type InvoiceStatus = "Pending" | "Paid" | "Overdue";
type CarrierTabType = "loads" | "bids" | "tracking" | "rates" | "billing" | "earnings" | "credit";
type ShipperTabType = "search" | "matrix" | "shipments" | "history" | "rfq" | "address" | "credit";
type CreditStatus = "Not_Applied" | "Pending_Review" | "Approved" | "Rejected";
type AuthViewMode = "login" | "signup" | "forgot";
type SessionStatus = "restoring" | "ready";
type SettlementType = "direct_to_pay" | "direct_upi" | "corporate_credit";
type TransportMode = "surface" | "air" | "ftl";
type LegalTab = "terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact";

interface CreditAgreement {
  id: string;
  shipper_id: string;
  shipper_name: string;
  carrier_id: string;
  carrier_name: string;
  document_url: string;
  document_name: string;
  file_path?: string; // Supabase Storage object path inside the 'agreements' bucket
  original_size_kb?: number;
  compressed_size_kb?: number;
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
  is_demo?: boolean;
}

interface RateCard {
  id: string;
  vendor_id: string;
  origin_prefix: string;
  dest_prefix: string;
  mode: TransportMode;
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
  is_demo?: boolean;
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
  settlement_type?: SettlementType;
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

interface QuoteEngineOptions {
  // When true (live mode) the engine NEVER substitutes unrelated/demo cards.
  // If no verified carrier card matches the lane, it returns an empty array.
  liveMode: boolean;
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
  mode: TransportMode;
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

interface AgreementCompressionResult {
  file: File;
  originalSizeKB: number;
  compressedSizeKB: number;
  savedKB: number;
  wasCompressed: boolean;
}

// ============================================================================
// 3. FEE CONFIG & LOOKUP CACHE (needed by the rate engine below)
// ============================================================================
// NOTE: MERCHANT_DETAILS, demo entities and mock data live in PART 2.
const DEFAULT_FEE_CONFIG: FeeConfig = {
  percentage: 2,
  minFloorINR: 25,
  taxPercentage: 18,
  fovPercentage: 0.2,
  odaFlatCharge: 450
};

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
// 4. FORMATTING & VALIDATION UTILITIES
// ============================================================================
const formatINR = (val: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(val || 0);
};

function isValidPin(pin: string): boolean {
  return /^[1-9][0-9]{5}$/.test((pin || "").trim());
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

function hasCompleteDimensions(b: BoxItem): boolean {
  return Boolean(
    b.length && b.width && b.height && Number(b.length) > 0 && Number(b.width) > 0 && Number(b.height) > 0
  );
}

// Builds a "line1, city - pin" string; returns "" if the address is empty so the
// UI can prompt the shipper instead of showing a dummy address.
function formatPickupAddress(addr: AddressProfile | null | undefined): string {
  if (!addr || !addr.address_line1 || !addr.pincode) return "";
  return `${addr.address_line1}${addr.address_line2 ? `, ${addr.address_line2}` : ""}, ${addr.city} - ${addr.pincode}`;
}

// ============================================================================
// 5. CARRIER-SPECIFIC DYNAMIC TRACKING URL RESOLVER
// ============================================================================
function appendDocketToBase(base: string, docket: string): string {
  const b = base.trim();
  const d = encodeURIComponent(docket);
  return b.includes("=") || b.endsWith("/") ? `${b}${d}` : `${b}/${d}`;
}

function getOfficialCarrierTrackingUrl(carrier: Vendor | string, docketNumber: string): string {
  if (!docketNumber) return "#";
  const cleanDocket = docketNumber.trim();

  if (typeof carrier === "object" && carrier !== null) {
    if (carrier.custom_tracking_url && carrier.custom_tracking_url.trim()) {
      return appendDocketToBase(carrier.custom_tracking_url, cleanDocket);
    }
    if (carrier.tracking_base_url && carrier.tracking_base_url.trim()) {
      return appendDocketToBase(carrier.tracking_base_url, cleanDocket);
    }
  }

  const name = (typeof carrier === "string" ? carrier : carrier?.name || "").toLowerCase();
  const enc = encodeURIComponent(cleanDocket);
  if (name.includes("delhivery")) return `https://www.delhivery.com/track/package/${enc}`;
  if (name.includes("blue dart")) return `https://www.bluedart.com/tracking?trackNo=${enc}`;
  if (name.includes("safexpress")) return `https://www.safexpress.com/track-waybill?waybill=${enc}`;
  if (name.includes("gati")) return `https://www.gati.com/track-shipment/?docket=${enc}`;
  if (name.includes("tci")) return `https://www.tcifreight.com/tracking/${enc}`;
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

// ============================================================================
// 6. ZONE / PIN LOOKUP
// ============================================================================
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

// Single resolver used everywhere a 6-digit PIN must become city/state/hub.
// Tries the public postal API first, then falls back to the local zone table.
async function lookupPinZone(pin: string): Promise<{ city: string; state: string; hub: string }> {
  const clean = (pin || "").trim();
  if (clean.length !== 6) return getLocalFallbackZone(clean);
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`);
    const data = await res.json();
    if (data && data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      const city: string = po.District || po.Block || po.Name;
      return {
        city,
        state: po.State,
        hub: `HUB-${city.substring(0, 3).toUpperCase()}-01`
      };
    }
  } catch (err) {
    console.warn("Postal API lookup fallback:", clean, err);
  }
  return getLocalFallbackZone(clean);
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
      const pin: string = data[0].PostOffice[0].Pincode;
      const prefix = pin.substring(0, 3);
      clientLocationCache[clean] = prefix;
      return prefix;
    }
  } catch (err) {
    console.warn("Postal API lookup fallback:", clean, err);
  }
  return clean.substring(0, 3);
}

// ============================================================================
// 7. RATE CALCULATION ENGINE (STRICT LIVE-MODE ISOLATION)
// ============================================================================
function calculatePlatformFee(freightTotal: number, feeConfig: FeeConfig = DEFAULT_FEE_CONFIG): number {
  const dynamicFee = (freightTotal * feeConfig.percentage) / 100;
  return Math.max(feeConfig.minFloorINR, Math.round(dynamicFee));
}

function calculateQuotesForShipment(
  originPin: string,
  destPin: string,
  boxes: BoxItem[],
  declaredValue: number,
  mode: "all" | TransportMode,
  isOda: boolean,
  rateCardsList: RateCard[],
  vendorsList: Vendor[],
  feeConfig: FeeConfig = DEFAULT_FEE_CONFIG,
  agreementsList: CreditAgreement[] = [],
  options: QuoteEngineOptions = { liveMode: false }
): CalculatedQuote[] {
  if (!isValidPin(originPin) || !isValidPin(destPin)) return [];

  const actualWeight = boxes.reduce((acc, b) => acc + (Number(b.weight) || 0) * (Number(b.qty) || 1), 0);
  if (actualWeight <= 0) return [];

  const oPrefix = originPin.substring(0, 3);
  const dPrefix = destPin.substring(0, 3);
  const hasDimensions = boxes.some(hasCompleteDimensions);

  // In live mode, strip anything flagged as demo before matching.
  const eligibleCards = options.liveMode ? rateCardsList.filter((c) => !c.is_demo) : rateCardsList;

  const matchedCards = eligibleCards.filter((card) => {
    if (!card.is_active) return false;
    if (mode !== "all" && card.mode !== mode) return false;
    const originMatches =
      card.origin_prefix === "%" || card.origin_prefix === oPrefix || originPin.startsWith(card.origin_prefix);
    const destMatches =
      card.dest_prefix === "%" || card.dest_prefix === dPrefix || destPin.startsWith(card.dest_prefix);
    return originMatches && destMatches;
  });

  // LIVE: no fallback whatsoever -> caller shows "No verified carrier rates found for this route yet".
  // DEMO: preserve the old sandbox behaviour of showing sample cards.
  const activeCards =
    matchedCards.length > 0 ? matchedCards : options.liveMode ? [] : eligibleCards.slice(0, 5);

  const quotes: CalculatedQuote[] = [];

  for (const card of activeCards) {
    const v: Vendor | undefined =
      card.vendors || vendorsList.find((vend) => vend.id === card.vendor_id) || (options.liveMode ? undefined : vendorsList[0]);
    // A card without a resolvable verified carrier is never shown in live mode.
    if (!v) continue;
    if (options.liveMode && v.is_demo) continue;

    const divisor = card.mode === "air" ? 5000 : 4500;

    let volumetricWeight = 0;
    if (hasDimensions) {
      volumetricWeight = boxes.reduce((acc, b) => {
        if (!hasCompleteDimensions(b)) return acc;
        const volKg = (Number(b.length) * Number(b.width) * Number(b.height)) / divisor;
        return acc + volKg * (Number(b.qty) || 1);
      }, 0);
    }

    const billableWeight = hasDimensions
      ? Math.max(actualWeight, Math.round(volumetricWeight * 10) / 10, Number(card.min_weight_kg) || 0)
      : Math.max(actualWeight, Number(card.min_weight_kg) || 0);

    const baseFreight = Number(card.base_rate) + billableWeight * Number(card.per_kg_rate);
    const fuelSurcharge = (baseFreight * Number(card.fuel_surcharge_pct)) / 100;
    const docket = Number(card.docket_charge);
    const fov = Math.max(50, (Number(declaredValue) * Number(card.fov_pct || feeConfig.fovPercentage)) / 100);
    const handling = billableWeight * Number(card.handling_per_kg || 0);
    const oda = isOda ? Number(card.oda_charge || feeConfig.odaFlatCharge) : 0;

    const subtotal = baseFreight + fuelSurcharge + docket + fov + handling + oda;
    const gst = subtotal * (feeConfig.taxPercentage / 100);
    const freightDirectTotal = subtotal + gst;
    const convenienceFee = calculatePlatformFee(freightDirectTotal, feeConfig);

    const matchingAgreement = agreementsList.find(
      (a) => a.carrier_id === v.id && a.status === "Approved" && (!options.liveMode || !a.is_demo)
    );
    const creditAvailable = Boolean(
      matchingAgreement &&
        matchingAgreement.approved_limit - matchingAgreement.utilized_amount >= freightDirectTotal + convenienceFee
    );

    quotes.push({
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
    });
  }

  return quotes;
}

// ============================================================================
// 8. IN-BROWSER FILE COMPRESSION (IMAGES + CREDIT AGREEMENT PDFs)
// ============================================================================
async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    img.onerror = () => resolve(file);
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
          resolve(
            blob && blob.size < file.size
              ? new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" })
              : file
          );
        },
        "image/jpeg",
        0.75
      );
    };
    reader.readAsDataURL(file);
  });
}

// Compresses a credit agreement before it is uploaded to the Supabase 'agreements' bucket.
//  - Files <= 1 MB are returned untouched.
//  - Images are re-encoded as JPEG (max 1200px wide, quality 0.75).
//  - PDFs are re-serialised with pdf-lib using object streams.
// HONEST NOTE: pdf-lib's useObjectStreams repacks the structure (xref + object overhead).
// It can shrink PDFs with many small objects, but it does NOT downsample embedded
// images, so a scanned PDF may barely shrink. The original is kept whenever the result isn't smaller.
async function compressAgreementFile(file: File): Promise<AgreementCompressionResult> {
  const originalSizeKB = Math.round(file.size / 1024);
  const untouched: AgreementCompressionResult = {
    file,
    originalSizeKB,
    compressedSizeKB: originalSizeKB,
    savedKB: 0,
    wasCompressed: false
  };

  if (file.size <= 1024 * 1024) return untouched;

  if (file.type.startsWith("image/")) {
    const compressedImage = await compressImageFile(file);
    const compressedSizeKB = Math.round(compressedImage.size / 1024);
    return {
      file: compressedImage,
      originalSizeKB,
      compressedSizeKB,
      savedKB: Math.max(0, originalSizeKB - compressedSizeKB),
      wasCompressed: compressedImage !== file
    };
  }

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const compressedBytes = await pdfDoc.save({ useObjectStreams: true });

      // Copy into a plain ArrayBuffer so the Blob constructor is happy under strict TS.
      const plainBuffer = new ArrayBuffer(compressedBytes.byteLength);
      new Uint8Array(plainBuffer).set(compressedBytes);
      const blob = new Blob([plainBuffer], { type: "application/pdf" });

      if (blob.size >= file.size) return untouched;

      const compressedFile = new File([blob], file.name, {
        type: "application/pdf",
        lastModified: Date.now()
      });
      const compressedSizeKB = Math.round(compressedFile.size / 1024);
      return {
        file: compressedFile,
        originalSizeKB,
        compressedSizeKB,
        savedKB: Math.max(0, originalSizeKB - compressedSizeKB),
        wasCompressed: true
      };
    } catch (err) {
      console.warn("Client-side PDF minification fallback (original uploaded):", err);
    }
  }

  return untouched;
}

// Builds a safe Storage object path: credit-agreements/<shipperId>/<timestamp>-<name>
function buildAgreementStoragePath(shipperId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `credit-agreements/${shipperId}/${Date.now()}-${safe}`;
}

// ============================================================================
// END OF PART 1 OF 7
// ============================================================================
// ============================================================================
// PART 2 OF 7 — GLOBAL CONFIG, DEMO DATA, APP ENGINE (PERSISTENT AUTH), AUTH MODAL
// Paste directly after Part 1. No named exports.
// ============================================================================

// ============================================================================
// 9. MERCHANT CONFIGURATION
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

// ============================================================================
// 10. DEMO SANDBOX DATA (ONLY EVER USED WHEN modeEnv === "demo")
// Every record is tagged is_demo: true. Live mode never reads these constants.
// ============================================================================
const DEMO_INIT_ORDER_ID = "LC-894210";
const DEMO_INIT_CARRIER_DOCKET = "148920194821";
const DEMO_SHIPPER_ID = "demo-shipper-uuid";
const DEMO_CARRIER_VENDOR_ID = "11111111-1111-1111-1111-111111111111";

const DEMO_SHIPPER_ADDRESS: AddressProfile = {
  id: "addr-demo-origin",
  label: "Primary Central Hub (Demo)",
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
  id: DEMO_SHIPPER_ID,
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
  vendor_id: DEMO_CARRIER_VENDOR_ID,
  isRealUser: false,
  custom_tracking_url: "https://www.delhivery.com/track/package/"
};

const DEMO_VENDORS: Vendor[] = [
  {
    id: DEMO_CARRIER_VENDOR_ID,
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
    custom_tracking_url: "https://www.delhivery.com/track/package/",
    is_demo: true
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
    custom_tracking_url: "https://www.bluedart.com/tracking?trackNo=",
    is_demo: true
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
    custom_tracking_url: "https://www.tcifreight.com/tracking/",
    is_demo: true
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
    custom_tracking_url: "https://www.gati.com/track-shipment/?docket=",
    is_demo: true
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
    tracking_base_url: "https://www.safexpress.com/track-waybill?waybill=",
    custom_tracking_url: "https://www.safexpress.com/track-waybill?waybill=",
    is_demo: true
  }
];

const DEMO_RATE_CARDS: RateCard[] = [
  {
    id: "rc-del-bom-surface",
    vendor_id: DEMO_CARRIER_VENDOR_ID,
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
    is_active: true,
    is_demo: true
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
    is_active: true,
    is_demo: true
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
    is_active: true,
    is_demo: true
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
    is_active: true,
    is_demo: true
  }
];

const DEMO_INVOICES: PlatformInvoice[] = [
  {
    id: "inv-2026-w42",
    invoice_number: "INV-LC-2026-W42",
    carrier_id: DEMO_CARRIER_VENDOR_ID,
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
    carrier_id: DEMO_CARRIER_VENDOR_ID,
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
  },
  {
    id: "inv-2026-m09",
    invoice_number: "INV-LC-2026-M09",
    carrier_id: DEMO_CARRIER_VENDOR_ID,
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
    payment_method: "Corporate NEFT",
    is_demo: true
  }
];

const DEMO_CREDIT_AGREEMENTS: CreditAgreement[] = [
  {
    id: "ca-apex-delhivery-01",
    shipper_id: DEMO_SHIPPER_ID,
    shipper_name: "Apex Retail Solutions Pvt Ltd",
    carrier_id: DEMO_CARRIER_VENDOR_ID,
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
  },
  {
    id: "ca-apex-bluedart-02",
    shipper_id: DEMO_SHIPPER_ID,
    shipper_name: "Apex Retail Solutions Pvt Ltd",
    carrier_id: "22222222-2222-2222-2222-222222222222",
    carrier_name: "Blue Dart Aviation",
    document_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    document_name: "Apex_BlueDart_Air_Credit_Facility.pdf",
    requested_limit: 250000,
    approved_limit: 0,
    utilized_amount: 0,
    status: "Pending_Review",
    payment_terms_days: 30,
    submitted_at: "2026-10-20T09:15:00Z",
    is_demo: true
  }
];

const DEMO_CREDIT_LEDGER: CreditLedgerEntry[] = [
  {
    id: "c-led-01",
    booking_id: "book-demo-01",
    order_ref: "LC-894210",
    carrier_docket_no: "148920194821",
    shipper_id: DEMO_SHIPPER_ID,
    shipper_name: "Apex Retail Solutions Pvt Ltd",
    carrier_id: DEMO_CARRIER_VENDOR_ID,
    carrier_name: "Delhivery B2B Express",
    amount: 38400,
    due_date: "2026-11-05",
    status: "Unpaid",
    created_at: "2026-10-21T11:00:00Z",
    is_demo: true
  },
  {
    id: "c-led-02",
    booking_id: "book-demo-02",
    order_ref: "LC-772194",
    carrier_docket_no: "148920188432",
    shipper_id: DEMO_SHIPPER_ID,
    shipper_name: "Apex Retail Solutions Pvt Ltd",
    carrier_id: DEMO_CARRIER_VENDOR_ID,
    carrier_name: "Delhivery B2B Express",
    amount: 104400,
    due_date: "2026-11-08",
    status: "Unpaid",
    created_at: "2026-10-24T14:30:00Z",
    is_demo: true
  }
];

// One sample consignment so the "Sample Tracking Identifiers" on the landing page resolve in demo mode.
const DEMO_BOOKINGS: Booking[] = [
  {
    id: "book-demo-01",
    order_id: DEMO_INIT_ORDER_ID,
    awb_number: DEMO_INIT_CARRIER_DOCKET,
    carrier_docket_no: DEMO_INIT_CARRIER_DOCKET,
    carrier_portal_url: `https://www.delhivery.com/track/package/${DEMO_INIT_CARRIER_DOCKET}`,
    shipper_id: DEMO_SHIPPER_ID,
    vendor_id: DEMO_CARRIER_VENDOR_ID,
    rate_card_id: "rc-del-bom-surface",
    shipper_name: "Apex Retail Solutions Pvt Ltd",
    shipper_phone: "+91 98110 23456",
    shipper_email: "dispatch@apexlogistics.in",
    shipper_gstin: "07AAACA1234A1Z5",
    pickup_address: "Plot 42, Okhla Industrial Area Phase-III, South Delhi - 110020",
    pickup_pincode: "110020",
    consignee_name: "Prime Electronics Retail",
    consignee_phone: "+91 98200 44556",
    consignee_gstin: "27AAACP9988G1ZK",
    delivery_address: "Warehouse 4B, Bhiwandi Logistics Park, Mumbai",
    origin_pin: "110020",
    dest_pin: "400001",
    mode: "surface",
    boxes: [
      { id: "demo-b1", qty: 2, weight: 20, length: 45, width: 35, height: 30 },
      { id: "demo-b2", qty: 1, weight: 15, length: null, width: null, height: null }
    ],
    declared_value: 75000,
    actual_weight: 55,
    volumetric_weight: 31.5,
    billable_weight: 55,
    cost_breakdown: {
      base: 1092.5,
      fuel: 131.1,
      docket: 120,
      fov: 150,
      handling: 82.5,
      oda: 0,
      gst: 283.7,
      freightSubtotal: 1859.8,
      platformConvenienceFee: 37,
      total: 1896.8,
      settlement_type: "direct_to_pay",
      payment_ref: "DIRECT-TO-PAY-POD"
    },
    final_total: 1896.8,
    status: "In Transit",
    tracking_history: [
      {
        status: "Booked",
        location: "Origin Hub (110020)",
        timestamp: "2026-10-26T09:30:00Z",
        remarks: "Order Ref LC-894210 generated. Carrier Docket 148920194821 assigned."
      },
      {
        status: "Picked Up",
        location: "Okhla Industrial Area, Delhi",
        timestamp: "2026-10-26T15:10:00Z",
        remarks: "Consignment picked up from shipper dock."
      },
      {
        status: "In Transit",
        location: "Jaipur Linehaul Gateway",
        timestamp: "2026-10-27T22:40:00Z",
        remarks: "Departed linehaul hub toward Mumbai MMR."
      }
    ],
    created_at: "2026-10-26T09:30:00Z",
    vendors: DEMO_VENDORS[0],
    is_demo: true
  }
];

const NEUTRAL_BOX: BoxItem = { id: "box-1", qty: 1, weight: 10, length: null, width: null, height: null };
const DEMO_BOXES: BoxItem[] = [
  { id: "box-1", qty: 2, weight: 20, length: 45, width: 35, height: 30 },
  { id: "box-2", qty: 1, weight: 15, length: null, width: null, height: null }
];
const EMPTY_ZONE: PinLookupResult = { city: "", state: "", hub: "", loading: false };

type StatusUpdateEntry = {
  status: string;
  location: string;
  remarks: string;
  docketNo?: string;
  docUrl?: string;
  isUploading?: boolean;
};

type StatusUpdateMap = Record<string, StatusUpdateEntry>;

type CreditApplicationPayload = {
  carrierId: string;
  limit: number;
  termsDays: number;
  docName: string;
  documentUrl: string; // may be "" for private-bucket uploads; file_path is the source of truth in live mode
  filePath?: string;
  originalSizeKB?: number;
  compressedSizeKB?: number;
};

// ============================================================================
// 11. LIGHTWEIGHT SESSION-RESTORE LOADER (shown instead of flashing demo/landing)
// ============================================================================
const SessionLoadingScreen: FC = () => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-white">
    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse">
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1" />
      </svg>
    </div>
    <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
      <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></span>
      <span>Restoring your secure session...</span>
    </div>
  </div>
);

// ============================================================================
// 12. APPLICATION STATE ENGINE & HOOK CONTROLLER
//
// DATA ISOLATION MODEL
// Demo data and live data live in SEPARATE state slots (demoX / liveX). The
// public `vendors`, `rateCards`, `bookings`... values are simply a view onto the
// slot matching modeEnv, and the matching setter writes to the same slot.
// Live slots start EMPTY and are filled only from Supabase, scoped per user.
// ============================================================================
function useAppEngine() {
  // ---- Session / navigation ----
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("restoring");
  const [activeRole, setActiveRole] = useState<RoleType | "landing">("landing");
  const [modeEnv, setModeEnv] = useState<ModeEnv>("demo");
  const [highVolumeMode, setHighVolumeMode] = useState<boolean>(true);
  const [shipperTab, setShipperTab] = useState<ShipperTabType>("search");
  const [carrierTab, setCarrierTab] = useState<CarrierTabType>("tracking");

  // ---- Auth ----
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_SHIPPER);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const modeRef = useRef<ModeEnv>("demo");
  modeRef.current = modeEnv;
  const loadedUserRef = useRef<string | null>(null);
  const inflightProfileRef = useRef<Map<string, Promise<void>>>(new Map());
  const liveProfileRef = useRef<UserProfile | null>(null);

  // ---- Carrier public tracking URL ----
  const [carrierCustomTrackingUrl, setCarrierCustomTrackingUrl] = useState<string>("");

  // ---- Addresses ----
  const [shipperAddresses, setShipperAddresses] = useState<AddressProfile[]>([DEMO_SHIPPER_ADDRESS]);
  const [activeOriginAddress, setActiveOriginAddress] = useState<AddressProfile | null>(DEMO_SHIPPER_ADDRESS);
  const [showAddressModal, setShowAddressModal] = useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<AddressProfile | null>(null);

  // ---- Billing config ----
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("weekly");
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(DEFAULT_FEE_CONFIG);
  const [showPayFeeModal, setShowPayFeeModal] = useState<boolean>(false);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<PlatformInvoice | null>(null);
  const [showCreditApplyModal, setShowCreditApplyModal] = useState<boolean>(false);

  // ---- Isolated data slots (demo vs live) ----
  const [demoVendors, setDemoVendors] = useState<Vendor[]>(DEMO_VENDORS);
  const [liveVendors, setLiveVendors] = useState<Vendor[]>([]);
  const [demoRateCards, setDemoRateCards] = useState<RateCard[]>(DEMO_RATE_CARDS);
  const [liveRateCards, setLiveRateCards] = useState<RateCard[]>([]);
  const [demoBookings, setDemoBookings] = useState<Booking[]>(DEMO_BOOKINGS);
  const [liveBookings, setLiveBookings] = useState<Booking[]>([]);
  const [demoRfqList, setDemoRfqList] = useState<RfqBid[]>([]);
  const [liveRfqList, setLiveRfqList] = useState<RfqBid[]>([]);
  const [demoInvoices, setDemoInvoices] = useState<PlatformInvoice[]>(DEMO_INVOICES);
  const [liveInvoices, setLiveInvoices] = useState<PlatformInvoice[]>([]);
  const [demoAgreements, setDemoAgreements] = useState<CreditAgreement[]>(DEMO_CREDIT_AGREEMENTS);
  const [liveAgreements, setLiveAgreements] = useState<CreditAgreement[]>([]);
  const [demoLedger, setDemoLedger] = useState<CreditLedgerEntry[]>(DEMO_CREDIT_LEDGER);
  const [liveLedger, setLiveLedger] = useState<CreditLedgerEntry[]>([]);
  const [liveDataLoading, setLiveDataLoading] = useState<boolean>(false);

  const isLive = modeEnv === "live";
  const vendors = isLive ? liveVendors : demoVendors;
  const setVendors = isLive ? setLiveVendors : setDemoVendors;
  const rateCards = isLive ? liveRateCards : demoRateCards;
  const setRateCards = isLive ? setLiveRateCards : setDemoRateCards;
  const bookings = isLive ? liveBookings : demoBookings;
  const setBookings = isLive ? setLiveBookings : setDemoBookings;
  const rfqList = isLive ? liveRfqList : demoRfqList;
  const setRfqList = isLive ? setLiveRfqList : setDemoRfqList;
  const invoices = isLive ? liveInvoices : demoInvoices;
  const setInvoices = isLive ? setLiveInvoices : setDemoInvoices;
  const creditAgreements = isLive ? liveAgreements : demoAgreements;
  const setCreditAgreements = isLive ? setLiveAgreements : setDemoAgreements;
  const creditLedger = isLive ? liveLedger : demoLedger;
  const setCreditLedger = isLive ? setLiveLedger : setDemoLedger;

  // ---- Modals ----
  const [showLegalModal, setShowLegalModal] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab>("terms");
  const [showCitySearchModal, setShowCitySearchModal] = useState<"origin" | "dest" | null>(null);
  const [showAddRateCardModal, setShowAddRateCardModal] = useState<boolean>(false);
  const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<CalculatedQuote | null>(null);
  const [printableBooking, setPrintableBooking] = useState<Booking | null>(null);
  const [batchPrintBookings, setBatchPrintBookings] = useState<Booking[] | null>(null);

  // ---- Single calculator ----
  const [originPin, setOriginPin] = useState<string>(DEMO_SHIPPER_ADDRESS.pincode);
  const [destPin, setDestPin] = useState<string>("400001");
  const [isOda, setIsOda] = useState<boolean>(false);
  const [declaredValue, setDeclaredValue] = useState<number>(75000);
  const [selectedMode, setSelectedMode] = useState<"all" | TransportMode>("all");
  const [boxes, setBoxes] = useState<BoxItem[]>(DEMO_BOXES);
  const [selectedBoxFor3D, setSelectedBoxFor3D] = useState<number>(0);
  const [pickupAddress, setPickupAddress] = useState<string>(formatPickupAddress(DEMO_SHIPPER_ADDRESS));

  // ---- Bulk CSV ----
  const [bulkManifestList, setBulkManifestList] = useState<BulkManifestRow[]>([]);
  const [bulkCsvFileName, setBulkCsvFileName] = useState<string>("");
  const [bulkUploadError, setBulkUploadError] = useState<string>("");
  const [bulkSettlementMethod, setBulkSettlementMethod] = useState<SettlementType>("direct_to_pay");
  const [bulkConsolidatedUtr, setBulkConsolidatedUtr] = useState<string>("");
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // ---- Tracking ----
  const [globalSearchInput, setGlobalSearchInput] = useState<string>("");
  const [landingTrackingInput, setLandingTrackingInput] = useState<string>("");
  const [activeTrackingAwb, setActiveTrackingAwb] = useState<string>(DEMO_INIT_ORDER_ID);
  const [trackingSearchInput, setTrackingSearchInput] = useState<string>(DEMO_INIT_ORDER_ID);

  // ---- Zones ----
  const [originZoneData, setOriginZoneData] = useState<PinLookupResult>({
    city: DEMO_SHIPPER_ADDRESS.city,
    state: DEMO_SHIPPER_ADDRESS.state,
    hub: "HUB-SOU-01",
    loading: false
  });
  const [destZoneData, setDestZoneData] = useState<PinLookupResult>({
    city: "Mumbai",
    state: "Maharashtra",
    hub: "BOM-CENTRAL",
    loading: false
  });

  const [statusUpdateMap, setStatusUpdateMap] = useState<StatusUpdateMap>({});

  // --------------------------------------------------------------------------
  // Origin address application (null => live shipper has no address yet)
  // --------------------------------------------------------------------------
  const applyOriginAddress = useCallback((addr: AddressProfile | null) => {
    setActiveOriginAddress(addr);
    if (!addr) {
      setOriginPin("");
      setPickupAddress("");
      setOriginZoneData(EMPTY_ZONE);
      return;
    }
    setOriginPin(addr.pincode);
    setPickupAddress(formatPickupAddress(addr));
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
    // First address a live shipper ever saves is always the default.
    const makeDefault = address.is_default || updatedList.length === 0;
    const normalized: AddressProfile = { ...address, is_default: makeDefault };
    if (makeDefault) updatedList = updatedList.map((a) => ({ ...a, is_default: false }));
    if (existingIndex >= 0) updatedList[existingIndex] = normalized;
    else updatedList.push(normalized);

    if (isLive && currentUser.isRealUser) {
      const { error } = await supabase
        .from("profiles")
        .update({ saved_addresses: updatedList })
        .eq("id", currentUser.id);
      if (error) {
        alert(`Could not save address to your account: ${error.message}`);
        return;
      }
      setCurrentUser((u) => ({ ...u, saved_addresses: updatedList }));
    }

    setShipperAddresses(updatedList);
    if (makeDefault || activeOriginAddress?.id === normalized.id) applyOriginAddress(normalized);
  };

  // --------------------------------------------------------------------------
  // Mode entry points
  // --------------------------------------------------------------------------
  const enterDemoMode = useCallback(
    (role: RoleType | "landing") => {
      modeRef.current = "demo";
      setModeEnv("demo");
      const carrierRole = role === "carrier" || role === "vendor";
      setCurrentUser(carrierRole ? DEMO_CARRIER : DEMO_SHIPPER);
      setActiveRole(role);
      setShipperAddresses([DEMO_SHIPPER_ADDRESS]);
      applyOriginAddress(DEMO_SHIPPER_ADDRESS);
      setDestPin("400001");
      setDestZoneData({ city: "Mumbai", state: "Maharashtra", hub: "BOM-CENTRAL", loading: false });
      setBoxes(DEMO_BOXES);
      setDeclaredValue(75000);
      setIsOda(false);
      setCarrierCustomTrackingUrl(DEMO_CARRIER.custom_tracking_url || "");
      setActiveTrackingAwb(DEMO_INIT_ORDER_ID);
      setTrackingSearchInput(DEMO_INIT_ORDER_ID);
    },
    [applyOriginAddress]
  );

  const enterLiveMode = useCallback(
    (profile: UserProfile) => {
      const role: RoleType = profile.role === "vendor" ? "carrier" : profile.role;
      liveProfileRef.current = profile;
      modeRef.current = "live";
      setModeEnv("live");
      setCurrentUser(profile);
      setActiveRole(role);
      setShipperTab("search");
      setCarrierTab("tracking");

      // REAL ADDRESS ISOLATION: only the user's own saved addresses. Empty => UI prompts to add one.
      const addrs = profile.saved_addresses || [];
      setShipperAddresses(addrs);
      applyOriginAddress(addrs.find((a) => a.is_default) || addrs[0] || null);

      setDestPin("");
      setDestZoneData(EMPTY_ZONE);
      setBoxes([{ ...NEUTRAL_BOX }]);
      setDeclaredValue(50000);
      setIsOda(false);
      setSelectedMode("all");
      setCarrierCustomTrackingUrl(profile.custom_tracking_url || "");
      setBulkManifestList([]);
      setBulkCsvFileName("");
      setBulkUploadError("");
      setSelectedQuoteForBooking(null);
      setPrintableBooking(null);
      setBatchPrintBookings(null);
      setActiveTrackingAwb("");
      setTrackingSearchInput("");
      setStatusUpdateMap({});
    },
    [applyOriginAddress]
  );

  // --------------------------------------------------------------------------
  // Live data fetch (strictly scoped to the signed-in user)
  // --------------------------------------------------------------------------
  const fetchLiveData = useCallback(async (profile: UserProfile) => {
    setLiveDataLoading(true);
    const isCarrierUser = profile.role === "carrier" || profile.role === "vendor";
    const vid = profile.vendor_id || profile.id;
    try {
      let rateQ = supabase.from("rate_cards").select("*, vendors(*)");
      rateQ = isCarrierUser ? rateQ.eq("vendor_id", vid) : rateQ.eq("is_active", true);

      let bookQ = supabase.from("bookings").select("*, vendors(*)").order("created_at", { ascending: false });
      bookQ = isCarrierUser ? bookQ.eq("vendor_id", vid) : bookQ.eq("shipper_id", profile.id);

      let rfqQ = supabase.from("rfq_bids").select("*").order("created_at", { ascending: false });
      rfqQ = isCarrierUser ? rfqQ.eq("status", "Open") : rfqQ.eq("shipper_name", profile.company_name);

      let agrQ = supabase.from("credit_agreements").select("*").order("submitted_at", { ascending: false });
      agrQ = isCarrierUser ? agrQ.eq("carrier_id", vid) : agrQ.eq("shipper_id", profile.id);

      let ledQ = supabase.from("credit_ledger").select("*").order("created_at", { ascending: false });
      ledQ = isCarrierUser ? ledQ.eq("carrier_id", vid) : ledQ.eq("shipper_id", profile.id);

      const invQ = isCarrierUser
        ? supabase.from("platform_invoices").select("*").eq("carrier_id", vid).order("period_start", { ascending: false })
        : null;

      const [vRes, rRes, bRes, qRes, aRes, lRes, iRes] = await Promise.all([
        supabase.from("vendors").select("*"),
        rateQ,
        bookQ,
        rfqQ,
        agrQ,
        ledQ,
        invQ ? invQ : Promise.resolve({ data: [] as PlatformInvoice[], error: null })
      ]);

      const firstError = [vRes, rRes, bRes, qRes, aRes, lRes, iRes].find((r: any) => r && r.error);
      if (firstError) console.warn("Live data sync warning:", (firstError as any).error?.message);

      setLiveVendors((vRes.data || []) as Vendor[]);
      setLiveRateCards((rRes.data || []) as RateCard[]);
      setLiveBookings((bRes.data || []) as Booking[]);
      setLiveRfqList((qRes.data || []) as RfqBid[]);
      setLiveAgreements((aRes.data || []) as CreditAgreement[]);
      setLiveLedger((lRes.data || []) as CreditLedgerEntry[]);
      setLiveInvoices((iRes.data || []) as PlatformInvoice[]);
    } catch (err) {
      console.warn("Supabase data synchronization warning:", err);
    } finally {
      setLiveDataLoading(false);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    if (modeRef.current === "live" && liveProfileRef.current) {
      await fetchLiveData(liveProfileRef.current);
    }
  }, [fetchLiveData]);

  // --------------------------------------------------------------------------
  // Profile loading (single source of truth for turning a session into a user)
  // --------------------------------------------------------------------------
  const loadProfile = useCallback(
    (user: SupabaseUser, force: boolean = false): Promise<void> => {
      if (!force && loadedUserRef.current === user.id) return Promise.resolve();
      const inflight = inflightProfileRef.current.get(user.id);
      if (inflight) return inflight;

      const task = (async () => {
        try {
          const { data: row, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
          if (error) console.warn("Profile fetch warning:", error.message);

          let pData: any = row;
          if (!pData) {
            // First sign-in after signup (e.g. after email confirmation): build the profile
            // from the metadata captured at registration. Role is whitelisted, never "admin".
            const meta = (user.user_metadata || {}) as Record<string, any>;
            const newRow = {
              id: user.id,
              email: user.email || "",
              full_name: meta.full_name || "",
              company_name: meta.company_name || "",
              gstin: meta.gstin || "",
              phone: meta.phone || "",
              role: meta.role === "carrier" ? "carrier" : "shipper",
              saved_addresses: [] as AddressProfile[]
            };
            const { data: inserted, error: insErr } = await supabase
              .from("profiles")
              .upsert([newRow])
              .select()
              .maybeSingle();
            if (insErr) console.warn("Profile create warning:", insErr.message);
            pData = inserted || newRow;
          }

          const isCarrier = pData.role === "carrier" || pData.role === "vendor";
          const resolvedRole: RoleType = isCarrier ? "carrier" : "shipper";
          const profile: UserProfile = {
            id: user.id,
            email: user.email || pData.email || "",
            full_name: pData.full_name || (user.email ? user.email.split("@")[0] : "Account Owner"),
            company_name: pData.company_name || pData.full_name || user.email || "My Company",
            gstin: pData.gstin || "",
            phone: pData.phone || "",
            role: resolvedRole,
            vendor_id: isCarrier ? user.id : undefined,
            isRealUser: true,
            saved_addresses: Array.isArray(pData.saved_addresses) ? pData.saved_addresses : [],
            custom_tracking_url: pData.custom_tracking_url || ""
          };

          // A carrier needs a vendors row (id = user id) so its rate cards and bookings link up.
          // ignoreDuplicates keeps any existing/verified row untouched.
          if (isCarrier) {
            const { error: vErr } = await supabase.from("vendors").upsert(
              [
                {
                  id: user.id,
                  name: profile.company_name,
                  badge: "New Carrier",
                  rating: 0,
                  gstin: profile.gstin,
                  fleet_types: []
                }
              ],
              { onConflict: "id", ignoreDuplicates: true }
            );
            if (vErr) console.warn("Vendor row ensure warning:", vErr.message);
          }

          loadedUserRef.current = user.id;
          enterLiveMode(profile);
          await fetchLiveData(profile);
        } catch (err) {
          console.warn("Profile restore failure:", err);
        } finally {
          inflightProfileRef.current.delete(user.id);
        }
      })();

      inflightProfileRef.current.set(user.id, task);
      return task;
    },
    [enterLiveMode, fetchLiveData]
  );

  const returnToLoggedOut = useCallback(() => {
    loadedUserRef.current = null;
    liveProfileRef.current = null;
    setAuthSession(null);
    setPasswordRecoveryPending(false);
    // Wipe every live slot so nothing from the previous account can ever render.
    setLiveVendors([]);
    setLiveRateCards([]);
    setLiveBookings([]);
    setLiveRfqList([]);
    setLiveInvoices([]);
    setLiveAgreements([]);
    setLiveLedger([]);
    setStatusUpdateMap({});
    setBulkManifestList([]);
    enterDemoMode("landing");
  }, [enterDemoMode]);

  // --------------------------------------------------------------------------
  // PERSISTENT AUTH: getSession() on mount + onAuthStateChange (subscribed once)
  // --------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const initSession = async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();
        if (cancelled) return;
        setAuthSession(session);
        if (session?.user) await loadProfile(session.user);
      } catch (err) {
        console.warn("Session restore fallback:", err);
      } finally {
        if (!cancelled) setSessionStatus("ready");
      }
    };
    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthSession(session);

      if (event === "PASSWORD_RECOVERY") setPasswordRecoveryPending(true);

      if (event === "SIGNED_OUT") {
        // Only an explicit sign-out (or a revoked/expired refresh token) lands here.
        if (modeRef.current === "live") returnToLoggedOut();
        return;
      }

      // TOKEN_REFRESHED only updates the stored session; the user stays logged in untouched.
      if (
        session?.user &&
        (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "PASSWORD_RECOVERY")
      ) {
        const u = session.user;
        // Never await Supabase calls inside this callback (deadlock risk): defer one tick.
        setTimeout(() => {
          void loadProfile(u);
        }, 0);
      }
    });

    return () => {
      cancelled = true;
      authListener?.subscription?.unsubscribe();
    };
  }, [loadProfile, returnToLoggedOut]);

  // --------------------------------------------------------------------------
  // PIN zone resolvers
  // --------------------------------------------------------------------------
  useEffect(() => {
    const pin = originPin.trim();
    if (pin.length !== 6) return;
    let cancelled = false;
    setOriginZoneData((prev) => ({ ...prev, loading: true }));
    lookupPinZone(pin).then((z) => {
      if (!cancelled) setOriginZoneData({ ...z, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [originPin]);

  useEffect(() => {
    const pin = destPin.trim();
    if (pin.length !== 6) return;
    let cancelled = false;
    setDestZoneData((prev) => ({ ...prev, loading: true }));
    lookupPinZone(pin).then((z) => {
      if (!cancelled) setDestZoneData({ ...z, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [destPin]);

  // --------------------------------------------------------------------------
  // Navigation handlers
  // --------------------------------------------------------------------------
  const handleGlobalSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!globalSearchInput.trim()) return;
    setActiveTrackingAwb(globalSearchInput.trim());
    setTrackingSearchInput(globalSearchInput.trim());
    setActiveRole("shipper");
    setShipperTab("history");
    setGlobalSearchInput("");
  };

  const handleRoleSwitch = (role: RoleType | "landing") => {
    if (modeEnv === "live" && currentUser.isRealUser) {
      if (role !== "landing" && role !== currentUser.role && !(role === "carrier" && currentUser.role === "vendor")) {
        alert(`Access Restricted: Your verified account is locked to the ${currentUser.role.toUpperCase()} workspace.`);
        return;
      }
      setActiveRole(role);
      return;
    }
    // Demo sandbox: free switching between consoles.
    setActiveRole(role);
    if (role === "shipper") setCurrentUser(DEMO_SHIPPER);
    if (role === "carrier" || role === "vendor") setCurrentUser(DEMO_CARRIER);
  };

  const handleModeToggle = () => {
    if (modeEnv === "demo") {
      if (!authSession || !liveProfileRef.current) {
        setShowAuthModal(true);
      } else {
        enterLiveMode(liveProfileRef.current);
      }
    } else {
      enterDemoMode(activeRole === "carrier" || activeRole === "vendor" ? "carrier" : "shipper");
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign-out warning:", err);
    }
    returnToLoggedOut();
  };

  // --------------------------------------------------------------------------
  // Quote calculation (live mode: strictly verified carrier rate cards only)
  // --------------------------------------------------------------------------
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
      feeConfig,
      creditAgreements,
      { liveMode: isLive }
    );
  }, [originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors, feeConfig, creditAgreements, isLive]);

  // --------------------------------------------------------------------------
  // Credit utilisation + ledger entries for bookings settled on corporate credit
  // --------------------------------------------------------------------------
  const applyCreditUtilization = async (saved: Booking[]) => {
    const creditBookings = saved.filter(
      (b) => b.cost_breakdown?.settlement_type === "corporate_credit" && b.cost_breakdown?.credit_agreement_id
    );
    if (creditBookings.length === 0) return;

    const newEntries: CreditLedgerEntry[] = [];
    const usageByAgreement: Record<string, number> = {};

    for (const b of creditBookings) {
      const agreementId = b.cost_breakdown.credit_agreement_id as string;
      const agreement = creditAgreements.find((a) => a.id === agreementId);
      if (!agreement) continue;
      const amount = b.cost_breakdown.freightSubtotal || b.final_total;
      const due = new Date();
      due.setDate(due.getDate() + (agreement.payment_terms_days || 15));
      usageByAgreement[agreementId] = (usageByAgreement[agreementId] || 0) + amount;
      newEntries.push({
        id: `led-${Date.now()}-${b.id}`,
        booking_id: b.id,
        order_ref: b.order_id,
        carrier_docket_no: b.carrier_docket_no,
        shipper_id: currentUser.id,
        shipper_name: currentUser.company_name || currentUser.full_name,
        carrier_id: agreement.carrier_id,
        carrier_name: agreement.carrier_name,
        amount,
        due_date: due.toISOString().split("T")[0],
        status: "Unpaid",
        created_at: new Date().toISOString()
      });
    }

    let ledgerToStore = newEntries;
    if (isLive) {
      const payload = newEntries.map(({ id, ...rest }) => rest);
      const { data, error } = await supabase.from("credit_ledger").insert(payload).select("*");
      if (error) {
        alert(`Bookings were created, but the credit ledger could not be updated: ${error.message}`);
        return;
      }
      ledgerToStore = (data || []) as CreditLedgerEntry[];
      for (const [agreementId, used] of Object.entries(usageByAgreement)) {
        const agreement = creditAgreements.find((a) => a.id === agreementId);
        if (!agreement) continue;
        await supabase
          .from("credit_agreements")
          .update({ utilized_amount: agreement.utilized_amount + used })
          .eq("id", agreementId);
      }
    }

    setCreditLedger((prev) => [...ledgerToStore, ...prev]);
    setCreditAgreements((prev) =>
      prev.map((a) => (usageByAgreement[a.id] ? { ...a, utilized_amount: a.utilized_amount + usageByAgreement[a.id] } : a))
    );
  };

  // Called by the single-booking modal (Part 4) and the bulk flow below.
  const registerNewBookings = async (saved: Booking[]) => {
    setBookings((prev) => [...saved, ...prev]);
    await applyCreditUtilization(saved);
  };

  // --------------------------------------------------------------------------
  // Bulk CSV upload (semicolon weights, optional dimensions)
  // --------------------------------------------------------------------------
  const handleBulkCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkCsvFileName(file.name);
    setBulkUploadError("");

    if (!activeOriginAddress) {
      setBulkUploadError("Set your default pickup address under Dispatch Facilities before uploading a bulk manifest.");
      return;
    }
    const originAddress = activeOriginAddress;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length <= 1) throw new Error("CSV file must contain a header row and data rows.");
        if (lines.length - 1 > 50) throw new Error("Maximum 50 consignments per upload. Please split your file.");

        const parsedRows: BulkManifestRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
          if (cols.length < 5) continue;

          const dest_pin = cols[0];
          const consignee_name = cols[1];
          const consignee_phone = cols[2];
          const delivery_address = cols[3];
          const total_boxes = Math.max(1, parseInt(cols[4], 10) || 1);
          const box_weights_str = cols[5] || "";
          const box_dimensions_str = cols[6] || "";
          const declared_val = parseFloat(cols[7] || "") || 50000;

          const parsedWeights = box_weights_str
            ? box_weights_str.split(";").map((w) => parseFloat(w.trim())).filter((n) => !isNaN(n) && n > 0)
            : [];
          const parsedDims = box_dimensions_str
            ? box_dimensions_str.split(";").map((d) => d.trim()).filter((d) => d.length > 0)
            : [];

          const boxItems: BoxItem[] = [];
          for (let b = 0; b < total_boxes; b++) {
            const wt = parsedWeights[b] || parsedWeights[0] || 10;
            let l: number | null = null;
            let w: number | null = null;
            let h: number | null = null;
            if (parsedDims[b]) {
              const parts = parsedDims[b].toLowerCase().split("x").map((p) => parseFloat(p.trim()));
              if (parts.length === 3 && !parts.some(isNaN)) {
                [l, w, h] = parts;
              }
            }
            boxItems.push({ id: `b-${i}-${b}`, qty: 1, weight: wt, length: l, width: w, height: h });
          }

          const hasOmittedDimensions = !boxItems.some(hasCompleteDimensions);
          const actualWeight = boxItems.reduce((acc, bi) => acc + bi.weight, 0);
          const volumetricWeight = hasOmittedDimensions
            ? 0
            : boxItems.reduce(
                (acc, bi) =>
                  hasCompleteDimensions(bi) ? acc + ((bi.length || 0) * (bi.width || 0) * (bi.height || 0)) / 4500 : acc,
                0
              );
          const billableWeight = hasOmittedDimensions ? actualWeight : Math.max(actualWeight, Math.round(volumetricWeight * 10) / 10);

          const pinOk = isValidPin(dest_pin);
          const quotes = pinOk
            ? calculateQuotesForShipment(
                originAddress.pincode,
                dest_pin,
                boxItems,
                declared_val,
                "surface",
                false,
                rateCards,
                vendors,
                feeConfig,
                creditAgreements,
                { liveMode: isLive }
              )
            : [];
          const sorted = [...quotes].sort((a, b) => a.breakdown.total - b.breakdown.total);

          parsedRows.push({
            rowId: `row-${i}-${Date.now()}`,
            dest_pin,
            consignee_name,
            consignee_phone,
            delivery_address,
            consignee_gstin: "",
            total_boxes,
            boxes: boxItems,
            declared_value: declared_val,
            hasOmittedDimensions,
            actualWeight: Math.round(actualWeight * 10) / 10,
            volumetricWeight: Math.round(volumetricWeight * 10) / 10,
            billableWeight: Math.round(billableWeight * 10) / 10,
            quotes,
            selectedQuote: sorted[0] || null,
            validationError: !pinOk
              ? `Row ${i + 1}: invalid destination PIN "${dest_pin}"`
              : quotes.length === 0
              ? `Row ${i + 1}: No verified carrier rates found for this route yet`
              : undefined
          });
        }

        if (parsedRows.length === 0) throw new Error("No valid rows found. Expected at least 5 columns per row.");
        setBulkManifestList(parsedRows);
      } catch (err: any) {
        setBulkUploadError(err.message || "Failed to process bulk CSV.");
      }
    };
    reader.readAsText(file);
    // Allow re-selecting the same file later.
    e.target.value = "";
  };

  // --------------------------------------------------------------------------
  // Confirm batch booking
  // --------------------------------------------------------------------------
  const handleConfirmBatchBooking = async () => {
    if (bulkManifestList.length === 0 || !activeOriginAddress) return;
    const bookable = bulkManifestList.filter((r) => r.selectedQuote);
    if (bookable.length === 0) {
      alert("None of the rows have a verified carrier rate. Nothing to book.");
      return;
    }
    if (bulkSettlementMethod === "corporate_credit" && bookable.some((r) => !r.selectedQuote?.creditAvailable)) {
      alert("Corporate credit is not approved (or the limit is exceeded) for one or more selected carriers. Choose another settlement method or carriers.");
      return;
    }

    setIsBatchProcessing(true);
    const origin = activeOriginAddress;
    const refString =
      bulkSettlementMethod === "direct_upi"
        ? bulkConsolidatedUtr
          ? `BULK-UPI-${bulkConsolidatedUtr}`
          : "BULK-UPI"
        : bulkSettlementMethod === "corporate_credit"
        ? "BULK-CREDIT"
        : "BULK-TO-PAY";

    const records = bookable.map((row) => {
      const selected = row.selectedQuote as CalculatedQuote;
      const carrierVendor = selected.vendor;
      const officialDocket = generateCarrierDocket(carrierVendor.name);
      const platformOrderId = `LC-${Math.floor(100000 + Math.random() * 900000)}`;
      return {
        order_id: platformOrderId,
        awb_number: officialDocket,
        carrier_docket_no: officialDocket,
        carrier_portal_url: getOfficialCarrierTrackingUrl(carrierVendor, officialDocket),
        shipper_id: currentUser.id,
        vendor_id: carrierVendor.id,
        rate_card_id: selected.rateCard.id,
        shipper_name: currentUser.company_name || currentUser.full_name,
        shipper_phone: currentUser.phone,
        shipper_email: currentUser.email,
        shipper_gstin: currentUser.gstin,
        pickup_address: formatPickupAddress(origin),
        pickup_pincode: origin.pincode,
        consignee_name: row.consignee_name,
        consignee_phone: row.consignee_phone,
        consignee_gstin: row.consignee_gstin,
        delivery_address: row.delivery_address,
        origin_pin: origin.pincode,
        dest_pin: row.dest_pin,
        mode: selected.rateCard.mode,
        boxes: row.boxes,
        declared_value: row.declared_value,
        actual_weight: row.actualWeight,
        volumetric_weight: row.volumetricWeight,
        billable_weight: row.billableWeight,
        cost_breakdown: {
          ...selected.breakdown,
          settlement_type: bulkSettlementMethod,
          payment_ref: refString,
          carrier_upi: carrierVendor.upi_id,
          credit_agreement_id: bulkSettlementMethod === "corporate_credit" ? selected.creditAgreement?.id : undefined
        },
        final_total: selected.breakdown.total,
        status: "Booked" as const,
        tracking_history: [
          {
            status: "Booked",
            location: `${origin.city} Origin Hub (${origin.pincode})`,
            timestamp: new Date().toISOString(),
            remarks: `Batch consignment booked. Carrier Waybill ${officialDocket} assigned.`
          }
        ]
      };
    });

    try {
      let savedBookings: Booking[];
      if (isLive) {
        const { data, error } = await supabase.from("bookings").insert(records).select("*, vendors(*)");
        if (error || !data) {
          alert(`Bulk booking failed: ${error?.message || "no rows returned"}. Nothing was dispatched.`);
          return;
        }
        savedBookings = data as Booking[];
      } else {
        savedBookings = records.map((b, i) => ({
          ...b,
          id: `bulk-${Date.now()}-${i}`,
          created_at: new Date().toISOString(),
          vendors: vendors.find((v) => v.id === b.vendor_id) || vendors[0],
          is_demo: true
        })) as Booking[];
      }

      await registerNewBookings(savedBookings);
      setBatchPrintBookings(savedBookings);
      setBulkManifestList([]);
      setBulkCsvFileName("");
      setShipperTab("shipments");
      const skipped = bulkManifestList.length - bookable.length;
      alert(
        `Success! Dispatched ${savedBookings.length} consignments.${skipped ? ` ${skipped} row(s) without a verified rate were skipped.` : ""} Continuous 4x6 labels are ready for printing.`
      );
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // Carrier: Bilty upload + status update
  // --------------------------------------------------------------------------
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

    const clearUploading = () =>
      setStatusUpdateMap((prev) => ({
        ...prev,
        [bookingId]: { ...(prev[bookingId] || { status: "", location: "", remarks: "" }), isUploading: false }
      }));

    try {
      const fileToUpload = await compressImageFile(rawFile);
      let publicUrl = "";

      if (isLive) {
        const fileExt = fileToUpload.name.split(".").pop();
        const filePath = `dockets/bilty-${bookingId}-${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from("dockets").upload(filePath, fileToUpload, {
          cacheControl: "3600",
          upsert: true
        });
        if (error) {
          alert(`Bilty upload failed: ${error.message}`);
          clearUploading();
          return;
        }
        publicUrl = supabase.storage.from("dockets").getPublicUrl(filePath).data.publicUrl;
        const { error: updErr } = await supabase.from("bookings").update({ carrier_docket_doc_url: publicUrl }).eq("id", bookingId);
        if (updErr) {
          alert(`Bilty uploaded but could not be linked to the booking: ${updErr.message}`);
          clearUploading();
          return;
        }
      } else {
        publicUrl = URL.createObjectURL(fileToUpload);
      }

      setStatusUpdateMap((prev) => ({
        ...prev,
        [bookingId]: { ...(prev[bookingId] || { status: "", location: "", remarks: "" }), docUrl: publicUrl, isUploading: false }
      }));
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, carrier_docket_doc_url: publicUrl } : b)));
      alert(`Physical Bilty scan uploaded successfully (~${Math.round(fileToUpload.size / 1024)} KB).`);
    } catch (err) {
      console.error("Bilty upload failure:", err);
      alert("Bilty upload failed. Please try again.");
      clearUploading();
    }
  };

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
    const newPortalUrl = getOfficialCarrierTrackingUrl(booking.vendors || carrierName, effectiveDocket);
    const effectiveDocUrl = updateData.docUrl || booking.carrier_docket_doc_url || "";
    const newStatus = (updateData.status || booking.status) as Booking["status"];

    const newStep: TrackingStep = {
      status: newStatus,
      location: updateData.location || "En-route Hub",
      timestamp: new Date().toISOString(),
      remarks: updateData.remarks || `Carrier updated status with Docket ${effectiveDocket}`
    };
    const updatedHistory = [...(booking.tracking_history || []), newStep];

    if (isLive) {
      const { error } = await supabase
        .from("bookings")
        .update({
          awb_number: effectiveDocket,
          carrier_docket_no: effectiveDocket,
          carrier_portal_url: newPortalUrl,
          carrier_docket_doc_url: effectiveDocUrl,
          status: newStatus,
          tracking_history: updatedHistory
        })
        .eq("id", bookingId);
      if (error) {
        alert(`Status update failed: ${error.message}`);
        return;
      }
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              awb_number: effectiveDocket,
              carrier_docket_no: effectiveDocket,
              carrier_portal_url: newPortalUrl,
              carrier_docket_doc_url: effectiveDocUrl,
              status: newStatus,
              tracking_history: updatedHistory
            }
          : b
      )
    );
    alert("Carrier Docket & Status successfully synchronized!");
  };

  // --------------------------------------------------------------------------
  // Platform fee invoices
  // --------------------------------------------------------------------------
  const handlePayInvoiceSuccess = async (invoiceId: string, utr: string, method: string) => {
    const patch = {
      status: "Paid" as InvoiceStatus,
      payment_date: new Date().toISOString().split("T")[0],
      payment_ref: utr,
      payment_method: method
    };
    if (isLive) {
      const { error } = await supabase.from("platform_invoices").update(patch).eq("id", invoiceId);
      if (error) {
        alert(`Could not record payment: ${error.message}`);
        return;
      }
    }
    setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, ...patch } : inv)));
  };

  // --------------------------------------------------------------------------
  // Carrier public tracking URL
  // --------------------------------------------------------------------------
  const handleSaveCarrierTrackingUrl = async (customUrl: string) => {
    const cleanUrl = customUrl.trim();
    const vendorId = currentUser.vendor_id || currentUser.id;

    if (isLive) {
      const { error } = await supabase
        .from("vendors")
        .update({ custom_tracking_url: cleanUrl, tracking_base_url: cleanUrl })
        .eq("id", vendorId);
      if (error) {
        alert(`Could not save tracking URL: ${error.message}`);
        return;
      }
      await supabase.from("profiles").update({ custom_tracking_url: cleanUrl }).eq("id", currentUser.id);
      setCurrentUser((u) => ({ ...u, custom_tracking_url: cleanUrl }));
    }

    setCarrierCustomTrackingUrl(cleanUrl);
    setVendors((prev) =>
      prev.map((v) => (v.id === vendorId ? { ...v, custom_tracking_url: cleanUrl, tracking_base_url: cleanUrl } : v))
    );
    alert("Public Tracking Portal URL updated! Shippers will now be redirected to your tracking portal.");
  };

  // --------------------------------------------------------------------------
  // Credit agreements
  // The modal (Part 4) compresses + uploads the file, then calls this to persist the record.
  // --------------------------------------------------------------------------
  const handleSubmitCreditApplication = async (
    payload: CreditApplicationPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    const targetCarrier = vendors.find((v) => v.id === payload.carrierId);
    const base = {
      shipper_id: currentUser.id,
      shipper_name: currentUser.company_name || currentUser.full_name,
      carrier_id: payload.carrierId,
      carrier_name: targetCarrier?.name || "National Transporter",
      document_url: payload.documentUrl,
      document_name: payload.docName,
      file_path: payload.filePath,
      original_size_kb: payload.originalSizeKB,
      compressed_size_kb: payload.compressedSizeKB,
      requested_limit: payload.limit,
      approved_limit: 0,
      utilized_amount: 0,
      status: "Pending_Review" as CreditStatus,
      payment_terms_days: payload.termsDays,
      submitted_at: new Date().toISOString()
    };

    if (isLive) {
      const { data, error } = await supabase.from("credit_agreements").insert([base]).select("*").maybeSingle();
      if (error || !data) return { ok: false, error: error?.message || "Insert returned no row." };
      setCreditAgreements((prev) => [data as CreditAgreement, ...prev]);
      return { ok: true };
    }

    setCreditAgreements((prev) => [{ ...base, id: `ca-${Date.now()}`, is_demo: true }, ...prev]);
    return { ok: true };
  };

  // Private-bucket documents are opened through a short-lived signed URL.
  const getAgreementViewUrl = async (agreement: CreditAgreement): Promise<string> => {
    if (agreement.file_path && !agreement.is_demo) {
      const { data, error } = await supabase.storage.from("agreements").createSignedUrl(agreement.file_path, 3600);
      if (!error && data?.signedUrl) return data.signedUrl;
    }
    return agreement.document_url;
  };

  const handleReviewCreditAgreement = async (
    agreementId: string,
    status: "Approved" | "Rejected",
    approvedLimit?: number,
    reason?: string
  ) => {
    const target = creditAgreements.find((a) => a.id === agreementId);
    if (!target) return;
    const patch = {
      status,
      approved_limit: status === "Approved" ? approvedLimit || target.requested_limit : 0,
      reviewed_at: new Date().toISOString(),
      rejection_reason: status === "Rejected" ? reason || "Underwriting criteria not satisfied" : undefined
    };
    if (isLive) {
      const { error } = await supabase.from("credit_agreements").update(patch).eq("id", agreementId);
      if (error) {
        alert(`Could not record decision: ${error.message}`);
        return;
      }
    }
    setCreditAgreements((prev) => prev.map((a) => (a.id === agreementId ? { ...a, ...patch } : a)));
    alert(`Agreement ${agreementId} has been marked as ${status.toUpperCase()}!`);
  };

  const handleSettleLedgerEntry = async (entryId: string, ref: string) => {
    const entry = creditLedger.find((e) => e.id === entryId);
    if (!entry) return;
    const patch = { status: "Settled" as const, settled_at: new Date().toISOString(), payment_ref: ref };
    const agreement = creditAgreements.find(
      (a) => a.carrier_id === entry.carrier_id && a.shipper_id === entry.shipper_id && a.status === "Approved"
    );

    if (isLive) {
      const { error } = await supabase.from("credit_ledger").update(patch).eq("id", entryId);
      if (error) {
        alert(`Could not settle ledger entry: ${error.message}`);
        return;
      }
      if (agreement) {
        await supabase
          .from("credit_agreements")
          .update({ utilized_amount: Math.max(0, agreement.utilized_amount - entry.amount) })
          .eq("id", agreement.id);
      }
    }

    setCreditLedger((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...patch } : e)));
    if (agreement) {
      setCreditAgreements((prev) =>
        prev.map((a) => (a.id === agreement.id ? { ...a, utilized_amount: Math.max(0, a.utilized_amount - entry.amount) } : a))
      );
    }
  };

  return {
    state: {
      sessionStatus,
      isLive,
      liveDataLoading,
      passwordRecoveryPending, setPasswordRecoveryPending,
      activeRole, setActiveRole,
      modeEnv, setModeEnv,
      highVolumeMode, setHighVolumeMode,
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
      handleSaveCarrierTrackingUrl,
      handleSubmitCreditApplication,
      handleReviewCreditAgreement,
      handleSettleLedgerEntry,
      getAgreementViewUrl,
      registerNewBookings,
      enterDemoMode,
      fetchAllData
    }
  };
}

// ============================================================================
// 13. AUTH MODAL — LOGIN, SIGNUP, FORGOT PASSWORD, SET-NEW-PASSWORD (RECOVERY)
// The modal only talks to supabase.auth. The engine's onAuthStateChange listener
// turns the resulting session into a profile, so there is a single code path.
// ============================================================================
type AuthModalView = AuthViewMode | "recovery";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: AuthModalView;
  onRecoveryComplete?: () => void;
}

const AuthModal: FC<AuthModalProps> = ({ isOpen, onClose, initialView = "login", onRecoveryComplete }) => {
  const [view, setView] = useState<AuthModalView>(initialView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"shipper" | "carrier">("shipper");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Follow the parent when it forces a view (e.g. PASSWORD_RECOVERY redirect).
  useEffect(() => {
    if (isOpen) setView(initialView);
  }, [initialView, isOpen]);

  if (!isOpen) return null;

  const switchView = (next: AuthModalView) => {
    setView(next);
    setErrorMsg("");
    setSuccessMsg("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (view === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        onClose();
      } else if (view === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const cleanGstin = gstin.trim().toUpperCase();
        if (cleanGstin && cleanGstin.length !== 15) throw new Error("GSTIN must be exactly 15 characters.");

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
            // Stored with the auth user so the profile can be created on first sign-in,
            // even when email confirmation means there is no session yet.
            data: {
              full_name: fullName.trim(),
              company_name: companyName.trim(),
              gstin: cleanGstin,
              phone: phone.trim(),
              role
            }
          }
        });
        if (error) throw error;

        if (data.session) {
          onClose(); // confirmation disabled: signed in immediately
        } else {
          switchView("login");
          setSuccessMsg("Account created. Check your inbox and confirm your email, then sign in.");
        }
      } else if (view === "forgot") {
        if (!isValidEmail(email)) throw new Error("Please enter a valid registered email address.");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setSuccessMsg("If that email is registered, a password reset link has been sent. Check your inbox (and spam folder).");
      } else if (view === "recovery") {
        if (password.length < 8) throw new Error("New password must be at least 8 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        onRecoveryComplete?.();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<AuthModalView, { title: string; sub: string; cta: string }> = {
    login: { title: "Live Account Sign In", sub: "Production Supabase Authentication Guard", cta: "Sign In To Live Platform" },
    signup: { title: "Register Logistics Enterprise", sub: "Create your verified business account", cta: "Create Enterprise Account" },
    forgot: { title: "Reset Your Password", sub: "We will email you a secure recovery link", cta: "Send Reset Link" },
    recovery: { title: "Set A New Password", sub: "Choose a strong password for your account", cta: "Update Password" }
  };
  const t = titles[view];
  const inputCls =
    "w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl my-8">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">{t.title}</h3>
            <p className="text-xs text-slate-500 font-medium">{t.sub}</p>
          </div>
          {view !== "recovery" && (
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {errorMsg && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold">{errorMsg}</p>
        )}
        {successMsg && (
          <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl font-bold">{successMsg}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {view !== "recovery" && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">Business Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          {view !== "forgot" && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                {view === "recovery" ? "New Password" : "Password"}
              </label>
              <input
                type="password"
                required
                autoComplete={view === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          {(view === "signup" || view === "recovery") && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">Confirm Password</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          {view === "login" && (
            <div className="text-right -mt-1">
              <button
                type="button"
                onClick={() => switchView("forgot")}
                className="text-indigo-600 font-bold hover:underline text-[11px]"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {view === "signup" && (
            <>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Name</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Company / Organization</label>
                <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">GSTIN (15 chars)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="07AAACA1234A1Z5"
                    className={`${inputCls} font-mono font-bold`}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98XXX XXXXX"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Primary Operational Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "shipper" | "carrier")}
                  className={`${inputCls} font-bold`}
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
            {loading ? "Please wait..." : t.cta}
          </button>
        </form>

        {view !== "recovery" && (
          <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100 space-y-1.5">
            {view === "login" && (
              <button type="button" onClick={() => switchView("signup")} className="text-indigo-600 font-bold hover:underline block mx-auto">
                Need a live enterprise account? Register here
              </button>
            )}
            {view === "signup" && (
              <button type="button" onClick={() => switchView("login")} className="text-indigo-600 font-bold hover:underline block mx-auto">
                Already have an enterprise account? Sign in
              </button>
            )}
            {view === "forgot" && (
              <button type="button" onClick={() => switchView("login")} className="text-indigo-600 font-bold hover:underline block mx-auto">
                ← Back to sign in
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// END OF PART 2 OF 7
// ============================================================================
// ============================================================================
// PART 3 OF 7 — ICONS, TOP NAVIGATION HEADER, PICKUP ADDRESS SETUP,
//               SHIPPER SINGLE BOOKING FORM (OPTIONAL L x W x H)
// Paste directly after Part 2. No named exports.
// ============================================================================

// ============================================================================
// 14. INLINE VECTOR ICONS
// ============================================================================
interface IconProps {
  className?: string;
}

const SvgIcon: FC<IconProps & { d: string[]; sw?: number }> = ({ className = "w-5 h-5", d, sw = 1.8 }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={sw}>
    {d.map((p, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" d={p} />
    ))}
  </svg>
);

const TruckIcon: FC<IconProps> = (p) => (
  <SvgIcon
    {...p}
    d={[
      "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z",
      "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1"
    ]}
  />
);
const PlaneIcon: FC<IconProps> = (p) => <SvgIcon {...p} d={["M12 19l9 2-9-18-9 18 9-2zm0 0v-8"]} />;
const BoxIcon: FC<IconProps> = (p) => <SvgIcon {...p} d={["M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"]} />;
const PrinterIcon: FC<IconProps> = (p) => (
  <SvgIcon {...p} d={["M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"]} />
);
const SearchIcon: FC<IconProps> = (p) => <SvgIcon {...p} d={["M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"]} />;
const PlusIcon: FC<IconProps> = (p) => <SvgIcon {...p} sw={2} d={["M12 4v16m8-8H4"]} />;
const TrashIcon: FC<IconProps> = (p) => (
  <SvgIcon {...p} d={["M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"]} />
);
const ArrowRightIcon: FC<IconProps> = (p) => <SvgIcon className="w-4 h-4" {...p} sw={2} d={["M14 5l7 7m0 0l-7 7m7-7H3"]} />;
const CheckCircleIcon: FC<IconProps> = (p) => <SvgIcon {...p} sw={2} d={["M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"]} />;
const XMarkIcon: FC<IconProps> = (p) => <SvgIcon {...p} sw={2} d={["M6 18L18 6M6 6l12 12"]} />;
const ShieldCheckIcon: FC<IconProps> = (p) => (
  <SvgIcon {...p} d={["M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"]} />
);
const ChevronDownIcon: FC<IconProps> = (p) => <SvgIcon {...p} sw={2} d={["M19 9l-7 7-7-7"]} />;
const LayersIcon: FC<IconProps> = (p) => (
  <SvgIcon {...p} d={["M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"]} />
);
const CurrencyRupeeIcon: FC<IconProps> = (p) => <SvgIcon {...p} d={["M9 8h6m-5 0h.01M9 12h5m-5 0h.01M9 4v16m0-12a4 4 0 014 4 4 4 0 01-4 4l6 6"]} />;
const CreditCardIcon: FC<IconProps> = (p) => (
  <SvgIcon {...p} d={["M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z", "M2 10h20M7 15h2m4 0h4"]} />
);
const ExternalLinkIcon: FC<IconProps> = (p) => (
  <SvgIcon className="w-4 h-4" {...p} sw={2} d={["M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"]} />
);
const DownloadIcon: FC<IconProps> = (p) => <SvgIcon {...p} d={["M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"]} />;
const UploadIcon: FC<IconProps> = (p) => <SvgIcon {...p} d={["M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"]} />;
const MapPinIcon: FC<IconProps> = (p) => (
  <SvgIcon className="w-4 h-4" {...p} d={["M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z", "M15 11a3 3 0 11-6 0 3 3 0 016 0z"]} />
);
const DocumentIcon: FC<IconProps> = (p) => (
  <SvgIcon className="w-4 h-4" {...p} d={["M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"]} />
);
const BoltIcon: FC<IconProps> = (p) => <SvgIcon className="w-4 h-4" {...p} sw={2} d={["M13 10V3L4 14h7v7l9-11h-7z"]} />;
const BuildingOfficeIcon: FC<IconProps> = (p) => (
  <SvgIcon {...p} d={["M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"]} />
);
const CalendarIcon: FC<IconProps> = (p) => (
  <SvgIcon {...p} d={["M6.75 3v2.25M17.25 3v2.253M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"]} />
);
const ClockIcon: FC<IconProps> = (p) => <SvgIcon {...p} d={["M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"]} />;
const DocumentCheckIcon: FC<IconProps> = (p) => (
  <SvgIcon {...p} d={["M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-12m-9.375-6.375L19.5 7.5m-9.375-5.25v5.25h5.25m-6.75 6.75l2.25 2.25 4.5-4.5"]} />
);
const UserCircleIcon: FC<IconProps> = (p) => (
  <SvgIcon {...p} d={["M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"]} />
);

// ============================================================================
// 15. TOP NAVIGATION HEADER (REAL IDENTITY IN LIVE MODE — ZERO DEMO LEAK)
// ============================================================================
interface AppHeaderProps {
  activeRole: RoleType | "landing";
  modeEnv: ModeEnv;
  currentUser: UserProfile;
  hasLiveSession: boolean;
  globalSearchInput: string;
  setGlobalSearchInput: (v: string) => void;
  onGlobalSearch: (e: FormEvent) => void;
  onRoleSwitch: (role: RoleType | "landing") => void;
  onModeToggle: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

const AppHeader: FC<AppHeaderProps> = ({
  activeRole,
  modeEnv,
  currentUser,
  hasLiveSession,
  globalSearchInput,
  setGlobalSearchInput,
  onGlobalSearch,
  onRoleSwitch,
  onModeToggle,
  onOpenAuth,
  onLogout
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const isRealAuthLive = modeEnv === "live" && Boolean(currentUser.isRealUser);
  const userIsShipper = currentUser.role === "shipper";
  const userIsCarrier = currentUser.role === "carrier" || currentUser.role === "vendor";

  // Display identity: in live mode ONLY the account's own data is ever shown.
  const displayName = currentUser.company_name || currentUser.full_name || currentUser.email;
  const initials = (displayName || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const navBtn = (active: boolean, color: string) =>
    `px-3 py-1.5 rounded-lg transition ${active ? `${color} text-white shadow-sm` : "text-slate-400 hover:text-white"}`;

  return (
    <header className="sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800 shadow-md no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center space-x-3 cursor-pointer select-none shrink-0" onClick={() => onRoleSwitch("landing")}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <TruckIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-black text-lg tracking-tight text-white">LogiCompare</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-1.5 rounded font-mono font-bold uppercase">
                Pro
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">B2B Freight Discovery</p>
          </div>
        </div>

        {/* Global search */}
        <form onSubmit={onGlobalSearch} className="hidden md:flex items-center max-w-sm w-full relative">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={globalSearchInput}
            onChange={(e) => setGlobalSearchInput(e.target.value)}
            placeholder="Search Order Ref (LC-...) or Docket..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </form>

        {/* Role navigation */}
        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          <button type="button" onClick={() => onRoleSwitch("landing")} className={navBtn(activeRole === "landing", "bg-indigo-600")}>
            Overview
          </button>

          {isRealAuthLive ? (
            <>
              {userIsShipper && (
                <button type="button" onClick={() => onRoleSwitch("shipper")} className={navBtn(activeRole === "shipper", "bg-indigo-600")}>
                  Shipper Console
                </button>
              )}
              {userIsCarrier && (
                <button type="button" onClick={() => onRoleSwitch("carrier")} className={navBtn(activeRole === "carrier", "bg-emerald-600")}>
                  Carrier Hub
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" onClick={() => onRoleSwitch("shipper")} className={navBtn(activeRole === "shipper", "bg-indigo-600")}>
                Shipper
              </button>
              <button type="button" onClick={() => onRoleSwitch("carrier")} className={navBtn(activeRole === "carrier", "bg-emerald-600")}>
                Carrier
              </button>
              <button type="button" onClick={() => onRoleSwitch("admin")} className={navBtn(activeRole === "admin", "bg-amber-600")}>
                Admin
              </button>
            </>
          )}
        </div>

        {/* Identity / auth area */}
        <div className="flex items-center space-x-2.5 shrink-0">
          {/* Mode badge */}
          {isRealAuthLive ? (
            <span className="hidden sm:inline-flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live</span>
            </span>
          ) : (
            <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full">
              Demo Sandbox
            </span>
          )}

          {/* Demo switcher: ONLY outside live mode */}
          {!isRealAuthLive && (
            <div className="hidden lg:flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-black px-1.5 text-amber-400">Sandbox:</span>
              <button
                type="button"
                onClick={() => onRoleSwitch("shipper")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                  activeRole === "shipper" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                ⚡ Apex
              </button>
              <button
                type="button"
                onClick={() => onRoleSwitch("carrier")}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                  activeRole === "carrier" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                🚛 Delhivery
              </button>
            </div>
          )}

          {/* Logged in but browsing the sandbox: offer a one-click return to the live account */}
          {!isRealAuthLive && hasLiveSession && (
            <button
              type="button"
              onClick={onModeToggle}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition"
            >
              Back To Live Account
            </button>
          )}

          {isRealAuthLive ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 pl-1.5 pr-3 py-1 rounded-xl transition"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">
                  {initials || "U"}
                </span>
                <span className="hidden sm:block text-left leading-tight">
                  <span className="block text-xs font-bold text-white max-w-[130px] truncate">{displayName}</span>
                  <span className="block text-[10px] text-slate-400 max-w-[130px] truncate">{currentUser.email}</span>
                </span>
                <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-2xl p-4 space-y-3 z-50" role="menu">
                  <div className="flex items-start space-x-3 border-b border-slate-100 pb-3">
                    <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white text-sm font-black flex items-center justify-center shrink-0">
                      {initials || "U"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{displayName}</p>
                      {currentUser.full_name && currentUser.full_name !== displayName && (
                        <p className="text-xs text-slate-600 truncate">{currentUser.full_name}</p>
                      )}
                      <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Role</span>
                      <strong className="capitalize text-slate-900">{userIsCarrier ? "carrier" : "shipper"}</strong>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Status</span>
                      <strong className="text-emerald-700">Verified Session</strong>
                    </div>
                    <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">GSTIN</span>
                      <strong className="font-mono text-slate-900">{currentUser.gstin || "Not provided"}</strong>
                    </div>
                    {currentUser.phone && (
                      <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Phone</span>
                        <strong className="font-mono text-slate-900">{currentUser.phone}</strong>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onModeToggle();
                    }}
                    className="w-full text-left text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg px-3 py-2 transition"
                  >
                    Preview Demo Sandbox
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-xs rounded-lg px-3 py-2 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition"
            >
              Sign In / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

// ============================================================================
// 16. PICKUP ADDRESS: SETUP MODAL (NO DUMMY FALLBACKS — EVERY FIELD IS REAL INPUT)
// ============================================================================
interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (address: AddressProfile) => void | Promise<void>;
  initialAddress?: AddressProfile | null;
  // The signed-in user's OWN details, used only to pre-fill a brand-new address.
  userDefaults?: { company_name?: string; contact_name?: string; phone?: string; email?: string; gstin?: string };
}

const AddressModal: FC<AddressModalProps> = ({ isOpen, onClose, onSave, initialAddress, userDefaults }) => {
  const [label, setLabel] = useState(initialAddress?.label || "Primary Warehouse");
  const [companyName, setCompanyName] = useState(initialAddress?.company_name || userDefaults?.company_name || "");
  const [contactName, setContactName] = useState(initialAddress?.contact_name || userDefaults?.contact_name || "");
  const [phone, setPhone] = useState(initialAddress?.phone || userDefaults?.phone || "");
  const [email, setEmail] = useState(initialAddress?.email || userDefaults?.email || "");
  const [gstin, setGstin] = useState(initialAddress?.gstin || userDefaults?.gstin || "");
  const [line1, setLine1] = useState(initialAddress?.address_line1 || "");
  const [line2, setLine2] = useState(initialAddress?.address_line2 || "");
  const [city, setCity] = useState(initialAddress?.city || "");
  const [stateName, setStateName] = useState(initialAddress?.state || "");
  const [pincode, setPincode] = useState(initialAddress?.pincode || "");
  const [isDefault, setIsDefault] = useState(initialAddress?.is_default ?? true);
  const [isLookingUpPin, setIsLookingUpPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handlePincodeBlur = async () => {
    const cleanPin = pincode.trim();
    if (!isValidPin(cleanPin)) return;
    setIsLookingUpPin(true);
    const zone = await lookupPinZone(cleanPin);
    // Only fill blanks so we never overwrite what the user typed.
    if (!city.trim()) setCity(zone.city);
    if (!stateName.trim()) setStateName(zone.state);
    setIsLookingUpPin(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!isValidPin(pincode)) return setErrorMsg("Please provide a valid 6-digit Indian PIN code.");
    if (!line1.trim()) return setErrorMsg("Address Line 1 is required.");
    if (!city.trim() || !stateName.trim()) return setErrorMsg("City and State are required.");
    if (gstin.trim() && gstin.trim().length !== 15) return setErrorMsg("GSTIN must be exactly 15 characters (or leave it blank).");

    const updated: AddressProfile = {
      id: initialAddress?.id || `addr-${Date.now()}`,
      label: label.trim() || "Warehouse",
      company_name: companyName.trim(),
      contact_name: contactName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      gstin: gstin.trim().toUpperCase(),
      address_line1: line1.trim(),
      address_line2: line2.trim(),
      city: city.trim(),
      state: stateName.trim(),
      pincode: pincode.trim(),
      is_default: isDefault
    };

    setIsSaving(true);
    try {
      await onSave(updated);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls =
    "w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">
              {initialAddress ? "Edit Pickup Warehouse" : "Add Pickup Warehouse / Origin Facility"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">Where your consignments are collected from. PIN is auto-zoned.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold">{errorMsg}</p>}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Facility Label *</label>
              <input type="text" required placeholder="e.g. Okhla Warehouse" value={label} onChange={(e) => setLabel(e.target.value)} className={`${inputCls} font-bold`} />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Company / Facility Name</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Dispatch Contact *</label>
              <input type="text" required value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Phone *</label>
              <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">GSTIN</label>
              <input type="text" maxLength={15} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} className={`${inputCls} font-mono`} />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Contact Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Address Line 1 (Street / Plot No.) *</label>
            <input type="text" required value={line1} onChange={(e) => setLine1(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Address Line 2 (Landmark / Gate / Yard)</label>
            <input type="text" value={line2} onChange={(e) => setLine2(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                PIN Code * {isLookingUpPin && <span className="text-indigo-600 text-[10px] animate-pulse">(Lookup...)</span>}
              </label>
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                onBlur={handlePincodeBlur}
                className={`${inputCls} font-mono font-bold`}
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">City / District *</label>
              <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">State *</label>
              <input type="text" required value={stateName} onChange={(e) => setStateName(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input type="checkbox" id="is_default_addr" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300" />
            <label htmlFor="is_default_addr" className="text-xs font-bold text-slate-700 cursor-pointer">
              Set as default pickup location (auto-loads into the rate calculator and bulk matrix)
            </label>
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Pickup Address"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 17. "SET YOUR PICKUP LOCATION" PROMPT (reused by calculator + bulk console)
// ============================================================================
const PickupAddressRequiredBanner: FC<{ onSetup: () => void }> = ({ onSetup }) => (
  <div className="bg-amber-50 border-2 border-amber-300 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
    <div className="space-y-1">
      <div className="flex items-center space-x-2">
        <MapPinIcon className="w-4 h-4 text-amber-700" />
        <span className="font-black text-sm text-amber-950">Set your default pickup location</span>
      </div>
      <p className="text-xs text-amber-900 font-medium max-w-xl">
        Add the warehouse address consignments are collected from. Freight rates, labels and manifests all use it as the origin.
      </p>
    </div>
    <button
      type="button"
      onClick={onSetup}
      className="bg-amber-600 hover:bg-amber-700 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-sm transition shrink-0"
    >
      Add Pickup Address
    </button>
  </div>
);

// ============================================================================
// 18. PICKUP WAREHOUSE MANAGER (SHIPPER "DISPATCH FACILITIES" TAB)
// ============================================================================
interface ShipperAddressSectionProps {
  addresses: AddressProfile[];
  activeAddress: AddressProfile | null;
  onSelectAddress: (address: AddressProfile) => void;
  onAddNewAddress: () => void;
  onEditAddress: (address: AddressProfile) => void;
}

const ShipperAddressSection: FC<ShipperAddressSectionProps> = ({
  addresses,
  activeAddress,
  onSelectAddress,
  onAddNewAddress,
  onEditAddress
}) => {
  return (
    <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <BuildingOfficeIcon className="w-5 h-5 text-indigo-600" />
            <span>Pickup Warehouse & Origin Facilities</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage the facilities your consignments are collected from.</p>
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
        <PickupAddressRequiredBanner onSetup={onAddNewAddress} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {addresses.map((addr) => {
            const isActive = activeAddress?.id === addr.id;
            return (
              <div
                key={addr.id}
                onClick={() => onSelectAddress(addr)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition relative flex flex-col justify-between ${
                  isActive ? "bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-200 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
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
                  {addr.company_name && <strong className="block text-xs text-slate-800">{addr.company_name}</strong>}
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    {addr.address_line1}
                    {addr.address_line2 ? `, ${addr.address_line2}` : ""}
                  </p>
                  <p className="text-[11px] font-bold text-slate-800 mt-0.5">
                    {addr.city}, {addr.state} - <span className="font-mono text-indigo-700">{addr.pincode}</span>
                  </p>
                  {(addr.contact_name || addr.phone) && (
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">
                      Contact: {addr.contact_name} {addr.phone ? `(${addr.phone})` : ""}
                    </p>
                  )}
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
// 19. 3D VISUAL ENGINES (only mounted when High-Volume 60FPS mode is OFF)
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

  const hasDims = Number(length) > 0 && Number(width) > 0 && Number(height) > 0;
  const safeL = Number(length) > 0 ? Number(length) : 30;
  const safeW = Number(width) > 0 ? Number(width) : 30;
  const safeH = Number(height) > 0 ? Number(height) : 30;

  useEffect(() => {
    if (!autoRotate || isDragging) return;
    const interval = setInterval(() => setRotY((prev) => (prev + 0.6) % 360), 30);
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
        <span className="text-[10px] uppercase font-black tracking-wider text-indigo-300 flex items-center">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1.5"></span>
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
          style={{ width: `${l}px`, height: `${h}px`, transformStyle: "preserve-3d", transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)` }}
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-amber-700 via-amber-600 to-amber-800 border border-amber-900/60 shadow-inner flex flex-col justify-between p-2 text-white overflow-hidden rounded-sm"
            style={{ transform: `translateZ(${w / 2}px)` }}
          >
            <div className="flex justify-between items-start opacity-90">
              <span className="text-[8px] font-black uppercase tracking-widest text-amber-950 bg-amber-400 px-1 py-0.5 rounded-sm">FRAGILE</span>
              <span className="text-[7px] font-mono text-amber-200">↑ THIS SIDE UP</span>
            </div>
            <div className="flex flex-col items-center my-auto">
              <div className="w-12 h-3.5 bg-white/90 rounded-sm flex items-center justify-center space-x-0.5 px-1 py-0.5 shadow-sm">
                {[1, 2, 1, 3, 1, 2, 1, 2, 1, 3, 1].map((n, i) => (
                  <div key={i} className="bg-black h-full" style={{ width: `${n}px` }} />
                ))}
              </div>
              <span className="text-[7px] font-mono font-black text-amber-100 tracking-wider mt-0.5">
                {hasDims ? `${safeL}×${safeW}×${safeH} CM` : "DIMS NOT SET"}
              </span>
            </div>
            <div className="h-1.5 w-full bg-amber-950/60 rounded-sm"></div>
          </div>
          <div
            className="absolute inset-0 bg-gradient-to-br from-amber-800 to-amber-900 border border-amber-950 flex items-center justify-center text-amber-300 font-mono text-[8px] font-bold"
            style={{ transform: `rotateY(180deg) translateZ(${w / 2}px)` }}
          >
            <span>LOGICOMPARE B2B</span>
          </div>
          <div
            className="absolute bg-gradient-to-br from-amber-800 via-amber-700 to-amber-900 border border-amber-950 flex flex-col justify-center items-center text-amber-200"
            style={{ width: `${w}px`, height: `${h}px`, left: `${(l - w) / 2}px`, transform: `rotateY(-90deg) translateZ(${l / 2}px)` }}
          >
            <span className="text-[7px] font-bold rotate-90 opacity-75">{hasDims ? `WIDTH: ${safeW}cm` : ""}</span>
          </div>
          <div
            className="absolute bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 border border-amber-950 flex flex-col justify-center items-center text-amber-200"
            style={{ width: `${w}px`, height: `${h}px`, left: `${(l - w) / 2}px`, transform: `rotateY(90deg) translateZ(${l / 2}px)` }}
          >
            <span className="text-[7px] font-bold -rotate-90 opacity-75">{hasDims ? `HT: ${safeH}cm` : ""}</span>
          </div>
          <div
            className="absolute bg-gradient-to-br from-amber-600 via-amber-500 to-amber-700 border border-amber-900 flex items-center justify-center overflow-hidden"
            style={{ width: `${l}px`, height: `${w}px`, top: `${(h - w) / 2}px`, transform: `rotateX(90deg) translateZ(${h / 2}px)` }}
          >
            <div className="w-full h-3 bg-amber-400/50 shadow-inner flex items-center justify-center">
              <span className="text-[6px] font-black text-amber-950 tracking-widest uppercase">HEAVY DUTY SEAL</span>
            </div>
          </div>
          <div
            className="absolute bg-amber-950 shadow-2xl"
            style={{ width: `${l}px`, height: `${w}px`, top: `${(h - w) / 2}px`, transform: `rotateX(-90deg) translateZ(${h / 2}px)` }}
          />
        </div>
      </div>
      <span className="text-[9px] text-slate-400 mt-1 font-mono">Drag with mouse to rotate 360°</span>
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

    let animId = 0;
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
        <span className="text-indigo-300 font-black">📍 {originHub || "ORIGIN"}</span>
        <span className="text-emerald-300 font-black">🎯 {destHub || "DEST"}</span>
      </div>
      <canvas ref={canvasRef} width={300} height={90} className="w-full max-w-[300px] h-[90px]" />
      <span className="text-[9px] text-slate-400 font-mono mt-0.5">3D Parabolic Linehaul Trajectory Active</span>
    </div>
  );
};

// ============================================================================
// 20. SHIPPER SINGLE BOOKING FORM (STRICTLY OPTIONAL L x W x H)
// Part 4 composes this with the live rate matrix inside ShipperSingleCalculatorSection.
// ============================================================================
interface ShipperSingleBookingFormProps {
  highVolumeMode: boolean;
  activeOriginAddress: AddressProfile | null;
  onManageFacilities: () => void;
  originPin: string;
  destPin: string;
  setDestPin: (val: string) => void;
  declaredValue: number;
  setDeclaredValue: (val: number) => void;
  selectedMode: "all" | TransportMode;
  setSelectedMode: (val: "all" | TransportMode) => void;
  isOda: boolean;
  setIsOda: (val: boolean) => void;
  boxes: BoxItem[];
  setBoxes: React.Dispatch<React.SetStateAction<BoxItem[]>>;
  selectedBoxFor3D: number;
  setSelectedBoxFor3D: (idx: number) => void;
  originZoneData: PinLookupResult;
  destZoneData: PinLookupResult;
  onOpenDestCityModal: () => void;
}

const ShipperSingleBookingForm: FC<ShipperSingleBookingFormProps> = ({
  highVolumeMode,
  activeOriginAddress,
  onManageFacilities,
  originPin,
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
  onOpenDestCityModal
}) => {
  const hasDimensions = useMemo(() => boxes.some(hasCompleteDimensions), [boxes]);

  const totalActualWeight = useMemo(
    () => boxes.reduce((acc, b) => acc + (Number(b.weight) || 0) * (Number(b.qty) || 1), 0),
    [boxes]
  );

  const volumetricDivisor = selectedMode === "air" ? 5000 : 4500;

  const totalVolumetricWeight = useMemo(() => {
    if (!hasDimensions) return 0;
    return boxes.reduce((acc, b) => {
      if (!hasCompleteDimensions(b)) return acc;
      return acc + ((Number(b.length) * Number(b.width) * Number(b.height)) / volumetricDivisor) * (Number(b.qty) || 1);
    }, 0);
  }, [boxes, hasDimensions, volumetricDivisor]);

  const billableWeight = useMemo(() => {
    if (!hasDimensions) return totalActualWeight;
    return Math.max(totalActualWeight, Math.round(totalVolumetricWeight * 10) / 10);
  }, [totalActualWeight, totalVolumetricWeight, hasDimensions]);

  // A box with SOME but not ALL dimensions is ignored for volumetric weight; tell the user.
  const partialDimBoxes = useMemo(
    () =>
      boxes.filter((b) => {
        const filled = [b.length, b.width, b.height].filter((v) => v && Number(v) > 0).length;
        return filled > 0 && filled < 3;
      }).length,
    [boxes]
  );

  const addBox = () =>
    setBoxes([...boxes, { id: `box-${Date.now()}`, qty: 1, weight: 10, length: null, width: null, height: null }]);

  const removeBox = (id: string) => {
    if (boxes.length <= 1) return;
    const next = boxes.filter((b) => b.id !== id);
    setBoxes(next);
    if (selectedBoxFor3D >= next.length) setSelectedBoxFor3D(0);
  };

  const updateQty = (id: string, raw: string) =>
    setBoxes(boxes.map((b) => (b.id === id ? { ...b, qty: Math.max(1, parseInt(raw, 10) || 1) } : b)));

  const updateWeight = (id: string, raw: string) =>
    setBoxes(boxes.map((b) => (b.id === id ? { ...b, weight: Math.max(0, parseFloat(raw) || 0) } : b)));

  // Dimensions are optional: an empty field is stored as null, never 0.
  const updateDimension = (id: string, field: "length" | "width" | "height", raw: string) =>
    setBoxes(
      boxes.map((b) => {
        if (b.id !== id) return b;
        const n = raw === "" ? null : Number(raw);
        return { ...b, [field]: n !== null && n > 0 ? n : null };
      })
    );

  const currentBox3D = boxes[selectedBoxFor3D] || boxes[0];
  const destPinInvalid = destPin.trim().length > 0 && !isValidPin(destPin);
  const numCls =
    "w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono text-slate-900 focus:border-indigo-600 focus:outline-none";

  return (
    <div className="space-y-6">
      {/* Active pickup facility, or a prompt when none exists */}
      {activeOriginAddress ? (
        <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-xs uppercase tracking-wider text-slate-300">Active Pickup Facility:</span>
              <span className="font-black text-sm text-white">{activeOriginAddress.label}</span>
            </div>
            <p className="text-xs text-slate-300 font-medium">
              {activeOriginAddress.address_line1}, {activeOriginAddress.city} -{" "}
              <span className="font-mono font-bold text-emerald-400">{activeOriginAddress.pincode}</span>
            </p>
          </div>
          <button type="button" onClick={onManageFacilities} className="bg-white hover:bg-slate-100 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-sm transition">
            Manage Facilities
          </button>
        </div>
      ) : (
        <PickupAddressRequiredBanner onSetup={onManageFacilities} />
      )}

      {/* Lane + value + mode */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200">
          <label className="block text-xs font-black text-indigo-950 uppercase tracking-wider mb-1">Origin PIN</label>
          <input
            type="text"
            readOnly
            value={originPin || ""}
            placeholder="Set pickup address"
            className="w-full bg-slate-100 border-2 border-indigo-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-700 cursor-not-allowed focus:outline-none"
          />
          <div className="mt-2 text-[11px] font-bold text-indigo-800 truncate">
            📍 {!originPin ? "No pickup address set" : originZoneData.loading ? "Checking..." : `${originZoneData.city} (${originZoneData.hub})`}
          </div>
          <p className="text-[10px] text-indigo-700/80 mt-0.5">Follows your active pickup facility.</p>
        </div>

        <div className={`p-4 rounded-xl border ${destPinInvalid ? "bg-rose-50/60 border-rose-300" : "bg-emerald-50/50 border-emerald-200"}`}>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-black text-emerald-950 uppercase tracking-wider">Destination PIN</label>
            <button type="button" onClick={onOpenDestCityModal} className="text-[11px] text-emerald-700 hover:underline font-bold flex items-center space-x-1">
              <MapPinIcon className="w-3.5 h-3.5" />
              <span>Lookup</span>
            </button>
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={destPin}
            onChange={(e) => setDestPin(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 400001"
            className="w-full bg-white border-2 border-emerald-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none"
          />
          <div className={`mt-2 text-[11px] font-bold truncate ${destPinInvalid ? "text-rose-700" : "text-emerald-800"}`}>
            {destPinInvalid
              ? "Enter a valid 6-digit PIN"
              : !destPin
              ? "🎯 Enter destination PIN"
              : destZoneData.loading
              ? "🎯 Checking..."
              : `🎯 ${destZoneData.city} (${destZoneData.hub})`}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">Declared Value (₹) FOV</label>
          <input
            type="number"
            min={0}
            value={declaredValue}
            onChange={(e) => setDeclaredValue(Math.max(0, Number(e.target.value) || 0))}
            className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500 mt-2 font-medium">Freight-on-value cargo risk coverage</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">Transport Mode</label>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as "all" | TransportMode)}
              className="w-full bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
            >
              <option value="all">All Modes (Air, Surface, FTL)</option>
              <option value="surface">Surface Express Only</option>
              <option value="air">Air Cargo Only</option>
              <option value="ftl">Full Truck Load (FTL)</option>
            </select>
          </div>
          <label className="flex items-center space-x-2 mt-2 cursor-pointer pt-1">
            <input type="checkbox" checked={isOda} onChange={(e) => setIsOda(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 border-slate-300" />
            <span className="text-xs text-slate-800 font-bold">Out of Delivery Area (ODA surcharge)</span>
          </label>
        </div>
      </div>

      {!highVolumeMode && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <RouteTrajectory3D originHub={originZoneData.hub} destHub={destZoneData.hub} />
        </div>
      )}

      {/* Cartons */}
      <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/70 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              Carton Specs ({boxes.length} Box Type{boxes.length > 1 ? "s" : ""})
            </span>
            <p className="text-[11px] text-slate-500 font-medium">
              Length, width and height are <strong>optional</strong>. Leave them blank and the quote uses dead weight only.
            </p>
          </div>
          <button type="button" onClick={addBox} className="text-xs text-indigo-600 hover:text-indigo-800 font-black flex items-center space-x-1">
            <PlusIcon className="w-4 h-4" />
            <span>Add Another Carton</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className={highVolumeMode ? "lg:col-span-12 space-y-2.5" : "lg:col-span-8 space-y-2.5"}>
            {boxes.map((box, idx) => (
              <div
                key={box.id}
                onClick={() => setSelectedBoxFor3D(idx)}
                className={`grid grid-cols-2 sm:grid-cols-6 gap-2.5 p-3.5 rounded-xl border-2 items-center text-xs shadow-xs cursor-pointer transition ${
                  selectedBoxFor3D === idx ? "bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200" : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Box #{idx + 1} Qty</span>
                  <input type="number" min={1} value={box.qty} onChange={(e) => updateQty(box.id, e.target.value)} className={`${numCls} font-bold`} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Weight (Kg/box) *</span>
                  <input type="number" min={0.5} step={0.5} value={box.weight} onChange={(e) => updateWeight(box.id, e.target.value)} className={`${numCls} font-bold`} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Length (cm)</span>
                  <input type="number" min={1} placeholder="Optional" value={box.length ?? ""} onChange={(e) => updateDimension(box.id, "length", e.target.value)} className={numCls} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Width (cm)</span>
                  <input type="number" min={1} placeholder="Optional" value={box.width ?? ""} onChange={(e) => updateDimension(box.id, "width", e.target.value)} className={numCls} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Height (cm)</span>
                  <input type="number" min={1} placeholder="Optional" value={box.height ?? ""} onChange={(e) => updateDimension(box.id, "height", e.target.value)} className={numCls} />
                </div>
                <div className="flex items-center justify-between sm:justify-end space-x-2 pt-2 sm:pt-0">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {hasCompleteDimensions(box)
                      ? `${(((Number(box.length) * Number(box.width) * Number(box.height)) / volumetricDivisor) * box.qty).toFixed(1)}kg vol`
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
                      aria-label="Remove carton"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!highVolumeMode && currentBox3D && (
            <div className="lg:col-span-4 flex justify-center">
              <Interactive3DBox length={currentBox3D.length} width={currentBox3D.width} height={currentBox3D.height} />
            </div>
          )}
        </div>

        {partialDimBoxes > 0 && (
          <p className="text-[11px] bg-amber-50 text-amber-900 border border-amber-300 px-3 py-2 rounded-lg font-bold">
            {partialDimBoxes} carton(s) have only some dimensions filled. Enter all three (L × W × H) or clear them; incomplete cartons use dead weight.
          </p>
        )}

        {/* Summary ribbon */}
        <div className="flex flex-wrap items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs gap-3">
          <div className="flex flex-wrap gap-6 font-medium">
            <div>
              <span className="text-slate-500">Dead Actual Weight: </span>
              <span className="font-mono font-black text-slate-900">{totalActualWeight.toFixed(1)} kg</span>
            </div>
            <div>
              <span className="text-slate-500">Volumetric Weight: </span>
              <span className="font-mono font-black text-indigo-700">{hasDimensions ? `${totalVolumetricWeight.toFixed(1)} kg` : "Omitted"}</span>
            </div>
            <div>
              <span className="text-slate-500">Billable Chargeable: </span>
              <span className="font-mono font-black text-emerald-700 text-sm">{billableWeight.toFixed(1)} kg</span>
            </div>
          </div>
          {!hasDimensions && (
            <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-bold">Dead Weight Applied</span>
          )}
        </div>
        {totalActualWeight <= 0 && (
          <p className="text-[11px] text-rose-700 font-bold">Enter a weight greater than 0 kg to see rates.</p>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// END OF PART 3 OF 7
// ============================================================================
// ============================================================================
// PART 4 OF 7 — SHIPPER MODULE B
//   Live rate matrix (strict demo isolation), single-booking checkout modal,
//   Credit Agreement application with client-side PDF compression -> Supabase
//   Storage 'agreements', shipper credit status, and the shared credit ledger.
// Paste directly after Part 3. No named exports.
// ============================================================================

// ============================================================================
// 21. LIVE RATE COMPARISON MATRIX
// ============================================================================
type CreditBadgeState =
  | { kind: "approved"; available: number }
  | { kind: "pending" }
  | { kind: "rejected" }
  | { kind: "none" };

interface ShipperRateMatrixProps {
  quotes: CalculatedQuote[];
  isLive: boolean;
  hasOrigin: boolean;
  destPin: string;
  totalWeight: number;
  creditAgreements: CreditAgreement[];
  onSelectQuote: (q: CalculatedQuote) => void;
  onOpenCreditApply: (carrierId?: string) => void;
  onSetupPickup: () => void;
}

const ShipperRateMatrix: FC<ShipperRateMatrixProps> = ({
  quotes,
  isLive,
  hasOrigin,
  destPin,
  totalWeight,
  creditAgreements,
  onSelectQuote,
  onOpenCreditApply,
  onSetupPickup
}) => {
  const [sortKey, setSortKey] = useState<"price" | "sla">("price");

  // Defence in depth: even if a demo card slipped through, it is never rendered in live mode.
  const visibleQuotes = useMemo(() => {
    const safe = isLive ? quotes.filter((q) => !q.rateCard.is_demo && !q.vendor.is_demo) : quotes;
    return [...safe].sort((a, b) =>
      sortKey === "price"
        ? a.breakdown.total - b.breakdown.total
        : a.rateCard.sla_days - b.rateCard.sla_days || a.breakdown.total - b.breakdown.total
    );
  }, [quotes, isLive, sortKey]);

  const lowestTotal = visibleQuotes.length > 0 ? Math.min(...visibleQuotes.map((q) => q.breakdown.total)) : 0;

  const creditStateFor = (carrierId: string): CreditBadgeState => {
    const mine = creditAgreements.filter((a) => a.carrier_id === carrierId);
    const approved = mine.find((a) => a.status === "Approved");
    if (approved) return { kind: "approved", available: Math.max(0, approved.approved_limit - approved.utilized_amount) };
    if (mine.some((a) => a.status === "Pending_Review")) return { kind: "pending" };
    if (mine.some((a) => a.status === "Rejected")) return { kind: "rejected" };
    return { kind: "none" };
  };

  // ---- Empty states (never fall back to dummy rates) ----
  if (visibleQuotes.length === 0) {
    let title = "No verified carrier rates found for this route yet";
    let body = "No active carrier tariff covers this lane and weight right now. Try another transport mode, or post the load for reverse-auction bidding under Load Auction (RFQ).";
    let action: ReactNode = null;

    if (!hasOrigin) {
      title = "Set your pickup location to see rates";
      body = "Freight rates are calculated from your default pickup warehouse.";
      action = (
        <button type="button" onClick={onSetupPickup} className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2 rounded-xl text-xs shadow-sm transition">
          Add Pickup Address
        </button>
      );
    } else if (!isValidPin(destPin)) {
      title = "Enter a destination PIN";
      body = "Type a valid 6-digit destination PIN code to compare carrier tariffs.";
    } else if (totalWeight <= 0) {
      title = "Enter carton weight";
      body = "Add a weight greater than 0 kg for at least one carton.";
    }

    return (
      <div className="space-y-4 pt-2">
        <h3 className="text-base font-black text-slate-900">Direct Carrier Freight Rate Matrix</h3>
        <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <p className="text-sm font-black text-slate-800">{title}</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{body}</p>
          {action}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-black text-slate-900">Direct Carrier Freight Rate Matrix</h3>
        <div className="flex items-center space-x-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as "price" | "sla")}
            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none"
            aria-label="Sort quotes"
          >
            <option value="price">Sort: Lowest price</option>
            <option value="sla">Sort: Fastest transit</option>
          </select>
          <span className="text-xs bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-1 rounded-full font-black">
            {visibleQuotes.length} {isLive ? "Verified" : "Sample"} Tariff{visibleQuotes.length > 1 ? "s" : ""} Found
          </span>
        </div>
      </div>

      {!isLive && (
        <p className="text-[11px] bg-amber-50 text-amber-900 border border-amber-300 px-3 py-2 rounded-lg font-bold">
          Demo Sandbox: these are sample tariffs. Sign in with a live account to see real carrier rates.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4">
        {visibleQuotes.map((quote) => {
          const credit = creditStateFor(quote.vendor.id);
          const isLowest = quote.breakdown.total === lowestTotal;
          return (
            <div
              key={quote.rateCard.id}
              className="bg-white border-2 border-slate-200 hover:border-indigo-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-slate-900">{quote.vendor.name}</span>
                    {quote.vendor.badge && (
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                        {quote.vendor.badge}
                      </span>
                    )}
                    {Number(quote.vendor.rating) > 0 && <span className="text-amber-500 text-xs font-black">★ {quote.vendor.rating}</span>}
                    {isLowest && (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        Lowest Price
                      </span>
                    )}
                    {!isLive && quote.rateCard.is_demo && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        Demo Rate
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
                    <span className="flex items-center space-x-1 capitalize text-slate-900 font-bold">
                      {quote.rateCard.mode === "air" ? <PlaneIcon className="w-4 h-4 text-sky-600" /> : <TruckIcon className="w-4 h-4 text-emerald-600" />}
                      <span>{quote.rateCard.mode} Linehaul</span>
                    </span>
                    <span>•</span>
                    <span>
                      Transit SLA: <strong className="text-slate-900">{quote.rateCard.sla_days} Days</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Billable Wt: <strong className="text-slate-900">{quote.billableWeight} kg</strong>
                      {quote.isDeadWeightCalculated && <em className="text-amber-700 not-italic font-bold"> (dead wt)</em>}
                    </span>
                    {quote.vendor.upi_id && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-emerald-800 font-bold">Direct UPI: {quote.vendor.upi_id}</span>
                      </>
                    )}
                  </div>

                  {/* Credit facility status with THIS carrier */}
                  <div className="pt-1">
                    {credit.kind === "approved" ? (
                      <span
                        className={`inline-flex items-center space-x-1.5 text-[11px] border px-2.5 py-0.5 rounded-lg font-bold ${
                          quote.creditAvailable ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-amber-50 text-amber-800 border-amber-300"
                        }`}
                      >
                        <CheckCircleIcon className={`w-3.5 h-3.5 ${quote.creditAvailable ? "text-emerald-600" : "text-amber-600"}`} />
                        <span>
                          {quote.creditAvailable
                            ? `Corporate Credit Approved (${formatINR(credit.available)} available)`
                            : `Credit approved, but only ${formatINR(credit.available)} available (not enough for this load)`}
                        </span>
                      </span>
                    ) : credit.kind === "pending" ? (
                      <span className="inline-flex items-center space-x-1.5 text-[11px] bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-lg font-bold">
                        <ClockIcon className="w-3.5 h-3.5 text-amber-600" />
                        <span>Credit Application Pending Review by Carrier</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenCreditApply(quote.vendor.id)}
                        className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold underline inline-flex items-center space-x-1"
                      >
                        <DocumentCheckIcon className="w-3.5 h-3.5" />
                        <span>
                          {credit.kind === "rejected" ? "Previous application rejected. Re-apply for" : "Apply for"} B2B Monthly Credit Facility with {quote.vendor.name}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Line-item breakdown */}
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
                    <span className="text-[10px] text-slate-500 font-bold block">GST + Handling{quote.breakdown.oda > 0 ? " + ODA" : ""}</span>
                    <span className="font-bold text-slate-900">{formatINR(quote.breakdown.gst + quote.breakdown.handling + quote.breakdown.oda)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-indigo-700 font-bold block">Platform Fee</span>
                    <span className="font-black text-indigo-700">{formatINR(quote.breakdown.platformConvenienceFee)}</span>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Total Consignment Cost</span>
                    <span className="text-xl font-black text-emerald-700">{formatINR(quote.breakdown.total)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectQuote(quote)}
                    className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition flex items-center space-x-1.5 shadow-sm"
                  >
                    <span>Direct Book Consignment</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 22. SINGLE CALCULATOR = BOOKING FORM (Part 3) + RATE MATRIX
// ============================================================================
interface ShipperSingleCalculatorSectionProps extends ShipperSingleBookingFormProps {
  isLive: boolean;
  calculatedQuotes: CalculatedQuote[];
  creditAgreements: CreditAgreement[];
  onSelectQuoteForBooking: (q: CalculatedQuote) => void;
  onOpenCreditApplyModal: (carrierId?: string) => void;
}

const ShipperSingleCalculatorSection: FC<ShipperSingleCalculatorSectionProps> = ({
  isLive,
  calculatedQuotes,
  creditAgreements,
  onSelectQuoteForBooking,
  onOpenCreditApplyModal,
  ...formProps
}) => {
  const totalWeight = useMemo(
    () => formProps.boxes.reduce((acc, b) => acc + (Number(b.weight) || 0) * (Number(b.qty) || 1), 0),
    [formProps.boxes]
  );

  return (
    <div className="space-y-6">
      <ShipperSingleBookingForm {...formProps} />
      <ShipperRateMatrix
        quotes={calculatedQuotes}
        isLive={isLive}
        hasOrigin={Boolean(formProps.activeOriginAddress && formProps.originPin)}
        destPin={formProps.destPin}
        totalWeight={totalWeight}
        creditAgreements={creditAgreements}
        onSelectQuote={onSelectQuoteForBooking}
        onOpenCreditApply={onOpenCreditApplyModal}
        onSetupPickup={formProps.onManageFacilities}
      />
    </div>
  );
};

// ============================================================================
// 23. SINGLE DIRECT BOOKING CHECKOUT MODAL
// The parent must call handlers.registerNewBookings([booking]) in onSuccess so
// bookings state AND the credit ledger/utilisation stay in sync (see Part 7).
// ============================================================================
interface DirectBookingModalProps {
  quote: CalculatedQuote;
  currentUser: UserProfile;
  isLive: boolean;
  originPin: string;
  destPin: string;
  boxes: BoxItem[];
  declaredValue: number;
  pickupAddress: string;
  onClose: () => void;
  onSuccess: (b: Booking) => void;
  onOpenCreditApplyModal: (carrierId?: string) => void;
}

const DirectBookingModal: FC<DirectBookingModalProps> = ({
  quote,
  currentUser,
  isLive,
  originPin,
  destPin,
  boxes,
  declaredValue,
  pickupAddress,
  onClose,
  onSuccess,
  onOpenCreditApplyModal
}) => {
  // Demo sandbox gets sample consignee data; a live account starts with blank fields.
  const [consigneeName, setConsigneeName] = useState(isLive ? "" : "Prime Electronics Retail");
  const [consigneePhone, setConsigneePhone] = useState(isLive ? "" : "+91 98200 44556");
  const [consigneeGstin, setConsigneeGstin] = useState(isLive ? "" : "27AAACP9988G1ZK");
  const [deliveryAddress, setDeliveryAddress] = useState(isLive ? "" : "Warehouse 4B, Bhiwandi Logistics Park, Mumbai");
  const [settlementType, setSettlementType] = useState<SettlementType>("direct_to_pay");
  const [directPaymentUtr, setDirectPaymentUtr] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const creditBlocked = settlementType === "corporate_credit" && !quote.creditAvailable;
  const inputCls =
    "w-full bg-white border-2 border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:border-indigo-600 focus:outline-none";

  const handleConfirm = async () => {
    setErrorMsg("");
    if (isSubmitting) return;
    if (!termsAccepted) return setErrorMsg("Please accept the consignment booking terms before proceeding.");
    if (creditBlocked) return setErrorMsg("Credit facility is not approved, or the limit is exceeded, with this transporter. Apply for credit or choose another payment mode.");
    if (!pickupAddress) return setErrorMsg("No pickup address is set. Add one under Dispatch Facilities first.");
    if (!consigneeName.trim() || !consigneePhone.trim() || !deliveryAddress.trim()) {
      return setErrorMsg("Consignee name, phone and destination address are required.");
    }
    if (consigneeGstin.trim() && consigneeGstin.trim().length !== 15) return setErrorMsg("Consignee GSTIN must be 15 characters (or leave it blank).");

    setIsSubmitting(true);

    const platformOrderId = `LC-${Math.floor(100000 + Math.random() * 900000)}`;
    const initialCarrierDocket = generateCarrierDocket(quote.vendor.name);
    const portalUrl = getOfficialCarrierTrackingUrl(quote.vendor, initialCarrierDocket);

    let refString = "DIRECT-TO-PAY-POD";
    if (settlementType === "direct_upi") {
      refString = directPaymentUtr.trim() ? `UPI-UTR-${directPaymentUtr.trim()}` : `DIRECT-UPI-${quote.vendor.upi_id || "PENDING"}`;
    } else if (settlementType === "corporate_credit") {
      refString = `CORP-CREDIT-FACILITY-${quote.creditAgreement?.id || "APPROVED"}`;
    }

    const enhancedBreakdown: CostBreakdown = {
      ...quote.breakdown,
      settlement_type: settlementType,
      payment_method:
        settlementType === "direct_upi" ? "Direct Carrier UPI" : settlementType === "corporate_credit" ? "B2B Monthly Credit" : "Direct To-Pay POD",
      payment_ref: refString,
      carrier_upi: quote.vendor.upi_id,
      credit_agreement_id: settlementType === "corporate_credit" ? quote.creditAgreement?.id : undefined
    };

    const record = {
      order_id: platformOrderId,
      awb_number: initialCarrierDocket,
      carrier_docket_no: initialCarrierDocket,
      carrier_portal_url: portalUrl,
      shipper_id: currentUser.id,
      vendor_id: quote.vendor.id,
      rate_card_id: quote.rateCard.id,
      shipper_name: currentUser.company_name || currentUser.full_name,
      shipper_phone: currentUser.phone,
      shipper_email: currentUser.email,
      shipper_gstin: currentUser.gstin,
      pickup_address: pickupAddress,
      pickup_pincode: originPin,
      consignee_name: consigneeName.trim(),
      consignee_phone: consigneePhone.trim(),
      consignee_gstin: consigneeGstin.trim().toUpperCase(),
      delivery_address: deliveryAddress.trim(),
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
      status: "Booked" as const,
      tracking_history: [
        {
          status: "Booked",
          location: `Origin Hub (${originPin})`,
          timestamp: new Date().toISOString(),
          remarks: `Order Ref ${platformOrderId} generated. Carrier Docket ${initialCarrierDocket} assigned. Direct freight (${formatINR(
            enhancedBreakdown.freightSubtotal
          )}) payable to ${quote.vendor.name} [Ref: ${refString}]. Platform fee (${formatINR(enhancedBreakdown.platformConvenienceFee)}) recorded.`
        }
      ]
    };

    try {
      if (isLive) {
        const { data, error } = await supabase.from("bookings").insert([record]).select("*, vendors(*)").maybeSingle();
        if (error || !data) {
          setErrorMsg(`Booking could not be saved: ${error?.message || "no row returned"}. Nothing was dispatched.`);
          return;
        }
        onSuccess(data as Booking);
      } else {
        onSuccess({
          ...record,
          id: `book-${Date.now()}`,
          created_at: new Date().toISOString(),
          vendors: quote.vendor,
          is_demo: true
        } as Booking);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Unexpected error while booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const settlementCard = (id: SettlementType, title: string, sub: string, disabled?: boolean) => (
    <label
      className={`p-3 rounded-xl border-2 transition ${disabled ? "opacity-60" : "cursor-pointer"} ${
        settlementType === id ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200" : "bg-white border-slate-200"
      }`}
    >
      <input type="radio" name="settlement_type" checked={settlementType === id} onChange={() => setSettlementType(id)} className="text-emerald-600" />
      <span className="font-bold block mt-1 text-slate-900">{title}</span>
      <p className="text-[10px] text-slate-500">{sub}</p>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto select-none">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">Direct Consignment Booking & Carrier Settlement</h3>
            <p className="text-xs text-slate-500">
              Carrier Partner: <strong className="text-emerald-700 font-bold">{quote.vendor.name}</strong> • Route {originPin} → {destPin}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold select-text">{errorMsg}</p>}

        <div className="bg-slate-950 text-white p-4 rounded-2xl shadow-inner space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span>Direct Freight (Payable to {quote.vendor.name}):</span>
            <strong className="text-base text-white font-mono">{formatINR(quote.breakdown.freightSubtotal)}</strong>
          </div>
          <div className="flex justify-between items-center text-indigo-300">
            <span>Platform Docket Verification Fee:</span>
            <strong className="font-mono">{formatINR(quote.breakdown.platformConvenienceFee)}</strong>
          </div>
          <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-black text-emerald-400">
            <span>Total Consignment Outlay:</span>
            <span className="font-mono text-base">{formatINR(quote.breakdown.total)}</span>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <label className="block text-slate-900 font-black uppercase tracking-wider">Choose Settlement Method:</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {settlementCard("direct_to_pay", "💵 To-Pay at Delivery", "Pay cash/cheque upon delivery.")}
            {settlementCard("direct_upi", "📲 Direct Carrier UPI", "Transfer freight directly to carrier.", !quote.vendor.upi_id)}
            {settlementCard("corporate_credit", "🏢 Corporate Credit", quote.creditAvailable ? "Approved credit balance applied" : "KYC application required")}
          </div>

          {settlementType === "corporate_credit" && !quote.creditAvailable && (
            <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-amber-900 text-xs space-y-1">
              <p className="font-bold">Notice: Formal Credit Facility Not Available For This Load</p>
              <p className="text-[11px]">Underwriting approval and sufficient limit are required before booking on net terms.</p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreditApplyModal(quote.vendor.id);
                }}
                className="text-indigo-700 font-bold underline text-[11px]"
              >
                Apply for credit facility with {quote.vendor.name} now →
              </button>
            </div>
          )}

          {settlementType === "direct_upi" && quote.vendor.upi_id && (
            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-2 font-mono">
              <div className="flex justify-between items-center text-xs">
                <span className="text-emerald-950 font-bold">Carrier UPI Handle:</span>
                <span className="bg-white px-2 py-0.5 rounded font-black text-slate-900 border border-emerald-200 select-text">{quote.vendor.upi_id}</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Consignee Name *</label>
                <input type="text" value={consigneeName} onChange={(e) => setConsigneeName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Consignee Phone *</label>
                <input type="tel" value={consigneePhone} onChange={(e) => setConsigneePhone(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Consignee GSTIN</label>
                <input type="text" maxLength={15} value={consigneeGstin} onChange={(e) => setConsigneeGstin(e.target.value.toUpperCase())} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Pickup From</label>
                <input type="text" readOnly value={pickupAddress} className={`${inputCls} bg-slate-100 text-slate-600 cursor-not-allowed`} />
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Destination Address *</label>
              <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={inputCls} />
            </div>
          </div>

          <label className="flex items-start space-x-2 pt-2 cursor-pointer">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 text-indigo-600 rounded" />
            <span className="text-[11px] text-slate-600 font-medium">
              I agree to settle freight directly with {quote.vendor.name} under Carriage by Road Act 2007 guidelines.
            </span>
          </label>
        </div>

        <div className="flex justify-end space-x-3 border-t border-slate-200 pt-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900">
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || !termsAccepted || creditBlocked}
            onClick={handleConfirm}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-md transition disabled:opacity-50"
          >
            {isSubmitting ? "Assigning Docket..." : "Confirm Booking & Assign Carrier Docket"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 24. CREDIT AGREEMENT APPLICATION — CLIENT-SIDE COMPRESSION -> SUPABASE STORAGE
// Flow: validate -> compressAgreementFile (pdf-lib useObjectStreams / JPEG re-encode)
//       -> upload to bucket 'agreements' -> persist path/URL via
//       handlers.handleSubmitCreditApplication (inserts into credit_agreements).
// ============================================================================
interface CreditApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLive: boolean;
  carriers: Vendor[];
  existingAgreements: CreditAgreement[];
  currentShipper: UserProfile;
  defaultCarrierId?: string;
  onSubmitApplication: (payload: CreditApplicationPayload) => Promise<{ ok: boolean; error?: string }>;
}

const MAX_AGREEMENT_UPLOAD_MB = 15;

const CreditApplyModal: FC<CreditApplyModalProps> = ({
  isOpen,
  onClose,
  isLive,
  carriers,
  existingAgreements,
  currentShipper,
  defaultCarrierId,
  onSubmitApplication
}) => {
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>(defaultCarrierId || carriers[0]?.id || "");
  const [requestedLimit, setRequestedLimit] = useState<number>(300000);
  const [termsDays, setTermsDays] = useState<number>(15);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusType, setStatusType] = useState<"idle" | "optimizing" | "uploading" | "saving" | "success" | "error">("idle");
  const [statusText, setStatusText] = useState("");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carriers may finish loading after the modal mounts, or a carrier may be preselected.
  useEffect(() => {
    if (defaultCarrierId) setSelectedCarrierId(defaultCarrierId);
    else if (!selectedCarrierId && carriers[0]) setSelectedCarrierId(carriers[0].id);
  }, [defaultCarrierId, carriers, selectedCarrierId]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    []
  );

  if (!isOpen) return null;

  const blockingAgreement = existingAgreements.find(
    (a) => a.carrier_id === selectedCarrierId && (a.status === "Pending_Review" || a.status === "Approved")
  );

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const okType = file.type === "application/pdf" || file.type.startsWith("image/") || file.name.toLowerCase().endsWith(".pdf");
    if (!okType) {
      setStatusType("error");
      setStatusText("Only PDF or image scans are accepted.");
      return;
    }
    if (file.size > MAX_AGREEMENT_UPLOAD_MB * 1024 * 1024) {
      setStatusType("error");
      setStatusText(`File is larger than ${MAX_AGREEMENT_UPLOAD_MB} MB. Please scan at a lower resolution.`);
      return;
    }
    setSelectedFile(file);
    setStatusType("idle");
    setStatusText("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedFile) {
      setStatusType("error");
      setStatusText("Please upload the executed B2B Credit Agreement or KYC document.");
      return;
    }
    if (!selectedCarrierId) {
      setStatusType("error");
      setStatusText("Select a carrier to apply to.");
      return;
    }
    if (requestedLimit <= 0) {
      setStatusType("error");
      setStatusText("Please provide a valid requested credit limit.");
      return;
    }
    if (blockingAgreement) {
      setStatusType("error");
      setStatusText("You already have a pending or approved facility with this carrier.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Compress in the browser (no-op for files <= 1 MB; original kept if not smaller)
      setStatusType("optimizing");
      setStatusText("Optimizing document...");
      const result = await compressAgreementFile(selectedFile);
      const fileToUpload = result.file;

      // 2. Upload to Supabase Storage (live accounts only; the sandbox never writes to storage)
      let filePath: string | undefined;
      let documentUrl = "";
      if (isLive) {
        setStatusType("uploading");
        setStatusText("Uploading to secure storage...");
        filePath = buildAgreementStoragePath(currentShipper.id, fileToUpload.name);
        const { error: upErr } = await supabase.storage.from("agreements").upload(filePath, fileToUpload, {
          cacheControl: "3600",
          upsert: false,
          contentType: fileToUpload.type || "application/pdf"
        });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        // Works if the bucket is public; for a private bucket the app opens documents via signed URL using file_path.
        documentUrl = supabase.storage.from("agreements").getPublicUrl(filePath).data.publicUrl;
      } else {
        documentUrl = URL.createObjectURL(fileToUpload);
      }

      // 3. Persist the application record
      setStatusType("saving");
      setStatusText("Submitting application...");
      const saved = await onSubmitApplication({
        carrierId: selectedCarrierId,
        limit: requestedLimit,
        termsDays,
        docName: fileToUpload.name,
        documentUrl,
        filePath,
        originalSizeKB: result.originalSizeKB,
        compressedSizeKB: result.compressedSizeKB
      });
      if (!saved.ok) {
        // Do not leave an orphaned file behind if the record could not be created.
        if (isLive && filePath) await supabase.storage.from("agreements").remove([filePath]);
        throw new Error(saved.error || "Could not save the application.");
      }

      setStatusType("success");
      setStatusText(
        result.savedKB > 0
          ? `Submitted. Compressed ${result.originalSizeKB} KB → ${result.compressedSizeKB} KB (saved ${result.savedKB} KB).`
          : "Application submitted successfully."
      );
      closeTimerRef.current = setTimeout(() => {
        setIsSubmitting(false);
        setStatusType("idle");
        setStatusText("");
        setSelectedFile(null);
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error("Credit application failed:", err);
      setStatusType("error");
      setStatusText(err?.message || "Failed to process document. Please try again.");
      setIsSubmitting(false);
    }
  };

  const pillCls =
    statusType === "optimizing"
      ? "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
      : statusType === "uploading" || statusType === "saving"
      ? "bg-indigo-100 text-indigo-900 border-indigo-300 animate-pulse"
      : statusType === "success"
      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
      : "bg-rose-100 text-rose-900 border-rose-300";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Apply for Carrier Credit Facility</h3>
            <p className="text-xs text-slate-500 font-medium">Submit the signed credit agreement / KYC for carrier underwriting.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="text-slate-400 hover:text-slate-700 p-1 disabled:opacity-40" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {carriers.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl">
            No carriers are onboarded on the platform yet, so there is no one to apply to.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Select Target Transporter</label>
              <select
                disabled={isSubmitting}
                value={selectedCarrierId}
                onChange={(e) => setSelectedCarrierId(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              >
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.gstin ? ` (GSTIN: ${c.gstin})` : ""}
                  </option>
                ))}
              </select>
              {blockingAgreement && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1.5 mt-1.5 font-bold">
                  You already have a {blockingAgreement.status === "Approved" ? "approved" : "pending"} credit facility with this carrier.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Requested Credit Ceiling (₹)</label>
                <input
                  type="number"
                  min={10000}
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

            <div>
              <label className="block text-slate-700 font-bold mb-1">Upload Signed Agreement / GST KYC (PDF or Scan) *</label>
              <div className="border-2 border-dashed border-indigo-300 rounded-2xl p-4 bg-indigo-50/40 text-center space-y-2">
                <input type="file" id="credit_agreement_doc" accept=".pdf,application/pdf,image/*" disabled={isSubmitting} onChange={handleFilePick} className="hidden" />
                <label
                  htmlFor="credit_agreement_doc"
                  className={`bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 shadow-xs ${
                    isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  }`}
                >
                  <UploadIcon className="w-4 h-4" />
                  <span>{selectedFile ? `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)` : "Select Agreement Document"}</span>
                </label>

                {statusText && (
                  <div className="pt-1.5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black border ${pillCls}`}>
                      {statusType === "success" ? "✓ " : statusType === "error" ? "⚠ " : "⏳ "}
                      {statusText}
                    </span>
                  </div>
                )}
                <p className="text-[10px] text-slate-500">Documents over 1 MB are compressed in your browser before upload (max {MAX_AGREEMENT_UPLOAD_MB} MB).</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-600">
              <p>
                <strong>Applying Entity:</strong> {currentShipper.company_name}
                {currentShipper.gstin ? ` (${currentShipper.gstin})` : ""}
              </p>
              <p>
                <strong>Authorized Signatory:</strong> {currentShipper.full_name}
                {currentShipper.phone ? ` (${currentShipper.phone})` : ""}
              </p>
            </div>

            <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-200">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900 disabled:opacity-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedFile || Boolean(blockingAgreement)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? "Processing..." : "Submit Credit Application"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 25. SHIPPER CREDIT AGREEMENT STATUS DASHBOARD
// ============================================================================
// Opens a private document via a signed URL. The blank tab is opened synchronously
// (inside the click) so popup blockers don't swallow it after the async call.
async function openAgreementDocument(
  agreement: CreditAgreement,
  getUrl: (a: CreditAgreement) => Promise<string>
): Promise<void> {
  const win = window.open("", "_blank");
  try {
    const url = await getUrl(agreement);
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (err) {
    if (win) win.close();
    alert("Could not open the document. Please try again.");
  }
}

interface ShipperCreditStatusSectionProps {
  agreements: CreditAgreement[];
  onApplyNewCredit: () => void;
  getAgreementViewUrl: (a: CreditAgreement) => Promise<string>;
}

const ShipperCreditStatusSection: FC<ShipperCreditStatusSectionProps> = ({ agreements, onApplyNewCredit, getAgreementViewUrl }) => {
  return (
    <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <DocumentCheckIcon className="w-5 h-5 text-indigo-600" />
            <span>Carrier Credit Agreements & KYC Facilities</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Credit facilities require a signed agreement and carrier underwriting review.</p>
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
        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl space-y-2">
          <p>No credit agreements yet. You cannot book on credit without an approved carrier facility.</p>
          <button type="button" onClick={onApplyNewCredit} className="text-indigo-600 font-bold underline">
            Submit an application and upload your signed agreement
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agreements.map((agreement) => {
            const availableLimit = Math.max(0, agreement.approved_limit - agreement.utilized_amount);
            const utilizationPct =
              agreement.approved_limit > 0 ? Math.min(100, Math.round((agreement.utilized_amount / agreement.approved_limit) * 100)) : 0;
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

                {agreement.status === "Approved" ? (
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
                      <span className="text-[10px] text-slate-500 block">Available</span>
                      <strong className="font-mono text-emerald-600">{formatINR(availableLimit)}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Requested Limit</span>
                    <strong className="font-mono text-slate-900">{formatINR(agreement.requested_limit)}</strong>
                  </div>
                )}

                {agreement.status === "Rejected" && agreement.rejection_reason && (
                  <p className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 font-medium">
                    <strong>Reason:</strong> {agreement.rejection_reason}
                  </p>
                )}

                {agreement.status === "Approved" && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                      <span>Limit Utilization</span>
                      <span>{utilizationPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${utilizationPct > 85 ? "bg-rose-500" : utilizationPct > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${utilizationPct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  <span>
                    Terms: <strong>{agreement.payment_terms_days} Days Net</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => openAgreementDocument(agreement, getAgreementViewUrl)}
                    className="text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center space-x-1"
                  >
                    <DocumentIcon className="w-3.5 h-3.5" />
                    <span>View Agreement Document</span>
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
// 26. SHARED CREDIT LEDGER (SHIPPER: dues view | CARRIER: receivables + settle)
// ============================================================================
type LedgerEffectiveStatus = "Unpaid" | "Settled" | "Overdue";

function ledgerEffectiveStatus(entry: CreditLedgerEntry): LedgerEffectiveStatus {
  if (entry.status === "Settled") return "Settled";
  const today = new Date().toISOString().split("T")[0];
  if (entry.status === "Overdue" || (entry.due_date && entry.due_date < today)) return "Overdue";
  return "Unpaid";
}

interface CombinedCreditLedgerSectionProps {
  role: RoleType;
  currentUser: UserProfile;
  creditAgreements: CreditAgreement[];
  creditLedger: CreditLedgerEntry[];
  onSettleLedgerEntry?: (entryId: string, ref: string) => void | Promise<void>;
}

const CombinedCreditLedgerSection: FC<CombinedCreditLedgerSectionProps> = ({
  role,
  currentUser,
  creditAgreements,
  creditLedger,
  onSettleLedgerEntry
}) => {
  const [filter, setFilter] = useState<"All" | LedgerEffectiveStatus>("Unpaid");
  const [settleRefInput, setSettleRefInput] = useState<Record<string, string>>({});
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const isShipper = role === "shipper";
  // Only the carrier (the party being paid) can confirm receipt; a shipper cannot mark its own dues settled.
  const canSettle = !isShipper && Boolean(onSettleLedgerEntry);
  const myCarrierId = currentUser.vendor_id || currentUser.id;

  const relevantLedger = useMemo(
    () => creditLedger.filter((e) => (isShipper ? e.shipper_id === currentUser.id : e.carrier_id === myCarrierId)),
    [creditLedger, isShipper, currentUser.id, myCarrierId]
  );

  const filteredEntries = useMemo(
    () => (filter === "All" ? relevantLedger : relevantLedger.filter((e) => ledgerEffectiveStatus(e) === filter)),
    [relevantLedger, filter]
  );

  const summary: CreditLedgerSummary = useMemo(() => {
    const relevantAgreements = creditAgreements.filter((a) => (isShipper ? a.shipper_id === currentUser.id : a.carrier_id === myCarrierId));
    const approved = relevantAgreements.filter((a) => a.status === "Approved");
    const totalLimit = approved.reduce((sum, a) => sum + a.approved_limit, 0);
    const totalUtilized = approved.reduce((sum, a) => sum + a.utilized_amount, 0);
    const open = relevantLedger.filter((e) => ledgerEffectiveStatus(e) !== "Settled");
    return {
      total_credit_limit: totalLimit,
      utilized_credit: totalUtilized,
      available_credit: Math.max(0, totalLimit - totalUtilized),
      outstanding_balance: open.reduce((sum, e) => sum + e.amount, 0),
      overdue_amount: relevantLedger.filter((e) => ledgerEffectiveStatus(e) === "Overdue").reduce((sum, e) => sum + e.amount, 0),
      active_agreements_count: approved.length
    };
  }, [creditAgreements, relevantLedger, isShipper, currentUser.id, myCarrierId]);

  const handleSettle = async (entryId: string) => {
    if (!onSettleLedgerEntry) return;
    const ref = (settleRefInput[entryId] || "").trim() || `UTR-RECON-${Date.now().toString().slice(-6)}`;
    setSettlingId(entryId);
    try {
      await onSettleLedgerEntry(entryId, ref);
    } finally {
      setSettlingId(null);
    }
  };

  const statusPill = (s: LedgerEffectiveStatus) =>
    s === "Settled"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : s === "Overdue"
      ? "bg-rose-100 text-rose-800 border-rose-300"
      : "bg-amber-100 text-amber-800 border-amber-300";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <DocumentCheckIcon className="w-5 h-5 text-indigo-600" />
            <span>{isShipper ? "B2B Credit Facility & Outstanding Balance Ledger" : "Receivables & Shipper Credit Risk Ledger"}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isShipper
              ? "Track your approved credit limits, outstanding dues and repayment schedules."
              : "Monitor extended credit exposure, utilized limits by shippers, and outstanding receivables."}
          </p>
        </div>
        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl text-xs font-bold text-white shadow-sm">
          {(["Unpaid", "Overdue", "Settled", "All"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg transition ${filter === tab ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">{isShipper ? "Total Approved Limit" : "Total Extended Exposure"}</span>
          <span className="text-2xl font-black text-slate-900 font-mono">{formatINR(summary.total_credit_limit)}</span>
          <p className="text-[10px] text-slate-400">Across {summary.active_agreements_count} active facilities</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">{isShipper ? "Utilized Balance (Dues)" : "Active Shipper Dues"}</span>
          <span className="text-2xl font-black text-indigo-700 font-mono">{formatINR(summary.utilized_credit)}</span>
          <p className="text-[10px] text-slate-400">Consignments booked on credit terms</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">{isShipper ? "Available Credit Buffer" : "Unutilized Buffer"}</span>
          <span className="text-2xl font-black text-emerald-600 font-mono">{formatINR(summary.available_credit)}</span>
          <p className="text-[10px] text-slate-400">Ready for instant dispatching</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Overdue / Critical Dues</span>
          <span className={`text-2xl font-black font-mono ${summary.overdue_amount > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {formatINR(summary.overdue_amount)}
          </span>
          <p className="text-[10px] text-slate-400">Past agreed net payment due dates</p>
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Consignment Credit Ledger ({filteredEntries.length} Records)</h3>
          <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-full border border-slate-200">Net Payment Terms</span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            {relevantLedger.length === 0
              ? isShipper
                ? "No credit bookings yet. Book a consignment on corporate credit once a facility is approved."
                : "No credit receivables yet."
              : "No ledger entries match the selected status filter."}
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
                  <th className="py-3 px-3.5 text-right">{canSettle ? "Reconciliation" : "Reference"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {filteredEntries.map((entry) => {
                  const eff = ledgerEffectiveStatus(entry);
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3.5 font-mono font-black text-indigo-700">{entry.order_ref}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-900 font-bold">{entry.carrier_docket_no}</td>
                      <td className="py-3 px-3.5 font-bold text-slate-800">{isShipper ? entry.carrier_name : entry.shipper_name}</td>
                      <td className="py-3 px-3.5 font-mono font-black text-slate-900 text-sm">{formatINR(entry.amount)}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-600 text-[11px]">{entry.due_date}</td>
                      <td className="py-3 px-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusPill(eff)}`}>{eff}</span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        {eff !== "Settled" && canSettle ? (
                          <div className="inline-flex items-center space-x-1.5">
                            <input
                              type="text"
                              placeholder="UTR Ref"
                              value={settleRefInput[entry.id] || ""}
                              onChange={(e) => setSettleRefInput({ ...settleRefInput, [entry.id]: e.target.value })}
                              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-[11px] font-mono max-w-[100px]"
                            />
                            <button
                              type="button"
                              disabled={settlingId === entry.id}
                              onClick={() => handleSettle(entry.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[11px] transition disabled:opacity-50"
                            >
                              {settlingId === entry.id ? "..." : "Mark Settled"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-400">
                            {eff === "Settled" ? entry.payment_ref || "Settled" : isShipper ? "Pay carrier directly" : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// END OF PART 4 OF 7
// ============================================================================
// ============================================================================
// PART 5 OF 7 — CARRIER MODULE A
//   Shipper RFQ poster, Available Loads board + Bid modal, public tracking URL
//   config, fleet tracking & bilty console, commercial rate cards (+ CSV and
//   manual modal), settlement bank/UPI profile.
// Paste directly after Part 4. No named exports.
// ============================================================================

// ============================================================================
// 27. SHIPPER: POST HEAVY / FTL LOAD FOR REVERSE AUCTION (RFQ)
// ============================================================================
interface ShipperRfqSectionProps {
  currentUser: UserProfile;
  isLive: boolean;
  defaultOriginPin: string;
  rfqList: RfqBid[];
  setRfqList: React.Dispatch<React.SetStateAction<RfqBid[]>>;
}

const ShipperRfqSection: FC<ShipperRfqSectionProps> = ({ currentUser, isLive, defaultOriginPin, rfqList, setRfqList }) => {
  // Live accounts start blank; the sandbox gets realistic sample values.
  const [origin, setOrigin] = useState(isLive ? defaultOriginPin : "110001");
  const [dest, setDest] = useState(isLive ? "" : "560001");
  const [desc, setDesc] = useState(isLive ? "" : "Industrial Gearboxes and Heavy Machinery Parts");
  const [weight, setWeight] = useState<number>(isLive ? 0 : 8500);
  const [truck, setTruck] = useState("32ft Multi-Axle Trailer (MXL)");
  const [budget, setBudget] = useState<number>(isLive ? 0 : 65000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // Pre-fill origin once the saved pickup address finishes loading.
  useEffect(() => {
    if (isLive && defaultOriginPin && !origin) setOrigin(defaultOriginPin);
  }, [isLive, defaultOriginPin, origin]);

  const inputCls =
    "w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:border-indigo-600 focus:outline-none";

  const handleCreateRfq = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setOkMsg("");
    if (!isValidPin(origin) || !isValidPin(dest)) return setErrorMsg("Enter valid 6-digit origin and destination PIN codes.");
    if (weight <= 0) return setErrorMsg("Cargo weight must be greater than 0 kg.");
    if (budget <= 0) return setErrorMsg("Ceiling target budget must be greater than ₹0.");

    setIsSubmitting(true);
    const record = {
      shipper_name: currentUser.company_name || currentUser.full_name,
      origin_pin: origin.trim(),
      dest_pin: dest.trim(),
      cargo_description: desc.trim(),
      total_weight_kg: Number(weight),
      truck_type: truck,
      target_price: Number(budget),
      status: "Open" as const,
      bids: [] as RfqBid["bids"]
    };

    try {
      if (isLive) {
        const { data, error } = await supabase.from("rfq_bids").insert([record]).select("*").maybeSingle();
        if (error || !data) {
          setErrorMsg(`Load could not be posted: ${error?.message || "no row returned"}.`);
          return;
        }
        setRfqList((prev) => [data as RfqBid, ...prev]);
      } else {
        setRfqList((prev) => [{ ...record, id: `rfq-${Date.now()}`, created_at: new Date().toISOString(), is_demo: true }, ...prev]);
      }
      setOkMsg("Load broadcast to verified fleet operators.");
      if (isLive) {
        setDesc("");
        setWeight(0);
        setBudget(0);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-lg font-black text-slate-900">Post Heavy / FTL Cargo Load for Reverse Auction</h2>
          <p className="text-xs text-slate-500 mt-0.5">Verified fleet operators bid competitively at or below your ceiling target price.</p>
        </div>

        {errorMsg && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold">{errorMsg}</p>}
        {okMsg && <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl font-bold">{okMsg}</p>}

        <form onSubmit={handleCreateRfq} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-800 font-bold mb-1">Origin Pincode (Pickup) *</label>
            <input type="text" inputMode="numeric" maxLength={6} value={origin} onChange={(e) => setOrigin(e.target.value.replace(/\D/g, ""))} className={`${inputCls} font-mono font-bold`} required />
          </div>
          <div>
            <label className="block text-slate-800 font-bold mb-1">Destination Pincode (Drop) *</label>
            <input type="text" inputMode="numeric" maxLength={6} value={dest} onChange={(e) => setDest(e.target.value.replace(/\D/g, ""))} className={`${inputCls} font-mono font-bold`} required />
          </div>
          <div>
            <label className="block text-slate-800 font-bold mb-1">Cargo Description *</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Electrical Panels / Steel Coils" className={inputCls} required />
          </div>
          <div>
            <label className="block text-slate-800 font-bold mb-1">Total Cargo Weight (Kg) *</label>
            <input type="number" min={1} value={weight || ""} onChange={(e) => setWeight(Number(e.target.value))} className={`${inputCls} font-mono font-bold`} required />
          </div>
          <div>
            <label className="block text-slate-800 font-bold mb-1">Required Vehicle / Truck Body</label>
            <select value={truck} onChange={(e) => setTruck(e.target.value)} className={`${inputCls} font-bold`}>
              <option value="32ft Multi-Axle Trailer (MXL)">32ft Multi-Axle Trailer (MXL)</option>
              <option value="24ft Container Truck">24ft Container Truck</option>
              <option value="Taurus 21-Tonner (10-Tyre)">Taurus 21-Tonner (10-Tyre)</option>
              <option value="19ft Open Body Truck">19ft Open Body Truck</option>
              <option value="Tata 407 (3.5T)">Tata 407 (3.5T)</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-800 font-bold mb-1">Ceiling Target Budget (₹) *</label>
            <input type="number" min={1} value={budget || ""} onChange={(e) => setBudget(Number(e.target.value))} className={`${inputCls} font-mono font-bold`} required />
          </div>
          <div className="md:col-span-3 flex justify-end pt-2">
            <button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-7 py-3 rounded-xl text-xs transition shadow-md disabled:opacity-50">
              {isSubmitting ? "Broadcasting..." : "Broadcast Load to Verified Transporters"}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-black text-slate-900">Your Broadcasted Loads & Carrier Counter-Bids</h3>
        {rfqList.length === 0 ? (
          <div className="bg-white border border-slate-300 rounded-2xl p-8 text-center text-slate-500 text-xs shadow-sm">
            No reverse auction loads posted yet. Fill the form above to invite competitive carrier bidding.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {rfqList.map((rfq) => {
              const bids = [...(rfq.bids || [])].sort((a, b) => a.bid_amount - b.bid_amount);
              return (
                <div key={rfq.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded font-black">
                          PIN {rfq.origin_pin} → {rfq.dest_pin}
                        </span>
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">{rfq.truck_type}</span>
                        <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold uppercase">{rfq.status}</span>
                      </div>
                      <h4 className="text-base font-black text-slate-900 mt-1.5">{rfq.cargo_description}</h4>
                      <p className="text-xs text-slate-500 font-medium">Cargo Weight: {rfq.total_weight_kg.toLocaleString("en-IN")} kg</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Ceiling Target Budget</span>
                      <span className="text-xl font-black text-emerald-700 font-mono">{formatINR(rfq.target_price)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-black text-slate-700 block uppercase tracking-wider">Received Carrier Bids ({bids.length})</span>
                    {bids.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">Awaiting bids from fleet operators on the carrier exchange...</p>
                    ) : (
                      <div className="space-y-2">
                        {bids.map((bid, bIdx) => (
                          <div key={`${bid.vendor_name}-${bIdx}`} className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${bIdx === 0 ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
                            <div>
                              <span className="font-black text-slate-900 block">
                                {bid.vendor_name} {bIdx === 0 && <em className="not-italic text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded ml-1">LOWEST</em>}
                              </span>
                              {bid.notes && <span className="text-[11px] text-slate-600 font-medium mt-0.5 block">{bid.notes}</span>}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 28. CARRIER: AVAILABLE LOADS BOARD + LOAD BIDDING MODAL
// ============================================================================
interface LoadBidModalProps {
  rfq: RfqBid;
  existingBid?: RfqBid["bids"][number];
  onClose: () => void;
  onSubmit: (amount: number, days: number, notes: string) => Promise<{ ok: boolean; error?: string }>;
}

const LoadBidModal: FC<LoadBidModalProps> = ({ rfq, existingBid, onClose, onSubmit }) => {
  const [amount, setAmount] = useState<number>(existingBid?.bid_amount || 0);
  const [days, setDays] = useState<number>(existingBid?.transit_days || 0);
  const [notes, setNotes] = useState(existingBid?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (amount <= 0 || days <= 0) return setErrorMsg("Enter both a quote price and transit SLA days.");
    if (amount > rfq.target_price) return setErrorMsg(`Your quote must be at or below the shipper's ceiling of ${formatINR(rfq.target_price)}.`);
    setIsSubmitting(true);
    const res = await onSubmit(amount, days, notes.trim());
    setIsSubmitting(false);
    if (!res.ok) return setErrorMsg(res.error || "Bid could not be placed.");
    onClose();
  };

  const inputCls = "w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:border-indigo-600 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl my-8">
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">{existingBid ? "Revise Your Bid" : "Place Competitive Bid"}</h3>
            <p className="text-xs text-slate-500 font-medium">
              PIN {rfq.origin_pin} → {rfq.dest_pin} • {rfq.total_weight_kg.toLocaleString("en-IN")} kg • {rfq.truck_type}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-950 text-white p-3.5 rounded-xl text-xs flex justify-between items-center">
          <span className="text-slate-300">Shipper Ceiling Budget</span>
          <strong className="font-mono text-emerald-400 text-sm">{formatINR(rfq.target_price)}</strong>
        </div>

        {errorMsg && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold">{errorMsg}</p>}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Quoted Price (₹) *</label>
              <input type="number" min={1} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} placeholder="e.g. 58000" className={`${inputCls} font-mono font-bold`} />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Transit SLA (Days) *</label>
              <input type="number" min={1} value={days || ""} onChange={(e) => setDays(Number(e.target.value))} placeholder="e.g. 3" className={`${inputCls} font-mono font-bold`} />
            </div>
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Fleet / Driver Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Dedicated trailer ready at hub" className={inputCls} />
          </div>
          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50">
              {isSubmitting ? "Submitting..." : existingBid ? "Update Bid" : "Place Official Bid"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CarrierBidsSectionProps {
  currentUser: UserProfile;
  isLive: boolean;
  rfqList: RfqBid[];
  setRfqList: React.Dispatch<React.SetStateAction<RfqBid[]>>;
}

const CarrierBidsSection: FC<CarrierBidsSectionProps> = ({ currentUser, isLive, rfqList, setRfqList }) => {
  const [activeRfq, setActiveRfq] = useState<RfqBid | null>(null);
  const [search, setSearch] = useState("");
  const bidderName = currentUser.company_name || currentUser.full_name;

  const openLoads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rfqList
      .filter((r) => r.status === "Open")
      .filter((r) => !q || r.origin_pin.includes(q) || r.dest_pin.includes(q) || r.cargo_description.toLowerCase().includes(q) || r.truck_type.toLowerCase().includes(q));
  }, [rfqList, search]);

  const submitBid = async (rfq: RfqBid, amount: number, days: number, notes: string): Promise<{ ok: boolean; error?: string }> => {
    const newBid = {
      vendor_name: bidderName,
      bid_amount: amount,
      transit_days: days,
      notes: notes || "Fleet available for immediate dispatch.",
      created_at: new Date().toISOString()
    };

    if (isLive) {
      // Re-read the latest bids first so a concurrent bid from another carrier isn't overwritten.
      const { data: fresh, error: readErr } = await supabase.from("rfq_bids").select("bids, status").eq("id", rfq.id).maybeSingle();
      if (readErr || !fresh) return { ok: false, error: readErr?.message || "This load is no longer available." };
      if (fresh.status !== "Open") return { ok: false, error: "This load is no longer open for bidding." };
      const merged = [...((fresh.bids as RfqBid["bids"]) || []).filter((b) => b.vendor_name !== bidderName), newBid];
      const { error } = await supabase.from("rfq_bids").update({ bids: merged }).eq("id", rfq.id);
      if (error) return { ok: false, error: error.message };
      setRfqList((prev) => prev.map((r) => (r.id === rfq.id ? { ...r, bids: merged } : r)));
      return { ok: true };
    }

    const merged = [...(rfq.bids || []).filter((b) => b.vendor_name !== bidderName), newBid];
    setRfqList((prev) => prev.map((r) => (r.id === rfq.id ? { ...r, bids: merged } : r)));
    return { ok: true };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Available Loads & Reverse Auction Board</h2>
          <p className="text-xs text-slate-500 mt-0.5">Browse open shipper loads and submit linehaul quotes at or below the ceiling budget.</p>
        </div>
        <div className="relative">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by PIN, cargo, truck..."
            className="bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 w-64 focus:border-indigo-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {openLoads.length === 0 ? (
          <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-xs shadow-sm">
            {rfqList.length === 0 ? "No live shipper loads are open right now." : "No open loads match your filter."}
          </div>
        ) : (
          openLoads.map((rfq) => {
            const mine = (rfq.bids || []).find((b) => b.vendor_name === bidderName);
            return (
              <div key={rfq.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded font-mono font-black">
                        PIN {rfq.origin_pin} → {rfq.dest_pin}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">{rfq.truck_type}</span>
                      <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold uppercase">{rfq.status}</span>
                    </div>
                    <h4 className="text-base font-black text-slate-900">{rfq.cargo_description}</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Shipper: {rfq.shipper_name} • Weight: {rfq.total_weight_kg.toLocaleString("en-IN")} kg • {(rfq.bids || []).length} bid(s) so far
                    </p>
                    {mine && (
                      <p className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg px-2.5 py-1 inline-block mt-1">
                        Your bid: {formatINR(mine.bid_amount)} • {mine.transit_days} day SLA
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-2">
                    <div>
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Shipper Ceiling Budget</span>
                      <span className="text-xl font-black text-emerald-700 font-mono">{formatINR(rfq.target_price)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveRfq(rfq)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl transition shadow-sm"
                    >
                      {mine ? "Revise Bid" : "Bid On This Load"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {activeRfq && (
        <LoadBidModal
          rfq={activeRfq}
          existingBid={(activeRfq.bids || []).find((b) => b.vendor_name === bidderName)}
          onClose={() => setActiveRfq(null)}
          onSubmit={(amount, days, notes) => submitBid(activeRfq, amount, days, notes)}
        />
      )}
    </div>
  );
};

// ============================================================================
// 29. CARRIER-SPECIFIC PUBLIC TRACKING PORTAL URL
// ============================================================================
interface CarrierTrackingUrlConfigProps {
  currentUrl: string;
  onSave: (newUrl: string) => void | Promise<void>;
}

const CarrierTrackingUrlConfigSection: FC<CarrierTrackingUrlConfigProps> = ({ currentUrl, onSave }) => {
  const [urlInput, setUrlInput] = useState(currentUrl || "");
  const [testDocket, setTestDocket] = useState("148920194821");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // The saved URL may arrive after mount (profile load) or change with the mode.
  useEffect(() => {
    setUrlInput(currentUrl || "");
  }, [currentUrl]);

  const previewResolvedUrl = useMemo(() => {
    if (!urlInput.trim()) return "Configure a tracking URL to see the live resolution preview";
    return appendDocketToBase(urlInput, testDocket.trim() || "DOCKET");
  }, [urlInput, testDocket]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const clean = urlInput.trim();
    try {
      const parsed = new URL(clean);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad protocol");
    } catch {
      return setErrorMsg("Tracking portal URL must be a valid address starting with http:// or https://");
    }
    setIsSaving(true);
    try {
      await onSave(clean);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
          <ExternalLinkIcon className="w-5 h-5 text-indigo-600" />
          <span>Carrier-Specific Public Tracking Portal URL</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Shippers and consignees who click &quot;Carrier Portal&quot; are redirected to your tracking URL with their docket number appended.
        </p>
      </div>

      {errorMsg && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold">{errorMsg}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-700 font-bold mb-1">Tracking Endpoint Base URL *</label>
          <input
            type="url"
            required
            placeholder="e.g. https://www.yourdomain.com/track?awb= or https://tracking.carrier.in/"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono text-slate-900 font-bold focus:bg-white focus:border-indigo-600 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            End the URL with an equals sign (<code className="font-mono text-indigo-700 font-bold">?awb=</code>) or a trailing slash (<code className="font-mono text-indigo-700 font-bold">/</code>) so the docket appends correctly.
          </p>
        </div>

        <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 border border-slate-800">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">Real-Time Redirection Simulator</span>
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
            <span className="font-mono text-xs text-indigo-300 break-all select-all block bg-slate-950 p-2 rounded-lg border border-slate-800">{previewResolvedUrl}</span>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50">
            {isSaving ? "Saving..." : "Save Public Tracking Portal"}
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================================
// 30. CARRIER FLEET TRACKING & PHYSICAL BILTY DISPATCH CONSOLE
// ============================================================================
interface CarrierOrdersSectionProps {
  currentUser: UserProfile;
  bookings: Booking[];
  statusUpdateMap: StatusUpdateMap;
  setStatusUpdateMap: React.Dispatch<React.SetStateAction<StatusUpdateMap>>;
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
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(
      (b) =>
        (b.order_id || "").toLowerCase().includes(q) ||
        (b.carrier_docket_no || "").toLowerCase().includes(q) ||
        (b.awb_number || "").toLowerCase().includes(q) ||
        (b.consignee_name || "").toLowerCase().includes(q)
    );
  }, [bookings, search]);

  const patchRow = (booking: Booking, rowForm: StatusUpdateEntry, patch: Partial<StatusUpdateEntry>) =>
    setStatusUpdateMap((prev) => ({ ...prev, [booking.id]: { ...rowForm, ...patch } }));

  const save = async (id: string) => {
    setSavingId(id);
    try {
      await onUpdateShipmentStatus(id);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Fleet Tracking & Bilty Dispatch Console</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operating Fleet: <strong className="text-emerald-700 font-bold">{currentUser.company_name}</strong> • {bookings.length} consignment(s)
          </p>
        </div>
        {bookings.length > 0 && (
          <div className="relative">
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order ref, docket or consignee..."
              className="bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 w-64 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        )}
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-xs shadow-sm">
          No consignments have been booked with your fleet yet.
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-xs shadow-sm">No consignments match your search.</div>
      ) : (
        <div className="space-y-4">
          {visible.map((booking) => {
            const rowForm: StatusUpdateEntry = statusUpdateMap[booking.id] || {
              status: "",
              location: "",
              remarks: "",
              docketNo: booking.carrier_docket_no || booking.awb_number,
              docUrl: booking.carrier_docket_doc_url || "",
              isUploading: false
            };
            const docketValue = rowForm.docketNo ?? (booking.carrier_docket_no || booking.awb_number);
            const attached = rowForm.docUrl || booking.carrier_docket_doc_url;

            return (
              <div key={booking.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded font-black">Ref: {booking.order_id || "LC-ORDER"}</span>
                    <span className="font-mono text-sm font-black text-slate-900">Docket: {booking.carrier_docket_no || booking.awb_number}</span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold capitalize">{booking.mode} Linehaul</span>
                    <span className="text-xs font-mono text-slate-600 font-bold">
                      {booking.origin_pin} → {booking.dest_pin}
                    </span>
                    <span className="text-[10px] bg-sky-100 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-full font-black uppercase">{booking.status}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-500 font-medium">Settlement:</span>
                    <span className="font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">{booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 font-medium">
                  <strong className="text-slate-800">{booking.consignee_name}</strong> • {booking.delivery_address} • {booking.boxes?.length || 1} box(es), {booking.billable_weight} kg billable
                </p>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">Carrier Docket / LR No.</label>
                      <input
                        type="text"
                        placeholder="Enter Physical Bilty No."
                        value={docketValue}
                        onChange={(e) => patchRow(booking, rowForm, { docketNo: e.target.value })}
                        className="w-full bg-white border-2 border-indigo-300 font-mono font-black text-indigo-950 rounded-xl px-3 py-1.5 text-xs shadow-sm focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-5">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">Physical Bilty / POD (Image / PDF, max 5 MB)</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="file"
                          id={`file-upload-${booking.id}`}
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onUploadDocketFile(booking.id, file);
                            e.target.value = "";
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
                        {attached && (
                          <a href={attached} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-emerald-800 font-black text-xs flex items-center space-x-1 underline truncate max-w-[150px]">
                            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Attached Scan</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">Transit Milestone Status</label>
                      <select
                        value={rowForm.status}
                        onChange={(e) => patchRow(booking, rowForm, { status: e.target.value })}
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

                  <div className="flex flex-col md:flex-row items-center gap-2.5 pt-2 border-t border-slate-200">
                    <input
                      type="text"
                      placeholder="Current Hub / City (e.g. Bilaspur Linehaul Gateway)"
                      value={rowForm.location}
                      onChange={(e) => patchRow(booking, rowForm, { location: e.target.value })}
                      className="w-full md:flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium focus:border-indigo-600 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Remarks (optional)"
                      value={rowForm.remarks}
                      onChange={(e) => patchRow(booking, rowForm, { remarks: e.target.value })}
                      className="w-full md:flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium focus:border-indigo-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={savingId === booking.id}
                      onClick={() => save(booking.id)}
                      className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl transition shadow-sm flex items-center justify-center space-x-1.5 shrink-0 disabled:opacity-50"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>{savingId === booking.id ? "Saving..." : "Save & Dispatch Docket Update"}</span>
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
// 31. CARRIER COMMERCIAL RATE CARD MASTER (LIST + BULK CSV)
// ============================================================================
interface CarrierRatesSectionProps {
  currentUser: UserProfile;
  isLive: boolean;
  rateCards: RateCard[];
  setRateCards: React.Dispatch<React.SetStateAction<RateCard[]>>;
  vendors: Vendor[];
  onOpenAddRateModal: () => void;
}

const MAX_CSV_RATE_ROWS = 500;

const CarrierRatesSection: FC<CarrierRatesSectionProps> = ({ currentUser, isLive, rateCards, setRateCards, vendors, onOpenAddRateModal }) => {
  const [csvFileName, setCsvFileName] = useState("");
  const [parsedCsvRows, setParsedCsvRows] = useState<ParsedCsvRateCard[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvUploadStatus, setCsvUploadStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vendorId = currentUser.vendor_id || currentUser.id;
  const myCards = useMemo(() => rateCards.filter((c) => c.vendor_id === vendorId), [rateCards, vendorId]);

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
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvUploadStatus(null);
    setCsvErrors([]);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file content");
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length <= 1) throw new Error("CSV file must contain a header row and data rows.");
        if (lines.length - 1 > MAX_CSV_RATE_ROWS) throw new Error(`Maximum ${MAX_CSV_RATE_ROWS} routes per upload.`);

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
          if ([min_weight_kg, base_rate, per_kg_rate, fuel_surcharge_pct, docket_charge].some((n) => n < 0) || sla_days < 1) {
            errors.push(`Row ${i + 1}: Rates cannot be negative and SLA must be at least 1 day.`);
            continue;
          }

          const origin_prefix = await resolveLocationToPrefix(origRaw);
          const dest_prefix = await resolveLocationToPrefix(destRaw);
          rows.push({
            origin_prefix,
            dest_prefix,
            mode: modeClean as TransportMode,
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
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const clearCsv = () => {
    setParsedCsvRows([]);
    setCsvFileName("");
    setCsvErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleBatchInsertRateCards = async () => {
    if (parsedCsvRows.length === 0) return;
    setIsUploadingCsv(true);
    setCsvUploadStatus(null);
    const payload = parsedCsvRows.map((r) => ({ ...r, vendor_id: vendorId }));

    try {
      if (isLive) {
        const { data, error } = await supabase.from("rate_cards").insert(payload).select("*, vendors(*)");
        if (error || !data) {
          setCsvUploadStatus({ type: "error", message: `Could not publish routes: ${error?.message || "no rows returned"}.` });
          return;
        }
        setRateCards((prev) => [...(data as RateCard[]), ...prev]);
      } else {
        const localCards: RateCard[] = payload.map((p, idx) => ({
          ...(p as unknown as RateCard),
          id: `rc-bulk-${Date.now()}-${idx}`,
          is_demo: true,
          vendors: vendors.find((v) => v.id === vendorId)
        }));
        setRateCards((prev) => [...localCards, ...prev]);
      }
      setCsvUploadStatus({ type: "success", message: `Successfully published ${parsedCsvRows.length} lane routes!` });
      clearCsv();
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const toggleActive = async (card: RateCard) => {
    const next = !card.is_active;
    if (isLive) {
      const { error } = await supabase.from("rate_cards").update({ is_active: next }).eq("id", card.id);
      if (error) {
        alert(`Could not update tariff: ${error.message}`);
        return;
      }
    }
    setRateCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, is_active: next } : c)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Commercial Rate Card Master</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage route tariffs individually or batch-publish route matrices via CSV. Only active tariffs appear in shipper quotes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleDownloadSampleCsv} className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-black flex items-center space-x-1.5 shadow-sm transition">
            <DownloadIcon className="w-4 h-4 text-indigo-600" />
            <span>Download Sample CSV</span>
          </button>
          <button type="button" onClick={onOpenAddRateModal} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center space-x-1.5 shadow-sm transition">
            <PlusIcon className="w-4 h-4" />
            <span>Add Route Manually</span>
          </button>
        </div>
      </div>

      <div className="bg-white border-2 border-dashed border-indigo-300 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <UploadIcon className="w-4 h-4 text-indigo-600" />
              <span>Bulk Upload Rate Cards via CSV (City Names or PIN Prefixes)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Columns: <code className="font-mono text-indigo-700 font-bold text-[11px]">origin, dest, mode, min_weight_kg, base_rate, per_kg_rate, fuel_surcharge_pct, docket_charge, sla_days</code>
            </p>
          </div>
          {parsedCsvRows.length > 0 && (
            <div className="flex items-center space-x-2">
              <button type="button" onClick={clearCsv} className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg">
                Clear
              </button>
              <button type="button" disabled={isUploadingCsv} onClick={handleBatchInsertRateCards} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow-sm flex items-center space-x-1.5 disabled:opacity-50">
                <CheckCircleIcon className="w-4 h-4" />
                <span>{isUploadingCsv ? "Publishing Routes..." : `Publish All ${parsedCsvRows.length} Routes`}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
          <input type="file" ref={fileInputRef} accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" id="csv-rate-card-upload" />
          <label htmlFor="csv-rate-card-upload" className="bg-white hover:bg-slate-100 text-indigo-700 border-2 border-indigo-200 px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer transition shadow-xs flex items-center space-x-2">
            <UploadIcon className="w-4 h-4 text-indigo-600" />
            <span>{csvFileName ? `Replace (${csvFileName})` : "Select Rate Card CSV File"}</span>
          </label>
          <p className="text-[11px] text-slate-500 font-medium">
            {isParsing ? "Parsing and resolving city names..." : parsedCsvRows.length > 0 ? `${parsedCsvRows.length} valid route(s) ready to publish` : "Click to select a .csv file from your computer"}
          </p>
        </div>

        {csvErrors.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 text-xs font-medium space-y-1">
            <strong>{csvErrors.length} row(s) skipped:</strong>
            <ul className="list-disc pl-5">
              {csvErrors.slice(0, 5).map((err, eIdx) => (
                <li key={eIdx}>{err}</li>
              ))}
              {csvErrors.length > 5 && <li>...and {csvErrors.length - 5} more</li>}
            </ul>
          </div>
        )}

        {csvUploadStatus && (
          <div className={`p-3.5 rounded-xl text-xs font-bold border ${csvUploadStatus.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-rose-50 text-rose-800 border-rose-300"}`}>
            {csvUploadStatus.message}
          </div>
        )}
      </div>

      {/* Existing tariffs */}
      <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Your Published Tariffs</h3>
          <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">{myCards.length} Lanes</span>
        </div>
        {myCards.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No tariffs published yet. Shippers will not see your rates until you add at least one active lane.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white uppercase font-black text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">Lane (Origin → Dest)</th>
                  <th className="py-3 px-3.5">Mode</th>
                  <th className="py-3 px-3.5">Min Wt</th>
                  <th className="py-3 px-3.5">Base</th>
                  <th className="py-3 px-3.5">Per Kg</th>
                  <th className="py-3 px-3.5">Fuel %</th>
                  <th className="py-3 px-3.5">SLA</th>
                  <th className="py-3 px-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {myCards.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3.5 font-mono font-black text-indigo-700">
                      {c.origin_prefix === "%" ? "ANY" : c.origin_prefix} → {c.dest_prefix === "%" ? "ANY" : c.dest_prefix}
                    </td>
                    <td className="py-3 px-3.5 capitalize font-bold">{c.mode}</td>
                    <td className="py-3 px-3.5 font-mono">{c.min_weight_kg} kg</td>
                    <td className="py-3 px-3.5 font-mono">{formatINR(c.base_rate)}</td>
                    <td className="py-3 px-3.5 font-mono">{formatINR(c.per_kg_rate)}</td>
                    <td className="py-3 px-3.5 font-mono">{c.fuel_surcharge_pct}%</td>
                    <td className="py-3 px-3.5 font-mono">{c.sla_days}d</td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => toggleActive(c)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition ${
                          c.is_active ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {c.is_active ? "Active" : "Paused"}
                      </button>
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
// 32. MANUAL LANE RATE CARD PUBLISHER MODAL
// ============================================================================
interface AddRateCardModalProps {
  currentUser: UserProfile;
  isLive: boolean;
  vendors: Vendor[];
  onSuccess: (card: RateCard) => void;
  onClose: () => void;
}

const AddRateCardModal: FC<AddRateCardModalProps> = ({ currentUser, isLive, vendors, onSuccess, onClose }) => {
  const [card, setCard] = useState({
    origin_prefix: "",
    dest_prefix: "",
    mode: "surface" as TransportMode,
    min_weight_kg: 10,
    base_rate: 0,
    per_kg_rate: 0,
    fuel_surcharge_pct: 12,
    docket_charge: 0,
    fov_pct: 0.2,
    oda_charge: 450,
    handling_per_kg: 2,
    sla_days: 3
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const prefixOk = (p: string) => p === "%" || /^\d{3}$/.test(p);
  const num = (k: keyof typeof card, v: string) => setCard({ ...card, [k]: v === "" ? 0 : Number(v) });
  const inputCls = "w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!prefixOk(card.origin_prefix) || !prefixOk(card.dest_prefix)) return setErrorMsg("Origin and destination must be a 3-digit PIN prefix (e.g. 110) or % for any.");
    if (card.base_rate < 0 || card.per_kg_rate < 0 || card.docket_charge < 0 || card.min_weight_kg < 0) return setErrorMsg("Rates and weights cannot be negative.");
    if (card.per_kg_rate === 0 && card.base_rate === 0) return setErrorMsg("Set a base rate or a per-kg rate.");
    if (card.sla_days < 1) return setErrorMsg("Transit SLA must be at least 1 day.");

    setIsSubmitting(true);
    const vendorId = currentUser.vendor_id || currentUser.id;
    const payload = { ...card, vendor_id: vendorId, is_active: true };

    try {
      if (isLive) {
        const { data, error } = await supabase.from("rate_cards").insert([payload]).select("*, vendors(*)").maybeSingle();
        if (error || !data) {
          setErrorMsg(`Tariff could not be published: ${error?.message || "no row returned"}.`);
          return;
        }
        onSuccess(data as RateCard);
      } else {
        onSuccess({ ...(payload as RateCard), id: `rc-${Date.now()}`, is_demo: true, vendors: vendors.find((v) => v.id === vendorId) });
      }
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
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold select-text">{errorMsg}</p>}

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Origin Prefix (3 digits or %) *</label>
            <input type="text" maxLength={3} value={card.origin_prefix} placeholder="110" onChange={(e) => setCard({ ...card, origin_prefix: e.target.value.trim() })} className={`${inputCls} font-mono`} required />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Dest Prefix (3 digits or %) *</label>
            <input type="text" maxLength={3} value={card.dest_prefix} placeholder="400" onChange={(e) => setCard({ ...card, dest_prefix: e.target.value.trim() })} className={`${inputCls} font-mono`} required />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Transport Mode</label>
            <select value={card.mode} onChange={(e) => setCard({ ...card, mode: e.target.value as TransportMode })} className={inputCls}>
              <option value="surface">Surface Express</option>
              <option value="air">Air Cargo</option>
              <option value="ftl">Full Truck Load (FTL)</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Transit SLA (Days)</label>
            <input type="number" min={1} value={card.sla_days} onChange={(e) => num("sla_days", e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Min Chargeable Weight (kg)</label>
            <input type="number" min={0} value={card.min_weight_kg} onChange={(e) => num("min_weight_kg", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Base Rate (₹)</label>
            <input type="number" min={0} value={card.base_rate || ""} onChange={(e) => num("base_rate", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Rate Per Kg (₹)</label>
            <input type="number" min={0} step={0.1} value={card.per_kg_rate || ""} onChange={(e) => num("per_kg_rate", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Fuel Surcharge (%)</label>
            <input type="number" min={0} step={0.5} value={card.fuel_surcharge_pct} onChange={(e) => num("fuel_surcharge_pct", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Docket / AWB Charge (₹)</label>
            <input type="number" min={0} value={card.docket_charge || ""} onChange={(e) => num("docket_charge", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Handling Per Kg (₹)</label>
            <input type="number" min={0} step={0.1} value={card.handling_per_kg} onChange={(e) => num("handling_per_kg", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">FOV (% of declared value)</label>
            <input type="number" min={0} step={0.05} value={card.fov_pct} onChange={(e) => num("fov_pct", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">ODA Charge (₹)</label>
            <input type="number" min={0} value={card.oda_charge} onChange={(e) => num("oda_charge", e.target.value)} className={inputCls} />
          </div>

          <div className="col-span-2 flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2 rounded-xl shadow-sm transition disabled:opacity-50">
              {isSubmitting ? "Publishing..." : "Publish Tariff Card"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 33. CARRIER DIRECT FREIGHT SETTLEMENT PROFILE (BANK & UPI) — NO PRE-FILLED DEMO DATA
// ============================================================================
interface CarrierBankSectionProps {
  currentUser: UserProfile;
  isLive: boolean;
  vendors: Vendor[];
  setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>;
}

const CarrierBankSection: FC<CarrierBankSectionProps> = ({ currentUser, isLive, vendors, setVendors }) => {
  const vendorId = currentUser.vendor_id || currentUser.id;
  const currentVendor = vendors.find((v) => v.id === vendorId);

  const [upi, setUpi] = useState(currentVendor?.upi_id || "");
  const [bankAcc, setBankAcc] = useState(currentVendor?.bank_account || "");
  const [ifsc, setIfsc] = useState(currentVendor?.ifsc_code || "");
  const [beneficiary, setBeneficiary] = useState(currentVendor?.beneficiary_name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Vendors load asynchronously in live mode; sync the form once the real row arrives.
  useEffect(() => {
    setUpi(currentVendor?.upi_id || "");
    setBankAcc(currentVendor?.bank_account || "");
    setIfsc(currentVendor?.ifsc_code || "");
    setBeneficiary(currentVendor?.beneficiary_name || "");
  }, [currentVendor?.id, currentVendor?.upi_id, currentVendor?.bank_account, currentVendor?.ifsc_code, currentVendor?.beneficiary_name]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const cleanIfsc = ifsc.trim().toUpperCase();
    if (!/^[^\s@]+@[^\s@]+$/.test(upi.trim())) return setMsg({ type: "err", text: "Enter a valid UPI ID, e.g. yourbusiness@icici." });
    if (!/^\d{9,18}$/.test(bankAcc.trim())) return setMsg({ type: "err", text: "Bank account number must be 9–18 digits." });
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) return setMsg({ type: "err", text: "IFSC must look like HDFC0000240." });
    if (!beneficiary.trim()) return setMsg({ type: "err", text: "Beneficiary name is required." });

    setIsSaving(true);
    const payload = { upi_id: upi.trim(), bank_account: bankAcc.trim(), ifsc_code: cleanIfsc, beneficiary_name: beneficiary.trim() };

    try {
      if (isLive) {
        const { data, error } = await supabase.from("vendors").update(payload).eq("id", vendorId).select("id");
        if (error) return setMsg({ type: "err", text: `Could not save settlement details: ${error.message}` });
        if (!data || data.length === 0) return setMsg({ type: "err", text: "Your carrier record was not found, so nothing was saved. Sign out and back in, then try again." });
      }
      setVendors((prev) => prev.map((v) => (v.id === vendorId ? { ...v, ...payload } : v)));
      setMsg({ type: "ok", text: "Bank and UPI settlement details saved. Shippers can now pay you directly." });
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = "w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 font-mono text-slate-900 font-bold focus:bg-white focus:border-emerald-600 focus:outline-none";

  return (
    <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm max-w-2xl space-y-5">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <CreditCardIcon className="w-5 h-5 text-emerald-600" />
            <span>Direct Freight Settlement Details</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Where commercial shippers send 100% direct freight payments when booking your routes.</p>
        </div>
        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black px-3.5 py-1 rounded-full">Zero Commission on Freight</span>
      </div>

      {msg && (
        <div className={`p-3.5 rounded-xl text-xs font-bold border ${msg.type === "ok" ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-rose-50 text-rose-800 border-rose-300"}`}>{msg.text}</div>
      )}

      <form onSubmit={handleSave} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-800 font-bold mb-1">Official Transporter UPI ID (VPA) *</label>
          <input type="text" required value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="e.g. yourbusiness@icici" className={inputCls} />
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Shippers who choose &quot;Direct Carrier UPI&quot; at checkout will see this handle.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-slate-800 font-bold mb-1">Bank Account Number *</label>
            <input type="text" required inputMode="numeric" value={bankAcc} onChange={(e) => setBankAcc(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 50200088910234" className={inputCls} />
          </div>
          <div>
            <label className="block text-slate-800 font-bold mb-1">Bank IFSC Code *</label>
            <input type="text" required maxLength={11} value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="e.g. HDFC0000240" className={`${inputCls} uppercase`} />
          </div>
        </div>

        <div>
          <label className="block text-slate-800 font-bold mb-1">Beneficiary / Account Holder Name (as per bank records) *</label>
          <input
            type="text"
            required
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            placeholder="Registered business name"
            className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:bg-white focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-2.5 rounded-xl transition shadow-sm flex items-center space-x-1.5 disabled:opacity-50">
            <CheckCircleIcon className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save Bank & UPI Settlement Profile"}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================================
// END OF PART 5 OF 7
// ============================================================================
// ============================================================================
// PART 6 OF 7 — CARRIER MODULE B + SHARED SHIPPER/PLATFORM VIEWS
//   Carrier credit approval console, weekly/monthly platform-fee billing ledger
//   + payment modal, shipper active shipments, universal tracker, legal modal,
//   footer, PIN city search modal, admin overview.
// The carrier credit LEDGER summary is CombinedCreditLedgerSection (Part 4, role="carrier").
// Paste directly after Part 5. No named exports.
// ============================================================================

// ============================================================================
// 34. CARRIER: CREDIT AGREEMENT APPROVAL & UNDERWRITING CONSOLE
// ============================================================================
interface CarrierCreditApprovalSectionProps {
  agreements: CreditAgreement[];
  onReviewAgreement: (
    agreementId: string,
    status: "Approved" | "Rejected",
    approvedLimit?: number,
    reason?: string
  ) => void | Promise<void>;
  getAgreementViewUrl: (a: CreditAgreement) => Promise<string>;
}

const CarrierCreditApprovalSection: FC<CarrierCreditApprovalSectionProps> = ({ agreements, onReviewAgreement, getAgreementViewUrl }) => {
  const [filter, setFilter] = useState<"All" | CreditStatus>("Pending_Review");
  const [approvalLimitInput, setApprovalLimitInput] = useState<Record<string, number>>({});
  const [rejectionReasonInput, setRejectionReasonInput] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = useMemo(
    () => (filter === "All" ? agreements : agreements.filter((a) => a.status === filter)),
    [agreements, filter]
  );

  const approved = useMemo(() => agreements.filter((a) => a.status === "Approved"), [agreements]);
  const totalCreditExposure = useMemo(() => approved.reduce((sum, a) => sum + a.approved_limit, 0), [approved]);
  const totalActiveExposureDues = useMemo(() => approved.reduce((sum, a) => sum + a.utilized_amount, 0), [approved]);
  const pendingCount = useMemo(() => agreements.filter((a) => a.status === "Pending_Review").length, [agreements]);

  const decide = async (agreement: CreditAgreement, decision: "Approved" | "Rejected") => {
    const limit = approvalLimitInput[agreement.id] ?? agreement.requested_limit;
    const reason = (rejectionReasonInput[agreement.id] || "").trim();
    setErrors((e) => ({ ...e, [agreement.id]: "" }));

    if (decision === "Approved" && (!limit || limit <= 0)) {
      return setErrors((e) => ({ ...e, [agreement.id]: "Enter an approved credit limit greater than ₹0." }));
    }
    if (decision === "Rejected" && !reason) {
      return setErrors((e) => ({ ...e, [agreement.id]: "Please give a rejection reason so the shipper knows what to fix." }));
    }
    setBusyId(agreement.id);
    try {
      await onReviewAgreement(agreement.id, decision, decision === "Approved" ? limit : 0, decision === "Rejected" ? reason : undefined);
    } finally {
      setBusyId(null);
    }
  };

  const statusPill = (s: CreditStatus) =>
    s === "Approved"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : s === "Pending_Review"
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : "bg-rose-100 text-rose-800 border-rose-300";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <DocumentCheckIcon className="w-5 h-5 text-emerald-600" />
            <span>Shipper Credit Facility Underwriting & KYC Approval</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Review signed B2B credit agreements, authorize billing limits and manage counterparty exposure.</p>
        </div>
        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl text-xs font-bold text-white">
          {(["Pending_Review", "Approved", "Rejected", "All"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg transition ${filter === tab ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              {tab.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Authorized Credit Line</span>
          <span className="text-2xl font-black text-slate-900 font-mono">{formatINR(totalCreditExposure)}</span>
          <p className="text-[10px] text-slate-400">Total approved exposure across shippers</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Active Utilized Credit</span>
          <span className="text-2xl font-black text-indigo-700 font-mono">{formatINR(totalActiveExposureDues)}</span>
          <p className="text-[10px] text-slate-400">Outstanding freight awaiting settlement</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Pending Requests</span>
          <span className="text-2xl font-black text-amber-600 font-mono">{pendingCount}</span>
          <p className="text-[10px] text-slate-400">Awaiting underwriting KYC verification</p>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-xs shadow-sm">
            {agreements.length === 0 ? "No shipper has applied for credit with your fleet yet." : "No credit applications match this status filter."}
          </div>
        ) : (
          filtered.map((agreement) => {
            const currentLimit = approvalLimitInput[agreement.id] ?? (agreement.approved_limit > 0 ? agreement.approved_limit : agreement.requested_limit);
            const currentReason = rejectionReasonInput[agreement.id] || "";
            const busy = busyId === agreement.id;

            return (
              <div key={agreement.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-sm text-slate-900">{agreement.shipper_name}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusPill(agreement.status)}`}>
                        {agreement.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Application ID: <span className="font-mono font-bold text-slate-700">{agreement.id}</span> • Terms: <strong>{agreement.payment_terms_days} Days Net</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Requested Facility Limit</span>
                    <span className="text-xl font-black text-indigo-700 font-mono">{formatINR(agreement.requested_limit)}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <DocumentIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 block">{agreement.document_name}</span>
                      <span className="text-[10px] text-slate-500">
                        Submitted {new Date(agreement.submitted_at).toLocaleDateString("en-IN")}
                        {agreement.original_size_kb ? ` • ${agreement.compressed_size_kb ?? agreement.original_size_kb} KB` : ""}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAgreementDocument(agreement, getAgreementViewUrl)}
                    className="bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-xl font-bold flex items-center space-x-1 shadow-xs transition"
                  >
                    <span>View Executed Agreement</span>
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {agreement.status === "Approved" && (
                  <p className="text-[11px] text-slate-600 font-medium">
                    Approved limit <strong className="font-mono">{formatINR(agreement.approved_limit)}</strong> • Utilized{" "}
                    <strong className="font-mono text-rose-600">{formatINR(agreement.utilized_amount)}</strong>
                    {agreement.reviewed_at ? ` • Reviewed ${new Date(agreement.reviewed_at).toLocaleDateString("en-IN")}` : ""}
                  </p>
                )}
                {agreement.status === "Rejected" && agreement.rejection_reason && (
                  <p className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 font-medium">
                    <strong>Rejection reason:</strong> {agreement.rejection_reason}
                  </p>
                )}

                {agreement.status === "Pending_Review" && (
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 space-y-3 text-xs">
                    <span className="font-black text-indigo-950 uppercase tracking-wider block">Underwriting & KYC Verification Decision</span>

                    {errors[agreement.id] && <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 font-bold">{errors[agreement.id]}</p>}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Approved Credit Limit (₹)</label>
                        <input
                          type="number"
                          min={0}
                          step={10000}
                          value={currentLimit}
                          onChange={(e) => setApprovalLimitInput({ ...approvalLimitInput, [agreement.id]: Number(e.target.value) })}
                          className="w-full bg-white border-2 border-indigo-300 rounded-xl p-2 font-mono font-bold text-slate-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Rejection Reason (required to reject)</label>
                        <input
                          type="text"
                          placeholder="e.g. Incomplete GST filing history"
                          value={currentReason}
                          onChange={(e) => setRejectionReasonInput({ ...rejectionReasonInput, [agreement.id]: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2 border-t border-indigo-100">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => decide(agreement, "Rejected")}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-4 py-2 rounded-xl font-black transition disabled:opacity-50"
                      >
                        Reject Application
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => decide(agreement, "Approved")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-black shadow-sm transition disabled:opacity-50"
                      >
                        {busy ? "Saving..." : "Authorize & Approve Credit Facility"}
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
// 35. PLATFORM FEE SETTLEMENT / INVOICE PAYMENT MODAL
// NOTE: the payment reference is entered by the carrier. For production, confirm
// it against your bank statement or a payment gateway webhook before treating the
// invoice as truly settled.
// ============================================================================
interface PayPlatformFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: PlatformInvoice | null;
  onPaySuccess: (invoiceId: string, utr: string, method: string) => void | Promise<void>;
}

const PayPlatformFeeModal: FC<PayPlatformFeeModalProps> = ({ isOpen, onClose, invoice, onPaySuccess }) => {
  const [method, setMethod] = useState<"upi" | "netbanking" | "card">("upi");
  const [utrNumber, setUtrNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [doneMsg, setDoneMsg] = useState("");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  if (!isOpen || !invoice) return null;

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (isProcessing || doneMsg) return;
    setErrorMsg("");
    const ref = utrNumber.trim();
    if (!/^[A-Za-z0-9\-_/]{6,40}$/.test(ref)) {
      return setErrorMsg("Enter a valid transaction / UTR reference (6–40 letters, digits or dashes).");
    }
    setIsProcessing(true);
    try {
      await onPaySuccess(invoice.id, ref, method === "upi" ? "UPI VPA" : method === "netbanking" ? "Corporate NetBanking" : "Corporate Debit Card");
      setDoneMsg(`Payment of ${formatINR(invoice.platform_fee_total)} recorded against ${invoice.invoice_number}.`);
      closeTimer.current = setTimeout(onClose, 1500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Could not record the payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const modeBtn = (id: "upi" | "netbanking" | "card", label: string) => (
    <button
      type="button"
      onClick={() => setMethod(id)}
      className={`p-2.5 rounded-xl border-2 font-bold text-center transition ${method === id ? "bg-indigo-50 border-indigo-600 text-indigo-900" : "bg-white border-slate-200 text-slate-700"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Settle Platform Commission Fee</h3>
            <p className="text-xs text-slate-500 font-medium">
              Invoice: <span className="font-mono font-bold text-indigo-700">{invoice.invoice_number}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-inner space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span>Billing Cycle:</span>
            <span className="font-bold uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {invoice.billing_cycle} ({invoice.period_start} to {invoice.period_end})
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
            <span>Platform Fee Payable ({MERCHANT_DETAILS.platformFeePct}%):</span>
            <span className="text-base font-mono">{formatINR(invoice.platform_fee_total)}</span>
          </div>
        </div>

        {errorMsg && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold">{errorMsg}</p>}
        {doneMsg && <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl font-bold">{doneMsg}</p>}

        <form onSubmit={handlePay} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-800 font-bold mb-1">Select Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {modeBtn("upi", "📲 UPI Transfer")}
              {modeBtn("netbanking", "🏦 NetBanking")}
              {modeBtn("card", "💳 Debit/Card")}
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 font-mono text-[11px] select-text">
            <p className="text-slate-600"><strong>Beneficiary:</strong> {MERCHANT_DETAILS.beneficiaryName}</p>
            <p className="text-slate-600"><strong>Platform VPA:</strong> {MERCHANT_DETAILS.vpa}</p>
            <p className="text-slate-600">
              <strong>Bank Account:</strong> {MERCHANT_DETAILS.accountNumber} (IFSC: {MERCHANT_DETAILS.ifsc})
            </p>
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
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:text-slate-900">
              Cancel
            </button>
            <button type="submit" disabled={isProcessing || Boolean(doneMsg)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50">
              {isProcessing ? "Recording..." : `Confirm Payment (${formatINR(invoice.platform_fee_total)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 36. CARRIER: PLATFORM FEE COMMISSION BILLING LEDGER (WEEKLY / MONTHLY)
// ============================================================================
function invoiceEffectiveStatus(inv: PlatformInvoice): InvoiceStatus {
  if (inv.status === "Paid") return "Paid";
  const today = new Date().toISOString().split("T")[0];
  return inv.status === "Overdue" || (inv.due_date && inv.due_date < today) ? "Overdue" : "Pending";
}

interface CarrierBillingSectionProps {
  currentUser: UserProfile;
  invoices: PlatformInvoice[];
  billingCycle: BillingCycle;
  setBillingCycle: (cycle: BillingCycle) => void;
  onOpenPayFeeModal: (invoice: PlatformInvoice) => void;
}

const CarrierBillingSection: FC<CarrierBillingSectionProps> = ({ currentUser, invoices, billingCycle, setBillingCycle, onOpenPayFeeModal }) => {
  const myCarrierId = currentUser.vendor_id || currentUser.id;
  const filteredInvoices = useMemo(
    () => invoices.filter((inv) => inv.billing_cycle === billingCycle && inv.carrier_id === myCarrierId),
    [invoices, billingCycle, myCarrierId]
  );

  const totalOutstanding = useMemo(
    () => filteredInvoices.filter((inv) => invoiceEffectiveStatus(inv) !== "Paid").reduce((sum, inv) => sum + inv.platform_fee_total, 0),
    [filteredInvoices]
  );
  const totalPaid = useMemo(
    () => filteredInvoices.filter((inv) => inv.status === "Paid").reduce((sum, inv) => sum + inv.platform_fee_total, 0),
    [filteredInvoices]
  );

  const cycleBtn = (id: BillingCycle, label: string) => (
    <button
      type="button"
      onClick={() => setBillingCycle(id)}
      className={`px-3 py-1.5 rounded-lg transition ${billingCycle === id ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            <span>Platform Fee Billing & Commission Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Weekly and monthly commission settlements ({MERCHANT_DETAILS.platformFeePct}% per load, minimum ₹{MERCHANT_DETAILS.minPlatformFeeINR}).
          </p>
        </div>
        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl text-xs font-bold text-white shadow-sm">
          {cycleBtn("weekly", "Weekly Billing")}
          {cycleBtn("monthly", "Monthly Billing")}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Pending Platform Dues</span>
          <span className="text-2xl font-black text-rose-600 font-mono">{formatINR(totalOutstanding)}</span>
          <p className="text-[10px] text-slate-400">Unpaid and overdue commission</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Settled Fees</span>
          <span className="text-2xl font-black text-emerald-600 font-mono">{formatINR(totalPaid)}</span>
          <p className="text-[10px] text-slate-400">Reconciled platform payouts</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Commission Structure</span>
          <span className="text-2xl font-black text-slate-900 font-mono">{Number(MERCHANT_DETAILS.platformFeePct).toFixed(2)}%</span>
          <p className="text-[10px] text-slate-400">Fixed rate with ₹{MERCHANT_DETAILS.minPlatformFeeINR} floor per load</p>
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
            {billingCycle === "weekly" ? "Weekly Invoices & Statements" : "Monthly Consolidated Invoices"}
          </h3>
          <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">{filteredInvoices.length} Invoices</span>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No {billingCycle} invoices have been issued for your fleet yet. Invoices appear here after a billing cycle closes.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white uppercase font-black text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">Invoice No</th>
                  <th className="py-3 px-3.5">Billing Period</th>
                  <th className="py-3 px-3.5">Consignments</th>
                  <th className="py-3 px-3.5">Gross Freight</th>
                  <th className="py-3 px-3.5">Commission</th>
                  <th className="py-3 px-3.5">Due Date</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {filteredInvoices.map((inv) => {
                  const eff = invoiceEffectiveStatus(inv);
                  return (
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
                            eff === "Paid"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : eff === "Overdue"
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                          }`}
                        >
                          {eff}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        {eff !== "Paid" ? (
                          <button type="button" onClick={() => onOpenPayFeeModal(inv)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3.5 py-1.5 rounded-lg text-xs shadow-sm transition">
                            Settle Dues
                          </button>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-500 font-bold">Paid ({inv.payment_ref ? inv.payment_ref.substring(0, 12) : "UTR Reconciled"})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 37. SHIPPER: ACTIVE SHIPMENTS & PRINT ALL LABELS
// ============================================================================
interface ShipperShipmentsSectionProps {
  bookings: Booking[];
  onRefresh: () => void | Promise<void>;
  onOpenLabelModal: (b: Booking) => void;
  onOpenTrackerTab: (orderRef: string) => void;
  onBatchPrintLabels: () => void;
}

const ShipperShipmentsSection: FC<ShipperShipmentsSectionProps> = ({ bookings, onRefresh, onOpenLabelModal, onOpenTrackerTab, onBatchPrintLabels }) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Booking["status"]>("All");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== "All" && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (b.order_id || "").toLowerCase().includes(q) ||
        (b.carrier_docket_no || "").toLowerCase().includes(q) ||
        (b.consignee_name || "").toLowerCase().includes(q) ||
        (b.dest_pin || "").includes(q)
      );
    });
  }, [bookings, search, statusFilter]);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const statusPill = (s: Booking["status"]) =>
    s === "Delivered"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : s === "In Transit" || s === "Out for Delivery"
      ? "bg-sky-100 text-sky-800 border-sky-300"
      : s === "Picked Up"
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : s === "Cancelled"
      ? "bg-rose-100 text-rose-800 border-rose-300"
      : "bg-slate-100 text-slate-700 border-slate-300";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Consignment Manifests & Thermal Printing</h2>
          <p className="text-xs text-slate-500 mt-0.5">Order IDs, carrier dockets, printable 4x6 labels and links to carrier tracking portals.</p>
        </div>
        <div className="flex items-center space-x-2.5">
          {bookings.length > 0 && (
            <button type="button" onClick={onBatchPrintLabels} className="bg-slate-950 hover:bg-slate-800 text-white font-black px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-sm transition">
              <PrinterIcon className="w-4 h-4 text-emerald-400" />
              <span>Print All 4x6 Labels & Manifest</span>
            </button>
          )}
          <button type="button" onClick={refresh} disabled={isRefreshing} className="bg-white hover:bg-slate-100 text-slate-800 px-4 py-2.5 rounded-xl text-xs font-black border border-slate-300 shadow-sm transition disabled:opacity-50">
            {isRefreshing ? "Refreshing..." : "🔄 Refresh List"}
          </button>
        </div>
      </div>

      {bookings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order ref, docket, consignee or PIN..."
              className="bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 w-72 focus:border-indigo-600 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "All" | Booking["status"])}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
          >
            <option value="All">All statuses</option>
            <option value="Booked">Booked</option>
            <option value="Picked Up">Picked Up</option>
            <option value="In Transit">In Transit</option>
            <option value="Out for Delivery">Out for Delivery</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <span className="text-[11px] text-slate-500 font-medium">
            {visible.length} of {bookings.length}
          </span>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-2xl p-12 text-center shadow-sm space-y-2">
          <p className="text-slate-800 font-bold text-sm">No shipments booked yet.</p>
          <p className="text-slate-500 text-xs">Calculate freight tariffs or upload a bulk CSV to dispatch your first consignment.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-xs shadow-sm">No shipments match your filters.</div>
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
              {visible.map((booking, idx) => {
                const carrierName = booking.vendors?.name || "Carrier Partner";
                const docketNo = booking.carrier_docket_no || booking.awb_number;
                const orderRef = booking.order_id || booking.id.slice(0, 8);
                const portalUrl = booking.carrier_portal_url || getOfficialCarrierTrackingUrl(booking.vendors || carrierName, docketNo);

                return (
                  <tr key={booking.id} className={idx % 2 === 0 ? "bg-white hover:bg-indigo-50/60 transition" : "bg-slate-50 hover:bg-indigo-50/60 transition"}>
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
                    <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-sm">{formatINR(booking.cost_breakdown?.freightSubtotal || booking.final_total)}</td>
                    <td className="py-3.5 px-4">
                      {booking.carrier_docket_doc_url ? (
                        <a href={booking.carrier_docket_doc_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1 underline text-[11px]">
                          <DocumentIcon className="w-3.5 h-3.5" />
                          <span>View Bilty Scan</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-semibold bg-slate-100 px-2 py-0.5 rounded">Pending Upload</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusPill(booking.status)}`}>{booking.status}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 shadow-xs transition"
                        title="Open Carrier Public Tracking Portal"
                      >
                        <span>Carrier Portal</span>
                        <ExternalLinkIcon className="w-3 h-3" />
                      </a>
                      <button type="button" onClick={() => onOpenLabelModal(booking)} className="bg-white hover:bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-300 inline-flex items-center space-x-1 shadow-xs transition">
                        <PrinterIcon className="w-3.5 h-3.5 text-slate-600" />
                        <span>Label</span>
                      </button>
                      <button type="button" onClick={() => onOpenTrackerTab(orderRef)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 shadow-xs transition">
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
};

// ============================================================================
// 38. SHIPPER: UNIVERSAL DUAL-ID TRACKER (ORDER REF OR CARRIER DOCKET)
// ============================================================================
interface ShipperTrackerSectionProps {
  isLive: boolean;
  bookings: Booking[];
  activeTrackingAwb: string;
  setActiveTrackingAwb: (val: string) => void;
  trackingSearchInput: string;
  setTrackingSearchInput: (val: string) => void;
}

const TRACKING_STAGES = ["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"];

const ShipperTrackerSection: FC<ShipperTrackerSectionProps> = ({
  isLive,
  bookings,
  activeTrackingAwb,
  setActiveTrackingAwb,
  trackingSearchInput,
  setTrackingSearchInput
}) => {
  const activeTrackBooking = useMemo(() => {
    const input = activeTrackingAwb.trim().toLowerCase();
    if (!input) return undefined;
    return bookings.find(
      (b) =>
        (b.order_id && b.order_id.toLowerCase() === input) ||
        (b.carrier_docket_no && b.carrier_docket_no.toLowerCase() === input) ||
        (b.awb_number && b.awb_number.toLowerCase() === input)
    );
  }, [bookings, activeTrackingAwb]);

  const isCancelled = activeTrackBooking?.status === "Cancelled";
  const currentStageIndex = useMemo(() => {
    if (!activeTrackBooking) return 0;
    const idx = TRACKING_STAGES.indexOf(activeTrackBooking.status);
    return idx === -1 ? 0 : idx;
  }, [activeTrackBooking]);

  const history = useMemo(
    () => [...(activeTrackBooking?.tracking_history || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [activeTrackBooking]
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setActiveTrackingAwb(trackingSearchInput.trim());
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="text-base font-black text-slate-900">Universal Consignment Live Tracker</h2>
        <p className="text-xs text-slate-500">
          Enter your Platform Order Ref (e.g. <strong className="text-indigo-600">{isLive ? "LC-123456" : DEMO_INIT_ORDER_ID}</strong>) or the carrier&apos;s Docket No.
          {!isLive && (
            <>
              {" "}(e.g. <strong className="text-indigo-600">{DEMO_INIT_CARRIER_DOCKET}</strong>)
            </>
          )}
        </p>
        <form onSubmit={submit} className="flex gap-2 max-w-md">
          <input
            type="text"
            value={trackingSearchInput}
            onChange={(e) => setTrackingSearchInput(e.target.value)}
            placeholder="Enter Order Ref or Docket..."
            className="flex-1 bg-white border-2 border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
          />
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-md transition flex items-center space-x-1.5">
            <SearchIcon className="w-4 h-4" />
            <span>Track</span>
          </button>
        </form>
      </div>

      {activeTrackBooking ? (
        <div className="bg-white border border-slate-300 rounded-2xl p-6 space-y-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl font-mono font-black text-indigo-700">{activeTrackBooking.order_id || "LC-CONSIGNMENT"}</span>
                <span className="text-sm font-mono font-black text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg">
                  Carrier Docket: {activeTrackBooking.carrier_docket_no || activeTrackBooking.awb_number}
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-black uppercase border ${isCancelled ? "bg-rose-100 text-rose-800 border-rose-300" : "bg-emerald-100 text-emerald-800 border-emerald-300"}`}>
                  {activeTrackBooking.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2 font-medium">
                Carrier Partner: <strong className="text-slate-900">{activeTrackBooking.vendors?.name || "Carrier Partner"}</strong> • Consignee:{" "}
                <strong className="text-slate-900">{activeTrackBooking.consignee_name}</strong>
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2.5">
              <div className="flex items-center space-x-2">
                {activeTrackBooking.carrier_docket_doc_url && (
                  <a href={activeTrackBooking.carrier_docket_doc_url} target="_blank" rel="noopener noreferrer" className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-xs flex items-center space-x-1.5">
                    <DocumentIcon className="w-3.5 h-3.5" />
                    <span>View Physical Bilty Scan</span>
                  </a>
                )}
                <a
                  href={
                    activeTrackBooking.carrier_portal_url ||
                    getOfficialCarrierTrackingUrl(activeTrackBooking.vendors || "", activeTrackBooking.carrier_docket_no || activeTrackBooking.awb_number)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow-sm flex items-center space-x-1.5"
                >
                  <span>Carrier Portal</span>
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                </a>
              </div>
              <span className="text-xs text-slate-600">
                Route:{" "}
                <strong className="text-slate-900 font-mono">
                  {activeTrackBooking.origin_pin} → {activeTrackBooking.dest_pin}
                </strong>
              </span>
            </div>
          </div>

          {!isCancelled && (
            <div className="py-2">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6">Delivery Milestone Pipeline</h4>
              <div className="grid grid-cols-5 gap-2 relative">
                {TRACKING_STAGES.map((stage, idx) => {
                  const isPassed = idx <= currentStageIndex;
                  const isCurrent = idx === currentStageIndex;
                  return (
                    <div key={stage} className="flex flex-col items-center text-center space-y-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                          isPassed ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
                        } ${isCurrent ? "ring-4 ring-emerald-200 scale-110" : ""}`}
                      >
                        {isPassed ? <CheckCircleIcon className="w-4 h-4" /> : idx + 1}
                      </div>
                      <span className={`text-[11px] font-bold ${isPassed ? "text-slate-900 font-black" : "text-slate-400"}`}>{stage}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">Milestone Audit Log (newest first)</h4>
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No milestones recorded yet.</p>
              ) : (
                history.map((step, idx) => (
                  <div key={`${step.timestamp}-${idx}`} className="flex items-start space-x-3 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 mt-1.5 shrink-0"></div>
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex-1 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-black text-slate-900 text-xs">{step.status}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{new Date(step.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                      </div>
                      <p className="text-indigo-800 font-bold mt-0.5">{step.location}</p>
                      <p className="text-slate-600 mt-1">{step.remarks}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center shadow-sm">
          <p className="text-slate-600 text-sm font-medium">
            {activeTrackingAwb.trim() ? (
              <>
                Consignment identifier <strong className="text-slate-900">&quot;{activeTrackingAwb}&quot;</strong> was not found in your shipments.
              </>
            ) : (
              "Enter an Order Ref or Carrier Docket above to see live milestones."
            )}
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 39. LEGAL, GOVERNANCE & COMPLIANCE MODAL
// ============================================================================
interface LegalModalProps {
  tab: LegalTab;
  setTab: (t: LegalTab) => void;
  onClose: () => void;
}

const LegalModal: FC<LegalModalProps> = ({ tab, setTab, onClose }) => {
  const tabs: { id: LegalTab; label: string }[] = [
    { id: "terms", label: "Terms of Service" },
    { id: "privacy", label: "Privacy Policy" },
    { id: "refund", label: "Refund & Cancellation" },
    { id: "shipping", label: "Shipping Policy" },
    { id: "prohibited", label: "Prohibited Goods" },
    { id: "contact", label: "Contact Us" }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto select-none no-print">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-3xl w-full p-6 shadow-2xl my-8 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Legal, Governance & Razorpay KYC Compliance</h3>
            <p className="text-xs text-slate-500 font-medium">
              Merchant: {MERCHANT_DETAILS.proprietor} • Jurisdiction: {MERCHANT_DETAILS.jurisdiction}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-600 space-y-3 max-h-96 overflow-y-auto pr-2 leading-relaxed select-text">
          {tab === "terms" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Terms and Conditions of Service</h4>
              <p>
                <strong>1. Platform Nature:</strong> {MERCHANT_DETAILS.platformName} is a proprietary B2B freight aggregator platform operated by <strong>{MERCHANT_DETAILS.proprietor}</strong>. LogiCompare connects commercial shippers with third-party fleet operators who publish their own tariffs on the platform.
              </p>
              <p>
                <strong>2. Statutory Compliance & E-Way Bills:</strong> Shippers warrant that consignments exceeding ₹50,000 are accompanied by valid, active GST E-Way Bills and commercial invoices.
              </p>
              <p>
                <strong>3. Direct Settlement:</strong> Freight is settled directly between shipper and carrier. The platform charges a convenience fee of {MERCHANT_DETAILS.platformFeePct}% per consignment (minimum ₹{MERCHANT_DETAILS.minPlatformFeeINR}).
              </p>
              <p>
                <strong>4. Governing Law:</strong> These terms are governed by the laws of India. Any dispute is subject to the exclusive jurisdiction of the competent courts in <strong>{MERCHANT_DETAILS.jurisdiction}</strong>.
              </p>
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Privacy & Data Protection Policy</h4>
              <p>
                <strong>1. Collection of Business Data:</strong> We collect business contact details, GSTIN identifiers, pickup/delivery warehouse addresses and package specifications solely to facilitate freight calculations, label printing and linehaul tracking.
              </p>
              <p>
                <strong>2. Designated Grievance Officer:</strong> In compliance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, the designated Grievance Officer is:
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
                <strong>1. Cancellation Prior to Pickup:</strong> Consignments cancelled before the carrier&apos;s pickup attempt qualify for a <strong>100% refund</strong> of platform verification fees.
              </p>
              <p>
                <strong>2. Refund Settlement Timeframe:</strong> Approved refunds are returned to the original source account. The standard credit window is <strong>5 to 7 business days</strong>.
              </p>
            </div>
          )}

          {tab === "shipping" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Shipping, Transit SLAs & Delivery Policy</h4>
              <p>
                <strong>1. Serviceable Network:</strong> Serviceability depends on the lanes each carrier publishes on the platform.
              </p>
              <p>
                <strong>2. Estimated Transit SLAs:</strong> Transit times are set by each carrier&apos;s tariff and shown on every quote. They are estimates and not guarantees.
              </p>
            </div>
          )}

          {tab === "prohibited" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Strictly Prohibited & Banned Cargo</h4>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>Explosives, fireworks, ammunition and hazardous chemicals (Classes 1–9 Hazmat).</li>
                <li>Flammable liquids, gases, compressed cylinders and corrosives.</li>
                <li>Unregistered bullion, loose precious gems and currency notes.</li>
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
          <button type="button" onClick={onClose} className="bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2 rounded-xl transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 40. COMPLIANCE & LEGAL FOOTER
// ============================================================================
interface FooterSectionProps {
  openLegalModal: (tab: LegalTab) => void;
}

const FooterSection: FC<FooterSectionProps> = ({ openLegalModal }) => {
  const links: { id: LegalTab; label: string }[] = [
    { id: "terms", label: "Terms of Service" },
    { id: "privacy", label: "Privacy Policy" },
    { id: "refund", label: "Refund & Cancellation" },
    { id: "shipping", label: "Shipping Policy" },
    { id: "prohibited", label: "Prohibited Cargo" },
    { id: "contact", label: "Contact Us" }
  ];

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
              Freight aggregator connecting commercial shippers with transport fleets. Freight is settled directly with the carrier.
            </p>
            <div className="inline-flex items-center space-x-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>
                Jurisdiction: <strong>{MERCHANT_DETAILS.jurisdiction}</strong>
              </span>
            </div>
          </div>

          <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            <span className="text-xs font-black uppercase tracking-wider block text-indigo-400">Merchant Contact & Grievance</span>
            <p className="text-[11px] text-slate-300"><strong>Proprietor:</strong> {MERCHANT_DETAILS.proprietor}</p>
            <p className="text-[11px] text-slate-300">
              <strong>Helpline:</strong> <a href={`tel:${MERCHANT_DETAILS.phone}`} className="text-indigo-400 hover:underline">{MERCHANT_DETAILS.phone}</a>
            </p>
            <p className="text-[11px] text-slate-300">
              <strong>Support:</strong> <a href={`mailto:${MERCHANT_DETAILS.email}`} className="text-indigo-400 hover:underline">{MERCHANT_DETAILS.email}</a>
            </p>
            <p className="text-[11px] text-slate-400 leading-tight"><strong>Address:</strong> {MERCHANT_DETAILS.address}</p>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-black uppercase tracking-wider block text-indigo-400">Governance & Policies</span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-400">
              {links.map((l) => (
                <button key={l.id} type="button" onClick={() => openLegalModal(l.id)} className="text-left hover:text-white transition">
                  {l.label}
                </button>
              ))}
            </div>
            <div className="pt-2 flex flex-wrap gap-2 text-[10px]">
              <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded font-mono font-bold">Direct Settlement</span>
              <span className="bg-indigo-950/60 text-indigo-300 border border-indigo-800/80 px-2 py-0.5 rounded font-mono font-bold">GST 18% GTA</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <p>
            © {new Date().getFullYear()} {MERCHANT_DETAILS.platformName} ({MERCHANT_DETAILS.proprietor}). All rights reserved.
          </p>
          <div className="flex items-center space-x-3">
            <span>Carriage by Road Act 2007</span>
            <span>•</span>
            <span>Refund SLA: 5–7 Days</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ============================================================================
// 41. POSTAL PIN DIRECTORY SEARCH MODAL
// ============================================================================
interface CitySearchModalProps {
  target: "origin" | "dest";
  onSelectPin: (pin: string) => void;
  onClose: () => void;
}

const CitySearchModal: FC<CitySearchModalProps> = ({ target, onSelectPin, onClose }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ name: string; district: string; state: string; pincode: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setLoading(true);
    setHasSearched(true);
    setFailed(false);
    try {
      const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data && data[0]?.Status === "Success" && data[0]?.PostOffice) {
        setResults(
          data[0].PostOffice.map((item: any) => ({ name: item.Name, district: item.District, state: item.State, pincode: item.Pincode }))
        );
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Find PIN Code for {target === "origin" ? "Origin" : "Destination"}</h3>
            <p className="text-xs text-slate-500 font-medium">Search Indian cities, districts or branch post offices</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Ludhiana, Meerut, Panipat, Bhiwandi..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
            autoFocus
          />
          <button type="submit" disabled={loading || query.trim().length < 3} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50">
            <SearchIcon className="w-4 h-4" />
            <span>{loading ? "..." : "Search"}</span>
          </button>
        </form>

        <div className="max-h-64 overflow-y-auto space-y-2 divide-y divide-slate-100 pr-1">
          {results.length > 0 ? (
            results.map((item, idx) => (
              <div
                key={`${item.pincode}-${idx}`}
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
                  <p className="text-[11px] text-slate-500">
                    {item.district}, {item.state}
                  </p>
                </div>
                <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">{item.pincode}</span>
              </div>
            ))
          ) : failed ? (
            <p className="text-center text-xs text-rose-600 py-6 font-bold">The PIN directory could not be reached. Check your connection or type the PIN directly.</p>
          ) : hasSearched && !loading ? (
            <p className="text-center text-xs text-slate-400 py-6">No matching post offices found. Try another city name.</p>
          ) : (
            <p className="text-center text-xs text-slate-400 py-6">Type at least 3 letters of your city and press search.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 42. SYSTEM ADMINISTRATION & AUDIT OVERSIGHT (DEMO SANDBOX ONLY)
// ============================================================================
interface AdminOverviewSectionProps {
  bookings: Booking[];
  vendors: Vendor[];
  rateCards: RateCard[];
}

const AdminOverviewSection: FC<AdminOverviewSectionProps> = ({ bookings, vendors, rateCards }) => {
  const grossFreight = bookings.reduce((acc, b) => acc + (b.cost_breakdown?.freightSubtotal || b.final_total || 0), 0);
  const platformFees = bookings.reduce((acc, b) => acc + (b.cost_breakdown?.platformConvenienceFee || 0), 0);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Administration & Oversight</h1>
        <p className="text-xs text-slate-500 mt-0.5">Platform performance, onboarded fleets and fee audit (sandbox view)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Dispatches</span>
          <span className="text-3xl font-black text-slate-900">{bookings.length}</span>
          <p className="text-[11px] text-emerald-600 font-bold">Dual-ID tracked</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Carrier Partners</span>
          <span className="text-3xl font-black text-indigo-600">{vendors.length}</span>
          <p className="text-[11px] text-indigo-600 font-bold">{rateCards.filter((r) => r.is_active).length} active tariffs</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Gross Freight Routed</span>
          <span className="text-3xl font-black text-slate-900 font-mono">{formatINR(grossFreight)}</span>
          <p className="text-[11px] text-slate-500 font-bold">Settled directly with carriers</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Platform Fees ({MERCHANT_DETAILS.platformFeePct}%)</span>
          <span className="text-3xl font-black text-emerald-600 font-mono">{formatINR(platformFees)}</span>
          <p className="text-[11px] text-emerald-700 font-bold">Accrued from bookings</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h3 className="text-base font-black text-slate-900">Integrated Transporters</h3>
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
                  <td className="py-3 px-4 text-amber-500 font-bold">{Number(v.rating) > 0 ? `★ ${v.rating}` : "—"}</td>
                  <td className="py-3 px-4 font-mono">{v.gstin || "—"}</td>
                  <td className="py-3 px-4 text-[11px] text-slate-500">{(v.fleet_types || []).join(", ") || "—"}</td>
                  <td className="py-3 px-4 font-mono text-emerald-700 font-bold">{v.upi_id || "—"}</td>
                  <td className="py-3 px-4 font-mono text-[10px] text-indigo-600 truncate max-w-[150px]">{v.tracking_base_url || "—"}</td>
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
// END OF PART 6 OF 7
// ============================================================================
// ============================================================================
// PART 7 OF 7 — BULK ORDER MANAGER, THERMAL LABELS + PRINT ALL, LANDING PAGE,
//               DEMO-SWITCHER ISOLATION, ROOT `export default function Page()`
// Paste directly after Part 6. This is the ONLY export in the file.
// ============================================================================

// ============================================================================
// 43. SHIPPER BULK CSV DISPATCH MATRIX (UP TO 50 CONSIGNMENTS)
// ============================================================================
interface ShipperBulkCsvSectionProps {
  isLive: boolean;
  activeOriginAddress: AddressProfile | null;
  onManageFacilities: () => void;
  bulkManifestList: BulkManifestRow[];
  onAutoSelectCheapest: () => void;
  onAutoSelectFastest: () => void;
  onSelectCarrierForRow: (rowId: string, vendorId: string) => void;
  onRemoveRow: (rowId: string) => void;
  onClearManifest: () => void;
  bulkSettlementMethod: SettlementType;
  setBulkSettlementMethod: (val: SettlementType) => void;
  bulkConsolidatedUtr: string;
  setBulkConsolidatedUtr: (val: string) => void;
  onConfirmBatchBooking: () => Promise<void>;
  isBatchProcessing: boolean;
  handleBulkCsvUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  bulkCsvFileName: string;
  bulkUploadError: string;
}

const ShipperBulkCsvSection: FC<ShipperBulkCsvSectionProps> = ({
  isLive,
  activeOriginAddress,
  onManageFacilities,
  bulkManifestList,
  onAutoSelectCheapest,
  onAutoSelectFastest,
  onSelectCarrierForRow,
  onRemoveRow,
  onClearManifest,
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
  const bookableRows = useMemo(() => bulkManifestList.filter((r) => r.selectedQuote), [bulkManifestList]);
  const skippedCount = bulkManifestList.length - bookableRows.length;
  const totalOutlay = bookableRows.reduce((acc, r) => acc + (r.selectedQuote?.breakdown.total || 0), 0);
  const totalFees = bookableRows.reduce((acc, r) => acc + (r.selectedQuote?.breakdown.platformConvenienceFee || 0), 0);
  const creditBlocked = bulkSettlementMethod === "corporate_credit" && bookableRows.some((r) => !r.selectedQuote?.creditAvailable);

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
    URL.revokeObjectURL(url);
  };

  const settlementOption = (id: SettlementType, label: string) => (
    <label
      className={`px-4 py-2 rounded-xl border cursor-pointer font-bold transition ${
        bulkSettlementMethod === id ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-slate-900 text-slate-300 border-slate-700"
      }`}
    >
      <input type="radio" name="bulk_settlement" checked={bulkSettlementMethod === id} onChange={() => setBulkSettlementMethod(id)} className="hidden" />
      {label}
    </label>
  );

  return (
    <div className="space-y-6">
      {activeOriginAddress ? (
        <div className="bg-slate-950 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-black text-sm uppercase tracking-wide">Dispatch Facility:</span>
              <span className="font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded text-xs font-bold">
                {activeOriginAddress.label} (PIN: {activeOriginAddress.pincode})
              </span>
              <button type="button" onClick={onManageFacilities} className="text-[11px] text-indigo-300 hover:text-white underline font-bold">
                Change
              </button>
            </div>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">{formatPickupAddress(activeOriginAddress)}</p>
          </div>
          <button type="button" onClick={handleDownloadBulkTemplate} className="bg-white hover:bg-slate-100 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-md shrink-0 transition">
            <DownloadIcon className="w-4 h-4 text-indigo-600" />
            <span>Download Template (.csv)</span>
          </button>
        </div>
      ) : (
        <PickupAddressRequiredBanner onSetup={onManageFacilities} />
      )}

      <div className={`bg-white border-2 border-dashed rounded-2xl p-8 text-center space-y-4 shadow-sm transition ${activeOriginAddress ? "border-indigo-300 hover:border-indigo-500" : "border-slate-200 opacity-60"}`}>
        <input type="file" accept=".csv,text/csv" onChange={handleBulkCsvUpload} disabled={!activeOriginAddress} className="hidden" id="bulk-csv-input" />
        <div className="max-w-lg mx-auto space-y-2.5">
          <label
            htmlFor="bulk-csv-input"
            className={`bg-indigo-600 text-white font-black px-6 py-3 rounded-xl text-xs inline-flex items-center space-x-2 shadow-md transition ${activeOriginAddress ? "hover:bg-indigo-700 cursor-pointer" : "cursor-not-allowed"}`}
          >
            <UploadIcon className="w-4 h-4" />
            <span>{bulkCsvFileName ? `Replace File (${bulkCsvFileName})` : "Select Bulk Consignment CSV (up to 50 locations)"}</span>
          </label>
          <p className="text-xs text-slate-600 font-medium">
            The dimensions column is optional. Weights use semicolons, e.g.{" "}
            <code className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 rounded font-mono font-bold">25; 10; 10</code>.
          </p>
        </div>
        {bulkUploadError && <div className="text-xs text-rose-800 bg-rose-50 border border-rose-300 p-3 rounded-xl font-bold max-w-lg mx-auto">{bulkUploadError}</div>}
      </div>

      {bulkManifestList.length > 0 && (
        <div className="bg-white border border-slate-300 rounded-2xl shadow-md overflow-hidden space-y-5 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2.5">
                <span>Bulk Consignment Manifest</span>
                <span className="bg-indigo-600 text-white text-xs px-3 py-0.5 rounded-full font-bold">{bulkManifestList.length} Destinations</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Quotes are calculated in your browser from {isLive ? "verified carrier tariffs" : "sample tariffs"}.
                {skippedCount > 0 && <strong className="text-rose-700"> {skippedCount} row(s) have no rate and will be skipped.</strong>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={onAutoSelectCheapest} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-sm transition">
                ⚡ Auto-Select Lowest Price
              </button>
              <button type="button" onClick={onAutoSelectFastest} className="bg-sky-600 hover:bg-sky-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-sm transition">
                🚀 Auto-Select Fastest SLA
              </button>
              <button type="button" onClick={onClearManifest} className="text-xs text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg font-bold">
                Clear
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
                  <th className="py-3 px-3.5">Fee</th>
                  <th className="py-3 px-3.5 text-right">Total Outlay</th>
                  <th className="py-3 px-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {bulkManifestList.map((row, idx) => {
                  const quote = row.selectedQuote;
                  return (
                    <tr key={row.rowId} className={`${row.validationError ? "bg-rose-50/60" : idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-indigo-50/60 transition`}>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-black text-slate-900 block text-xs">{row.dest_pin}</span>
                        <span className="text-[11px] text-slate-500 font-semibold">{getLocalFallbackZone(row.dest_pin).city}</span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-bold text-slate-900 block">{row.consignee_name}</span>
                        <span className="text-[11px] text-slate-500 truncate max-w-[180px] block">{row.delivery_address}</span>
                        {row.validationError && <span className="text-[10px] text-rose-700 font-black block mt-0.5">{row.validationError}</span>}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-black text-indigo-700 block">{row.total_boxes} Box(es)</span>
                        <span className="text-[10px] text-slate-500 font-mono">{row.boxes.map((b) => `${b.weight}kg`).join(", ")}</span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-black font-mono text-slate-900 block text-xs">{row.billableWeight} kg</span>
                        {row.hasOmittedDimensions && (
                          <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-black block mt-0.5" title="Dead weight applied since dimensions were not specified.">
                            Dead Wt Applied
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        {row.quotes.length > 0 ? (
                          <select
                            value={quote?.vendor?.id || ""}
                            onChange={(e) => onSelectCarrierForRow(row.rowId, e.target.value)}
                            className="bg-white border-2 border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none max-w-[220px]"
                          >
                            {row.quotes.map((q) => (
                              <option key={q.rateCard.id} value={q.vendor.id}>
                                {q.vendor.name} ({q.rateCard.sla_days}d - {formatINR(q.breakdown.total)})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px] font-black text-rose-700">No rate</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-800">{quote ? formatINR(quote.breakdown.freightSubtotal) : "—"}</td>
                      <td className="py-3 px-3.5 font-mono text-indigo-700 font-bold">{quote ? formatINR(quote.breakdown.platformConvenienceFee) : "—"}</td>
                      <td className="py-3 px-3.5 font-mono font-black text-right text-emerald-800 text-sm">{quote ? formatINR(quote.breakdown.total) : "—"}</td>
                      <td className="py-3 px-3.5 text-right">
                        <button type="button" onClick={() => onRemoveRow(row.rowId)} className="text-rose-500 hover:text-rose-700 p-1" aria-label="Remove row">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-950 text-white p-6 rounded-2xl shadow-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-sm font-black uppercase text-indigo-400 block tracking-wide">Consolidated Settlement Method ({bookableRows.length} Shipments)</span>
                <p className="text-xs text-slate-400 mt-0.5">100% of freight is settled directly with transporters. Platform fee is {MERCHANT_DETAILS.platformFeePct}% (min ₹{MERCHANT_DETAILS.minPlatformFeeINR}).</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {settlementOption("direct_to_pay", "💵 To-Pay POD")}
                {settlementOption("direct_upi", "📲 Direct Carrier UPI")}
                {settlementOption("corporate_credit", "🏢 Corporate Credit")}
              </div>
            </div>

            {bulkSettlementMethod === "direct_upi" && (
              <div className="flex items-center space-x-3 text-xs bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                <label className="font-bold text-slate-300 shrink-0">Payment Reference (optional):</label>
                <input
                  type="text"
                  value={bulkConsolidatedUtr}
                  onChange={(e) => setBulkConsolidatedUtr(e.target.value)}
                  placeholder="e.g. 409827104928"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-white flex-1 max-w-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {creditBlocked && (
              <p className="text-xs text-amber-200 bg-amber-900/40 border border-amber-700 rounded-xl px-3.5 py-2.5 font-bold">
                Corporate credit is not approved (or the limit is too low) for one or more selected carriers. Pick other carriers or another settlement method.
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="text-xs">
                <span className="text-slate-400">Total Manifest Outlay: </span>
                <strong className="text-xl text-emerald-400 font-mono font-black ml-2">{formatINR(totalOutlay)}</strong>
                <span className="text-[11px] text-slate-400 block mt-0.5">Includes platform fee: {formatINR(totalFees)}</span>
              </div>
              <button
                type="button"
                disabled={isBatchProcessing || bookableRows.length === 0 || creditBlocked}
                onClick={onConfirmBatchBooking}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-7 py-3.5 rounded-xl text-xs transition shadow-lg flex items-center space-x-2 disabled:opacity-50"
              >
                <CheckCircleIcon className="w-5 h-5 text-slate-950" />
                <span>{isBatchProcessing ? "Assigning Carrier Dockets..." : `Confirm & Book ${bookableRows.length} Shipment${bookableRows.length === 1 ? "" : "s"}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 44. CONTINUOUS 4x6 THERMAL MULTI-BOX LABELS + MASTER HANDOVER MANIFEST
// Prints through window.print(). The app shell is hidden in print CSS (Page adds
// `print:hidden` while this modal is open), so only labels + manifest are printed.
// NOTE: the bars are a docket-derived visual, NOT a scannable Code 128 barcode.
// ============================================================================
interface ThermalPrintModalProps {
  printableBooking: Booking | null;
  batchPrintBookings: Booking[] | null;
  onClose: () => void;
}

function expandBookingBoxes(booking: Booking): BoxItem[] {
  const list = booking.boxes && booking.boxes.length > 0 ? booking.boxes : [];
  if (list.length === 0) {
    return [{ id: "b0", qty: 1, weight: booking.actual_weight, length: null, width: null, height: null }];
  }
  // A carton row with qty 3 prints 3 labels ("BOX 1 OF N" ... "BOX N OF N").
  return list.flatMap((b) => Array.from({ length: Math.max(1, Number(b.qty) || 1) }, () => b));
}

function barsFromDocket(docket: string): number[] {
  const src = (docket || "0000").replace(/[^A-Za-z0-9]/g, "") || "0000";
  const bars: number[] = [];
  for (let i = 0; i < 34; i++) bars.push((src.charCodeAt(i % src.length) % 4) + 1);
  return bars;
}

const ThermalPrintModal: FC<ThermalPrintModalProps> = ({ printableBooking, batchPrintBookings, onClose }) => {
  const allBookings = batchPrintBookings || (printableBooking ? [printableBooking] : []);
  const totalCartons = allBookings.reduce((acc, b) => acc + expandBookingBoxes(b).length, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto print:static print:block print:bg-white print:p-0 print:backdrop-blur-none select-none">
      <style>{`
        .thermal-label-container { width: 4in; min-height: 6in; box-sizing: border-box; margin: 0 auto 16px; overflow: hidden; }
        @media print {
          @page label { size: 4in 6in; margin: 0; }
          @page manifest { size: A4; margin: 10mm; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .thermal-label-container { page: label; width: 4in !important; height: 6in !important; min-height: 6in !important; max-height: 6in !important; padding: 0.15in !important; margin: 0 !important; border: 3px solid #000 !important; break-after: page; page-break-after: always; }
          .manifest-sheet { page: manifest; break-before: page; page-break-before: always; width: 100% !important; }
        }
      `}</style>

      <div className="bg-white text-black rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 border border-slate-300 print:m-0 print:p-0 print:shadow-none print:border-0 print:rounded-none print:max-w-none print:w-full">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
          <div>
            <h3 className="text-base font-black text-slate-900">
              {batchPrintBookings ? `Batch 4x6 Thermal Labels (${batchPrintBookings.length} Consignments, ${totalCartons} Labels) + Handover Manifest` : "4x6 Thermal Multi-Box Shipping Labels"}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">One label per carton, calibrated for 4x6 thermal printers. Set the printer paper size to 4x6 in the print dialog.</p>
          </div>
          <div className="flex items-center space-x-2">
            <button type="button" onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition">
              <PrinterIcon className="w-4 h-4" />
              <span>Print All Labels (4x6)</span>
            </button>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg" aria-label="Close">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 print:space-y-0">
          {allBookings.map((booking) => {
            const cartons = expandBookingBoxes(booking);
            const carrierLabel = (booking.vendors?.name || "CARRIER").toUpperCase();
            const bars = barsFromDocket(booking.carrier_docket_no || booking.awb_number);

            return (
              <React.Fragment key={booking.id}>
                {cartons.map((box, boxIdx) => (
                  <div key={`${booking.id}-box-${boxIdx}`} className="thermal-label-container font-sans bg-white text-black border-4 border-black p-3 space-y-2.5 rounded-sm">
                    <div className="flex justify-between items-start border-b-2 border-black pb-1.5">
                      <div>
                        <h2 className="text-lg font-black leading-tight tracking-tight uppercase">{carrierLabel}</h2>
                        <span className="text-[8px] font-black uppercase tracking-widest block text-slate-700">CARRIER CONSIGNMENT NOTE</span>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black font-mono">
                          {booking.origin_pin.slice(0, 3)} → {booking.dest_pin.slice(0, 3)}
                        </span>
                        <span className="text-[9px] font-black uppercase bg-black text-white px-1.5 py-0.5 rounded-sm block mt-0.5">
                          BOX {boxIdx + 1} OF {cartons.length}
                        </span>
                      </div>
                    </div>

                    <div className="text-center py-1.5 border-b-2 border-black space-y-1">
                      <div className="flex justify-center items-center space-x-0.5 h-10">
                        {bars.map((w, i) => (
                          <div key={i} className="bg-black h-full" style={{ width: `${w * 2.2}px` }} />
                        ))}
                      </div>
                      <div className="flex items-center justify-center space-x-2 font-mono">
                        <span className="text-sm font-black tracking-widest">DOCKET: {booking.carrier_docket_no || booking.awb_number}</span>
                        <span className="text-[10px] font-bold text-slate-700">[{booking.order_id}]</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-b-2 border-black pb-1.5 text-[10px] leading-tight">
                      <div>
                        <span className="text-[8px] font-black uppercase block text-slate-700">SHIPPER (CONSIGNOR):</span>
                        <strong className="block truncate font-black text-xs">{booking.shipper_name}</strong>
                        <p className="text-slate-800 break-words">{booking.pickup_address}</p>
                        <p className="font-mono font-bold mt-0.5">PIN: {booking.origin_pin}</p>
                        {booking.shipper_gstin && <p className="font-mono text-[9px]">GSTIN: {booking.shipper_gstin}</p>}
                      </div>
                      <div>
                        <span className="text-[8px] font-black uppercase block text-slate-700">DELIVER TO (CONSIGNEE):</span>
                        <strong className="block truncate font-black text-xs">{booking.consignee_name}</strong>
                        <p className="text-slate-800 break-words">{booking.delivery_address}</p>
                        <p className="font-mono font-bold mt-0.5">
                          PIN: {booking.dest_pin} • Ph: {booking.consignee_phone}
                        </p>
                        {booking.consignee_gstin && <p className="font-mono text-[9px]">GSTIN: {booking.consignee_gstin}</p>}
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
                        <strong className="text-[9px] font-mono font-bold">{hasCompleteDimensions(box as BoxItem) ? `${box.length}x${box.width}x${box.height}` : "DEAD WT"}</strong>
                      </div>
                      <div>
                        <span className="text-[7px] font-bold block uppercase text-slate-700">TERMS</span>
                        <strong className="text-[9px] font-mono font-black uppercase truncate block">{booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}</strong>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[8px] text-slate-700 pt-0.5 font-mono">
                      <span>Carriage by Road Act 2007 consignment</span>
                      <span>{new Date(booking.created_at).toLocaleDateString("en-IN")}</span>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            );
          })}

          {batchPrintBookings && batchPrintBookings.length > 0 && (
            <div className="manifest-sheet bg-white text-black p-6 border-4 border-black font-sans space-y-5 rounded-sm">
              <div className="flex justify-between border-b-2 border-black pb-3">
                <div>
                  <h2 className="text-lg font-black tracking-tight">MASTER PICKUP HANDOVER MANIFEST</h2>
                  <p className="text-xs text-slate-700 font-medium">Dispatch Facility: {batchPrintBookings[0].pickup_address}</p>
                  <p className="text-xs text-slate-700 font-mono">Origin Pincode: {batchPrintBookings[0].pickup_pincode || batchPrintBookings[0].origin_pin}</p>
                  <p className="text-xs text-slate-700 font-medium">Shipper: {batchPrintBookings[0].shipper_name}</p>
                </div>
                <div className="text-right font-mono font-bold text-xs space-y-0.5">
                  <p>DISPATCH DATE: {new Date().toLocaleDateString("en-IN")}</p>
                  <p className="text-sm font-black text-black">TOTAL CONSIGNMENTS: {batchPrintBookings.length}</p>
                  <p>TOTAL CARTONS: {totalCartons}</p>
                  <p>TOTAL BILLABLE: {batchPrintBookings.reduce((acc, b) => acc + (b.billable_weight || 0), 0).toFixed(1)} KG</p>
                </div>
              </div>

              <table className="w-full text-left text-[10px] border border-black">
                <thead className="bg-slate-200 border-b-2 border-black font-black uppercase">
                  <tr>
                    <th className="p-1.5 border-r border-black">#</th>
                    <th className="p-1.5 border-r border-black">Order Ref</th>
                    <th className="p-1.5 border-r border-black">Carrier</th>
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
                      <td className="p-1.5 border-r border-black font-bold">{b.vendors?.name || "—"}</td>
                      <td className="p-1.5 border-r border-black font-mono">{b.carrier_docket_no}</td>
                      <td className="p-1.5 border-r border-black truncate max-w-[130px] font-bold">{b.consignee_name}</td>
                      <td className="p-1.5 border-r border-black font-mono font-bold">{b.dest_pin}</td>
                      <td className="p-1.5 border-r border-black font-mono">{expandBookingBoxes(b).length}</td>
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
// 45. HERO ANIMATED TRUCK (2D CANVAS) — only mounted when High-Volume mode is OFF
// ============================================================================
function Hero3DTruck() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [speed, setSpeed] = useState<"normal" | "turbo">("normal");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId = 0;
    let wheelAngle = 0;

    const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      if (typeof (ctx as any).roundRect === "function") (ctx as any).roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2 + 10;

      ctx.save();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
      ctx.lineWidth = 1;
      for (let i = -140; i <= 140; i += 28) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 1.8, cy + 50);
        ctx.lineTo(cx + i * 0.5, cy - 20);
        ctx.stroke();
      }
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

      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 30, 85, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);

      const gradContainer = ctx.createLinearGradient(-80, -35, 10, 10);
      gradContainer.addColorStop(0, "#4f46e5");
      gradContainer.addColorStop(0.5, "#3730a3");
      gradContainer.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = gradContainer;
      ctx.strokeStyle = "#818cf8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundedRect(-80, -38, 95, 48, 4);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      for (let rx = -70; rx < 10; rx += 8) {
        ctx.beginPath();
        ctx.moveTo(rx, -36);
        ctx.lineTo(rx, 8);
        ctx.stroke();
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText("LOGICOMPARE B2B", -68, -12);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 7px sans-serif";
      ctx.fillText("EXPRESS CARGO LINEHAUL", -68, -2);

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

      ctx.fillStyle = "rgba(186, 230, 253, 0.85)";
      ctx.beginPath();
      ctx.moveTo(38, -25);
      ctx.lineTo(50, -9);
      ctx.lineTo(24, -9);
      ctx.lineTo(24, -25);
      ctx.closePath();
      ctx.fill();

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

      wheelAngle += speed === "turbo" ? 0.35 : 0.16;
      for (const wx of [-62, -42, 28, 46]) {
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
          <span className="text-xs font-mono font-bold text-slate-200">Linehaul Container Transit</span>
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
        <span className="text-emerald-400 font-bold">Linehaul Animation</span>
      </div>
    </div>
  );
}

// ============================================================================
// 46. LANDING PAGE (CTAs ADAPT TO LOGGED-OUT / LIVE SHIPPER / LIVE CARRIER)
// ============================================================================
interface LandingViewProps {
  highVolumeMode: boolean;
  vendors: Vendor[];
  isLive: boolean;
  liveRole: "shipper" | "carrier" | null;
  landingTrackingInput: string;
  setLandingTrackingInput: (val: string) => void;
  onQuickTrack: (val?: string) => void;
  onJumpToCompare: () => void;
  onJumpToBulk: () => void;
  onOpenCarrierHub: () => void;
  onOpenAuth: () => void;
  onSwitchShipperDemo: () => void;
  onSwitchCarrierDemo: () => void;
}

const LandingView: FC<LandingViewProps> = ({
  highVolumeMode,
  vendors,
  isLive,
  liveRole,
  landingTrackingInput,
  setLandingTrackingInput,
  onQuickTrack,
  onJumpToCompare,
  onJumpToBulk,
  onOpenCarrierHub,
  onOpenAuth,
  onSwitchShipperDemo,
  onSwitchCarrierDemo
}) => {
  const [workflowTab, setWorkflowTab] = useState<"shipper" | "vendor">("shipper");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const showShipperCtas = !isLive || liveRole === "shipper";
  const showCarrierCta = isLive && liveRole === "carrier";
  const feePct = MERCHANT_DETAILS.platformFeePct;
  const feeMin = MERCHANT_DETAILS.minPlatformFeeINR;

  const faqs = [
    {
      q: "What is the difference between Order Ref (LC-XXXXXX) and Carrier Docket?",
      a: "The Order Ref is LogiCompare Pro's internal reference used for platform invoices and receipts. The Carrier Docket is the transporter's own waybill used by drivers and freight hubs."
    },
    {
      q: "Can I book shipments if I don't know the exact box dimensions?",
      a: "Yes. Length, width and height are optional. When dimensions are left blank, the engine prices the load on dead actual weight alone."
    },
    {
      q: "How does the formal B2B Credit Facility work?",
      a: "Credit is never available by default. You apply by uploading an executed credit agreement. Once the carrier approves a limit, the credit option unlocks at checkout for that carrier."
    },
    {
      q: "How does platform fee billing work?",
      a: `Freight is paid directly to carriers. The platform charges a ${feePct}% convenience fee per load (minimum ₹${feeMin}), invoiced to carriers on a weekly or monthly cycle.`
    },
    {
      q: "Where is my credit agreement or bilty scan stored?",
      a: "Files are stored in private Supabase Storage buckets. Large files are compressed in your browser before upload to keep storage small."
    }
  ];

  const shipperSteps = [
    ["PIN & Optional Dimensions", "Enter a destination PIN or upload a CSV of up to 50 locations. Dimensions are optional; dead weight prices the load when omitted."],
    ["Compare Rates & Credit", "Inspect line-item pricing: base, fuel %, docket, ODA, FOV and GST. See your approved credit line per carrier."],
    ["One-Click Dual-ID Booking", "Settle via To-Pay, direct UPI or approved corporate credit. Receive an internal Order Ref and the carrier's docket."],
    ["Continuous 4x6 Labels", "Print one Box X of Y thermal label per carton plus a Master Handover Manifest with driver sign-off."]
  ];
  const carrierSteps = [
    ["Onboard Fleet & Tracking URL", "Register as a transporter, add bank/UPI settlement details and your public tracking portal URL."],
    ["Underwrite Credit Agreements", "Review signed agreements from shippers, then approve a credit ceiling or reject with a reason."],
    ["Weekly / Monthly Billing", "Track platform fee dues by cycle, with due dates and UTR payment recording."]
  ];

  const capabilities: [ReactNode, string, string, string][] = [
    [<LayersIcon key="a" className="w-5 h-5" />, "bg-indigo-50 text-indigo-600", "Multi-Box Volumetric Engine", "Compares actual and volumetric weight across cartons using 4500 and 5000 divisors. Dead weight alone applies when dimensions are omitted."],
    [<CurrencyRupeeIcon key="b" className="w-5 h-5" />, "bg-emerald-50 text-emerald-600", "Transparent Surcharges", "Every quote itemises base freight, fuel surcharge, docket charge, handling, ODA fee and 18% GST."],
    [<ShieldCheckIcon key="c" className="w-5 h-5" />, "bg-amber-50 text-amber-600", "FOV Cargo Risk Charge", "A freight-on-value charge is calculated from your declared value using each carrier's published percentage."],
    [<PrinterIcon key="d" className="w-5 h-5" />, "bg-blue-50 text-blue-600", "4x6 Thermal Label Printing", "Per-carton labels with the carrier docket, ending with a driver handover sign-off manifest."],
    [<TruckIcon key="e" className="w-5 h-5" />, "bg-purple-50 text-purple-600", "Carrier-Configured Tracking URLs", "Each transporter's own public tracking portal is opened with the docket number appended automatically."],
    [<CreditCardIcon key="f" className="w-5 h-5" />, "bg-rose-50 text-rose-600", "Formal B2B Credit Agreements", "Upload an executed agreement, get underwritten by the carrier and unlock net-term credit with a tracked ledger."]
  ];

  const primaryBtn = "bg-indigo-600 hover:bg-indigo-500 text-white font-black px-7 py-3.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 hover:scale-105 flex items-center space-x-2";
  const ghostBtn = "bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold px-6 py-3.5 rounded-xl text-sm transition backdrop-blur-md flex items-center space-x-2";

  return (
    <div className="flex-1 flex flex-col space-y-16 pb-16">
      {/* SECTION 1: HERO */}
      <section className="relative overflow-hidden bg-slate-950 text-white pt-16 pb-24 px-4 lg:px-8 border-b border-slate-800">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 scale-105 pointer-events-none"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop')` }}
        />
        <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/90 to-slate-950 pointer-events-none" />

        <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide backdrop-blur-md shadow-inner">
              <span>🇮🇳</span>
              <span>Dual-ID Consignment Discovery & Automated Dispatch</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">One-Click Bulk Freight Booking & Multi-Box 4x6 Thermal Labels.</h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
              Compare tariffs from transporters on the platform, upload semicolon-delimited CSVs, auto-assign the lowest rate, manage approved corporate credit lines and print continuous thermal labels with driver handover manifests.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              {showShipperCtas && (
                <>
                  <button type="button" onClick={onJumpToBulk} className={primaryBtn}>
                    <UploadIcon className="w-5 h-5" />
                    <span>Launch Bulk Shipper Console</span>
                  </button>
                  <button type="button" onClick={onJumpToCompare} className={ghostBtn}>
                    <BoxIcon className="w-5 h-5 text-indigo-400" />
                    <span>Single Calculator</span>
                  </button>
                </>
              )}
              {showCarrierCta && (
                <button type="button" onClick={onOpenCarrierHub} className={primaryBtn}>
                  <TruckIcon className="w-5 h-5" />
                  <span>Open Carrier Hub</span>
                </button>
              )}
              {!isLive && (
                <>
                  <button type="button" onClick={onOpenAuth} className={ghostBtn}>
                    <span>Sign In / Register</span>
                  </button>
                  <button type="button" onClick={onSwitchCarrierDemo} className={`${ghostBtn} hover:border-slate-500`}>
                    <TruckIcon className="w-5 h-5 text-emerald-400" />
                    <span>Carrier Sandbox (Demo)</span>
                  </button>
                </>
              )}
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
                <h3 className="text-white font-black text-lg">High-Volume Mode Active</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">Direct settlement via To-Pay POD, UPI or pre-approved B2B credit. Animations are off for maximum speed.</p>
              </div>
            )}
          </div>
        </div>

        {/* Tracking quick lookup */}
        {(!isLive || liveRole === "shipper") && (
          <div className="pt-10 max-w-xl mx-auto relative z-10">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onQuickTrack();
              }}
              className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-2xl flex flex-col sm:flex-row items-center gap-2"
            >
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
              <button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-6 py-3 rounded-xl transition shadow-md shrink-0">
                Track Shipment
              </button>
            </form>
            {!isLive && (
              <div className="flex items-center justify-center space-x-3 text-[11px] text-slate-400 mt-3 font-medium">
                <span>Sample IDs:</span>
                <button type="button" onClick={() => onQuickTrack(DEMO_INIT_ORDER_ID)} className="font-mono text-indigo-300 hover:text-indigo-200 underline font-bold">
                  Ref: {DEMO_INIT_ORDER_ID}
                </button>
                <span>•</span>
                <button type="button" onClick={() => onQuickTrack(DEMO_INIT_CARRIER_DOCKET)} className="font-mono text-indigo-300 hover:text-indigo-200 underline font-bold">
                  Docket: {DEMO_INIT_CARRIER_DOCKET}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* SECTION 2: STATS & CARRIER STRIP */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-8 border-b border-slate-200">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-3xl font-black text-indigo-600">{vendors.length}</span>
            <p className="text-xs font-bold text-slate-900 mt-1">Carrier Partners On Platform</p>
            <p className="text-[11px] text-slate-500">{isLive ? "Live onboarded transporters" : "Sample sandbox carriers"}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-3xl font-black text-emerald-600">PIN</span>
            <p className="text-xs font-bold text-slate-900 mt-1">Lane-Based Coverage</p>
            <p className="text-[11px] text-slate-500">Each carrier publishes its own lanes</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-3xl font-black text-slate-900">100%</span>
            <p className="text-xs font-bold text-slate-900 mt-1">Direct Carrier Settlement</p>
            <p className="text-[11px] text-slate-500">To-Pay / Direct UPI / B2B Credit</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <span className="text-3xl font-black text-amber-500">{feePct}%</span>
            <p className="text-xs font-bold text-slate-900 mt-1">Flat Platform Fee</p>
            <p className="text-[11px] text-slate-500">Min ₹{feeMin} per booking</p>
          </div>
        </div>

        <div className="pt-8 text-center space-y-4">
          <span className="text-xs uppercase font-black text-slate-500 tracking-widest block">Transporters On The Platform</span>
          {vendors.length === 0 ? (
            <p className="text-xs text-slate-500">Carriers will appear here as they onboard.</p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {vendors.map((v) => (
                <div key={v.id} className="flex items-center space-x-2.5 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-400 transition">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="font-extrabold text-xs text-slate-900">{v.name}</span>
                  {Number(v.rating) > 0 && <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">★ {v.rating}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 3: WORKFLOW */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full">Operational Architecture</span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">How LogiCompare Pro Works</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">Platform transparency combined with real carrier waybill and corporate credit standards.</p>
          <div className="inline-flex p-1.5 bg-slate-200 rounded-2xl mt-4 shadow-inner">
            <button type="button" onClick={() => setWorkflowTab("shipper")} className={`px-5 py-2 rounded-xl text-xs font-black transition ${workflowTab === "shipper" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              📦 For Shippers & Businesses
            </button>
            <button type="button" onClick={() => setWorkflowTab("vendor")} className={`px-5 py-2 rounded-xl text-xs font-black transition ${workflowTab === "vendor" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              🚛 For Fleets & Carriers
            </button>
          </div>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${workflowTab === "shipper" ? "lg:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-3"}`}>
          {(workflowTab === "shipper" ? shipperSteps : carrierSteps).map(([title, body], i) => (
            <div key={title} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <span className={`w-8 h-8 rounded-xl font-black flex items-center justify-center text-sm ${workflowTab === "shipper" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-800"}`}>{i + 1}</span>
              <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: CAPABILITIES */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full">Enterprise Architecture</span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Engineered for Indian Logistics Complexity</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map(([icon, tone, title, body]) => (
            <div key={title} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>{icon}</div>
              <h3 className="font-bold text-slate-900 text-base">{title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5: FAQ */}
      <section className="max-w-4xl mx-auto px-4 lg:px-8 w-full space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full">FAQ & Knowledge Base</span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div key={faq.q} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition">
              <button type="button" onClick={() => setOpenFaq(openFaq === idx ? null : idx)} className="w-full p-4 text-left font-black text-sm text-slate-900 flex items-center justify-between hover:bg-slate-50" aria-expanded={openFaq === idx}>
                <span>{faq.q}</span>
                <ChevronDownIcon className={`w-4 h-4 text-slate-500 transition-transform ${openFaq === idx ? "rotate-180 text-indigo-600" : ""}`} />
              </button>
              {openFaq === idx && <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3 font-medium">{faq.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 6: BOTTOM CTA */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full">
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 rounded-3xl p-8 sm:p-14 text-white text-center space-y-6 shadow-2xl border border-indigo-500/20">
          <div className="absolute -top-24 left-1/3 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <span className="relative z-10 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md">Start Saving On B2B Freight</span>
          <h2 className="relative z-10 text-2xl sm:text-4xl font-black max-w-2xl mx-auto">Ready to book with official carrier dockets and zero freight markup?</h2>
          <p className="relative z-10 text-indigo-200 text-xs sm:text-sm max-w-xl mx-auto">
            Open the dashboard to compare live rates, print carrier labels and manage approved credit agreements.
          </p>
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 pt-2">
            {showShipperCtas && (
              <button type="button" onClick={onJumpToCompare} className="bg-white hover:bg-slate-100 text-slate-950 font-black px-7 py-3.5 rounded-xl text-sm transition shadow-lg hover:scale-105">
                Open Freight Rate Matrix
              </button>
            )}
            {showCarrierCta && (
              <button type="button" onClick={onOpenCarrierHub} className="bg-white hover:bg-slate-100 text-slate-950 font-black px-7 py-3.5 rounded-xl text-sm transition shadow-lg hover:scale-105">
                Open Carrier Hub
              </button>
            )}
            {!isLive && (
              <>
                <button type="button" onClick={onOpenAuth} className="bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 font-bold px-7 py-3.5 rounded-xl text-sm transition backdrop-blur-md shadow-md">
                  Create Free Account
                </button>
                <button type="button" onClick={onSwitchShipperDemo} className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold px-7 py-3.5 rounded-xl text-sm transition backdrop-blur-md">
                  ⚡ Instant Demo as Shipper
                </button>
              </>
            )}
            {showShipperCtas && isLive && (
              <button type="button" onClick={onJumpToBulk} className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold px-7 py-3.5 rounded-xl text-sm transition backdrop-blur-md">
                🚀 Launch Bulk Console
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

// ============================================================================
// 47. THE MASTER NEXT.JS SINGLE DEFAULT EXPORT: Page()
// ============================================================================
export default function Page() {
  const { state, handlers } = useAppEngine();
  const [creditCarrierPreselect, setCreditCarrierPreselect] = useState<string | undefined>(undefined);

  const isRealAuthLive = state.modeEnv === "live" && Boolean(state.currentUser.isRealUser);
  const userIsShipper = state.currentUser.role === "shipper";
  const userIsCarrier = state.currentUser.role === "carrier" || state.currentUser.role === "vendor";
  const printOpen = Boolean(state.printableBooking || state.batchPrintBookings);
  const authModalOpen = state.showAuthModal || state.passwordRecoveryPending;

  // While the saved session is being restored, show a loader instead of flashing demo/landing UI.
  if (state.sessionStatus === "restoring") return <SessionLoadingScreen />;

  const openCreditApply = (carrierId?: string) => {
    setCreditCarrierPreselect(carrierId);
    state.setShowCreditApplyModal(true);
  };

  const showShipperView = state.activeRole === "shipper" && (!isRealAuthLive || userIsShipper);
  const showCarrierView = (state.activeRole === "carrier" || state.activeRole === "vendor") && (!isRealAuthLive || userIsCarrier);
  const showAdminView = state.activeRole === "admin" && !isRealAuthLive;

  const shipperTabs: { id: ShipperTabType; label: string }[] = [
    { id: "search", label: "🔍 New Rate Search" },
    { id: "matrix", label: "⚡ Rate Matrix (Bulk CSV)" },
    { id: "shipments", label: "📦 Active Shipments" },
    { id: "history", label: "📍 History & Live Track" },
    { id: "rfq", label: "⚖️ Load Auction (RFQ)" },
    { id: "address", label: "🏢 Dispatch Facilities" },
    { id: "credit", label: "💳 B2B Credit Agreements" }
  ];
  const carrierTabs: { id: CarrierTabType; label: string }[] = [
    { id: "loads", label: "🎯 Available Loads (RFQs)" },
    { id: "tracking", label: "📋 Fleet Tracking & Bilty" },
    { id: "rates", label: "🏷️ Commercial Rate Cards" },
    { id: "billing", label: "💳 Platform Fee Billing" },
    { id: "credit", label: "📑 Credit Approvals & Exposure" },
    { id: "earnings", label: "🏦 Settlement Bank Profile" }
  ];

  const cardCls = "bg-white rounded-xl shadow-sm border border-slate-200 p-6";

  return (
    <>
      {/* The whole app is hidden when printing labels so only the label sheets print. */}
      <div className={`min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white ${printOpen ? "print:hidden" : ""}`}>
        <AppHeader
          activeRole={state.activeRole}
          modeEnv={state.modeEnv}
          currentUser={state.currentUser}
          hasLiveSession={Boolean(state.authSession)}
          globalSearchInput={state.globalSearchInput}
          setGlobalSearchInput={state.setGlobalSearchInput}
          onGlobalSearch={handlers.handleGlobalSearch}
          onRoleSwitch={handlers.handleRoleSwitch}
          onModeToggle={handlers.handleModeToggle}
          onOpenAuth={() => state.setShowAuthModal(true)}
          onLogout={handlers.handleLogout}
        />

        <div className="flex-1">
          {/* VIEW A: LANDING */}
          {state.activeRole === "landing" && (
            <LandingView
              highVolumeMode={state.highVolumeMode}
              vendors={state.vendors}
              isLive={isRealAuthLive}
              liveRole={isRealAuthLive ? (userIsCarrier ? "carrier" : "shipper") : null}
              landingTrackingInput={state.landingTrackingInput}
              setLandingTrackingInput={state.setLandingTrackingInput}
              onQuickTrack={(val) => {
                const target = (val || state.landingTrackingInput || (isRealAuthLive ? "" : DEMO_INIT_ORDER_ID)).trim();
                if (!target) return;
                if (isRealAuthLive && !userIsShipper) return;
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
              onOpenCarrierHub={() => handlers.handleRoleSwitch("carrier")}
              onOpenAuth={() => state.setShowAuthModal(true)}
              onSwitchShipperDemo={() => handlers.enterDemoMode("shipper")}
              onSwitchCarrierDemo={() => handlers.enterDemoMode("carrier")}
            />
          )}

          {/* VIEW B: SHIPPER WORKSPACE */}
          {showShipperView && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shipper Console</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consignment Matrix & Dispatches • Active Organization: <strong className="text-slate-800">{state.currentUser.company_name}</strong>
                    {state.liveDataLoading && <span className="ml-2 text-indigo-600 font-bold animate-pulse">Syncing...</span>}
                  </p>
                </div>
                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold text-slate-600 flex items-center space-x-1">
                    <BoltIcon className="w-4 h-4 text-amber-500" />
                    <span>High-Volume Mode:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => state.setHighVolumeMode(!state.highVolumeMode)}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-black transition ${state.highVolumeMode ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}
                  >
                    {state.highVolumeMode ? "ACTIVE (no 3D)" : "OFF"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
                {shipperTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => state.setShipperTab(tab.id)}
                    className={`px-4 py-2 rounded-xl font-bold transition shadow-sm ${state.shipperTab === tab.id ? "bg-indigo-600 text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {state.shipperTab === "search" && (
                <div className={cardCls}>
                  <ShipperSingleCalculatorSection
                    isLive={state.isLive}
                    highVolumeMode={state.highVolumeMode}
                    activeOriginAddress={state.activeOriginAddress}
                    onManageFacilities={() => state.setShipperTab("address")}
                    originPin={state.originPin}
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
                    onOpenDestCityModal={() => state.setShowCitySearchModal("dest")}
                    calculatedQuotes={state.calculatedQuotes}
                    creditAgreements={state.creditAgreements}
                    onSelectQuoteForBooking={(q) => state.setSelectedQuoteForBooking(q)}
                    onOpenCreditApplyModal={openCreditApply}
                  />
                </div>
              )}

              {state.shipperTab === "matrix" && (
                <div className={cardCls}>
                  <ShipperBulkCsvSection
                    isLive={state.isLive}
                    activeOriginAddress={state.activeOriginAddress}
                    onManageFacilities={() => state.setShipperTab("address")}
                    bulkManifestList={state.bulkManifestList}
                    onAutoSelectCheapest={() =>
                      state.setBulkManifestList((prev) =>
                        prev.map((r) => ({ ...r, selectedQuote: [...r.quotes].sort((a, b) => a.breakdown.total - b.breakdown.total)[0] || null }))
                      )
                    }
                    onAutoSelectFastest={() =>
                      state.setBulkManifestList((prev) =>
                        prev.map((r) => ({
                          ...r,
                          selectedQuote: [...r.quotes].sort((a, b) => a.rateCard.sla_days - b.rateCard.sla_days || a.breakdown.total - b.breakdown.total)[0] || null
                        }))
                      )
                    }
                    onSelectCarrierForRow={(rowId, vId) =>
                      state.setBulkManifestList((prev) =>
                        prev.map((r) => (r.rowId === rowId ? { ...r, selectedQuote: r.quotes.find((q) => q.vendor.id === vId) || r.quotes[0] || null } : r))
                      )
                    }
                    onRemoveRow={(rowId) => state.setBulkManifestList((prev) => prev.filter((r) => r.rowId !== rowId))}
                    onClearManifest={() => {
                      state.setBulkManifestList([]);
                      state.setBulkCsvFileName("");
                      state.setBulkUploadError("");
                    }}
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
                <div className={cardCls}>
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
                <div className={cardCls}>
                  <ShipperTrackerSection
                    isLive={state.isLive}
                    bookings={state.bookings}
                    activeTrackingAwb={state.activeTrackingAwb}
                    setActiveTrackingAwb={state.setActiveTrackingAwb}
                    trackingSearchInput={state.trackingSearchInput}
                    setTrackingSearchInput={state.setTrackingSearchInput}
                  />
                </div>
              )}

              {state.shipperTab === "rfq" && (
                <div className={cardCls}>
                  <ShipperRfqSection
                    key={state.modeEnv}
                    currentUser={state.currentUser}
                    isLive={state.isLive}
                    defaultOriginPin={state.originPin}
                    rfqList={state.rfqList}
                    setRfqList={state.setRfqList}
                  />
                </div>
              )}

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
                />
              )}

              {state.shipperTab === "credit" && (
                <div className="space-y-6">
                  <ShipperCreditStatusSection
                    agreements={state.creditAgreements}
                    onApplyNewCredit={() => openCreditApply()}
                    getAgreementViewUrl={handlers.getAgreementViewUrl}
                  />
                  <CombinedCreditLedgerSection role="shipper" currentUser={state.currentUser} creditAgreements={state.creditAgreements} creditLedger={state.creditLedger} />
                </div>
              )}
            </div>
          )}

          {/* VIEW C: CARRIER WORKSPACE */}
          {showCarrierView && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">Carrier Operations Hub</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Operating Fleet: <strong className="text-emerald-700 font-bold">{state.currentUser.company_name}</strong>
                    {state.liveDataLoading && <span className="ml-2 text-indigo-600 font-bold animate-pulse">Syncing...</span>}
                  </p>
                </div>
                <button type="button" onClick={() => state.setShowAddRateCardModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition">
                  + Publish New Lane Tariff
                </button>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
                {carrierTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => state.setCarrierTab(tab.id)}
                    className={`px-4 py-2 rounded-xl font-bold transition shadow-sm ${state.carrierTab === tab.id ? "bg-emerald-600 text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {state.carrierTab === "loads" && (
                <div className={cardCls}>
                  <CarrierBidsSection currentUser={state.currentUser} isLive={state.isLive} rfqList={state.rfqList} setRfqList={state.setRfqList} />
                </div>
              )}

              {state.carrierTab === "tracking" && (
                <div className="space-y-6">
                  <CarrierTrackingUrlConfigSection currentUrl={state.carrierCustomTrackingUrl} onSave={handlers.handleSaveCarrierTrackingUrl} />
                  <div className={cardCls}>
                    <CarrierOrdersSection
                      currentUser={state.currentUser}
                      bookings={state.bookings}
                      statusUpdateMap={state.statusUpdateMap}
                      setStatusUpdateMap={state.setStatusUpdateMap}
                      onUploadDocketFile={handlers.handleUploadDocketFile}
                      onUpdateShipmentStatus={handlers.handleUpdateShipmentStatus}
                    />
                  </div>
                </div>
              )}

              {state.carrierTab === "rates" && (
                <div className={cardCls}>
                  <CarrierRatesSection
                    currentUser={state.currentUser}
                    isLive={state.isLive}
                    rateCards={state.rateCards}
                    setRateCards={state.setRateCards}
                    vendors={state.vendors}
                    onOpenAddRateModal={() => state.setShowAddRateCardModal(true)}
                  />
                </div>
              )}

              {state.carrierTab === "billing" && (
                <div className={cardCls}>
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
                    onReviewAgreement={handlers.handleReviewCreditAgreement}
                    getAgreementViewUrl={handlers.getAgreementViewUrl}
                  />
                  <CombinedCreditLedgerSection
                    role="carrier"
                    currentUser={state.currentUser}
                    creditAgreements={state.creditAgreements}
                    creditLedger={state.creditLedger}
                    onSettleLedgerEntry={handlers.handleSettleLedgerEntry}
                  />
                </div>
              )}

              {state.carrierTab === "earnings" && (
                <div className={cardCls}>
                  <CarrierBankSection currentUser={state.currentUser} isLive={state.isLive} vendors={state.vendors} setVendors={state.setVendors} />
                </div>
              )}
            </div>
          )}

          {/* VIEW D: ADMIN (DEMO SANDBOX ONLY — never mounted for a live account) */}
          {showAdminView && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
              <AdminOverviewSection bookings={state.bookings} vendors={state.vendors} rateCards={state.rateCards} />
            </div>
          )}
        </div>

        {/* GLOBAL MODALS */}
        {state.selectedQuoteForBooking && (
          <DirectBookingModal
            quote={state.selectedQuoteForBooking}
            currentUser={state.currentUser}
            isLive={state.isLive}
            originPin={state.originPin}
            destPin={state.destPin}
            boxes={state.boxes}
            declaredValue={state.declaredValue}
            pickupAddress={state.pickupAddress}
            onClose={() => state.setSelectedQuoteForBooking(null)}
            onSuccess={async (b) => {
              await handlers.registerNewBookings([b]);
              state.setSelectedQuoteForBooking(null);
              state.setActiveTrackingAwb(b.order_id);
              state.setTrackingSearchInput(b.order_id);
              state.setShipperTab("shipments");
            }}
            onOpenCreditApplyModal={openCreditApply}
          />
        )}

        {state.showAddressModal && (
          <AddressModal
            key={state.editingAddress?.id || "new-address"}
            isOpen={state.showAddressModal}
            onClose={() => {
              state.setShowAddressModal(false);
              state.setEditingAddress(null);
            }}
            onSave={handlers.handleSaveAddress}
            initialAddress={state.editingAddress}
            userDefaults={
              state.isLive
                ? {
                    company_name: state.currentUser.company_name,
                    contact_name: state.currentUser.full_name,
                    phone: state.currentUser.phone,
                    email: state.currentUser.email,
                    gstin: state.currentUser.gstin
                  }
                : undefined
            }
          />
        )}

        {state.showCreditApplyModal && (
          <CreditApplyModal
            isOpen={state.showCreditApplyModal}
            isLive={state.isLive}
            onClose={() => {
              state.setShowCreditApplyModal(false);
              setCreditCarrierPreselect(undefined);
            }}
            carriers={state.vendors}
            existingAgreements={state.creditAgreements}
            currentShipper={state.currentUser}
            defaultCarrierId={creditCarrierPreselect}
            onSubmitApplication={handlers.handleSubmitCreditApplication}
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
            onPaySuccess={handlers.handlePayInvoiceSuccess}
          />
        )}

        {state.showLegalModal && <LegalModal tab={state.legalModalTab} setTab={state.setLegalModalTab} onClose={() => state.setShowLegalModal(false)} />}

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

        {authModalOpen && (
          <AuthModal
            isOpen={authModalOpen}
            initialView={state.passwordRecoveryPending ? "recovery" : "login"}
            onRecoveryComplete={() => state.setPasswordRecoveryPending(false)}
            onClose={() => state.setShowAuthModal(false)}
          />
        )}

        {state.showAddRateCardModal && (
          <AddRateCardModal
            currentUser={state.currentUser}
            isLive={state.isLive}
            vendors={state.vendors}
            onSuccess={(card) => state.setRateCards((prev) => [card, ...prev])}
            onClose={() => state.setShowAddRateCardModal(false)}
          />
        )}

        <FooterSection
          openLegalModal={(tab) => {
            state.setLegalModalTab(tab);
            state.setShowLegalModal(true);
          }}
        />
      </div>

      {/* Print modal lives OUTSIDE the app shell so print CSS can hide the shell completely. */}
      {printOpen && (
        <ThermalPrintModal
          printableBooking={state.printableBooking}
          batchPrintBookings={state.batchPrintBookings}
          onClose={() => {
            state.setPrintableBooking(null);
            state.setBatchPrintBookings(null);
          }}
        />
      )}
    </>
  );
}
