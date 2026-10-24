
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

// Safe Supabase client initialization
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xyzcompany.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key-placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// Fallback Indian Logistics Seed for offline or initial demo testing
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
// INLINE ICONS
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

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function LogiComparePro() {
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

  // Checkout Modal State
  const [pickupAddress, setPickupAddress] = useState("Plot 45, Okhla Industrial Area Phase-III, New Delhi");
  const [consigneeName, setConsigneeName] = useState("Prime Electronics Retail");
  const [consigneePhone, setConsigneePhone] = useState("+91 98200 44556");
  const [consigneeGstin, setConsigneeGstin] = useState("27AAACP9988G1ZK");
  const [deliveryAddress, setDeliveryAddress] = useState("Warehouse 4B, Bhiwandi Logistics Park, Mumbai");
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

  // Confirm Booking
  const handleConfirmBooking = async () => {
    if (!selectedQuoteForBooking) return;
    setIsSubmittingBooking(true);

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const generatedAwb = `LC-${randomSuffix}`;

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
      cost_breakdown: selectedQuoteForBooking.breakdown,
      final_total: selectedQuoteForBooking.breakdown.total,
      status: "Booked",
      tracking_history: [
        {
          status: "Booked",
          location: `${originZone.city} Hub (${originPin})`,
          timestamp: new Date().toISOString(),
          remarks: "AWB Generated & Commercial Invoice Linked"
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
      {/* CLEAN LIGHT NAVIGATION BAR */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-xs px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
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

          {/* Quick Demo Role Switcher */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => switchDemoRole("shipper")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                currentUser.role === "shipper"
                  ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>⚡ Shipper Mode</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded font-medium">Apex</span>
            </button>
            <button
              onClick={() => switchDemoRole("vendor")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                currentUser.role === "vendor"
                  ? "bg-white text-emerald-700 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>⚡ Carrier Mode</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-medium">Delhivery</span>
            </button>
          </div>

          {/* Active Profile & Auth Button */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-900">{currentUser.company_name}</p>
              <p className="text-[11px] text-slate-500 font-mono">GSTIN: {currentUser.gstin || "Unregistered"}</p>
            </div>

            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-xs flex items-center space-x-2"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Account / Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ============================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Navigation Selector Bar */}
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
                {/* 1. Light Calculator Form Card */}
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
                    {/* Origin PIN */}
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

                    {/* Destination PIN */}
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

                    {/* Declared Cargo Value */}
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

                    {/* Mode & ODA Checkbox */}
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
                          {/* Carrier Branding & Route */}
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

                          {/* Line-Item Grid */}
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

                          {/* Price & Book Action */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">All-Inclusive Total</span>
                              <span className="text-xl font-black text-emerald-700">{formatINR(quote.breakdown.total)}</span>
                            </div>
                            <button
                              onClick={() => setSelectedQuoteForBooking(quote)}
                              className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition flex items-center space-x-1.5 shadow-sm"
                            >
                              <span>Book & Generate AWB</span>
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
                    {/* Header */}
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

                    {/* Clean 5-Step Visual Progress Bar */}
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

                    {/* Timestamp Audit Trail */}
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

                {/* RFQ Cards */}
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

                        {/* Bid Placement Box */}
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

      {/* ============================================================== */}
      {/* MODAL 1: LIGHT CHECKOUT & AWB GENERATOR */}
      {/* ============================================================== */}
      {selectedQuoteForBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Commercial Consignment Booking</h3>
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

            <div className="space-y-4 text-xs">
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
            </div>

            <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedQuoteForBooking(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingBooking}
                onClick={handleConfirmBooking}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 shadow-xs"
              >
                <span>{isSubmittingBooking ? "Manifesting AWB..." : "Confirm & Generate AWB"}</span>
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

            {/* Indian B2B Shipping Label Spec */}
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

              {/* Weight Grid */}
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
      {/* ENTERPRISE FOOTER */}
      {/* ============================================================== */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 LogiCompare Pro • B2B Freight Logistics Marketplace for India</p>
          <div className="flex items-center space-x-4">
            <span>GTA GST 18% Compliant</span>
            <span>•</span>
            <span>Indian Pincode Hub Routing</span>
            <span>•</span>
            <span>Carriage of Goods Act 2007</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
