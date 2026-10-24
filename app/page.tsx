
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

// Safe Supabase client initialization
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xyzcompany.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key-placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==========================================
// OFFICIAL MERCHANT & COMPLIANCE CONSTANTS (RAZORPAY KYC)
// ==========================================
export const MERCHANT_DETAILS = {
  proprietor: "Yash Chaudhary",
  platformName: "LogiCompare Pro",
  category: "B2B Freight & Logistics Marketplace Aggregator",
  email: "yash963957@gmail.com",
  phone: "+91 8194017660",
  address: "House No. S-175/219, B Block, Rangpuri Pahari Nala, New Delhi - 110037, India",
  jurisdiction: "New Delhi, Delhi, India",
  operatingHours: "Monday to Saturday, 09:00 AM – 07:00 PM IST"
};

// ==========================================
// TYPES & DOMAIN INTERFACES
// ==========================================
export interface BoxItem {
  id: string;
  qty: number;
  weight: number; // in kg
  length: number; // in cm
  width: number;  // in cm
  height: number; // in cm
}

export interface Vendor {
  id: string;
  name: string;
  badge: string;
  rating: number;
  gstin: string;
  fleet_types: string[];
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
  total: number;
  payment_method?: string;
  payment_ref?: string;
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
  awb_number: string;
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
  role: "shipper" | "vendor";
  vendor_id?: string;
}

// Fallback Indian Logistics Seed
const FALLBACK_VENDORS: Vendor[] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Delhivery B2B Express", badge: "Market Leader", rating: 4.8, gstin: "06AAACD9876Q1ZB", fleet_types: ["Surface Express", "Air Express", "Part Truck Load"] },
  { id: "22222222-2222-2222-2222-222222222222", name: "Blue Dart Aviation", badge: "Fastest Air SLA", rating: 4.9, gstin: "27AAACB0982G1ZL", fleet_types: ["Air Express Priority", "Critical Cargo"] },
  { id: "33333333-3333-3333-3333-333333333333", name: "TCI Freight", badge: "Heavy Haulage", rating: 4.6, gstin: "08AAACT1234F1ZX", fleet_types: ["FTL 32ft MXL", "Taurus 21T", "Heavy Surface"] },
  { id: "44444444-4444-4444-4444-444444444444", name: "Gati-KWE Multi-Modal", badge: "Extensive Reach", rating: 4.4, gstin: "36AAACG4455H1ZP", fleet_types: ["Surface Express", "Air Freight"] },
  { id: "55555555-5555-5555-5555-555555555555", name: "Safexpress Logistics", badge: "Secure 3PL", rating: 4.7, gstin: "07AAACS7788P1ZZ", fleet_types: ["SafeAir Cargo", "Surface Cargo Hub"] }
];

// Indian Pincode Hub Lookup
function lookupPinZone(pin: string): { city: string; state: string; hub: string } {
  if (!pin || pin.length < 3) return { city: "Detecting City...", state: "India", hub: "HUB-GEN" };
  const p3 = pin.substring(0, 3);
  const p2 = pin.substring(0, 2);

  if (p3 === "110") return { city: "Delhi NCR", state: "Delhi", hub: "DEL-NORTH-01" };
  if (p3 === "121" || p3 === "122") return { city: "Gurugram / FBD", state: "Haryana (NCR)", hub: "GGN-GATEWAY" };
  if (p3 === "201") return { city: "Noida / Ghaziabad", state: "Uttar Pradesh (NCR)", hub: "UP-WEST-HUB" };
  if (p3 === "250") return { city: "Meerut", state: "Uttar Pradesh", hub: "MRT-HUB-02" };
  if (p3 === "400" || p3 === "401") return { city: "Mumbai MMR", state: "Maharashtra", hub: "BOM-CENTRAL" };
  if (p3 === "411") return { city: "Pune", state: "Maharashtra", hub: "PNQ-IND-01" };
  if (p3 === "560") return { city: "Bengaluru", state: "Karnataka", hub: "BLR-SOUTH-MAIN" };
  if (p3 === "500") return { city: "Hyderabad", state: "Telangana", hub: "HYD-HUB-01" };
  if (p3 === "600") return { city: "Chennai", state: "Tamil Nadu", hub: "MAA-AIR-SEA" };
  if (p3 === "700") return { city: "Kolkata", state: "West Bengal", hub: "CCU-EAST-PORT" };
  if (p3 === "380") return { city: "Ahmedabad", state: "Gujarat", hub: "AMD-WEST-01" };
  if (p3 === "302") return { city: "Jaipur", state: "Rajasthan", hub: "JAI-NORTH-WEST" };
  if (p2 === "68") return { city: "Kochi Region", state: "Kerala", hub: "COK-SOUTH-HUB" };

  return { city: `Zone ${p2}XX`, state: "Regional District", hub: `HUB-${p2}X` };
}

// Indian Rupee Formatter
const formatINR = (val: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(val || 0);
};

// ==========================================
// INLINE SVG ICONS
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

const ArrowRightIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
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

const ShieldCheckIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const ChevronDownIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const LayersIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const CurrencyRupeeIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6m-5 0h.01M9 12h5m-5 0h.01M9 4v16m0-12a4 4 0 014 4 4 4 0 01-4 4l6 6" />
  </svg>
);

const CreditCardIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 10h20M7 15h2m4 0h4" />
  </svg>
);

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function LogiComparePro() {
  // Navigation View State
  const [activeView, setActiveView] = useState<"landing" | "dashboard">("landing");
  const [landingWorkflowTab, setLandingWorkflowTab] = useState<"shipper" | "vendor">("shipper");
  const [landingTrackingInput, setLandingTrackingInput] = useState("LC-894210");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Legal / Compliance Modal State (Razorpay KYC)
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<"terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact">("terms");

  // Demo Personas
  const DEMO_SHIPPER: UserProfile = {
    id: "demo-shipper-uuid",
    email: "dispatch@apexlogistics.in",
    full_name: "Vikram Malhotra",
    company_name: "Apex Retail Solutions Pvt Ltd",
    gstin: "07AAACA1234A1Z5",
    phone: "+91 98110 23456",
    role: "shipper"
  };

  const DEMO_VENDOR: UserProfile = {
    id: "demo-vendor-uuid",
    email: "ops@delhiveryb2b.com",
    full_name: "Ramesh Sharma",
    company_name: "Delhivery B2B Cargo Hub",
    gstin: "06AAACD9876Q1ZB",
    phone: "+91 98991 76543",
    role: "vendor",
    vendor_id: "11111111-1111-1111-1111-111111111111"
  };

  // State Management
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_SHIPPER);
  const [activePortal, setActivePortal] = useState<"shipper" | "vendor">("shipper");
  const [shipperSubTab, setShipperSubTab] = useState<"compare" | "shipments" | "tracker" | "rfq">("compare");
  const [vendorSubTab, setVendorSubTab] = useState<"orders" | "rates" | "bids">("orders");

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authCompanyName, setAuthCompanyName] = useState("");
  const [authGstin, setAuthGstin] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authRole, setAuthRole] = useState<"shipper" | "vendor">("shipper");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState("");

  // Rate Search & Multi-Box Calculator State
  const [originPin, setOriginPin] = useState("110020");
  const [destPin, setDestPin] = useState("400001");
  const [isOda, setIsOda] = useState(false);
  const [declaredValue, setDeclaredValue] = useState<number>(75000);
  const [selectedMode, setSelectedMode] = useState<"all" | "surface" | "air" | "ftl">("all");
  const [boxes, setBoxes] = useState<BoxItem[]>([
    { id: "box-1", qty: 2, weight: 20, length: 45, width: 35, height: 30 },
    { id: "box-2", qty: 1, weight: 15, length: 30, width: 30, height: 25 }
  ]);

  // Data Collections
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>(FALLBACK_VENDORS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rfqList, setRfqList] = useState<RfqBid[]>([]);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Modals & Active Selections
  const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<CalculatedQuote | null>(null);
  const [printableBooking, setPrintableBooking] = useState<Booking | null>(null);
  const [activeTrackingAwb, setActiveTrackingAwb] = useState("LC-894210");
  const [trackingSearchInput, setTrackingSearchInput] = useState("LC-894210");

  // Checkout Modal State with Razorpay Payment Selection
  const [pickupAddress, setPickupAddress] = useState("Plot 45, Okhla Industrial Area Phase-III, New Delhi");
  const [consigneeName, setConsigneeName] = useState("Prime Electronics Retail");
  const [consigneePhone, setConsigneePhone] = useState("+91 98200 44556");
  const [consigneeGstin, setConsigneeGstin] = useState("27AAACP9988G1ZK");
  const [deliveryAddress, setDeliveryAddress] = useState("Warehouse 4B, Bhiwandi Logistics Park, Mumbai");
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "b2b_credit">("razorpay");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // RFQ Creation State
  const [newRfqOrigin, setNewRfqOrigin] = useState("110001");
  const [newRfqDest, setNewRfqDest] = useState("560001");
  const [newRfqDesc, setNewRfqDesc] = useState("Industrial Gearboxes and Heavy Machinery Parts");
  const [newRfqWeight, setNewRfqWeight] = useState(8500);
  const [newRfqTruck, setNewRfqTruck] = useState("32ft Multi-Axle Trailer (MXL)");
  const [newRfqBudget, setNewRfqBudget] = useState(65000);

  // Vendor Status Update Row State
  const [statusUpdateMap, setStatusUpdateMap] = useState<Record<string, { status: string; location: string; remarks: string }>>({});

  // Rate Card Publish Modal
  const [showAddRateCard, setShowAddRateCard] = useState(false);
  const [newRateCard, setNewRateCard] = useState({
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

  // RFQ Vendor Bidding State
  const [bidFormMap, setBidFormMap] = useState<Record<string, { amount: number; days: number; notes: string }>>({});

  // Sync Supabase Data
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
      console.warn("Supabase fetch warning:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Quick switch role
  const switchDemoRole = (role: "shipper" | "vendor") => {
    if (role === "shipper") {
      setCurrentUser(DEMO_SHIPPER);
      setActivePortal("shipper");
    } else {
      setCurrentUser(DEMO_VENDOR);
      setActivePortal("vendor");
    }
    setActiveView("dashboard");
  };

  // Helper to open legal policy modal on a specific tab
  const openLegalModal = (tab: "terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact") => {
    setLegalModalTab(tab);
    setShowLegalModal(true);
  };

  // Landing Page Quick Track Jump
  const handleLandingQuickTrack = (awbToTrack?: string) => {
    const awb = awbToTrack || landingTrackingInput || "LC-894210";
    setActiveTrackingAwb(awb);
    setTrackingSearchInput(awb);
    setActiveView("dashboard");
    setActivePortal("shipper");
    setShipperSubTab("tracker");
  };

  // Landing Page Quick Compare Jump
  const handleLandingJumpToCompare = () => {
    setActiveView("dashboard");
    setActivePortal("shipper");
    setShipperSubTab("compare");
  };

  // Multi-box weight computation
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

  // Box Actions
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

  const originZone = useMemo(() => lookupPinZone(originPin), [originPin]);
  const destZone = useMemo(() => lookupPinZone(destPin), [destPin]);

  // Freight Quote Calculations
  const calculatedQuotes: CalculatedQuote[] = useMemo(() => {
    if (!searchTriggered && rateCards.length === 0) return [];

    const oPrefix = originPin.substring(0, 3);
    const dPrefix = destPin.substring(0, 3);

    const matchedCards = rateCards.filter((card) => {
      if (!card.is_active) return false;
      if (selectedMode !== "all" && card.mode !== selectedMode) return false;

      const originMatches = card.origin_prefix === "%" || card.origin_prefix === oPrefix || originPin.startsWith(card.origin_prefix);
      const destMatches = card.dest_prefix === "%" || card.dest_prefix === dPrefix || destPin.startsWith(card.dest_prefix);

      return originMatches && destMatches;
    });

    const activeList = matchedCards.length > 0 ? matchedCards : rateCards.slice(0, 6);

    return activeList.map((card) => {
      const v = card.vendors || vendors.find((vend) => vend.id === card.vendor_id) || vendors[0];
      const effectiveBillable = Math.max(billableWeight, card.min_weight_kg);

      const baseFreight = Number(card.base_rate) + effectiveBillable * Number(card.per_kg_rate);
      const fuelSurcharge = (baseFreight * Number(card.fuel_surcharge_pct)) / 100;
      const docket = Number(card.docket_charge);
      const fov = Math.max(50, (Number(declaredValue) * Number(card.fov_pct)) / 100);
      const handling = effectiveBillable * Number(card.handling_per_kg);
      const oda = isOda ? Number(card.oda_charge) : 0;

      const subtotal = baseFreight + fuelSurcharge + docket + fov + handling + oda;
      const gst = subtotal * 0.18;
      const total = subtotal + gst;

      return {
        rateCard: card,
        vendor: v,
        actualWeight: totalActualWeight,
        volumetricWeight: Math.round(totalVolumetricWeight * 10) / 10,
        billableWeight: Math.round(effectiveBillable * 10) / 10,
        breakdown: {
          base: Math.round(baseFreight * 100) / 100,
          fuel: Math.round(fuelSurcharge * 100) / 100,
          docket: Math.round(docket * 100) / 100,
          fov: Math.round(fov * 100) / 100,
          handling: Math.round(handling * 100) / 100,
          oda: Math.round(oda * 100) / 100,
          gst: Math.round(gst * 100) / 100,
          total: Math.round(total * 100) / 100
        }
      };
    });
  }, [searchTriggered, rateCards, originPin, destPin, selectedMode, billableWeight, totalActualWeight, totalVolumetricWeight, declaredValue, isOda, vendors]);

  const handleSearchRates = () => {
    setIsSearching(true);
    setTimeout(() => {
      setSearchTriggered(true);
      setIsSearching(false);
    }, 350);
  };

  // Confirm Booking with Razorpay Payment Tracking
  const handleConfirmBooking = async () => {
    if (!selectedQuoteForBooking) return;
    if (!termsAccepted) {
      alert("Please confirm that the shipment contains no prohibited goods and accept the Terms & Refund Policy before proceeding.");
      return;
    }

    setIsSubmittingBooking(true);

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const generatedAwb = `LC-${randomSuffix}`;
    const generatedPaymentRef = paymentMethod === "razorpay" 
      ? `pay_LC${Math.floor(10000000 + Math.random() * 90000000)}` 
      : "B2B-POSTPAID-CREDIT";

    const enhancedBreakdown: CostBreakdown = {
      ...selectedQuoteForBooking.breakdown,
      payment_method: paymentMethod === "razorpay" ? "Razorpay Online (UPI/Card/NetBanking)" : "B2B Postpaid Invoice Credit",
      payment_ref: generatedPaymentRef
    };

    const newBookingRecord: Partial<Booking> = {
      awb_number: generatedAwb,
      shipper_id: currentUser.id,
      vendor_id: selectedQuoteForBooking.vendor.id,
      rate_card_id: selectedQuoteForBooking.rateCard.id,
      shipper_name: currentUser.company_name || currentUser.full_name,
      shipper_phone: currentUser.phone || "+91 98110 23456",
      shipper_email: currentUser.email,
      shipper_gstin: currentUser.gstin || "07AAACA1234A1Z5",
      pickup_address: pickupAddress,
      consignee_name: consigneeName,
      consignee_phone: consigneePhone,
      consignee_gstin: consigneeGstin,
      delivery_address: deliveryAddress,
      origin_pin: originPin,
      dest_pin: destPin,
      mode: selectedQuoteForBooking.rateCard.mode,
      boxes: boxes,
      declared_value: declaredValue,
      actual_weight: selectedQuoteForBooking.actualWeight,
      volumetric_weight: selectedQuoteForBooking.volumetricWeight,
      billable_weight: selectedQuoteForBooking.billableWeight,
      cost_breakdown: enhancedBreakdown,
      final_total: selectedQuoteForBooking.breakdown.total,
      status: "Booked",
      tracking_history: [
        {
          status: "Booked",
          location: `${originZone.city} Hub (${originPin})`,
          timestamp: new Date().toISOString(),
          remarks: `AWB Generated. Payment via ${enhancedBreakdown.payment_method} [Ref: ${generatedPaymentRef}]. Verified by ${MERCHANT_DETAILS.proprietor}`
        }
      ]
    };

    try {
      const { data, error } = await supabase.from("bookings").insert([newBookingRecord]).select("*, vendors(*)");

      if (!error && data && data[0]) {
        setBookings([data[0] as Booking, ...bookings]);
      } else {
        const localMock: Booking = {
          ...(newBookingRecord as Booking),
          id: `book-${Date.now()}`,
          created_at: new Date().toISOString(),
          vendors: selectedQuoteForBooking.vendor
        };
        setBookings([localMock, ...bookings]);
      }
    } catch (err) {
      console.warn("Fallback local booking:", err);
    } finally {
      setIsSubmittingBooking(false);
      setSelectedQuoteForBooking(null);
      setTermsAccepted(false);
      setShipperSubTab("shipments");
    }
  };

  // Status Updater (Vendor)
  const handleUpdateShipmentStatus = async (bookingId: string) => {
    const updateData = statusUpdateMap[bookingId];
    if (!updateData || !updateData.status) {
      alert("Please select a status to update");
      return;
    }

    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const newStep: TrackingStep = {
      status: updateData.status,
      location: updateData.location || "En-route Hub",
      timestamp: new Date().toISOString(),
      remarks: updateData.remarks || `Status updated to ${updateData.status}`
    };

    const updatedHistory = [...(booking.tracking_history || []), newStep];

    try {
      await supabase
        .from("bookings")
        .update({
          status: updateData.status,
          tracking_history: updatedHistory
        })
        .eq("id", bookingId);

      setBookings(
        bookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                status: updateData.status as Booking["status"],
                tracking_history: updatedHistory
              }
            : b
        )
      );

      setStatusUpdateMap({
        ...statusUpdateMap,
        [bookingId]: { status: "", location: "", remarks: "" }
      });
      alert(`Consignment ${booking.awb_number} updated to ${updateData.status}!`);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  // RFQ Creation
  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: Partial<RfqBid> = {
      shipper_name: currentUser.company_name || currentUser.full_name,
      origin_pin: newRfqOrigin,
      dest_pin: newRfqDest,
      cargo_description: newRfqDesc,
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
      alert("Load successfully posted for reverse bidding!");
    } catch (err) {
      console.error(err);
    }
  };

  // Vendor Submit Bid
  const handleSubmitVendorBid = async (rfqId: string) => {
    const form = bidFormMap[rfqId];
    if (!form || !form.amount || !form.days) {
      alert("Please provide bid price and transit SLA days");
      return;
    }

    const rfq = rfqList.find((r) => r.id === rfqId);
    if (!rfq) return;

    const newBidObj = {
      vendor_name: currentUser.company_name || "Delhivery B2B Express",
      bid_amount: Number(form.amount),
      transit_days: Number(form.days),
      notes: form.notes || "Ready container vehicle with GPS tracking.",
      created_at: new Date().toISOString()
    };

    const updatedBids = [...(rfq.bids || []), newBidObj];

    try {
      await supabase.from("rfq_bids").update({ bids: updatedBids }).eq("id", rfqId);
      setRfqList(rfqList.map((r) => (r.id === rfqId ? { ...r, bids: updatedBids } : r)));
      setBidFormMap({ ...bidFormMap, [rfqId]: { amount: 0, days: 0, notes: "" } });
      alert("Bid placed successfully!");
    } catch (err) {
      console.error("Failed to submit bid", err);
    }
  };

  // Publish Rate Card
  const handlePublishRateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const vendorId = currentUser.vendor_id || "11111111-1111-1111-1111-111111111111";
    const payload = {
      ...newRateCard,
      vendor_id: vendorId,
      is_active: true
    };

    try {
      const { data, error } = await supabase.from("rate_cards").insert([payload]).select("*, vendors(*)");
      if (!error && data && data[0]) {
        setRateCards([data[0] as RateCard, ...rateCards]);
      } else {
        const localCard: RateCard = {
          ...(payload as RateCard),
          id: `rc-${Date.now()}`,
          vendors: vendors.find((v) => v.id === vendorId)
        };
        setRateCards([localCard, ...rateCards]);
      }
      setShowAddRateCard(false);
      alert("New Rate Card published and active!");
    } catch (err) {
      console.error(err);
    }
  };

  // Real Auth Handling
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMsg("");

    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;

        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email: authEmail,
            full_name: authFullName,
            company_name: authCompanyName,
            gstin: authGstin,
            phone: authPhone,
            role: authRole,
            vendor_id: authRole === "vendor" ? "11111111-1111-1111-1111-111111111111" : undefined
          };
          await supabase.from("profiles").upsert([profile]);
          setCurrentUser(profile);
          setActivePortal(profile.role);
          setActiveView("dashboard");
          setShowAuthModal(false);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        if (data.user) {
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
          if (pData) {
            setCurrentUser(pData as UserProfile);
            setActivePortal(pData.role);
          }
          setActiveView("dashboard");
          setShowAuthModal(false);
        }
      }
    } catch (err: any) {
      setAuthMsg(err.message || "Auth error. You can continue using demo roles seamlessly.");
    } finally {
      setAuthLoading(false);
    }
  };

  const activeTrackBooking = useMemo(() => {
    return bookings.find((b) => b.awb_number.toLowerCase() === activeTrackingAwb.trim().toLowerCase());
  }, [bookings, activeTrackingAwb]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* ============================================================== */}
      {/* GLOBAL TOP NAVIGATION BAR */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-xs px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveView("landing")}>
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <TruckIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">LogiCompare</span>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Pro B2B
                </span>
              </div>
              <p className="text-xs text-slate-500">Pan-India Freight Exchange & Commercial AWB Hub</p>
            </div>
          </div>

          {/* Navigation View Switcher (Landing vs Dashboard) */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveView("landing")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeView === "landing"
                  ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🏠 Home / Overview</span>
            </button>
            <button
              onClick={() => setActiveView("dashboard")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeView === "dashboard"
                  ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🚀 Freight Matrix Dashboard</span>
            </button>
          </div>

          {/* Quick Demo Switchers & Auth */}
          <div className="flex items-center space-x-2">
            <div className="hidden sm:flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => switchDemoRole("shipper")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                  currentUser.role === "shipper" && activeView === "dashboard"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>⚡ Shipper</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1 py-0.2 rounded font-medium">Apex</span>
              </button>
              <button
                onClick={() => switchDemoRole("vendor")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                  currentUser.role === "vendor" && activeView === "dashboard"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>⚡ Carrier</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded font-medium">Delhivery</span>
              </button>
            </div>

            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-xs flex items-center space-x-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Account / Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* VIEW 1: INTRO / HIGH-CONVERTING B2B LANDING PAGE */}
      {/* ============================================================== */}
      {activeView === "landing" && (
        <div className="flex-1 flex flex-col space-y-16 pb-12">
          {/* 1. HERO SECTION */}
          <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/70 via-white to-slate-50 pt-12 pb-16 px-4 lg:px-8 border-b border-slate-200">
            <div className="max-w-6xl mx-auto text-center space-y-6">
              {/* Trust Badge */}
              <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200 text-indigo-800 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-xs">
                <span>🇮🇳</span>
                <span>Built for Indian B2B Supply Chains, Manufacturers & Cargo Shippers</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
                Compare Multi-Carrier B2B Freight Rates & Book Consignments in{" "}
                <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">60 Seconds</span>.
              </h1>

              {/* Subheadline */}
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
                LogiCompare Pro eliminates opaque transporter quotes. Instantly calculate billable volumetric weights (Surface 4500 / Air 5000), ODA surcharges, 
                0.2% FOV transit risk coverage, fuel percentages, and 18% GST across India's premier B2B carrier networks.
              </p>

              {/* Primary Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleLandingJumpToCompare}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition shadow-md shadow-indigo-600/20 flex items-center space-x-2"
                >
                  <BoxIcon className="w-5 h-5" />
                  <span>Compare Freight Rates Now</span>
                </button>
                <button
                  onClick={() => switchDemoRole("vendor")}
                  className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold px-6 py-3 rounded-xl text-sm transition shadow-xs flex items-center space-x-2"
                >
                  <TruckIcon className="w-5 h-5 text-emerald-600" />
                  <span>Join as Carrier / Vendor</span>
                </button>
              </div>

              {/* Quick AWB Track Widget Inside Hero */}
              <div className="pt-6 max-w-xl mx-auto">
                <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200/90 shadow-md flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex items-center space-x-2 px-3 py-1 text-slate-400 w-full sm:w-auto">
                    <SearchIcon className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-xs font-semibold text-slate-500 shrink-0">Track AWB:</span>
                    <input
                      type="text"
                      value={landingTrackingInput}
                      onChange={(e) => setLandingTrackingInput(e.target.value)}
                      placeholder="e.g. LC-894210"
                      className="bg-transparent font-mono text-sm text-slate-900 font-bold focus:outline-none w-full"
                    />
                  </div>
                  <button
                    onClick={() => handleLandingQuickTrack()}
                    className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shrink-0"
                  >
                    Track Shipment
                  </button>
                </div>
                <div className="flex items-center justify-center space-x-3 text-[11px] text-slate-500 mt-2.5">
                  <span>Try Sample AWBs:</span>
                  <button
                    onClick={() => handleLandingQuickTrack("LC-894210")}
                    className="font-mono text-indigo-600 hover:underline font-semibold"
                  >
                    LC-894210 (In Transit)
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => handleLandingQuickTrack("LC-551923")}
                    className="font-mono text-indigo-600 hover:underline font-semibold"
                  >
                    LC-551923 (Delivered)
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 2. TRUST METRICS & CARRIER STRIP */}
          <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-8 border-b border-slate-200">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 text-center shadow-xs">
                <span className="text-3xl font-black text-indigo-600">5+</span>
                <p className="text-xs font-bold text-slate-800 mt-1">Verified National Carriers</p>
                <p className="text-[11px] text-slate-500">Integrated surface & air linehauls</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 text-center shadow-xs">
                <span className="text-3xl font-black text-emerald-600">19,000+</span>
                <p className="text-xs font-bold text-slate-800 mt-1">Serviceable PIN Codes</p>
                <p className="text-[11px] text-slate-500">Pan-India Tier-1 to ODA Coverage</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 text-center shadow-xs">
                <span className="text-3xl font-black text-slate-900">100%</span>
                <p className="text-xs font-bold text-slate-800 mt-1">Transparent GST Breakup</p>
                <p className="text-[11px] text-slate-500">Statutory 18% GTA ITC compliant</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 text-center shadow-xs">
                <span className="text-3xl font-black text-amber-500">0s</span>
                <p className="text-xs font-bold text-slate-800 mt-1">Instant AWB Generation</p>
                <p className="text-[11px] text-slate-500">Printable 4x6 / A4 barcode labels</p>
              </div>
            </div>

            {/* Carrier Logos Strip */}
            <div className="pt-6 text-center space-y-3">
              <span className="text-xs uppercase font-bold text-slate-600 tracking-wider">
                Direct Integration With India's Top Rated Commercial Carriers
              </span>
              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-2 opacity-85">
                {vendors.map((v) => (
                  <div key={v.id} className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="font-extrabold text-xs text-slate-800">{v.name}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">★ {v.rating}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 3. INTERACTIVE "HOW IT WORKS" WORKFLOW */}
          <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
                Interactive Operational Workflow
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">How LogiCompare Pro Works</h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
                Whether you are a manufacturing business booking daily pallets or a carrier managing rate cards, our unified platform orchestrates the complete lifecycle.
              </p>

              {/* Workflow Toggle */}
              <div className="inline-flex p-1 bg-slate-200/70 rounded-xl mt-4">
                <button
                  onClick={() => setLandingWorkflowTab("shipper")}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition ${
                    landingWorkflowTab === "shipper" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📦 For Shippers & Businesses
                </button>
                <button
                  onClick={() => setLandingWorkflowTab("vendor")}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition ${
                    landingWorkflowTab === "vendor" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🚛 For Logistics Vendors & Carriers
                </button>
              </div>
            </div>

            {/* Workflow Steps Cards */}
            {landingWorkflowTab === "shipper" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative">
                  <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">1</span>
                  <h3 className="font-bold text-slate-900 text-sm">PIN & Multi-Box Input</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Enter origin and destination PINs with auto hub detection. Add multiple cartons with weight and (L x W x H cm) dimensions.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative">
                  <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">2</span>
                  <h3 className="font-bold text-slate-900 text-sm">Compare Landed Quotes</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Inspect transparent line-item pricing: Base Freight, Fuel %, Docket Fee, ODA Surcharge, 0.2% FOV Insurance, and 18% GST.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative">
                  <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">3</span>
                  <h3 className="font-bold text-slate-900 text-sm">Online Payment & AWB</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Confirm booking via Razorpay or B2B Credit to generate official <span className="font-mono font-bold text-indigo-700">LC-XXXXXX</span> AWB and print barcode labels.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative">
                  <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">4</span>
                  <h3 className="font-bold text-slate-900 text-sm">5-Milestone Live Tracking</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Track consignment movement from Booked and Picked Up to In Transit linehauls and Proof of Delivery (POD).
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative">
                  <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">1</span>
                  <h3 className="font-bold text-slate-900 text-sm">Onboard Carrier & GSTIN</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Register as a verified transporter, enter GSTIN credentials, and link your fleet types (Surface, Air Cargo, or FTL Heavy Trailers).
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative">
                  <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">2</span>
                  <h3 className="font-bold text-slate-900 text-sm">Publish Rate Cards or Bid on RFQs</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Define lane-specific rate tariffs (base rate, per-kg rate, fuel %, ODA charges) or submit competitive bids on heavy cargo loads.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative">
                  <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">3</span>
                  <h3 className="font-bold text-slate-900 text-sm">Fulfill & Dispatch Milestone Scans</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Receive bookings, update status logs (Picked Up, In Transit Hub, Out for Delivery), and sync tracking history across all stakeholders.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* 4. CORE CAPABILITIES (6-CARD FEATURE GRID) */}
          <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full space-y-6">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
                Enterprise Features
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Engineered for Indian Logistics Complexity</h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
                Everything required to eliminate manual freight rate haggling and streamline logistics procurement.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-indigo-300 transition">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <LayersIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Multi-Box Volumetric Engine</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automatically calculates actual weight vs. volumetric weight across multiple box sizes. Supports IATA Air divisor (5000) and Indian Surface Express divisor (4500).
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-indigo-300 transition">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CurrencyRupeeIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Zero Hidden Surcharges</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Transparent breakdown of all statutory logistics fees: Base freight, Fuel Surcharge %, Docket AWB charge, Handling per kg, ODA fee, and 18% GST.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-indigo-300 transition">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShieldCheckIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">FOV Cargo Risk Insurance</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Built-in 0.20% Freight On Value (FOV) risk coverage calculator ensuring high-value electronic and pharmaceutical shipments are protected against transit damages.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-indigo-300 transition">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <PrinterIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Automated Commercial AWB Labels</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Instant generation of physical shipping labels complete with high-density barcode stripes, origin/dest routing hub codes, package counts, and GSTINs.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-indigo-300 transition">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <TruckIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Heavy Load RFQ Reverse Bidding</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Post requirements for 32ft MXL trailers, 24ft containers, or 21-ton Taurus trucks. Verified fleet owners submit competitive bids below your target ceiling price.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-indigo-300 transition">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <CreditCardIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Razorpay Verified Settlements</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Instant online payment settlement via UPI, corporate net banking, and cards via Razorpay alongside B2B credit accounts and automated digital payment receipts.
                </p>
              </div>
            </div>
          </section>

          {/* 5. FREQUENTLY ASKED QUESTIONS (ACCORDION) */}
          <section className="max-w-4xl mx-auto px-4 lg:px-8 w-full space-y-6">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
                FAQ & Knowledge Base
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Frequently Asked Questions</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Common questions on Indian commercial freight calculation, billable weights, payments, and compliance.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  q: "How is Billable Weight calculated between Actual and Volumetric weight?",
                  a: "Commercial carriers charge based on whichever is higher: the gross actual weight on the scale or the volumetric weight. For Surface Cargo in India, the volumetric weight is calculated as (Length x Width x Height in cm) / 4500. For Air Cargo, the standard divisor is 5000. LogiCompare Pro automatically computes this across all box dimensions and applies carrier minimum weight thresholds."
                },
                {
                  q: "What payment methods are supported on LogiCompare?",
                  a: "We support instant online B2B settlements powered by Razorpay (UPI, Credit/Debit Cards, NetBanking from all major Indian banks) as well as B2B Postpaid Invoice Credit for approved corporate accounts. All digital transactions generate verifiable payment references (pay_LC...)."
                },
                {
                  q: "What is your Refund & Cancellation Policy for cancelled shipments?",
                  a: "Shipments cancelled prior to carrier pickup qualify for a 100% full refund. Once verified, refunds are credited back to the original payment source via Razorpay within 5 to 7 business days. If cancelled after vehicle dispatch, a nominal docket visit charge applies."
                },
                {
                  q: "What are ODA (Out of Delivery Area) and FOV (Freight on Value) charges?",
                  a: "ODA is an additional surcharge applied by carriers when a delivery destination PIN code is located outside primary municipal hubs, typically adding ₹450 - ₹600. FOV (Freight on Value) is a transit risk protection fee (0.20% of the declared cargo invoice value) providing formal insurance compensation against loss or damage."
                }
              ].map((faq, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs transition"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full p-4 text-left font-bold text-sm text-slate-900 flex items-center justify-between hover:bg-slate-50"
                  >
                    <span>{faq.q}</span>
                    <ChevronDownIcon
                      className={`w-4 h-4 text-slate-500 transition-transform ${openFaq === idx ? "rotate-180 text-indigo-600" : ""}`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 6. BOTTOM CALL-TO-ACTION BANNER */}
          <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full">
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 sm:p-12 text-white text-center space-y-6 shadow-xl">
              <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Start Saving On B2B Freight
              </span>
              <h2 className="text-2xl sm:text-4xl font-black max-w-2xl mx-auto">
                Ready to optimize your supply chain and eliminate freight billing disputes?
              </h2>
              <p className="text-indigo-200 text-xs sm:text-sm max-w-xl mx-auto">
                Switch to the Freight Matrix Dashboard to calculate live rates, print commercial AWB labels, and track consignments across India.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleLandingJumpToCompare}
                  className="bg-white hover:bg-slate-100 text-slate-900 font-extrabold px-6 py-3 rounded-xl text-sm transition shadow-lg"
                >
                  Open Freight Rate Matrix
                </button>
                <button
                  onClick={() => switchDemoRole("shipper")}
                  className="bg-indigo-700 hover:bg-indigo-600 text-white border border-indigo-500 font-bold px-6 py-3 rounded-xl text-sm transition"
                >
                  ⚡ Instant Demo as Shipper
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 2: FULL FREIGHT MATRIX DASHBOARD (APP) */}
      {/* ============================================================== */}
      {activeView === "dashboard" && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
          {/* Dashboard Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-3">
            <div className="flex items-center space-x-1 bg-slate-200/70 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActivePortal("shipper")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                  activePortal === "shipper" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Shipper Portal
              </button>
              <button
                onClick={() => setActivePortal("vendor")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                  activePortal === "vendor" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Carrier & Fleet Hub
              </button>
            </div>

            {/* Sub-Tabs Navigation */}
            {activePortal === "shipper" ? (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  { id: "compare", label: "🔍 Compare & Book Rates" },
                  { id: "shipments", label: "📦 My Shipments & Labels" },
                  { id: "tracker", label: "📍 Live AWB Tracker" },
                  { id: "rfq", label: "⚖️ Heavy Load RFQ Bidding" }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setShipperSubTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                      shipperSubTab === t.id
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold"
                        : "text-slate-600 hover:bg-slate-200/50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  { id: "orders", label: "📋 Incoming Orders & Dispatch" },
                  { id: "rates", label: "🏷️ Rate Card Manager" },
                  { id: "bids", label: "🎯 Bid on Live RFQs" }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setVendorSubTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                      vendorSubTab === t.id
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold"
                        : "text-slate-600 hover:bg-slate-200/50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* SHIPPER PORTAL MODULES */}
          {/* ============================================================== */}
          {activePortal === "shipper" && (
            <div className="space-y-6">
              {/* SUB-TAB A: RATE CALCULATOR & COMPARISON MATRIX */}
              {shipperSubTab === "compare" && (
                <div className="space-y-6">
                  {/* 1. Calculator Form Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="border-b border-slate-100 pb-4 mb-6">
                      <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                        <BoxIcon className="w-5 h-5 text-indigo-600" />
                        <span>Pan-India Commercial Freight Calculator</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Auto-detects hub routing codes, computes volumetric divisors (Air 5000 / Surface 4500), and calculates statutory B2B logistics taxes.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Origin Pincode (Pickup)</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={originPin}
                          onChange={(e) => setOriginPin(e.target.value)}
                          placeholder="e.g. 110020"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-indigo-700 font-semibold">{originZone.city}</span>
                          <span className="bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 font-mono text-[10px]">
                            {originZone.hub}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Destination Pincode (Drop)</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={destPin}
                          onChange={(e) => setDestPin(e.target.value)}
                          placeholder="e.g. 400001"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-700 font-semibold">{destZone.city}</span>
                          <span className="bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 font-mono text-[10px]">
                            {destZone.hub}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Declared Value (₹) for Insurance</label>
                        <input
                          type="number"
                          value={declaredValue}
                          onChange={(e) => setDeclaredValue(Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                        <p className="text-[11px] text-slate-500 mt-2">FOV covers 0.2% transit risk loss</p>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Transport Mode</label>
                          <select
                            value={selectedMode}
                            onChange={(e) => setSelectedMode(e.target.value as any)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
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
                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-slate-700 font-medium">ODA Pincode (+₹450)</span>
                        </label>
                      </div>
                    </div>

                    {/* Multi-Box Repeater Section */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          Consignment Box Dimensions ({boxes.length} {boxes.length === 1 ? "box type" : "box types"})
                        </span>
                        <button
                          type="button"
                          onClick={addBox}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1"
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          <span>Add Another Box Type</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {boxes.map((box, idx) => (
                          <div
                            key={box.id}
                            className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-white p-3 rounded-lg border border-slate-200 items-center text-xs shadow-xs"
                          >
                            <div>
                              <span className="text-[10px] text-slate-500 block mb-0.5">Box #{idx + 1} Qty</span>
                              <input
                                type="number"
                                min={1}
                                value={box.qty}
                                onChange={(e) => updateBox(box.id, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-500 block mb-0.5">Weight (Kg/box)</span>
                              <input
                                type="number"
                                min={0.5}
                                step={0.5}
                                value={box.weight}
                                onChange={(e) => updateBox(box.id, "weight", parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-500 block mb-0.5">Length (cm)</span>
                              <input
                                type="number"
                                min={1}
                                value={box.length}
                                onChange={(e) => updateBox(box.id, "length", parseFloat(e.target.value) || 1)}
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-500 block mb-0.5">Width (cm)</span>
                              <input
                                type="number"
                                min={1}
                                value={box.width}
                                onChange={(e) => updateBox(box.id, "width", parseFloat(e.target.value) || 1)}
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-500 block mb-0.5">Height (cm)</span>
                              <input
                                type="number"
                                min={1}
                                value={box.height}
                                onChange={(e) => updateBox(box.id, "height", parseFloat(e.target.value) || 1)}
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                              />
                            </div>

                            <div className="flex items-center justify-between sm:justify-end space-x-3 pt-3 sm:pt-0">
                              <span className="text-[11px] text-slate-500 font-mono">
                                {((box.length * box.width * box.height) / (selectedMode === "air" ? 5000 : 4500)).toFixed(1)} kg vol
                              </span>
                              {boxes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeBox(box.id)}
                                  className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Weight Summary Banner */}
                      <div className="flex flex-wrap items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 text-xs shadow-xs">
                        <div className="flex flex-wrap gap-5">
                          <div>
                            <span className="text-slate-500">Total Actual Wt: </span>
                            <span className="font-bold text-slate-900 font-mono">{totalActualWeight.toFixed(1)} kg</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Volumetric Wt: </span>
                            <span className="font-bold text-indigo-700 font-mono">{totalVolumetricWeight.toFixed(2)} kg</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Billable Charge Wt: </span>
                            <span className="font-bold text-emerald-700 font-mono text-sm">{billableWeight.toFixed(1)} kg</span>
                          </div>
                        </div>

                        <button
                          onClick={handleSearchRates}
                          disabled={isSearching}
                          className="mt-2 sm:mt-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg transition flex items-center space-x-2 shadow-sm"
                        >
                          <SearchIcon className="w-4 h-4" />
                          <span>{isSearching ? "Searching..." : "Compare Carrier Rates"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2. Rates Comparison Cards */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Verified Logistics Carrier Quotes</h3>
                        <p className="text-xs text-slate-500">Includes Fuel, Handling, FOV Risk Insurance, & 18% GST</p>
                      </div>
                      <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full font-bold">
                        {calculatedQuotes.length} Available Rates
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {calculatedQuotes.map((quote) => (
                        <div
                          key={quote.rateCard.id}
                          className="bg-white border border-slate-200 hover:border-indigo-400 rounded-xl p-5 transition-all shadow-xs hover:shadow-sm"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-3">
                                <span className="text-base font-bold text-slate-900">{quote.vendor.name}</span>
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                  {quote.vendor.badge}
                                </span>
                                <span className="text-amber-500 text-xs font-bold flex items-center space-x-1">
                                  <span>★</span>
                                  <span>{quote.vendor.rating}</span>
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center space-x-1 text-slate-700 font-medium capitalize">
                                  {quote.rateCard.mode === "air" ? (
                                    <PlaneIcon className="w-4 h-4 text-sky-600" />
                                  ) : (
                                    <TruckIcon className="w-4 h-4 text-emerald-600" />
                                  )}
                                  <span>{quote.rateCard.mode} Freight</span>
                                </span>
                                <span>•</span>
                                <span>
                                  SLA Transit: <strong className="text-slate-800">{quote.rateCard.sla_days} Days</strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Billable Wt: <strong className="text-slate-800">{quote.billableWeight} kg</strong>
                                </span>
                                <span>•</span>
                                <span className="font-mono text-slate-500">GSTIN: {quote.vendor.gstin}</span>
                              </div>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs grid grid-cols-3 sm:grid-cols-6 gap-2 text-center sm:text-left">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Base Freight</span>
                                <span className="font-semibold text-slate-800">{formatINR(quote.breakdown.base)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Fuel ({quote.rateCard.fuel_surcharge_pct}%)</span>
                                <span className="font-semibold text-slate-800">{formatINR(quote.breakdown.fuel)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">FOV Insur.</span>
                                <span className="font-semibold text-slate-800">{formatINR(quote.breakdown.fov)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Docket/AWB</span>
                                <span className="font-semibold text-slate-800">{formatINR(quote.breakdown.docket)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">ODA Fee</span>
                                <span className="font-semibold text-slate-800">{formatINR(quote.breakdown.oda)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">GST (18%)</span>
                                <span className="font-semibold text-slate-800">{formatINR(quote.breakdown.gst)}</span>
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                              <div className="text-left sm:text-right">
                                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">All-Inclusive Total</span>
                                <span className="text-xl font-black text-emerald-700">{formatINR(quote.breakdown.total)}</span>
                              </div>
                              <button
                                onClick={() => setSelectedQuoteForBooking(quote)}
                                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition flex items-center space-x-1.5 shadow-sm"
                              >
                                <span>Book & Pay</span>
                                <ArrowRightIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB B: MY SHIPMENTS & LABELS */}
              {shipperSubTab === "shipments" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Consignment Bookings & Manifests</h2>
                      <p className="text-xs text-slate-500">Generate shipping labels, track parcels, and monitor transit compliance</p>
                    </div>
                    <button
                      onClick={fetchAllData}
                      className="text-xs bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-medium shadow-xs"
                    >
                      Refresh List
                    </button>
                  </div>

                  {bookings.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
                      <p className="text-slate-500 text-sm">No shipments booked yet. Calculate rates to book your first load!</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[11px] border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">AWB Number</th>
                            <th className="py-3 px-4">Carrier</th>
                            <th className="py-3 px-4">Route & PIN</th>
                            <th className="py-3 px-4">Mode / Wt</th>
                            <th className="py-3 px-4">Payment</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Total Freight</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bookings.map((booking) => (
                            <tr key={booking.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                                {booking.awb_number}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-900 block">{booking.vendors?.name || "Carrier Partner"}</span>
                                <span className="text-[11px] text-slate-500">{booking.consignee_name}</span>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center space-x-1 font-mono font-semibold text-slate-800">
                                  <span>{booking.origin_pin}</span>
                                  <span>→</span>
                                  <span>{booking.dest_pin}</span>
                                </div>
                                <span className="text-[10px] text-slate-500">
                                  {lookupPinZone(booking.origin_pin).city} to {lookupPinZone(booking.dest_pin).city}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="capitalize text-slate-800 block font-semibold">{booking.mode}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{booking.billable_weight} kg</span>
                              </td>
                              <td className="py-3.5 px-4 font-mono">
                                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold block w-fit">
                                  {booking.cost_breakdown?.payment_ref || "Paid"}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    booking.status === "Delivered"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : booking.status === "In Transit"
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : booking.status === "Picked Up"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-slate-100 text-slate-700 border border-slate-200"
                                  }`}
                                >
                                  {booking.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-bold text-slate-900">{formatINR(booking.final_total)}</td>
                              <td className="py-3.5 px-4 text-right space-x-2">
                                <button
                                  onClick={() => setPrintableBooking(booking)}
                                  className="bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded text-[11px] font-semibold border border-slate-300 inline-flex items-center space-x-1 shadow-xs"
                                >
                                  <PrinterIcon className="w-3.5 h-3.5" />
                                  <span>Print Label</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveTrackingAwb(booking.awb_number);
                                    setTrackingSearchInput(booking.awb_number);
                                    setShipperSubTab("tracker");
                                  }}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded text-[11px] font-semibold inline-flex items-center space-x-1"
                                >
                                  <span>Track</span>
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

              {/* SUB-TAB C: LIVE AWB TRACKER */}
              {shipperSubTab === "tracker" && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                    <h2 className="text-base font-bold text-slate-900 mb-1">Real-Time Indian Airway Bill (AWB) Tracking</h2>
                    <p className="text-xs text-slate-500 mb-4">Enter your LogiCompare Pro AWB number (e.g. LC-894210 or LC-551923)</p>

                    <div className="flex gap-2 max-w-md">
                      <input
                        type="text"
                        value={trackingSearchInput}
                        onChange={(e) => setTrackingSearchInput(e.target.value)}
                        placeholder="Enter AWB Number..."
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                      <button
                        onClick={() => setActiveTrackingAwb(trackingSearchInput)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs"
                      >
                        Track Shipment
                      </button>
                    </div>
                  </div>

                  {activeTrackBooking ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-8 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl font-mono font-black text-slate-900">{activeTrackBooking.awb_number}</span>
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase">
                              {activeTrackBooking.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Carrier Partner: <strong className="text-slate-800">{activeTrackBooking.vendors?.name || "Delhivery B2B"}</strong>
                          </p>
                        </div>

                        <div className="text-right text-xs">
                          <p className="text-slate-600">
                            Route: <span className="font-mono font-bold text-slate-900">{activeTrackBooking.origin_pin}</span> ({lookupPinZone(activeTrackBooking.origin_pin).city}) →{" "}
                            <span className="font-mono font-bold text-slate-900">{activeTrackBooking.dest_pin}</span> ({lookupPinZone(activeTrackBooking.dest_pin).city})
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            Consignee: <strong className="text-slate-800">{activeTrackBooking.consignee_name}</strong>
                          </p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">Delivery Milestone Progress</h4>
                        {(() => {
                          const steps = ["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"];
                          const currentIdx = steps.indexOf(activeTrackBooking.status);

                          return (
                            <div className="relative">
                              <div className="hidden sm:block absolute top-1/2 left-0 right-0 h-1 bg-slate-200 -translate-y-1/2 z-0"></div>
                              <div
                                className="hidden sm:block absolute top-1/2 left-0 h-1 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-500"
                                style={{ width: `${Math.max(0, (currentIdx / (steps.length - 1)) * 100)}%` }}
                              ></div>

                              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 relative z-10">
                                {steps.map((st, i) => {
                                  const isPassed = i <= currentIdx;
                                  const isCurrent = i === currentIdx;

                                  return (
                                    <div key={st} className="flex sm:flex-col items-center sm:text-center space-x-3 sm:space-x-0">
                                      <div
                                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                                          isCurrent
                                            ? "bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-sm"
                                            : isPassed
                                            ? "bg-emerald-600 text-white"
                                            : "bg-white text-slate-400 border border-slate-300"
                                        }`}
                                      >
                                        {isPassed && !isCurrent ? "✓" : i + 1}
                                      </div>
                                      <span
                                        className={`text-xs mt-2 font-medium ${
                                          isCurrent ? "text-indigo-700 font-bold" : isPassed ? "text-slate-800" : "text-slate-400"
                                        }`}
                                      >
                                        {st}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="border-t border-slate-100 pt-6">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Milestone Timestamp Audit</h4>
                        <div className="space-y-3">
                          {(activeTrackBooking.tracking_history || []).map((step, idx) => (
                            <div key={idx} className="flex items-start space-x-3 text-xs">
                              <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 mt-1 shrink-0"></div>
                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-bold text-slate-900">{step.status}</span>
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    {new Date(step.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                                  </span>
                                </div>
                                <p className="text-indigo-700 font-medium mt-0.5">{step.location}</p>
                                <p className="text-slate-600 mt-1">{step.remarks}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
                      <p className="text-slate-500 text-sm">AWB number "{activeTrackingAwb}" not found. Try searching LC-894210 or LC-551923.</p>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB D: RFQ REVERSE BIDDING */}
              {shipperSubTab === "rfq" && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                    <h2 className="text-base font-bold text-slate-900 mb-1">Post Heavy/FTL Cargo Load for Reverse Auction</h2>
                    <p className="text-xs text-slate-500 mb-6">
                      Carriers and fleet operators will bid competitively below your ceiling target price.
                    </p>

                    <form onSubmit={handleCreateRfq} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Origin Pincode</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={newRfqOrigin}
                          onChange={(e) => setNewRfqOrigin(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Destination Pincode</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={newRfqDest}
                          onChange={(e) => setNewRfqDest(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo Description</label>
                        <input
                          type="text"
                          value={newRfqDesc}
                          onChange={(e) => setNewRfqDesc(e.target.value)}
                          placeholder="e.g. Electrical Panels / Steel Coils"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Total Weight (Kg)</label>
                        <input
                          type="number"
                          value={newRfqWeight}
                          onChange={(e) => setNewRfqWeight(Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Required Truck Type</label>
                        <select
                          value={newRfqTruck}
                          onChange={(e) => setNewRfqTruck(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                        >
                          <option value="32ft Multi-Axle Trailer (MXL)">32ft Multi-Axle Trailer (MXL)</option>
                          <option value="24ft Container Truck">24ft Container Truck</option>
                          <option value="Taurus 21-Tonner (10-Tyre)">Taurus 21-Tonner (10-Tyre)</option>
                          <option value="19ft Open Body Truck">19ft Open Body Truck</option>
                          <option value="Tata 407 (3.5T)">Tata 407 (3.5T)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Ceiling Target Budget (₹)</label>
                        <input
                          type="number"
                          value={newRfqBudget}
                          onChange={(e) => setNewRfqBudget(Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
                          required
                        />
                      </div>

                      <div className="md:col-span-3 flex justify-end">
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-xs transition shadow-sm"
                        >
                          Broadcast RFQ to Verified Carriers
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-slate-900">Active Loads & Carrier Bids</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {rfqList.map((rfq) => (
                        <div key={rfq.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-mono font-bold">
                                {rfq.origin_pin} → {rfq.dest_pin}
                              </span>
                              <h4 className="text-sm font-bold text-slate-900 mt-1">{rfq.cargo_description}</h4>
                            </div>

                            <div className="text-right text-xs">
                              <span className="text-slate-500">Target Budget: </span>
                              <span className="font-bold text-emerald-700">{formatINR(rfq.target_price)}</span>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {rfq.truck_type} • {(rfq.total_weight_kg / 1000).toFixed(1)} MT
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="text-xs font-bold text-slate-600 block mb-2">
                              Received Bids ({rfq.bids?.length || 0})
                            </span>
                            {!rfq.bids || rfq.bids.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">No bids placed yet. Broadcasting actively to fleet operators.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {rfq.bids.map((bid, bIdx) => (
                                  <div key={bIdx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-slate-900">{bid.vendor_name}</span>
                                      <span className="font-black text-emerald-700">{formatINR(bid.bid_amount)}</span>
                                    </div>
                                    <p className="text-slate-600 text-[11px]">
                                      Transit SLA: <strong className="text-slate-800">{bid.transit_days} Days</strong>
                                    </p>
                                    <p className="text-slate-500 italic text-[11px]">"{bid.notes}"</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* CARRIER / VENDOR DASHBOARD MODULES */}
          {/* ============================================================== */}
          {activePortal === "vendor" && (
            <div className="space-y-6">
              {/* SUB-TAB A: INCOMING ORDERS & DISPATCH */}
              {vendorSubTab === "orders" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Assigned Consignments & Linehaul Status Dispatch</h2>
                      <p className="text-xs text-slate-500">
                        Operating as Carrier: <strong className="text-emerald-700">{currentUser.company_name}</strong>
                      </p>
                    </div>
                    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-mono font-bold">
                      Hub Active
                    </span>
                  </div>

                  <div className="space-y-4">
                    {bookings.map((booking) => {
                      const rowForm = statusUpdateMap[booking.id] || { status: "", location: "", remarks: "" };

                      return (
                        <div key={booking.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="flex items-center space-x-3">
                              <span className="font-mono text-base font-bold text-indigo-700">{booking.awb_number}</span>
                              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded capitalize font-medium">
                                {booking.mode}
                              </span>
                              <span className="text-xs font-mono text-slate-500 font-semibold">
                                {booking.origin_pin} → {booking.dest_pin}
                              </span>
                            </div>

                            <div className="flex items-center space-x-3 text-xs">
                              <span className="text-slate-500">Current Status:</span>
                              <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                {booking.status}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
                            <div>
                              <span className="text-slate-500 block mb-0.5">Shipper (Pickup Address):</span>
                              <p className="font-bold text-slate-900">{booking.shipper_name}</p>
                              <p className="text-slate-600">{booking.pickup_address}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 block mb-0.5">Consignee (Delivery Address):</span>
                              <p className="font-bold text-slate-900">{booking.consignee_name} ({booking.consignee_phone})</p>
                              <p className="text-slate-600">{booking.delivery_address}</p>
                            </div>
                          </div>

                          {/* Interactive Status Dispatch Form */}
                          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center gap-2">
                            <select
                              value={rowForm.status}
                              onChange={(e) =>
                                setStatusUpdateMap({
                                  ...statusUpdateMap,
                                  [booking.id]: { ...rowForm, status: e.target.value }
                                })
                              }
                              className="w-full md:w-44 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                            >
                              <option value="">Update Status...</option>
                              <option value="Picked Up">Picked Up</option>
                              <option value="In Transit">In Transit</option>
                              <option value="Out for Delivery">Out for Delivery</option>
                              <option value="Delivered">Delivered</option>
                            </select>

                            <input
                              type="text"
                              placeholder="Current Hub / City (e.g. Bilaspur Hub HR)"
                              value={rowForm.location}
                              onChange={(e) =>
                                setStatusUpdateMap({
                                  ...statusUpdateMap,
                                  [booking.id]: { ...rowForm, location: e.target.value }
                                })
                              }
                              className="w-full md:flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                            />

                            <input
                              type="text"
                              placeholder="Linehaul / Delivery Remarks"
                              value={rowForm.remarks}
                              onChange={(e) =>
                                setStatusUpdateMap({
                                  ...statusUpdateMap,
                                  [booking.id]: { ...rowForm, remarks: e.target.value }
                                })
                              }
                              className="w-full md:flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                            />

                            <button
                              onClick={() => handleUpdateShipmentStatus(booking.id)}
                              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition shadow-xs"
                            >
                              Dispatch Update
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB-TAB B: RATE CARD MASTER */}
              {vendorSubTab === "rates" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Commercial Rate Card Master</h2>
                      <p className="text-xs text-slate-500">Configure base rates, per kg rates, fuel indexes, and ODA surcharges</p>
                    </div>
                    <button
                      onClick={() => setShowAddRateCard(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      <span>Publish New Rate Card</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Origin / Dest</th>
                          <th className="py-3 px-4">Mode</th>
                          <th className="py-3 px-4">Min Wt</th>
                          <th className="py-3 px-4">Base Rate</th>
                          <th className="py-3 px-4">Per Kg</th>
                          <th className="py-3 px-4">Fuel %</th>
                          <th className="py-3 px-4">Docket Fee</th>
                          <th className="py-3 px-4">SLA</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {rateCards.map((rc) => (
                          <tr key={rc.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 text-slate-900 font-bold">
                              {rc.origin_prefix} → {rc.dest_prefix}
                            </td>
                            <td className="py-3 px-4 uppercase text-slate-700 font-sans font-semibold">{rc.mode}</td>
                            <td className="py-3 px-4">{rc.min_weight_kg} kg</td>
                            <td className="py-3 px-4">{formatINR(rc.base_rate)}</td>
                            <td className="py-3 px-4">{formatINR(rc.per_kg_rate)}/kg</td>
                            <td className="py-3 px-4">{rc.fuel_surcharge_pct}%</td>
                            <td className="py-3 px-4">{formatINR(rc.docket_charge)}</td>
                            <td className="py-3 px-4 text-slate-800 font-sans">{rc.sla_days} Days</td>
                            <td className="py-3 px-4">
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-sans font-bold">
                                Active
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-TAB C: BID ON LIVE RFQS */}
              {vendorSubTab === "bids" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Live Heavy Cargo RFQ Exchange</h2>
                    <p className="text-xs text-slate-500">Bid on full truck load and project freight requirements posted by shippers</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {rfqList.map((rfq) => {
                      const form = bidFormMap[rfq.id] || { amount: 0, days: 0, notes: "" };

                      return (
                        <div key={rfq.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-mono font-bold">
                                PIN {rfq.origin_pin} → {rfq.dest_pin}
                              </span>
                              <h4 className="text-base font-bold text-slate-900 mt-1">{rfq.cargo_description}</h4>
                              <p className="text-xs text-slate-500">
                                Posted by: <strong className="text-slate-800">{rfq.shipper_name}</strong>
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="text-xs text-slate-500 block">Ceiling Target Price</span>
                              <span className="text-base font-black text-emerald-700">{formatINR(rfq.target_price)}</span>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {rfq.truck_type} • {(rfq.total_weight_kg / 1000).toFixed(1)} MT
                              </p>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            <span className="text-xs font-bold text-slate-700 block">Submit Competitive Carrier Quote</span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[11px] text-slate-600 mb-1">Quoted Price (₹)</label>
                                <input
                                  type="number"
                                  placeholder="e.g. 72000"
                                  value={form.amount || ""}
                                  onChange={(e) =>
                                    setBidFormMap({
                                      ...bidFormMap,
                                      [rfq.id]: { ...form, amount: Number(e.target.value) }
                                    })
                                  }
                                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-600 mb-1">Transit SLA (Days)</label>
                                <input
                                  type="number"
                                  placeholder="e.g. 4"
                                  value={form.days || ""}
                                  onChange={(e) =>
                                    setBidFormMap({
                                      ...bidFormMap,
                                      [rfq.id]: { ...form, days: Number(e.target.value) }
                                    })
                                  }
                                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-600 mb-1">Fleet / Driver Notes</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Dedicated 32ft MXL vehicle ready"
                                  value={form.notes}
                                  onChange={(e) =>
                                    setBidFormMap({
                                      ...bidFormMap,
                                      [rfq.id]: { ...form, notes: e.target.value }
                                    })
                                  }
                                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end">
                              <button
                                onClick={() => handleSubmitVendorBid(rfq.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs"
                              >
                                Place Official Bid
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: LIGHT CHECKOUT & RAZORPAY PAYMENT SELECTION */}
      {/* ============================================================== */}
      {selectedQuoteForBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Commercial Consignment Booking & Payment</h3>
                <p className="text-xs text-slate-500">
                  Carrier: <strong className="text-indigo-700">{selectedQuoteForBooking.vendor.name}</strong> • Mode:{" "}
                  <span className="uppercase font-semibold">{selectedQuoteForBooking.rateCard.mode}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedQuoteForBooking(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Total Fare Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block">Total Freight Charges (with 18% GST)</span>
                <span className="text-2xl font-black text-emerald-700">
                  {formatINR(selectedQuoteForBooking.breakdown.total)}
                </span>
              </div>
              <div className="text-right text-xs text-slate-600 font-mono">
                <p>Billable: <strong>{selectedQuoteForBooking.billableWeight} kg</strong></p>
                <p>Transit: <strong>{selectedQuoteForBooking.rateCard.sla_days} Days SLA</strong></p>
              </div>
            </div>

            {/* Address Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Pickup Address & Warehouse Details</label>
                <textarea
                  rows={2}
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Consignee Business Name</label>
                  <input
                    type="text"
                    value={consigneeName}
                    onChange={(e) => setConsigneeName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Consignee Phone</label>
                  <input
                    type="text"
                    value={consigneePhone}
                    onChange={(e) => setConsigneePhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Consignee GSTIN</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={consigneeGstin}
                    onChange={(e) => setConsigneeGstin(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Delivery Destination Address</label>
                <textarea
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900"
                />
              </div>

              {/* Razorpay Dual Payment Method Selector */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2">
                <label className="block text-slate-800 font-bold">Select Payment Settlement Method</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-start space-x-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      paymentMethod === "razorpay"
                        ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_opt"
                      checked={paymentMethod === "razorpay"}
                      onChange={() => setPaymentMethod("razorpay")}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 flex items-center space-x-1">
                        <span>💳 Pay Online (Razorpay)</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-bold">Instant</span>
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">UPI, Debit/Credit Cards & Corporate NetBanking. Verified settlement.</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start space-x-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      paymentMethod === "b2b_credit"
                        ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_opt"
                      checked={paymentMethod === "b2b_credit"}
                      onChange={() => setPaymentMethod("b2b_credit")}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900">🏢 B2B Postpaid Invoice / To-Pay</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">Pay at consignment collection or via registered GST corporate credit terms.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Mandatory Razorpay Terms & Prohibited Cargo Checkbox */}
              <div className="pt-1">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-600 leading-relaxed">
                    I confirm this shipment contains no{" "}
                    <button
                      type="button"
                      onClick={() => openLegalModal("prohibited")}
                      className="text-indigo-600 font-semibold underline"
                    >
                      prohibited or hazardous cargo
                    </button>
                    , the weight/dimensions are accurate, and I accept the{" "}
                    <button
                      type="button"
                      onClick={() => openLegalModal("terms")}
                      className="text-indigo-600 font-semibold underline"
                    >
                      Terms & Conditions
                    </button>
                    ,{" "}
                    <button
                      type="button"
                      onClick={() => openLegalModal("privacy")}
                      className="text-indigo-600 font-semibold underline"
                    >
                      Privacy Policy
                    </button>
                    , and{" "}
                    <button
                      type="button"
                      onClick={() => openLegalModal("refund")}
                      className="text-indigo-600 font-semibold underline"
                    >
                      Refund & Cancellation Policy
                    </button>
                    .
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setSelectedQuoteForBooking(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingBooking || !termsAccepted}
                onClick={handleConfirmBooking}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 shadow-xs ${
                  termsAccepted
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <span>
                  {isSubmittingBooking
                    ? "Processing Payment & AWB..."
                    : paymentMethod === "razorpay"
                    ? "Pay via Razorpay & Generate AWB"
                    : "Confirm B2B Booking & Generate AWB"}
                </span>
                <CheckCircleIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: PRINTABLE COMMERCIAL AWB SHIPPING LABEL */}
      {/* ============================================================== */}
      {printableBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-950 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8 space-y-4 print:p-0 print:m-0 print:border-none print:shadow-none">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 print:hidden">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Commercial Airway Bill (AWB)</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm"
                >
                  <PrinterIcon className="w-4 h-4" />
                  <span>Print Label (A4 / 4x6)</span>
                </button>
                <button
                  onClick={() => setPrintableBooking(null)}
                  className="text-slate-500 hover:text-slate-800 p-1"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="border-4 border-black p-4 space-y-3 font-sans text-black">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">{printableBooking.vendors?.name || "LOGICOMPARE B2B"}</h2>
                  <p className="text-[10px] uppercase font-bold tracking-wider">STANDARD CARGO CONSIGNMENT NOTE</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono">
                    {lookupPinZone(printableBooking.origin_pin).hub} / {lookupPinZone(printableBooking.dest_pin).hub}
                  </span>
                  <p className="text-[10px] font-bold uppercase">{printableBooking.mode} FREIGHT EXPRESS</p>
                </div>
              </div>

              {/* Barcode Mock */}
              <div className="text-center py-2 border-b-2 border-black space-y-1">
                <div className="flex justify-center items-center space-x-1 h-14 overflow-hidden">
                  {[2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3, 4, 1, 2, 3, 2, 4, 1].map((w, i) => (
                    <div key={i} className="bg-black h-full" style={{ width: `${w * 2.5}px` }} />
                  ))}
                </div>
                <span className="text-lg font-mono font-black tracking-widest block">{printableBooking.awb_number}</span>
              </div>

              {/* Shipper & Consignee */}
              <div className="grid grid-cols-2 gap-3 border-b-2 border-black pb-2 text-xs">
                <div className="border-r border-black pr-2">
                  <span className="text-[9px] font-black uppercase block">SHIPPER (FROM):</span>
                  <p className="font-bold">{printableBooking.shipper_name}</p>
                  <p className="text-[10px] leading-tight">{printableBooking.pickup_address}</p>
                  <p className="text-[10px] font-mono mt-1">PIN: <strong>{printableBooking.origin_pin}</strong></p>
                  <p className="text-[10px] font-mono">GSTIN: {printableBooking.shipper_gstin}</p>
                </div>

                <div>
                  <span className="text-[9px] font-black uppercase block">CONSIGNEE (TO):</span>
                  <p className="font-bold">{printableBooking.consignee_name}</p>
                  <p className="text-[10px] leading-tight">{printableBooking.delivery_address}</p>
                  <p className="text-[10px] font-mono mt-1">PIN: <strong>{printableBooking.dest_pin}</strong></p>
                  <p className="text-[10px] font-mono">GSTIN: {printableBooking.consignee_gstin}</p>
                  <p className="text-[10px]">Ph: {printableBooking.consignee_phone}</p>
                </div>
              </div>

              {/* Cargo Grid & Payment Stamp */}
              <div className="grid grid-cols-4 gap-2 text-center border-b-2 border-black pb-2 text-xs">
                <div>
                  <span className="text-[9px] font-bold uppercase block">BOXES</span>
                  <span className="text-sm font-black">{printableBooking.boxes?.length || 1} PKGS</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase block">ACTUAL WT</span>
                  <span className="text-sm font-black">{printableBooking.actual_weight} KG</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase block">BILLABLE WT</span>
                  <span className="text-sm font-black">{printableBooking.billable_weight} KG</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase block">VALUE</span>
                  <span className="text-sm font-black">{formatINR(printableBooking.declared_value)}</span>
                </div>
              </div>

              <div className="border-b-2 border-black pb-2 flex items-center justify-between text-[10px]">
                <div>
                  <span className="font-bold">PAYMENT REFERENCE: </span>
                  <span className="font-mono">{printableBooking.cost_breakdown?.payment_ref || "PAID-ONLINE"}</span>
                </div>
                <div>
                  <span className="font-bold">SETTLEMENT: </span>
                  <span>{printableBooking.cost_breakdown?.payment_method || "Razorpay Online"}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 text-[9px] leading-tight text-slate-700">
                <div className="space-y-0.5">
                  <p className="font-bold">HANDLE WITH CARE • B2B COMMERCIAL FREIGHT</p>
                  <p>Carrier liability subject to Carriage of Goods by Road Act, 2007.</p>
                  <p className="font-mono">Created: {new Date(printableBooking.created_at).toLocaleString("en-IN")}</p>
                </div>
                <div className="w-12 h-12 border-2 border-black flex items-center justify-center font-mono font-bold text-[8px] text-center">
                  SCAN QR
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: PUBLISH NEW RATE CARD (VENDOR) */}
      {/* ============================================================== */}
      {showAddRateCard && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Publish New Commercial Rate Tariff</h3>
              <button onClick={() => setShowAddRateCard(false)} className="text-slate-400 hover:text-slate-700">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublishRateCard} className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">Origin Prefix (e.g. 110 or %)</label>
                <input
                  type="text"
                  value={newRateCard.origin_prefix}
                  onChange={(e) => setNewRateCard({ ...newRateCard, origin_prefix: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Dest Prefix (e.g. 400 or %)</label>
                <input
                  type="text"
                  value={newRateCard.dest_prefix}
                  onChange={(e) => setNewRateCard({ ...newRateCard, dest_prefix: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Transport Mode</label>
                <select
                  value={newRateCard.mode}
                  onChange={(e) => setNewRateCard({ ...newRateCard, mode: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                >
                  <option value="surface">Surface Express</option>
                  <option value="air">Air Cargo</option>
                  <option value="ftl">Full Truck Load (FTL)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Transit SLA (Days)</label>
                <input
                  type="number"
                  value={newRateCard.sla_days}
                  onChange={(e) => setNewRateCard({ ...newRateCard, sla_days: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Base Rate (₹)</label>
                <input
                  type="number"
                  value={newRateCard.base_rate}
                  onChange={(e) => setNewRateCard({ ...newRateCard, base_rate: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Rate Per Kg (₹)</label>
                <input
                  type="number"
                  step={0.1}
                  value={newRateCard.per_kg_rate}
                  onChange={(e) => setNewRateCard({ ...newRateCard, per_kg_rate: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Fuel Surcharge (%)</label>
                <input
                  type="number"
                  step={0.5}
                  value={newRateCard.fuel_surcharge_pct}
                  onChange={(e) => setNewRateCard({ ...newRateCard, fuel_surcharge_pct: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Docket / AWB Charge (₹)</label>
                <input
                  type="number"
                  value={newRateCard.docket_charge}
                  onChange={(e) => setNewRateCard({ ...newRateCard, docket_charge: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                  required
                />
              </div>

              <div className="col-span-2 flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRateCard(false)}
                  className="px-3 py-1.5 rounded text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded text-xs shadow-xs"
                >
                  Publish Tariff Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: AUTHENTICATION / SIGN IN / SIGN UP */}
      {/* ============================================================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {authMode === "login" ? "Account Sign In" : "Register Logistics Enterprise"}
              </h3>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-slate-700">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {authMsg && <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">{authMsg}</p>}

            <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">Business Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                  required
                />
              </div>

              {authMode === "signup" && (
                <>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Full Name</label>
                    <input
                      type="text"
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Company / Enterprise Name</label>
                    <input
                      type="text"
                      value={authCompanyName}
                      onChange={(e) => setAuthCompanyName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">GSTIN (15 Digits)</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={authGstin}
                      onChange={(e) => setAuthGstin(e.target.value)}
                      placeholder="e.g. 07AAACA1234A1Z5"
                      className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Account Role</label>
                    <select
                      value={authRole}
                      onChange={(e) => setAuthRole(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                    >
                      <option value="shipper">Shipper (Manufacturer / Retailer / Trader)</option>
                      <option value="vendor">Logistics Vendor / Carrier / Fleet Owner</option>
                    </select>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded text-xs transition shadow-xs"
              >
                {authLoading ? "Processing..." : authMode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
              {authMode === "login" ? (
                <button onClick={() => setAuthMode("signup")} className="text-indigo-600 font-semibold hover:underline">
                  Don't have an enterprise account? Sign up
                </button>
              ) : (
                <button onClick={() => setAuthMode("login")} className="text-indigo-600 font-semibold hover:underline">
                  Already registered? Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: RAZORPAY-COMPLIANT LEGAL & POLICY MODAL */}
      {/* ============================================================== */}
      {showLegalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Legal, Governance & Razorpay KYC Compliance</h3>
                <p className="text-xs text-slate-500">Merchant: {MERCHANT_DETAILS.proprietor} • Jurisdiction: {MERCHANT_DETAILS.jurisdiction}</p>
              </div>
              <button onClick={() => setShowLegalModal(false)} className="text-slate-400 hover:text-slate-700">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Interactive Tab Switcher */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-2">
              {[
                { id: "terms", label: "Terms & Conditions" },
                { id: "privacy", label: "Privacy Policy" },
                { id: "refund", label: "Refund & Cancellation" },
                { id: "shipping", label: "Shipping & Delivery" },
                { id: "prohibited", label: "Prohibited Goods" },
                { id: "contact", label: "Contact Us" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLegalModalTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    legalModalTab === tab.id
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="text-xs text-slate-600 space-y-3 max-h-96 overflow-y-auto pr-2 leading-relaxed">
              {legalModalTab === "terms" && (
                <div className="space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm">Terms and Conditions of Service</h4>
                  <p>
                    <strong>1. Platform Nature:</strong> {MERCHANT_DETAILS.platformName} is a proprietary B2B logistics technology and freight aggregator platform operated by <strong>{MERCHANT_DETAILS.proprietor}</strong>. LogiCompare connects commercial shippers with third-party verified fleet operators and carriers (e.g. Delhivery, Blue Dart, TCI Freight, Safexpress, Gati-KWE).
                  </p>
                  <p>
                    <strong>2. Statutory Compliance & E-Way Bills:</strong> In accordance with the Central Goods and Services Tax Act, 2017, the Shipper warrants that any consignment valued in excess of ₹50,000 is accompanied by a valid, active GST E-Way Bill and tax invoice. Shipper is strictly liable for any penalty arising from misdeclaration.
                  </p>
                  <p>
                    <strong>3. Weight Discrepancy & Verification:</strong> All freight charges are calculated on whichever is higher between actual gross weight and volumetric weight (L x W x H / 4500 for surface, 5000 for air). Carried consignments are scanned at carrier gateway transit hubs; discrepancies will be billed additionally.
                  </p>
                  <p>
                    <strong>4. Carriage of Goods Act:</strong> Physical transport of goods is governed by the Carriage by Road Act, 2007 and applicable Indian aviation cargo statutes. LogiCompare’s aggregate liability is limited to the FOV (Freight on Value) risk protection declared at the time of booking.
                  </p>
                  <p>
                    <strong>5. Governing Law:</strong> These terms are governed by the laws of India. Any legal dispute or proceeding shall be subject to the exclusive jurisdiction of the competent courts in <strong>{MERCHANT_DETAILS.jurisdiction}</strong>.
                  </p>
                </div>
              )}

              {legalModalTab === "privacy" && (
                <div className="space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm">Privacy & Data Protection Policy</h4>
                  <p>
                    <strong>1. Collection of Business Data:</strong> We collect business contact details, GSTIN identifiers, pickup/delivery warehouse addresses, and package specifications solely to facilitate freight calculations, AWB barcode printing, and linehaul tracking.
                  </p>
                  <p>
                    <strong>2. Disclosure to Carriers:</strong> Necessary consignment parameters are shared exclusively with the assigned carrier partner (e.g., Delhivery, Blue Dart) for dispatch, transit routing, and Proof of Delivery (POD) completion.
                  </p>
                  <p>
                    <strong>3. Payment Security:</strong> We do not store credit card numbers, CVVs, or NetBanking credentials on our servers. All digital transactions are processed through <strong>Razorpay</strong> over 256-bit SSL encrypted channels in compliance with PCI-DSS.
                  </p>
                  <p>
                    <strong>4. Grievance Officer:</strong> In compliance with the Information Technology Act, 2000 and Digital Personal Data Protection (DPDP) Act, 2023, the designated Grievance Officer is:
                  </p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-0.5">
                    <p><strong>Officer:</strong> {MERCHANT_DETAILS.proprietor}</p>
                    <p><strong>Email:</strong> {MERCHANT_DETAILS.email}</p>
                    <p><strong>Helpline:</strong> {MERCHANT_DETAILS.phone}</p>
                    <p><strong>Address:</strong> {MERCHANT_DETAILS.address}</p>
                  </div>
                </div>
              )}

              {legalModalTab === "refund" && (
                <div className="space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm">Refund & Cancellation Policy</h4>
                  <p>
                    <strong>1. Cancellation Prior to Pickup:</strong> Shippers may cancel any consignment booking prior to the carrier dispatching a vehicle for collection. Consignments cancelled before pickup attempt qualify for a <strong>100% full refund</strong>.
                  </p>
                  <p>
                    <strong>2. Cancellation Post-Dispatch / Driver Attempt:</strong> If a cancellation is requested after a carrier vehicle has been deployed or reached the shipper warehouse, a nominal dead-freight visit charge (equivalent to the base docket charge of ₹150–₹250) will be deducted, and the balance refunded.
                  </p>
                  <p>
                    <strong>3. Refund Mode & Settlement Timeframe:</strong> All approved refunds are processed back to the original source account (UPI, credit/debit card, or bank account) via <strong>Razorpay</strong>. The standard refund credit window is <strong>5 to 7 business days</strong> depending on the issuing bank.
                  </p>
                  <p>
                    <strong>4. Dispute Resolution:</strong> If a refund is delayed beyond 7 business days, shippers can write with their AWB and payment reference to <strong>{MERCHANT_DETAILS.email}</strong> for immediate investigation.
                  </p>
                </div>
              )}

              {legalModalTab === "shipping" && (
                <div className="space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm">Shipping, Transit SLAs & Delivery Policy</h4>
                  <p>
                    <strong>1. Serviceable Network:</strong> LogiCompare Pro services 19,000+ PIN codes across all 28 Indian States and 8 Union Territories via aggregated multi-modal express networks.
                  </p>
                  <p>
                    <strong>2. Estimated Transit SLAs:</strong>
                    <br />• <strong>Surface Cargo Express:</strong> 3 to 6 business days depending on transit lane (e.g., Delhi to Mumbai in ~3 days; Delhi to Bengaluru in ~4 days).
                    <br />• <strong>Air Express Cargo:</strong> 24 to 48 hours connecting primary metro airport gateways.
                    <br />• <strong>FTL (Full Truck Load):</strong> Linehaul direct transit without transshipment, scheduled on dedicated driver relays.
                  </p>
                  <p>
                    <strong>3. ODA (Out of Delivery Area):</strong> Remote rural or special security regions classified as ODA may incur an additional 1 to 2 business days for local connection.
                  </p>
                  <p>
                    <strong>4. Proof of Delivery (POD):</strong> Deliveries are concluded upon physical signature or OTP confirmation by the consignee, automatically updating the AWB tracking audit.
                  </p>
                </div>
              )}

              {legalModalTab === "prohibited" && (
                <div className="space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm">Strictly Prohibited & Banned Cargo</h4>
                  <p>Shippers are strictly prohibited from booking or tendering the following items for shipment:</p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-700">
                    <li>Explosives, fireworks, ammunition, and hazardous chemicals (Classes 1–9 Hazmat).</li>
                    <li>Flammable liquids, gases, compressed cylinders, and corrosives.</li>
                    <li>Unregistered bullion, loose precious gems, and sovereign cash/currency notes.</li>
                    <li>Narcotics, psychotropic substances, and contraband goods prohibited under the NDPS Act.</li>
                    <li>Live animals, human remains, or wildlife articles prohibited under the Wildlife Protection Act.</li>
                    <li>Radioactive materials and bio-hazard clinical waste.</li>
                  </ul>
                  <p className="text-rose-700 font-semibold text-[11px] bg-rose-50 p-2 rounded border border-rose-200">
                    Any tender of banned goods will result in immediate confiscation, consignment forfeiture, and police reporting under Indian criminal statutes.
                  </p>
                </div>
              )}

              {legalModalTab === "contact" && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm">Official Merchant & Support Contact</h4>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <p><strong className="text-slate-900">Proprietor / Merchant:</strong> {MERCHANT_DETAILS.proprietor}</p>
                    <p><strong className="text-slate-900">Platform:</strong> {MERCHANT_DETAILS.platformName} ({MERCHANT_DETAILS.category})</p>
                    <p><strong className="text-slate-900">Email:</strong> <a href={`mailto:${MERCHANT_DETAILS.email}`} className="text-indigo-600 underline">{MERCHANT_DETAILS.email}</a></p>
                    <p><strong className="text-slate-900">Helpline Phone:</strong> <a href={`tel:${MERCHANT_DETAILS.phone}`} className="text-indigo-600 underline">{MERCHANT_DETAILS.phone}</a></p>
                    <p><strong className="text-slate-900">Operating Address:</strong> {MERCHANT_DETAILS.address}</p>
                    <p><strong className="text-slate-900">Support Hours:</strong> {MERCHANT_DETAILS.operatingHours}</p>
                    <p><strong className="text-slate-900">Legal Jurisdiction:</strong> {MERCHANT_DETAILS.jurisdiction}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowLegalModal(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-lg"
              >
                Close Compliance Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* EXTENDED RAZORPAY-COMPLIANT GLOBAL FOOTER */}
      {/* ============================================================== */}
      <footer className="mt-auto border-t border-slate-200 bg-white text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-100 pb-6">
            {/* Column 1: Brand & Registration */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <TruckIcon className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-sm text-slate-900">{MERCHANT_DETAILS.platformName}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Operated by <strong>{MERCHANT_DETAILS.proprietor}</strong>. An enterprise B2B multi-carrier freight booking exchange and AWB generation network compliant with Indian Goods Transport Agency (GTA) and GST regulations.
              </p>
              <p className="text-[11px] text-slate-500">
                Official Jurisdiction: <strong>{MERCHANT_DETAILS.jurisdiction}</strong>
              </p>
            </div>

            {/* Column 2: Official Merchant Contact (Razorpay Spec) */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">Merchant Contact & Grievance</span>
              <p className="text-[11px]"><strong>Proprietor:</strong> {MERCHANT_DETAILS.proprietor}</p>
              <p className="text-[11px]">
                <strong>Helpline:</strong> <a href={`tel:${MERCHANT_DETAILS.phone}`} className="text-indigo-600 hover:underline">{MERCHANT_DETAILS.phone}</a>
              </p>
              <p className="text-[11px]">
                <strong>Support:</strong> <a href={`mailto:${MERCHANT_DETAILS.email}`} className="text-indigo-600 hover:underline">{MERCHANT_DETAILS.email}</a>
              </p>
              <p className="text-[11px] text-slate-500 leading-tight">
                <strong>Address:</strong> {MERCHANT_DETAILS.address}
              </p>
            </div>

            {/* Column 3: Quick Legal Links */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">Governance & Policies</span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-slate-600">
                <button onClick={() => openLegalModal("terms")} className="text-left hover:text-indigo-600">Terms & Conditions</button>
                <button onClick={() => openLegalModal("privacy")} className="text-left hover:text-indigo-600">Privacy Policy</button>
                <button onClick={() => openLegalModal("refund")} className="text-left hover:text-indigo-600">Refund & Cancellation</button>
                <button onClick={() => openLegalModal("shipping")} className="text-left hover:text-indigo-600">Shipping Policy</button>
                <button onClick={() => openLegalModal("prohibited")} className="text-left hover:text-indigo-600">Prohibited Goods</button>
                <button onClick={() => openLegalModal("contact")} className="text-left hover:text-indigo-600">Contact Us</button>
              </div>
              <div className="pt-2 flex items-center space-x-2 text-[10px] text-slate-500">
                <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono font-bold">100% Razorpay Verified</span>
                <span>•</span>
                <span>PCI-DSS Secured</span>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Strip */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 text-[11px]">
            <p>© 2026 {MERCHANT_DETAILS.platformName} ({MERCHANT_DETAILS.proprietor}). All rights reserved across India.</p>
            <div className="flex items-center space-x-3">
              <span>Carriage by Road Act 2007</span>
              <span>•</span>
              <span>GTA GST 18% Compliant</span>
              <span>•</span>
              <span>Refund SLA: 5–7 Business Days</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
