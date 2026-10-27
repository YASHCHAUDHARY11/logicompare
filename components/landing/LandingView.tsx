
"use client";

import React, { useState } from "react";
import { Vendor } from "@/types/freight";
import { Hero3DTruck } from "@/components/visuals/Hero3DTruck";
import {
  BoxIcon,
  TruckIcon,
  LayersIcon,
  CurrencyRupeeIcon,
  ShieldCheckIcon,
  PrinterIcon,
  CreditCardIcon,
  ChevronDownIcon,
  SearchIcon
} from "@/components/icons";

interface LandingViewProps {
  highVolumeMode: boolean;
  vendors: Vendor[];
  landingTrackingInput: string;
  setLandingTrackingInput: (val: string) => void;
  onQuickTrack: (val?: string) => void;
  onJumpToCompare: () => void;
  onJumpToBulk: () => void;
  onSwitchCarrierDemo: () => void;
}

export function LandingView({
  highVolumeMode,
  vendors,
  landingTrackingInput,
  setLandingTrackingInput,
  onQuickTrack,
  onJumpToCompare,
  onJumpToBulk,
  onSwitchCarrierDemo
}: LandingViewProps) {
  const [workflowTab, setWorkflowTab] = useState<"shipper" | "vendor">("shipper");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="flex-1 flex flex-col space-y-16 pb-12">
      {/* SECTION 1: CINEMATIC HERO */}
      <section className="relative overflow-hidden bg-slate-950 text-white pt-16 pb-20 px-4 lg:px-8 border-b border-slate-800">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 scale-105 transition-transform duration-1000 ease-out"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop')` }}
        />
        <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/90 to-slate-950" />

        <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide backdrop-blur-md shadow-inner">
              <span>🇮🇳</span>
              <span>Hybrid Dual-ID: Internal Platform Ref + Official Transporter Waybills</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white">
              Compare Multi-Carrier B2B Freight Rates & Book With{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400">
                Verified Dockets
              </span>.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
              Seamlessly manage internal order manifests while dispatching cargo with official carrier dockets (Delhivery, Blue Dart, Safexpress, Gati, TCI) and deep-linking to live tracking portals.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                onClick={onJumpToBulk}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 hover:scale-105 flex items-center space-x-2"
              >
                <BoxIcon className="w-5 h-5" />
                <span>Launch 50/Day Bulk Shipper Console</span>
              </button>
              <button
                onClick={onJumpToCompare}
                className="bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold px-7 py-3.5 rounded-xl text-sm transition backdrop-blur-md flex items-center space-x-2"
              >
                <span>Single Calculator</span>
              </button>
              <button
                onClick={onSwitchCarrierDemo}
                className="bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold px-7 py-3.5 rounded-xl text-sm transition backdrop-blur-md flex items-center space-x-2 hover:border-slate-500"
              >
                <TruckIcon className="w-5 h-5 text-emerald-400" />
                <span>Join as Carrier</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            {!highVolumeMode ? (
              <Hero3DTruck />
            ) : (
              <div className="bg-slate-900/90 border border-indigo-500/30 p-8 rounded-3xl text-center space-y-3">
                <span className="text-4xl">⚡</span>
                <h3 className="text-white font-bold text-base">High-Volume Mode Active</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  3D canvas paused to eliminate GPU overhead for 50+ consignments/day dispatchers.
                </p>
              </div>
            )}
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
              onClick={() => onQuickTrack()}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition shadow-md shrink-0"
            >
              Track Shipment
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: TRUST METRICS & CARRIER STRIP */}
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

        <div className="pt-8 text-center space-y-4">
          <span className="text-xs uppercase font-bold text-slate-500 tracking-widest block">
            Official Multi-Carrier Logistics Integration & Tracking
          </span>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-1">
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

      {/* SECTION 3: INTERACTIVE "HOW IT WORKS" WORKFLOW */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
            Interactive Operational Workflow
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">How LogiCompare Pro Works</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Consolidating platform transparency with real-world carrier waybill standards.
          </p>

          <div className="inline-flex p-1 bg-slate-200/70 rounded-xl mt-4">
            <button
              onClick={() => setWorkflowTab("shipper")}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition ${
                workflowTab === "shipper" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
              }`}
            >
              📦 For Shippers & Businesses
            </button>
            <button
              onClick={() => setWorkflowTab("vendor")}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition ${
                workflowTab === "vendor" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
              }`}
            >
              🚛 For Logistics Vendors & Carriers
            </button>
          </div>
        </div>

        {workflowTab === "shipper" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">1</span>
              <h3 className="font-bold text-slate-900 text-sm">Bulk CSV or Single PIN</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Enter single PINs or drop a 50-location CSV with multi-box weights (e.g. 25; 10; 10) and optional dimensions.
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">2</span>
              <h3 className="font-bold text-slate-900 text-sm">Compare Carrier Rates</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Inspect transparent line-item pricing: Base Freight, Fuel %, Docket Fee, ODA Surcharge, 0.2% FOV Insurance, and 18% GST.
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">3</span>
              <h3 className="font-bold text-slate-900 text-sm">One-Click Dual-ID Booking</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Settle freight direct with carrier. Get your official Platform Ref + Carrier Waybill and print continuous 4x6 labels.
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">4</span>
              <h3 className="font-bold text-slate-900 text-sm">Live Carrier Tracking</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Track status with either ID on LogiCompare or click the direct portal button (↗) to view live scans on carrier portals.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">1</span>
              <h3 className="font-bold text-slate-900 text-sm">Onboard Carrier & GSTIN</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Register as a verified transporter, enter GSTIN credentials, and link your direct UPI ID and bank account.
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">2</span>
              <h3 className="font-bold text-slate-900 text-sm">Publish Rates via Bulk CSV</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Define lane-specific tariffs individually or upload entire route sheets with city names via client-cached bulk CSV.
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">3</span>
              <h3 className="font-bold text-slate-900 text-sm">Update Official Bilty Scan</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Receive bookings, enter your branch's physical Bilty/Docket number, attach photos/PDF scans, and collect direct settlements.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4: 6-CARD CORE FEATURES */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
            Enterprise Features
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Engineered for Indian Logistics Complexity</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Direct transporter settlements combined with official carrier tracking APIs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <LayersIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Multi-Box Volumetric Engine</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Automatically calculates actual weight vs. volumetric weight across multiple box sizes. Supports IATA Air divisor (5000) and Indian Surface Express divisor (4500).
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CurrencyRupeeIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Zero Hidden Surcharges</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Transparent breakdown of all statutory logistics fees: Base freight, Fuel Surcharge %, Docket AWB charge, Handling per kg, ODA fee, and 18% GST.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">FOV Cargo Risk Insurance</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Built-in 0.20% Freight On Value (FOV) risk coverage calculator ensuring high-value electronic and pharmaceutical shipments are protected against transit damages.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <PrinterIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Carrier-Certified Consignment Notes</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Print official carrier labels showing the Transporter's official Waybill number, destination routing hub codes, package counts, and GSTINs.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TruckIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Official Tracking Deep-Links</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Direct redirection to official carrier portals (Delhivery, Blue Dart, Safexpress, Gati, TCI) for real-time driver scans and delivery proof.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
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

      {/* SECTION 5: FAQ ACCORDION */}
      <section className="max-w-4xl mx-auto px-4 lg:px-8 w-full space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
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
              a: "Documents are stored in a dedicated Supabase Object Storage bucket with a 5 MB file size limit. Images are compressed client-side to ~100KB to prevent storage exhaustion while preserving full legibility."
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
            <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs transition">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 text-left font-bold text-sm text-slate-900 flex items-center justify-between hover:bg-slate-50"
              >
                <span>{faq.q}</span>
                <ChevronDownIcon className={`w-4 h-4 text-slate-500 transition-transform ${openFaq === idx ? "rotate-180 text-indigo-600" : ""}`} />
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

      {/* SECTION 6: BOTTOM CTA BANNER */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 w-full">
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 rounded-3xl p-8 sm:p-14 text-white text-center space-y-6 shadow-2xl border border-indigo-500/20">
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
              onClick={onJumpToBulk}
              className="bg-white hover:bg-slate-100 text-slate-950 font-extrabold px-7 py-3 rounded-xl text-sm transition shadow-lg hover:scale-105"
            >
              Open Bulk Shipper Console
            </button>
            <button
              onClick={onJumpToCompare}
              className="bg-indigo-600/80 hover:bg-indigo-600 text-white border border-indigo-400/30 font-bold px-7 py-3 rounded-xl text-sm transition backdrop-blur-md"
            >
              Single Freight Calculator
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
