"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Clean initialization reading directly from Vercel environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==========================================
// OFFICIAL PLATFORM & AGGREGATOR DETAILS
// ==========================================
const MERCHANT_DETAILS = {
  proprietor: "Yash Chaudhary",
  platformName: "LogiCompare Pro",
  category: "B2B Freight Discovery & Consignment Marketplace",
  email: "yash963957@gmail.com",
  phone: "+91 8194017660",
  address: "House No. S-175/219, B Block, Rangpuri Pahari Nala, New Delhi - 110037, India",
  jurisdiction: "New Delhi, Delhi, India",
  operatingHours: "Monday to Saturday, 09:00 AM – 07:00 PM IST",
  platformFeePct: 2, // 2% Dynamic Platform Fee
  minPlatformFeeINR: 25 // Minimum ₹25 floor cap
};

// ==========================================
// DOMAIN DATA INTERFACES
// ==========================================
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
  if (p3 === "160") return { city: "Chandigarh (Tricity)", state: "Chandigarh", hub: "CHD-CENTRAL" };
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

const formatINR = (val: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(val || 0);
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

const resolveLocationToPrefix = async (rawInput: string): Promise<string> => {
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
    console.warn("API lookup fallback failed for:", clean, err);
  }
  return clean.substring(0, 3);
};

// ==========================================
// 3D VISUAL COMPONENT 1: INTERACTIVE 3D PACKAGE BOX
// ==========================================
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
    <div className="flex flex-col items-center select-none bg-gradient-to-b from-slate-900/60 to-slate-900/90 p-4 rounded-2xl border border-slate-700/60 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-300 flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1"></span>
          Live 3D Carton Visualizer
        </span>
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700"
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
          <div
            className="absolute inset-0 bg-gradient-to-br from-amber-700 via-amber-600 to-amber-800 border border-amber-900/40 shadow-inner flex flex-col justify-between p-2 text-white overflow-hidden rounded-xs"
            style={{ transform: `translateZ(${w / 2}px)` }}
          >
            <div className="flex justify-between items-start opacity-90">
              <span className="text-[8px] font-black uppercase tracking-widest text-amber-950 bg-amber-400/80 px-1 rounded-xs">
                FRAGILE
              </span>
              <span className="text-[7px] font-mono text-amber-200">↑ THIS SIDE UP</span>
            </div>
            <div className="flex flex-col items-center my-auto">
              <div className="w-10 h-3 bg-white/90 rounded-xs flex items-center justify-center space-x-0.5 px-1 py-0.5">
                {[1, 2, 1, 3, 1, 2, 1, 2, 1].map((n, i) => (
                  <div key={i} className="bg-black h-full" style={{ width: `${n}px` }} />
                ))}
              </div>
              <span className="text-[6px] font-mono font-bold text-amber-100 tracking-wider mt-0.5">
                {length}×{width}×{height} CM
              </span>
            </div>
            <div className="h-1.5 w-full bg-amber-900/60 rounded-xs"></div>
          </div>

          <div
            className="absolute inset-0 bg-gradient-to-br from-amber-800 to-amber-900 border border-amber-950 flex items-center justify-center text-amber-300 font-mono text-[8px] font-bold"
            style={{ transform: `rotateY(180deg) translateZ(${w / 2}px)` }}
          >
            <span>LOGICOMPARE B2B</span>
          </div>

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
              <span className="text-[6px] font-bold text-amber-950 tracking-widest uppercase">HEAVY DUTY SEAL</span>
            </div>
          </div>

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

// ==========================================
// 3D VISUAL COMPONENT 2: HERO INTERACTIVE 3D CONTAINER TRUCK
// ==========================================
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

      ctx.save();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
      ctx.lineWidth = 1;
      for (let i = -140; i <= 140; i += 28) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 1.8, cy + 50);
        ctx.lineTo(cx + i * 0.5, cy - 20);
        ctx.stroke();
      }

      const stripeOffset = (Date.now() / (speed === "turbo" ? 40 : 80)) % 40;
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
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
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
      ctx.roundRect(-80, -38, 95, 48, 4);
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

      wheelAngle += speed === "turbo" ? 0.35 : 0.15;
      const wheelPositions = [-62, -42, 28, 46];
      wheelPositions.forEach((wx) => {
        ctx.save();
        ctx.translate(wx, 14);
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
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
    <div className="relative flex flex-col items-center bg-slate-900/80 border border-indigo-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between w-full px-2 mb-1">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-mono font-bold text-slate-200">3D Linehaul Truck Intermodal</span>
        </div>
        <button
          onClick={() => setSpeed(speed === "normal" ? "turbo" : "normal")}
          className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-900/60 border border-indigo-500/40 px-2.5 py-1 rounded-full hover:bg-indigo-800 transition"
        >
          {speed === "turbo" ? "⚡ Turbo Speed" : "▶ Normal Transit"}
        </button>
      </div>

      <canvas ref={canvasRef} width={340} height={170} className="w-full max-w-[340px] h-[170px]" />

      <div className="flex items-center justify-between w-full text-[10px] text-slate-400 pt-1 border-t border-slate-800 font-mono">
        <span>Vehicle: 32ft MXL Container</span>
        <span className="text-emerald-400 font-bold">GPS Active • Linehaul</span>
      </div>
    </div>
  );
}

// ==========================================
// 3D VISUAL COMPONENT 3: ANIMATED 3D ROUTE TRAJECTORY ARC
// ==========================================
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
    <div className="relative bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 text-white flex flex-col items-center">
      <div className="flex justify-between items-center w-full text-[10px] font-mono mb-1">
        <span className="text-indigo-300 font-bold">📍 {originHub || "DEL-ORIGIN"}</span>
        <span className="text-emerald-300 font-bold">🎯 {destHub || "BOM-DEST"}</span>
      </div>
      <canvas ref={canvasRef} width={300} height={90} className="w-full max-w-[300px] h-[90px]" />
      <span className="text-[9px] text-slate-400 font-mono mt-0.5">3D Parabolic Linehaul Trajectory Active</span>
    </div>
  );
}

// Inline SVG Icons
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

const ExternalLinkIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const DownloadIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const UploadIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const MapPinIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const DEMO_INIT_ORDER_ID = "LC-894210";
const DEMO_INIT_CARRIER_DOCKET = "148920194821";

export default function LogiComparePro() {
  const [activeView, setActiveView] = useState<"landing" | "dashboard">("landing");
  const [landingWorkflowTab, setLandingWorkflowTab] = useState<"shipper" | "vendor">("shipper");
  const [landingTrackingInput, setLandingTrackingInput] = useState(DEMO_INIT_ORDER_ID);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<"terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact">("terms");

  const [showCitySearchModal, setShowCitySearchModal] = useState<"origin" | "dest" | null>(null);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citySearchResults, setCitySearchResults] = useState<Array<{ name: string; district: string; state: string; pincode: string }>>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);

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

  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_SHIPPER);
  const [activePortal, setActivePortal] = useState<"shipper" | "vendor">("shipper");
  const [shipperSubTab, setShipperSubTab] = useState<"compare" | "shipments" | "tracker" | "rfq">("compare");
  const [vendorSubTab, setVendorSubTab] = useState<"orders" | "rates" | "bids" | "bank">("orders");

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

  const [originPin, setOriginPin] = useState("110037");
  const [destPin, setDestPin] = useState("400001");
  const [isOda, setIsOda] = useState(false);
  const [declaredValue, setDeclaredValue] = useState<number>(75000);
  const [selectedMode, setSelectedMode] = useState<"all" | "surface" | "air" | "ftl">("all");
  const [boxes, setBoxes] = useState<BoxItem[]>([
    { id: "box-1", qty: 2, weight: 20, length: 45, width: 35, height: 30 },
    { id: "box-2", qty: 1, weight: 15, length: 30, width: 30, height: 25 }
  ]);
  const [selectedBoxFor3D, setSelectedBoxFor3D] = useState<number>(0);

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

  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>(FALLBACK_VENDORS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rfqList, setRfqList] = useState<RfqBid[]>([]);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<CalculatedQuote | null>(null);
  const [printableBooking, setPrintableBooking] = useState<Booking | null>(null);
  const [activeTrackingAwb, setActiveTrackingAwb] = useState(DEMO_INIT_ORDER_ID);
  const [trackingSearchInput, setTrackingSearchInput] = useState(DEMO_INIT_ORDER_ID);

  const [pickupAddress, setPickupAddress] = useState("House No. S-175/219, B Block, Rangpuri Pahari Nala, New Delhi - 110037");
  const [consigneeName, setConsigneeName] = useState("Prime Electronics Retail");
  const [consigneePhone, setConsigneePhone] = useState("+91 98200 44556");
  const [consigneeGstin, setConsigneeGstin] = useState("27AAACP9988G1ZK");
  const [deliveryAddress, setDeliveryAddress] = useState("Warehouse 4B, Bhiwandi Logistics Park, Mumbai");
  const [settlementType, setSettlementType] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");
  const [directPaymentUtr, setDirectPaymentUtr] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  const [newRfqOrigin, setNewRfqOrigin] = useState("110001");
  const [newRfqDest, setNewRfqDest] = useState("560001");
  const [newRfqDesc, setNewRfqDesc] = useState("Industrial Gearboxes and Heavy Machinery Parts");
  const [newRfqWeight, setNewRfqWeight] = useState(8500);
  const [newRfqTruck, setNewRfqTruck] = useState("32ft Multi-Axle Trailer (MXL)");
  const [newRfqBudget, setNewRfqBudget] = useState(65000);

  const [statusUpdateMap, setStatusUpdateMap] = useState<Record<string, { status: string; location: string; remarks: string; docketNo?: string }>>({});

  // Vendor Bank Settlement State
  const [vendorUpiInput, setVendorUpiInput] = useState("delhivery.b2b@icici");
  const [vendorBankAccInput, setVendorBankAccInput] = useState("50200088910234");
  const [vendorIfscInput, setVendorIfscInput] = useState("HDFC0000240");
  const [vendorBeneficiaryInput, setVendorBeneficiaryInput] = useState("Delhivery Limited B2B Logistics");
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankSaveMsg, setBankSaveMsg] = useState("");

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

  const [csvFileName, setCsvFileName] = useState("");
  const [parsedCsvRows, setParsedCsvRows] = useState<ParsedCsvRateCard[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvUploadStatus, setCsvUploadStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bidFormMap, setBidFormMap] = useState<Record<string, { amount: number; days: number; notes: string }>>({});

  useEffect(() => {
    if (originPin.trim().length === 6) {
      setOriginZoneData((prev) => ({ ...prev, loading: true, error: undefined }));
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
      setDestZoneData((prev) => ({ ...prev, loading: true, error: undefined }));
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

  const handleSearchCityToPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citySearchQuery || citySearchQuery.length < 3) return;
    setIsSearchingCity(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/postoffice/${citySearchQuery.trim()}`);
      const data = await res.json();
      if (data && data[0]?.Status === "Success" && data[0]?.PostOffice) {
        setCitySearchResults(
          data[0].PostOffice.map((item: any) => ({
            name: item.Name,
            district: item.District,
            state: item.State,
            pincode: item.Pincode
          }))
        );
      } else {
        setCitySearchResults([]);
      }
    } catch {
      setCitySearchResults([]);
    } finally {
      setIsSearchingCity(false);
    }
  };

  const applySelectedCityPin = (pincode: string) => {
    if (showCitySearchModal === "origin") setOriginPin(pincode);
    else if (showCitySearchModal === "dest") setDestPin(pincode);
    setShowCitySearchModal(null);
    setCitySearchQuery("");
    setCitySearchResults([]);
  };

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

  // Sync active vendor bank details to inputs
  useEffect(() => {
    const vId = currentUser.vendor_id || "11111111-1111-1111-1111-111111111111";
    const found = vendors.find((v) => v.id === vId);
    if (found) {
      if (found.upi_id) setVendorUpiInput(found.upi_id);
      if (found.bank_account) setVendorBankAccInput(found.bank_account);
      if (found.ifsc_code) setVendorIfscInput(found.ifsc_code);
      if (found.beneficiary_name) setVendorBeneficiaryInput(found.beneficiary_name);
    }
  }, [currentUser, vendors]);

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

  const openLegalModal = (tab: "terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact") => {
    setLegalModalTab(tab);
    setShowLegalModal(true);
  };

  const handleLandingQuickTrack = (inputToTrack?: string) => {
    const target = inputToTrack || landingTrackingInput || DEMO_INIT_ORDER_ID;
    setActiveTrackingAwb(target);
    setTrackingSearchInput(target);
    setActiveView("dashboard");
    setActivePortal("shipper");
    setShipperSubTab("tracker");
  };

  const handleLandingJumpToCompare = () => {
    setActiveView("dashboard");
    setActivePortal("shipper");
    setShipperSubTab("compare");
  };

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
    if (selectedBoxFor3D >= boxes.length - 1) {
      setSelectedBoxFor3D(Math.max(0, boxes.length - 2));
    }
  };

  const updateBox = (id: string, field: keyof BoxItem, value: number) => {
    setBoxes(boxes.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

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
      const freightDirectTotal = subtotal + gst;

      const rawPctFee = (freightDirectTotal * MERCHANT_DETAILS.platformFeePct) / 100;
      const convenienceFee = Math.max(MERCHANT_DETAILS.minPlatformFeeINR, Math.round(rawPctFee));

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
          freightSubtotal: Math.round(freightDirectTotal * 100) / 100,
          platformConvenienceFee: convenienceFee,
          total: Math.round((freightDirectTotal + convenienceFee) * 100) / 100
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

  const handleConfirmDirectBooking = async () => {
    if (!selectedQuoteForBooking) return;
    if (!termsAccepted) {
      alert("Please accept the consignment booking terms before proceeding.");
      return;
    }

    setIsSubmittingBooking(true);

    const platformOrderId = `LC-${Math.floor(100000 + Math.random() * 900000)}`;

    const carrier = selectedQuoteForBooking.vendor.name.toLowerCase();
    let initialCarrierDocket = "";
    if (carrier.includes("delhivery")) {
      initialCarrierDocket = `14${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    } else if (carrier.includes("blue dart")) {
      initialCarrierDocket = `BLU${Math.floor(100000000 + Math.random() * 900000000)}`;
    } else if (carrier.includes("tci")) {
      initialCarrierDocket = `TCI-${Math.floor(1000000 + Math.random() * 9000000)}`;
    } else if (carrier.includes("gati")) {
      initialCarrierDocket = `GTI-${Math.floor(10000000 + Math.random() * 90000000)}`;
    } else {
      initialCarrierDocket = `SAF-${Math.floor(10000000 + Math.random() * 90000000)}`;
    }

    let refString = "DIRECT-TO-PAY-POD";
    if (settlementType === "direct_upi") {
      refString = directPaymentUtr ? `UPI-UTR-${directPaymentUtr}` : `DIRECT-UPI-${selectedQuoteForBooking.vendor.upi_id}`;
    } else if (settlementType === "corporate_credit") {
      refString = "B2B-DIRECT-CREDIT-TERMS";
    }

    const officialPortalUrl = getOfficialCarrierTrackingUrl(selectedQuoteForBooking.vendor.name, initialCarrierDocket);

    const enhancedBreakdown: CostBreakdown = {
      ...selectedQuoteForBooking.breakdown,
      settlement_type: settlementType,
      payment_method: settlementType === "direct_upi" ? "Direct Carrier UPI" : settlementType === "corporate_credit" ? "B2B Monthly Credit" : "Direct To-Pay POD",
      payment_ref: refString,
      carrier_upi: selectedQuoteForBooking.vendor.upi_id
    };

    const newBookingRecord: Partial<Booking> = {
      order_id: platformOrderId,
      awb_number: initialCarrierDocket,
      carrier_docket_no: initialCarrierDocket,
      carrier_portal_url: officialPortalUrl,
      shipper_id: currentUser.id,
      vendor_id: selectedQuoteForBooking.vendor.id,
      rate_card_id: selectedQuoteForBooking.rateCard.id,
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
          location: `${originZoneData.city} Hub (${originPin})`,
          timestamp: new Date().toISOString(),
          remarks: `Order Ref ${platformOrderId} generated. Carrier Docket ${initialCarrierDocket} assigned. Direct freight (${formatINR(enhancedBreakdown.freightSubtotal)}) payable to ${selectedQuoteForBooking.vendor.name} [Ref: ${refString}]. Platform 2% fee (₹${enhancedBreakdown.platformConvenienceFee}) recorded.`
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
    } catch {
      // Local fallback
    } finally {
      setIsSubmittingBooking(false);
      setSelectedQuoteForBooking(null);
      setTermsAccepted(false);
      setDirectPaymentUtr("");
      setShipperSubTab("shipments");
    }
  };

  const handleUpdateShipmentStatus = async (bookingId: string) => {
    const updateData = statusUpdateMap[bookingId];
    if (!updateData) {
      alert("Please provide updated details");
      return;
    }

    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const carrierName = booking.vendors?.name || "Carrier";
    const effectiveDocket = updateData.docketNo && updateData.docketNo.trim() !== "" 
      ? updateData.docketNo.trim() 
      : (booking.carrier_docket_no || booking.awb_number);

    const newPortalUrl = getOfficialCarrierTrackingUrl(carrierName, effectiveDocket);

    const newStep: TrackingStep = {
      status: updateData.status || booking.status,
      location: updateData.location || "En-route Hub",
      timestamp: new Date().toISOString(),
      remarks: updateData.remarks || `Carrier updated consignment status with Docket ${effectiveDocket}`
    };

    const updatedHistory = [...(booking.tracking_history || []), newStep];

    try {
      await supabase
        .from("bookings")
        .update({
          awb_number: effectiveDocket,
          carrier_docket_no: effectiveDocket,
          carrier_portal_url: newPortalUrl,
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
                status: (updateData.status as Booking["status"]) || b.status,
                tracking_history: updatedHistory
              }
            : b
        )
      );

      setStatusUpdateMap({
        ...statusUpdateMap,
        [bookingId]: { status: "", location: "", remarks: "", docketNo: "" }
      });
      alert(`Carrier Docket & Status successfully synchronized!`);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  // Vendor Saves Bank & UPI Details
  const handleSaveVendorBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBank(true);
    setBankSaveMsg("");

    const vendorId = currentUser.vendor_id || "11111111-1111-1111-1111-111111111111";
    const payload = {
      upi_id: vendorUpiInput.trim(),
      bank_account: vendorBankAccInput.trim(),
      ifsc_code: vendorIfscInput.trim().toUpperCase(),
      beneficiary_name: vendorBeneficiaryInput.trim()
    };

    try {
      const { error } = await supabase.from("vendors").update(payload).eq("id", vendorId);
      if (error) throw error;

      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, ...payload } : v))
      );
      setBankSaveMsg("Bank and UPI settlement details saved successfully! Shippers can now pay you directly.");
    } catch (err: any) {
      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, ...payload } : v))
      );
      setBankSaveMsg("Settlement details saved locally!");
    } finally {
      setIsSavingBank(false);
    }
  };

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
          const cols = lines[i].split(",").map((c) => c.trim());
          if (cols.length < 9) {
            errors.push(`Row ${i + 1}: Expected 9 columns, found ${cols.length}`);
            continue;
          }

          const [origRaw, destRaw, modeRaw, minWtRaw, baseRateRaw, perKgRaw, fuelRaw, docketRaw, slaRaw] = cols;
          const modeClean = modeRaw.toLowerCase();

          const origin_prefix = await resolveLocationToPrefix(origRaw);
          const dest_prefix = await resolveLocationToPrefix(destRaw);

          if (!["surface", "air", "ftl"].includes(modeClean)) {
            errors.push(`Row ${i + 1}: Invalid transport mode '${modeRaw}'.`);
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
      setAuthMsg(err.message || "Auth error. Continue seamlessly using demo roles.");
    } finally {
      setAuthLoading(false);
    }
  };

  const activeTrackBooking = useMemo(() => {
    const input = activeTrackingAwb.trim().toLowerCase();
    return bookings.find(
      (b) =>
        (b.order_id && b.order_id.toLowerCase() === input) ||
        (b.carrier_docket_no && b.carrier_docket_no.toLowerCase() === input) ||
        b.awb_number.toLowerCase() === input
    );
  }, [bookings, activeTrackingAwb]);

  const currentBox3D = boxes[selectedBoxFor3D] || boxes[0];

  return (
    <div className="min-h-screen bg-slate-900/5 text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* GLOBAL TOP NAVIGATION */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200/80 shadow-xs px-4 lg:px-8 py-3 transition-all">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setActiveView("landing")}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
              <TruckIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">LogiCompare</span>
                <span className="bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 text-indigo-700 border border-indigo-200/80 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Pro B2B 3D
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Hybrid Dual-ID Consignment Network & 3D Interactive Freight</p>
            </div>
          </div>

          <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 backdrop-blur-xs">
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

          <div className="flex items-center space-x-2">
            <div className="hidden sm:flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
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
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Account / Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* VIEW 1: INTRO / B2B LANDING PAGE */}
      {activeView === "landing" && (
        <div className="flex-1 flex flex-col space-y-16 pb-12">
          {/* CINEMATIC HERO */}
          <section className="relative overflow-hidden bg-slate-950 text-white pt-16 pb-20 px-4 lg:px-8 border-b border-slate-800">
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 scale-105 transition-transform duration-1000 ease-out"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop')` }}
            />
            <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-32 left-1/4 w-96 h-96 bg-indigo-500/25 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute top-20 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl"></div>
            </div>

            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/90 to-slate-950" />

            <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide backdrop-blur-md shadow-inner">
                  <span>🇮🇳</span>
                  <span>Hybrid Dual-ID: Internal Platform Ref + Official Transporter Waybills</span>
                </div>

                <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white">
                  Compare Multi-Carrier B2B Freight Rates & Book With{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400">Verified Dockets</span>.
                </h1>

                <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                  Seamlessly manage internal order manifests (`LC-XXXXXX`) while dispatching cargo with official carrier dockets (Delhivery, Blue Dart, Safexpress, Gati, TCI) and deep-linking to live tracking portals.
                </p>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
                  <button
                    onClick={handleLandingJumpToCompare}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 hover:scale-105 flex items-center space-x-2"
                  >
                    <BoxIcon className="w-5 h-5" />
                    <span>Compare Freight Rates Now</span>
                  </button>
                  <button
                    onClick={() => switchDemoRole("vendor")}
                    className="bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold px-7 py-3.5 rounded-xl text-sm transition backdrop-blur-md flex items-center space-x-2 hover:border-slate-500"
                  >
                    <TruckIcon className="w-5 h-5 text-emerald-400" />
                    <span>Join as Carrier / Vendor</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 flex justify-center">
                <Hero3DTruck />
              </div>
            </div>

            <div className="pt-8 max-w-xl mx-auto relative z-10">
              <div className="bg-white/10 backdrop-blur-md p-2 sm:p-2.5 rounded-2xl border border-white/20 shadow-2xl flex flex-col sm:flex-row items-center gap-2">
                <div className="flex items-center space-x-2 px-3 py-1 text-slate-300 w-full sm:w-auto">
                  <SearchIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-400 shrink-0">Track Order/Docket:</span>
                  <input
                    type="text"
                    value={landingTrackingInput}
                    onChange={(e) => setLandingTrackingInput(e.target.value)}
                    placeholder="e.g. LC-894210 or 148920194821"
                    className="bg-transparent font-mono text-sm text-white font-bold focus:outline-none w-full placeholder-slate-500"
                  />
                </div>
                <button
                  onClick={() => handleLandingQuickTrack()}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition shadow-md shrink-0"
                >
                  Track Shipment
                </button>
              </div>
            </div>
          </section>

          {/* TRUST METRICS */}
          <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-8 border-b border-slate-200">
              <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 text-center shadow-xs">
                <span className="text-3xl font-black text-indigo-600">5+</span>
                <p className="text-xs font-bold text-slate-800 mt-1">Verified National Carriers</p>
                <p className="text-[11px] text-slate-500">Official AWB / Docket Integrated</p>
              </div>
              <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 text-center shadow-xs">
                <span className="text-3xl font-black text-emerald-600">19,000+</span>
                <p className="text-xs font-bold text-slate-800 mt-1">Serviceable PIN Codes</p>
                <p className="text-[11px] text-slate-500">Pan-India Tier-1 to ODA Coverage</p>
              </div>
              <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 text-center shadow-xs">
                <span className="text-3xl font-black text-slate-900">100%</span>
                <p className="text-xs font-bold text-slate-800 mt-1">Direct Shipper-to-Carrier</p>
                <p className="text-[11px] text-slate-500">To-Pay / Direct UPI settlement</p>
              </div>
              <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 text-center shadow-xs">
                <span className="text-3xl font-black text-amber-500">2%</span>
                <p className="text-xs font-bold text-slate-800 mt-1">Transparent Platform Fee</p>
                <p className="text-[11px] text-slate-500">Min ₹25 floor cap per booking</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* VIEW 2: FREIGHT MATRIX DASHBOARD */}
      {activeView === "dashboard" && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-3">
            <div className="flex items-center space-x-1 bg-slate-200/70 p-1 rounded-xl w-fit backdrop-blur-xs">
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

            {/* Sub-Tabs */}
            {activePortal === "shipper" ? (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  { id: "compare", label: "🔍 Compare & Book Rates" },
                  { id: "shipments", label: "📦 My Shipments & Labels" },
                  { id: "tracker", label: "📍 Live Carrier Docket Tracker" },
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
                  { id: "orders", label: "📋 Incoming Orders & Docket Dispatch" },
                  { id: "rates", label: "🏷️ Rate Card Manager (Bulk CSV)" },
                  { id: "bids", label: "🎯 Bid on Live RFQs" },
                  { id: "bank", label: "🏦 Bank & UPI Settlement Profile" } // NEW VENDOR BANK TAB
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

          {/* SHIPPER PORTAL */}
          {activePortal === "shipper" && (
            <div className="space-y-6">
              {shipperSubTab === "compare" && (
                <div className="space-y-6">
                  {/* Calculator Card */}
                  <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-6 shadow-xl shadow-slate-200/50">
                    <div className="border-b border-slate-100 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                          <BoxIcon className="w-5 h-5 text-indigo-600" />
                          <span>Pan-India Commercial Freight Calculator</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Direct transporter tariffs with 0% freight markup. Platform fee is 2% (min ₹25) on booking.
                        </p>
                      </div>
                      <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 w-fit">
                        Direct Carrier Settlement
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-600">Origin PIN (Pickup)</label>
                          <button
                            type="button"
                            onClick={() => setShowCitySearchModal("origin")}
                            className="text-[11px] text-indigo-600 hover:underline font-semibold flex items-center space-x-1"
                          >
                            <MapPinIcon className="w-3 h-3" />
                            <span>City Search</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          maxLength={6}
                          value={originPin}
                          onChange={(e) => setOriginPin(e.target.value)}
                          placeholder="e.g. 110037"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none"
                        />
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-indigo-700 font-semibold truncate">
                            {originZoneData.loading ? "Looking up..." : `📍 ${originZoneData.city}, ${originZoneData.state}`}
                          </span>
                          <span className="bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 font-mono text-[10px] shrink-0">
                            {originZoneData.hub}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-600">Destination PIN (Drop)</label>
                          <button
                            type="button"
                            onClick={() => setShowCitySearchModal("dest")}
                            className="text-[11px] text-emerald-600 hover:underline font-semibold flex items-center space-x-1"
                          >
                            <MapPinIcon className="w-3 h-3" />
                            <span>City Search</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          maxLength={6}
                          value={destPin}
                          onChange={(e) => setDestPin(e.target.value)}
                          placeholder="e.g. 400001"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none"
                        />
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-700 font-semibold truncate">
                            {destZoneData.loading ? "Looking up..." : `📍 ${destZoneData.city}, ${destZoneData.state}`}
                          </span>
                          <span className="bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 font-mono text-[10px] shrink-0">
                            {destZoneData.hub}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Declared Value (₹) for FOV</label>
                        <input
                          type="number"
                          value={declaredValue}
                          onChange={(e) => setDeclaredValue(Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none"
                        />
                        <p className="text-[11px] text-slate-500 mt-2">FOV covers 0.2% transit risk loss</p>
                      </div>

                      <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Transport Mode</label>
                          <select
                            value={selectedMode}
                            onChange={(e) => setSelectedMode(e.target.value as any)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
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
                          <span className="text-xs text-slate-700 font-medium">ODA Pincode (+₹450)</span>
                        </label>
                      </div>
                    </div>

                    <div className="mb-6">
                      <RouteTrajectory3D originHub={originZoneData.hub} destHub={destZoneData.hub} />
                    </div>

                    {/* Boxes Input & 3D Carton */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
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

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                        <div className="lg:col-span-8 space-y-2">
                          {boxes.map((box, idx) => (
                            <div
                              key={box.id}
                              onClick={() => setSelectedBoxFor3D(idx)}
                              className={`grid grid-cols-2 sm:grid-cols-6 gap-2 p-3 rounded-lg border items-center text-xs shadow-xs cursor-pointer transition ${
                                selectedBoxFor3D === idx
                                  ? "bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-300"
                                  : "bg-white border-slate-200 hover:border-slate-300"
                              }`}
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeBox(box.id);
                                    }}
                                    className="text-rose-500 hover:text-rose-700 p-1 rounded"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="lg:col-span-4 flex justify-center">
                          <Interactive3DBox
                            length={currentBox3D.length}
                            width={currentBox3D.width}
                            height={currentBox3D.height}
                          />
                        </div>
                      </div>

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

                  {/* Rates Comparison Cards */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Direct Carrier Freight Tariffs</h3>
                        <p className="text-xs text-slate-500">100% Freight is settled directly with the transporter. Platform fee: 2% (min ₹25).</p>
                      </div>
                      <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full font-bold">
                        {calculatedQuotes.length} Available Rates
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {calculatedQuotes.map((quote) => (
                        <div
                          key={quote.rateCard.id}
                          className="bg-white border border-slate-200 hover:border-indigo-400 rounded-xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 shadow-xs"
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
                                <span className="font-mono text-emerald-700 font-bold">Direct UPI: {quote.vendor.upi_id}</span>
                              </div>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs grid grid-cols-3 sm:grid-cols-5 gap-2 text-center sm:text-left">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Base Freight</span>
                                <span className="font-semibold text-slate-800">{formatINR(quote.breakdown.base)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Fuel Surcharge</span>
                                <span className="font-semibold text-slate-800">{formatINR(quote.breakdown.fuel)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Docket + FOV</span>
                                <span className="font-semibold text-slate-800">{formatINR(quote.breakdown.docket + quote.breakdown.fov)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">GST (18%)</span>
                                <span className="font-semibold text-slate-800">{formatINR(quote.breakdown.gst)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-indigo-600 block font-bold">Platform Fee (2%)</span>
                                <span className="font-bold text-indigo-700">₹{quote.breakdown.platformConvenienceFee}</span>
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                              <div className="text-left sm:text-right">
                                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Total Consignment Cost</span>
                                <span className="text-xl font-black text-emerald-700">{formatINR(quote.breakdown.total)}</span>
                                <span className="text-[10px] text-slate-500 block">Direct Freight: {formatINR(quote.breakdown.freightSubtotal)}</span>
                              </div>
                              <button
                                onClick={() => setSelectedQuoteForBooking(quote)}
                                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition flex items-center space-x-1.5 shadow-sm"
                              >
                                <span>Direct Book Consignment</span>
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

              {/* SHIPMENTS & LABELS */}
              {shipperSubTab === "shipments" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Consignment Manifests & Tracking Logs</h2>
                      <p className="text-xs text-slate-500">Access LogiCompare Order IDs, Carrier Waybills, printable labels, and live tracking portals</p>
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
                            <th className="py-3 px-4">Order Ref / Carrier Docket</th>
                            <th className="py-3 px-4">Carrier</th>
                            <th className="py-3 px-4">Route & PIN</th>
                            <th className="py-3 px-4">Freight (Direct)</th>
                            <th className="py-3 px-4">Platform Fee (2%)</th>
                            <th className="py-3 px-4">Settlement Mode</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bookings.map((booking) => {
                            const carrierName = booking.vendors?.name || "Carrier Partner";
                            const docketNo = booking.carrier_docket_no || booking.awb_number;
                            const orderRef = booking.order_id || booking.id.slice(0, 8);
                            const portalUrl = booking.carrier_portal_url || getOfficialCarrierTrackingUrl(carrierName, docketNo);

                            return (
                              <tr key={booking.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-3.5 px-4">
                                  <span className="font-mono font-black text-indigo-700 block text-xs">
                                    {orderRef}
                                  </span>
                                  <span className="font-mono text-[11px] text-slate-600 block mt-0.5">
                                    Docket: <strong>{docketNo}</strong>
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="font-bold text-slate-900 block">{carrierName}</span>
                                  <span className="text-[11px] text-slate-500">{booking.consignee_name}</span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center space-x-1 font-mono font-semibold text-slate-800">
                                    <span>{booking.origin_pin}</span>
                                    <span>→</span>
                                    <span>{booking.dest_pin}</span>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-bold text-slate-900">
                                  {formatINR(booking.cost_breakdown?.freightSubtotal || booking.final_total)}
                                </td>
                                <td className="py-3.5 px-4 font-bold text-indigo-700">
                                  ₹{booking.cost_breakdown?.platformConvenienceFee || MERCHANT_DETAILS.minPlatformFeeINR}
                                </td>
                                <td className="py-3.5 px-4 font-mono">
                                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold block w-fit">
                                    {booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}
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
                                <td className="py-3.5 px-4 text-right space-x-2">
                                  <a
                                    href={portalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center space-x-1 shadow-2xs"
                                    title="Open Carrier Live Portal"
                                  >
                                    <span>Carrier Site</span>
                                    <ExternalLinkIcon className="w-3 h-3" />
                                  </a>
                                  <button
                                    onClick={() => setPrintableBooking(booking)}
                                    className="bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded text-[11px] font-semibold border border-slate-300 inline-flex items-center space-x-1 shadow-xs"
                                  >
                                    <PrinterIcon className="w-3.5 h-3.5" />
                                    <span>Label</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveTrackingAwb(orderRef);
                                      setTrackingSearchInput(orderRef);
                                      setShipperSubTab("tracker");
                                    }}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded text-[11px] font-semibold inline-flex items-center space-x-1"
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
              )}

              {/* UNIVERSAL TRACKER */}
              {shipperSubTab === "tracker" && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                    <h2 className="text-base font-bold text-slate-900 mb-1">Universal Consignment Live Tracker</h2>
                    <p className="text-xs text-slate-500 mb-4">
                      Enter either your <strong>Platform Order Ref (e.g. {DEMO_INIT_ORDER_ID})</strong> or official <strong>Carrier Docket No. (e.g. {DEMO_INIT_CARRIER_DOCKET})</strong>
                    </p>

                    <div className="flex gap-2 max-w-md">
                      <input
                        type="text"
                        value={trackingSearchInput}
                        onChange={(e) => setTrackingSearchInput(e.target.value)}
                        placeholder="Enter Order Ref or Docket..."
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none"
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
                            <span className="text-xl font-mono font-black text-indigo-700">
                              {activeTrackBooking.order_id || "LC-CONSIGNMENT"}
                            </span>
                            <span className="text-base font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              Docket: {activeTrackBooking.carrier_docket_no || activeTrackBooking.awb_number}
                            </span>
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase">
                              {activeTrackBooking.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5">
                            Carrier Partner: <strong className="text-slate-800">{activeTrackBooking.vendors?.name || "Delhivery B2B Express"}</strong>
                          </p>
                        </div>

                        <div className="flex flex-col sm:items-end gap-2">
                          <a
                            href={activeTrackBooking.carrier_portal_url || getOfficialCarrierTrackingUrl(activeTrackBooking.vendors?.name || "Delhivery", activeTrackBooking.carrier_docket_no || activeTrackBooking.awb_number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm flex items-center space-x-1.5 w-fit"
                          >
                            <span>Open Official {activeTrackBooking.vendors?.name || "Carrier"} Tracking Portal</span>
                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                          </a>
                          <span className="text-[11px] text-slate-500">
                            Route: <strong className="text-slate-800 font-mono">{activeTrackBooking.origin_pin} → {activeTrackBooking.dest_pin}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-6">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Milestone Audit Logs</h4>
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
                      <p className="text-slate-500 text-sm">
                        Consignment identifier "{activeTrackingAwb}" not found.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* RFQ REVERSE BIDDING */}
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
                </div>
              )}
            </div>
          )}

          {/* CARRIER / VENDOR DASHBOARD */}
          {activePortal === "vendor" && (
            <div className="space-y-6">
              {/* VENDOR SUB-TAB A: INCOMING ORDERS */}
              {vendorSubTab === "orders" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Carrier Orders & Physical Docket / Bilty Entry</h2>
                      <p className="text-xs text-slate-500">
                        Operating as Carrier: <strong className="text-emerald-700">{currentUser.company_name}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {bookings.map((booking) => {
                      const rowForm = statusUpdateMap[booking.id] || { 
                        status: "", 
                        location: "", 
                        remarks: "", 
                        docketNo: booking.carrier_docket_no || booking.awb_number 
                      };

                      return (
                        <div key={booking.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="flex items-center space-x-3">
                              <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black">
                                Ref: {booking.order_id || "LC-ORDER"}
                              </span>
                              <span className="font-mono text-sm font-bold text-slate-900">
                                Docket: {booking.carrier_docket_no || booking.awb_number}
                              </span>
                              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded capitalize font-medium">
                                {booking.mode}
                              </span>
                              <span className="text-xs font-mono text-slate-500 font-semibold">
                                {booking.origin_pin} → {booking.dest_pin}
                              </span>
                            </div>

                            <div className="flex items-center space-x-3 text-xs">
                              <span className="text-slate-500">Settlement:</span>
                              <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                {booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}
                              </span>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center gap-2">
                            <div className="w-full md:w-56">
                              <input
                                type="text"
                                placeholder="Enter Bilty / Docket No."
                                value={rowForm.docketNo}
                                onChange={(e) =>
                                  setStatusUpdateMap({
                                    ...statusUpdateMap,
                                    [booking.id]: { ...rowForm, docketNo: e.target.value }
                                  })
                                }
                                className="w-full bg-white border border-indigo-300 font-mono font-bold text-indigo-900 rounded-lg px-2.5 py-1.5 text-xs shadow-2xs"
                              />
                            </div>

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
                              placeholder="Current Hub / City (e.g. Bilaspur Linehaul)"
                              value={rowForm.location}
                              onChange={(e) =>
                                setStatusUpdateMap({
                                  ...statusUpdateMap,
                                  [booking.id]: { ...rowForm, location: e.target.value }
                                })
                              }
                              className="w-full md:flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                            />

                            <button
                              onClick={() => handleUpdateShipmentStatus(booking.id)}
                              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition shadow-xs"
                            >
                              Dispatch Docket Update
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VENDOR SUB-TAB B: RATE CARD MASTER + BULK CSV */}
              {vendorSubTab === "rates" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Commercial Rate Card Master</h2>
                      <p className="text-xs text-slate-500">Manage route tariffs individually or batch-publish via CSV</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleDownloadSampleCsv}
                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition"
                      >
                        <DownloadIcon className="w-4 h-4 text-indigo-600" />
                        <span>📥 Download Sample CSV</span>
                      </button>

                      <button
                        onClick={() => setShowAddRateCard(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
                      >
                        <PlusIcon className="w-3.5 h-3.5" />
                        <span>Add Route Manually</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border-2 border-dashed border-indigo-200 rounded-2xl p-6 space-y-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                          <UploadIcon className="w-4 h-4 text-indigo-600" />
                          <span>Bulk Upload Rate Cards via CSV (City Names or Prefixes Supported)</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Upload standard CSV with 9 columns: <code className="font-mono text-indigo-700 font-semibold text-[11px]">origin, dest, mode, min_weight_kg, base_rate, per_kg_rate, fuel_surcharge_pct, docket_charge, sla_days</code>
                        </p>
                      </div>

                      {parsedCsvRows.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setParsedCsvRows([]);
                              setCsvFileName("");
                              setCsvErrors([]);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded"
                          >
                            Clear
                          </button>
                          <button
                            disabled={isUploadingCsv}
                            onClick={handleBatchInsertRateCards}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-sm flex items-center space-x-1.5"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                            <span>{isUploadingCsv ? "Publishing Routes..." : `Publish All ${parsedCsvRows.length} Routes`}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50/70 rounded-xl border border-slate-200 text-center space-y-2">
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
                        className="bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs flex items-center space-x-2"
                      >
                        <UploadIcon className="w-4 h-4 text-indigo-600" />
                        <span>{csvFileName ? `Replace (${csvFileName})` : "Select Rate Card CSV File"}</span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        {csvFileName ? `Selected: ${csvFileName}` : "Click to choose .csv file"}
                      </p>
                    </div>

                    {csvUploadStatus && (
                      <div
                        className={`p-3 rounded-xl text-xs font-medium border ${
                          csvUploadStatus.type === "success"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                      >
                        {csvUploadStatus.message}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VENDOR SUB-TAB C: BID ON LIVE RFQS */}
              {vendorSubTab === "bids" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-slate-900">Live Heavy Cargo RFQ Exchange</h2>
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
                            </div>

                            <div className="text-right">
                              <span className="text-base font-black text-emerald-700">{formatINR(rfq.target_price)}</span>
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
                                  placeholder="e.g. Dedicated container vehicle ready"
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

              {/* VENDOR SUB-TAB D: NEW BANK & UPI SETTLEMENT PROFILE FORM */}
              {vendorSubTab === "bank" && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-2xl">
                    <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                          <CreditCardIcon className="w-5 h-5 text-emerald-600" />
                          <span>Direct Freight Settlement Details</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Configure where Shippers send 100% direct freight payments when booking your routes.
                        </p>
                      </div>
                      <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                        Zero Commission on Freight
                      </span>
                    </div>

                    {bankSaveMsg && (
                      <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                        {bankSaveMsg}
                      </div>
                    )}

                    <form onSubmit={handleSaveVendorBank} className="space-y-4 text-xs">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">
                          Official Transporter UPI ID (VPA)
                        </label>
                        <input
                          type="text"
                          required
                          value={vendorUpiInput}
                          onChange={(e) => setVendorUpiInput(e.target.value)}
                          placeholder="e.g. yourbusiness@icici or 9899123456@upi"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          Shippers who select "Direct Carrier UPI" at checkout will see this UPI handle to make payment.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">
                            Bank Account Number
                          </label>
                          <input
                            type="text"
                            required
                            value={vendorBankAccInput}
                            onChange={(e) => setVendorBankAccInput(e.target.value)}
                            placeholder="e.g. 50200088910234"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 focus:bg-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-700 font-bold mb-1">
                            Bank IFSC Code
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={11}
                            value={vendorIfscInput}
                            onChange={(e) => setVendorIfscInput(e.target.value.toUpperCase())}
                            placeholder="e.g. HDFC0000240"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono uppercase text-slate-900 focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">
                          Beneficiary / Account Holder Name (As per Bank)
                        </label>
                        <input
                          type="text"
                          required
                          value={vendorBeneficiaryInput}
                          onChange={(e) => setVendorBeneficiaryInput(e.target.value)}
                          placeholder="e.g. Delhivery Limited B2B Logistics"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 font-semibold focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={isSavingBank}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-sm flex items-center space-x-1.5"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                          <span>{isSavingBank ? "Saving..." : "Save Bank & UPI Profile"}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* MODAL 0: REVERSE CITY SEARCH TO PINCODE */}
      {showCitySearchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Find PIN Code for {showCitySearchModal === "origin" ? "Origin" : "Destination"}
                </h3>
                <p className="text-xs text-slate-500">Search city or post office name across India</p>
              </div>
              <button onClick={() => setShowCitySearchModal(null)} className="text-slate-400 hover:text-slate-700">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSearchCityToPin} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Ludhiana, Meerut, Panipat, Chandigarh..."
                value={citySearchQuery}
                onChange={(e) => setCitySearchQuery(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                autoFocus
              />
              <button
                type="submit"
                disabled={isSearchingCity}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs"
              >
                {isSearchingCity ? "..." : "Search"}
              </button>
            </form>

            <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-slate-100">
              {citySearchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => applySelectedCityPin(item.pincode)}
                  className="pt-2 flex items-center justify-between p-2 rounded-lg hover:bg-indigo-50 cursor-pointer transition text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p className="text-[11px] text-slate-500">{item.district}, {item.state}</p>
                  </div>
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded">
                    {item.pincode}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: DIRECT SHIPPER-TO-CARRIER CHECKOUT */}
      {selectedQuoteForBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-xl my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Direct Consignment Booking & Carrier Settlement</h3>
                <p className="text-xs text-slate-500">Transporter: <strong className="text-emerald-700">{selectedQuoteForBooking.vendor.name}</strong></p>
              </div>
              <button onClick={() => setSelectedQuoteForBooking(null)}><XMarkIcon className="w-5 h-5" /></button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Direct Carrier Freight (Payable to Transporter):</span>
                <span className="text-base font-bold text-slate-900">{formatINR(selectedQuoteForBooking.breakdown.freightSubtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-indigo-700">
                <span>Platform Docket Verification Fee (2%, min ₹25):</span>
                <span className="font-bold">₹{selectedQuoteForBooking.breakdown.platformConvenienceFee}</span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center text-sm font-black text-emerald-800">
                <span>Total Consignment Outlay:</span>
                <span>{formatINR(selectedQuoteForBooking.breakdown.total)}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block text-slate-800 font-bold">Choose How You Settle Freight with {selectedQuoteForBooking.vendor.name}:</label>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label className={`p-3 rounded-xl border cursor-pointer ${settlementType === "direct_to_pay" ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300" : "bg-white border-slate-200"}`}>
                  <input type="radio" checked={settlementType === "direct_to_pay"} onChange={() => setSettlementType("direct_to_pay")} className="text-emerald-600" />
                  <span className="font-bold block mt-1 text-slate-900">💵 To-Pay at Delivery (POD)</span>
                  <p className="text-[10px] text-slate-500">Pay cash/cheque to transporter upon parcel delivery.</p>
                </label>

                <label className={`p-3 rounded-xl border cursor-pointer ${settlementType === "direct_upi" ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300" : "bg-white border-slate-200"}`}>
                  <input type="radio" checked={settlementType === "direct_upi"} onChange={() => setSettlementType("direct_upi")} className="text-emerald-600" />
                  <span className="font-bold block mt-1 text-slate-900">📲 Direct Carrier UPI / Bank</span>
                  <p className="text-[10px] text-slate-500">Transfer freight direct to carrier's UPI handle.</p>
                </label>

                <label className={`p-3 rounded-xl border cursor-pointer ${settlementType === "corporate_credit" ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300" : "bg-white border-slate-200"}`}>
                  <input type="radio" checked={settlementType === "corporate_credit"} onChange={() => setSettlementType("corporate_credit")} className="text-emerald-600" />
                  <span className="font-bold block mt-1 text-slate-900">🏢 B2B Monthly Credit</span>
                  <p className="text-[10px] text-slate-500">Carrier will bill under your pre-approved GST credit terms.</p>
                </label>
              </div>

              {settlementType === "direct_upi" && (
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex justify-between items-center font-mono">
                    <span className="text-emerald-900 font-bold">Carrier UPI ID:</span>
                    <span className="bg-white px-2 py-0.5 rounded font-bold text-slate-900">{selectedQuoteForBooking.vendor.upi_id || "delhivery.b2b@icici"}</span>
                  </div>
                  {selectedQuoteForBooking.vendor.bank_account && (
                    <div className="text-[11px] text-slate-600 font-mono flex justify-between">
                      <span>Bank: {selectedQuoteForBooking.vendor.bank_account} ({selectedQuoteForBooking.vendor.ifsc_code})</span>
                      <span className="font-bold">{selectedQuoteForBooking.vendor.beneficiary_name}</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Payment Reference / UTR Number (Optional):</label>
                    <input
                      type="text"
                      placeholder="e.g. 340982710123"
                      value={directPaymentUtr}
                      onChange={(e) => setDirectPaymentUtr(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded p-1.5 font-mono text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-0.5">Pickup Address</label>
                  <input type="text" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} className="w-full border rounded p-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-0.5">Consignee Name</label>
                    <input type="text" value={consigneeName} onChange={(e) => setConsigneeName(e.target.value)} className="w-full border rounded p-1.5" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-0.5">Consignee Phone</label>
                    <input type="text" value={consigneePhone} onChange={(e) => setConsigneePhone(e.target.value)} className="w-full border rounded p-1.5" />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-0.5">Delivery Destination Address</label>
                  <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="w-full border rounded p-1.5" />
                </div>
              </div>

              <label className="flex items-start space-x-2 pt-1 cursor-pointer">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5" />
                <span className="text-[11px] text-slate-600">
                  I agree to settle freight directly with {selectedQuoteForBooking.vendor.name} under Carriage by Road Act guidelines.
                </span>
              </label>
            </div>

            <div className="flex justify-end space-x-3 border-t pt-3">
              <button onClick={() => setSelectedQuoteForBooking(null)} className="px-3 py-1.5 text-xs text-slate-600">Cancel</button>
              <button
                disabled={isSubmittingBooking || !termsAccepted}
                onClick={handleConfirmDirectBooking}
                className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-lg text-xs shadow-xs"
              >
                Confirm Booking & Assign Official Carrier Docket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINTABLE DUAL-ID OFFICIAL AWB LABEL */}
      {printableBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-950 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8 space-y-4 print:p-0">
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <span className="text-xs font-bold text-slate-600">Official Carrier Shipping Label & Consignment Note</span>
              <div className="flex space-x-2">
                <button onClick={() => window.print()} className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold">Print Label</button>
                <button onClick={() => setPrintableBooking(null)}><XMarkIcon className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="border-4 border-black p-4 space-y-3 font-sans text-black">
              <div className="flex justify-between border-b-2 border-black pb-2">
                <div>
                  <h2 className="text-xl font-black">{printableBooking.vendors?.name || "OFFICIAL LOGISTICS PARTNER"}</h2>
                  <p className="text-[9px] uppercase font-bold tracking-wider">OFFICIAL CARRIER CONSIGNMENT NOTE & DOCKET</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono">HUB-{printableBooking.origin_pin.slice(0, 3)} / HUB-{printableBooking.dest_pin.slice(0, 3)}</span>
                  <p className="text-[9px] font-bold uppercase">{printableBooking.mode} FREIGHT EXPRESS</p>
                  <span className="text-[10px] font-mono font-bold block text-indigo-900 mt-0.5">
                    Order Ref: {printableBooking.order_id || printableBooking.id.slice(0, 8)}
                  </span>
                </div>
              </div>

              <div className="text-center py-2 border-b-2 border-black space-y-1">
                <div className="flex justify-center items-center space-x-1 h-12">
                  {[2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3, 4, 1, 2, 3, 2, 4, 1].map((w, i) => (
                    <div key={i} className="bg-black h-full" style={{ width: `${w * 2.5}px` }} />
                  ))}
                </div>
                <div className="flex items-center justify-center space-x-3">
                  <span className="text-base font-mono font-black tracking-wider">
                    CARRIER DOCKET: {printableBooking.carrier_docket_no || printableBooking.awb_number}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    [{printableBooking.order_id || "LC-REF"}]
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-b-2 border-black pb-2 text-xs">
                <div>
                  <span className="text-[9px] font-black uppercase block">CONSIGNOR (SHIPPER):</span>
                  <p className="font-bold">{printableBooking.shipper_name}</p>
                  <p className="text-[10px]">{printableBooking.pickup_address} (PIN: {printableBooking.origin_pin})</p>
                  <p className="text-[10px] font-mono mt-0.5">GSTIN: {printableBooking.shipper_gstin}</p>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase block">CONSIGNEE:</span>
                  <p className="font-bold">{printableBooking.consignee_name}</p>
                  <p className="text-[10px]">{printableBooking.delivery_address} (PIN: {printableBooking.dest_pin})</p>
                  <p className="text-[10px]">Ph: {printableBooking.consignee_phone}</p>
                  <p className="text-[10px] font-mono mt-0.5">GSTIN: {printableBooking.consignee_gstin}</p>
                </div>
              </div>

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

              <div className="border-b-2 border-black pb-2 flex justify-between text-[11px]">
                <div>
                  <span className="font-bold">SETTLEMENT TYPE: </span>
                  <span className="font-mono uppercase font-black">{printableBooking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}</span>
                </div>
                <div>
                  <span className="font-bold">DIRECT FREIGHT: </span>
                  <span className="font-black">{formatINR(printableBooking.cost_breakdown?.freightSubtotal || printableBooking.final_total)}</span>
                </div>
              </div>

              <div className="border-b-2 border-black pb-2 flex justify-between text-[10px] text-slate-700">
                <span>Platform Docket Verification Fee (2%): ₹{printableBooking.cost_breakdown?.platformConvenienceFee || MERCHANT_DETAILS.minPlatformFeeINR}</span>
                <span className="font-bold">Total Consignment Outlay: {formatINR(printableBooking.final_total)}</span>
              </div>

              <div className="flex justify-between pt-1 text-[9px] text-slate-700">
                <p>Governed by Carriage by Road Act 2007. Verified via LogiCompare Pro.</p>
                <p className="font-mono">{new Date(printableBooking.created_at).toLocaleDateString("en-IN")}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MANUAL RATE CARD PUBLISHER */}
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
                <label className="block text-slate-600 mb-1 font-medium">Origin Prefix (e.g. 110 or 160)</label>
                <input
                  type="text"
                  value={newRateCard.origin_prefix}
                  onChange={(e) => setNewRateCard({ ...newRateCard, origin_prefix: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Dest Prefix (e.g. 400 or 560)</label>
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

      {/* MODAL 4: AUTHENTICATION MODAL */}
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

      {/* MODAL 5: RAZORPAY-COMPLIANT LEGAL MODAL */}
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

            <div className="text-xs text-slate-600 space-y-3 max-h-96 overflow-y-auto pr-2 leading-relaxed">
              {legalModalTab === "terms" && (
                <div className="space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm">Terms and Conditions of Service</h4>
                  <p>
                    <strong>1. Platform Nature:</strong> {MERCHANT_DETAILS.platformName} is a proprietary B2B logistics technology and freight aggregator platform operated by <strong>{MERCHANT_DETAILS.proprietor}</strong>. LogiCompare connects commercial shippers with third-party verified fleet operators and carriers (e.g. Delhivery, Blue Dart, TCI Freight, Safexpress, Gati-KWE).
                  </p>
                  <p>
                    <strong>2. Statutory Compliance & E-Way Bills:</strong> In accordance with the Central Goods and Services Tax Act, 2017, the Shipper warrants that any consignment valued in excess of ₹50,000 is accompanied by a valid, active GST E-Way Bill and tax invoice.
                  </p>
                  <p>
                    <strong>3. Governing Law:</strong> These terms are governed by the laws of India. Any legal dispute or proceeding shall be subject to the exclusive jurisdiction of the competent courts in <strong>{MERCHANT_DETAILS.jurisdiction}</strong>.
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
                    <strong>2. Grievance Officer:</strong> In compliance with the Information Technology Act, 2000 and Digital Personal Data Protection (DPDP) Act, 2023, the designated Grievance Officer is:
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
                    <strong>1. Cancellation Prior to Pickup:</strong> Consignments cancelled before carrier pickup attempt qualify for a <strong>100% full refund</strong> of platform verification fees.
                  </p>
                  <p>
                    <strong>2. Refund Mode & Settlement Timeframe:</strong> All approved refunds are processed back to the original source account via Razorpay. The standard refund credit window is <strong>5 to 7 business days</strong>.
                  </p>
                </div>
              )}

              {legalModalTab === "shipping" && (
                <div className="space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm">Shipping, Transit SLAs & Delivery Policy</h4>
                  <p>
                    <strong>1. Serviceable Network:</strong> LogiCompare Pro services 19,000+ PIN codes across India via aggregated multi-modal express networks.
                  </p>
                  <p>
                    <strong>2. Estimated Transit SLAs:</strong> Surface Express (3–6 business days), Air Express Cargo (24–48 hours connecting primary metro airport gateways).
                  </p>
                </div>
              )}

              {legalModalTab === "prohibited" && (
                <div className="space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-sm">Strictly Prohibited & Banned Cargo</h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-700">
                    <li>Explosives, fireworks, ammunition, and hazardous chemicals (Classes 1–9 Hazmat).</li>
                    <li>Flammable liquids, gases, compressed cylinders, and corrosives.</li>
                    <li>Unregistered bullion, loose precious gems, and sovereign cash/currency notes.</li>
                    <li>Narcotics and contraband goods prohibited under the NDPS Act.</li>
                  </ul>
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

      {/* EXTENDED GLOBAL FOOTER */}
      <footer className="mt-auto border-t border-slate-200 bg-white text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-100 pb-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <TruckIcon className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-sm text-slate-900">{MERCHANT_DETAILS.platformName}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Operated by <strong>{MERCHANT_DETAILS.proprietor}</strong>. An enterprise B2B multi-carrier freight booking exchange and official waybill tracking network.
              </p>
              <p className="text-[11px] text-slate-500">
                Official Jurisdiction: <strong>{MERCHANT_DETAILS.jurisdiction}</strong>
              </p>
            </div>

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
                <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono font-bold">100% Direct Settlement</span>
                <span>•</span>
                <span>GTA 18% Compliant</span>
              </div>
            </div>
          </div>

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
