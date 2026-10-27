"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BoxItem, Vendor, RateCard, CalculatedQuote, Booking, BulkManifestRow, RfqBid, UserProfile, PinLookupResult } from "@/types/freight";
import { MERCHANT_DETAILS, DEMO_INIT_ORDER_ID, DEMO_INIT_CARRIER_DOCKET, DEMO_SHIPPER, DEMO_VENDOR, FALLBACK_VENDORS, FALLBACK_DEFAULT_RATE_CARDS } from "@/lib/constants";
import { formatINR, getLocalFallbackZone, generateCarrierDocket, getOfficialCarrierTrackingUrl, calculateQuotesForShipment, compressImageFile } from "@/lib/freightUtils";

// Layout & View Components
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BulkCsvTab } from "@/components/shipper/BulkCsvTab";
import { ThermalPrintModal } from "@/components/modals/ThermalPrintModal";
import { Hero3DTruck } from "@/components/visuals/Hero3DTruck";
import { Interactive3DBox } from "@/components/visuals/Interactive3DBox";
import { RouteTrajectory3D } from "@/components/visuals/RouteTrajectory3D";

// Icons
import { BoxIcon, TruckIcon, PlaneIcon, SearchIcon, PlusIcon, TrashIcon, ArrowRightIcon, CheckCircleIcon, XMarkIcon, PrinterIcon, MapPinIcon, DocumentIcon, ExternalLinkIcon, DownloadIcon, UploadIcon } from "@/components/icons";

export default function LogiComparePro() {
  const [activeView, setActiveView] = useState<"landing" | "dashboard">("landing");
  const [landingWorkflowTab, setLandingWorkflowTab] = useState<"shipper" | "vendor">("shipper");
  const [landingTrackingInput, setLandingTrackingInput] = useState(DEMO_INIT_ORDER_ID);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // High-Volume Mode Toggle
  const [highVolumeMode, setHighVolumeMode] = useState<boolean>(true);

  // User Profile
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_SHIPPER);
  const [activePortal, setActivePortal] = useState<"shipper" | "vendor">("shipper");
  const [shipperSubTab, setShipperSubTab] = useState<"bulk" | "compare" | "shipments" | "tracker" | "rfq">("bulk");
  const [vendorSubTab, setVendorSubTab] = useState<"orders" | "rates" | "bids" | "bank">("orders");

  // State: Data masters
  const [rateCards, setRateCards] = useState<RateCard[]>(FALLBACK_DEFAULT_RATE_CARDS);
  const [vendors, setVendors] = useState<Vendor[]>(FALLBACK_VENDORS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rfqList, setRfqList] = useState<RfqBid[]>([]);

  // Modals
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<"terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact">("terms");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [printableBooking, setPrintableBooking] = useState<Booking | null>(null);
  const [batchPrintBookings, setBatchPrintBookings] = useState<Booking[] | null>(null);

  // Single ad-hoc shipment state
  const [originPin, setOriginPin] = useState(MERCHANT_DETAILS.defaultOriginPin);
  const [destPin, setDestPin] = useState("400001");
  const [isOda, setIsOda] = useState(false);
  const [declaredValue, setDeclaredValue] = useState<number>(75000);
  const [selectedMode, setSelectedMode] = useState<"all" | "surface" | "air" | "ftl">("all");
  const [boxes, setBoxes] = useState<BoxItem[]>([
    { id: "box-1", qty: 2, weight: 20, length: 45, width: 35, height: 30 },
    { id: "box-2", qty: 1, weight: 15, length: 30, width: 30, height: 25 }
  ]);
  const [selectedBoxFor3D, setSelectedBoxFor3D] = useState<number>(0);
  const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<CalculatedQuote | null>(null);
  const [settlementType, setSettlementType] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");
  const [directPaymentUtr, setDirectPaymentUtr] = useState("");
  const [pickupAddress, setPickupAddress] = useState(MERCHANT_DETAILS.defaultWarehouseAddress);
  const [consigneeName, setConsigneeName] = useState("Prime Electronics Retail");
  const [consigneePhone, setConsigneePhone] = useState("+91 98200 44556");
  const [consigneeGstin, setConsigneeGstin] = useState("27AAACP9988G1ZK");
  const [deliveryAddress, setDeliveryAddress] = useState("Warehouse 4B, Bhiwandi Logistics Park, Mumbai");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Bulk CSV state
  const [bulkManifestList, setBulkManifestList] = useState<BulkManifestRow[]>([]);
  const [bulkCsvFileName, setBulkCsvFileName] = useState("");
  const [bulkUploadError, setBulkUploadError] = useState("");
  const [bulkSettlementMethod, setBulkSettlementMethod] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");
  const [bulkConsolidatedUtr, setBulkConsolidatedUtr] = useState("");
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Tracking tab state
  const [activeTrackingAwb, setActiveTrackingAwb] = useState(DEMO_INIT_ORDER_ID);
  const [trackingSearchInput, setTrackingSearchInput] = useState(DEMO_INIT_ORDER_ID);

  // Zone Lookups
  const [originZoneData, setOriginZoneData] = useState<PinLookupResult>({ city: "South West Delhi", state: "Delhi", hub: "DEL-SOUTH-HUB", loading: false });
  const [destZoneData, setDestZoneData] = useState<PinLookupResult>({ city: "Mumbai", state: "Maharashtra", hub: "BOM-CENTRAL", loading: false });

  // Carrier ops state
  const [statusUpdateMap, setStatusUpdateMap] = useState<Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>>({});
  const [vendorUpiInput, setVendorUpiInput] = useState("delhivery.b2b@icici");
  const [vendorBankAccInput, setVendorBankAccInput] = useState("50200088910234");
  const [vendorIfscInput, setVendorIfscInput] = useState("HDFC0000240");
  const [vendorBeneficiaryInput, setVendorBeneficiaryInput] = useState("Delhivery Limited B2B Logistics");
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankSaveMsg, setBankSaveMsg] = useState("");

  // Lock default warehouse if High Volume Mode is on
  useEffect(() => {
    if (highVolumeMode) {
      setOriginPin(MERCHANT_DETAILS.defaultOriginPin);
      setPickupAddress(MERCHANT_DETAILS.defaultWarehouseAddress);
    }
  }, [highVolumeMode]);

  // Session mount check
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
          if (pData) {
            const realProfile: UserProfile = { ...(pData as UserProfile), isRealUser: true };
            setCurrentUser(realProfile);
            setActivePortal(realProfile.role);
          }
        }
      } catch (err) {
        console.warn("Session check fallback:", err);
      }
    };
    checkUserSession();
  }, []);

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

  // Demo switchers & authentication
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignored
    }
    setCurrentUser(DEMO_SHIPPER);
    setActivePortal("shipper");
    setActiveView("landing");
  };

  // Bulk CSV Handlers
  const handleBulkCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkCsvFileName(file.name);
    setBulkUploadError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty CSV file content");

        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length <= 1) throw new Error("CSV file must contain a header row and data rows.");

        const parsedRows: BulkManifestRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
          if (cols.length < 8) continue;

          const [dest_pin, consignee_name, consignee_phone, delivery_address, total_boxes_str, box_weights_str, box_dimensions_str, declared_value_str] = cols;

          const total_boxes = Math.max(1, parseInt(total_boxes_str, 10) || 1);
          const declared_val = parseFloat(declared_value_str) || 50000;

          const parsedWeights = box_weights_str ? box_weights_str.split(";").map((w) => parseFloat(w.trim())).filter((n) => !isNaN(n) && n > 0) : [];
          const parsedDims = box_dimensions_str ? box_dimensions_str.split(";").map((d) => d.trim()).filter((d) => d.length > 0) : [];

          const hasOmittedDimensions = parsedDims.length === 0;
          const boxItems: BoxItem[] = [];

          for (let b = 0; b < total_boxes; b++) {
            const wt = parsedWeights[b] !== undefined ? parsedWeights[b] : (parsedWeights[0] || 10);
            let l = 0, w = 0, h = 0;
            if (parsedDims[b]) {
              const parts = parsedDims[b].toLowerCase().split("x").map((p) => parseFloat(p.trim()));
              if (parts.length === 3 && !parts.some(isNaN)) {
                l = parts[0];
                w = parts[1];
                h = parts[2];
              }
            }
            boxItems.push({ id: `bulk-box-${i}-${b}`, qty: 1, weight: wt, length: l, width: w, height: h });
          }

          const actualWeight = boxItems.reduce((acc, bi) => acc + bi.weight, 0);
          const divisor = 4500;
          const volumetricWeight = hasOmittedDimensions ? 0 : boxItems.reduce((acc, bi) => acc + ((bi.length * bi.width * bi.height) / divisor), 0);
          const billableWeight = hasOmittedDimensions ? actualWeight : Math.max(actualWeight, Math.round(volumetricWeight * 10) / 10);

          const quotes = calculateQuotesForShipment(
            highVolumeMode ? MERCHANT_DETAILS.defaultOriginPin : originPin,
            dest_pin,
            boxItems,
            declared_val,
            "surface",
            false,
            rateCards,
            vendors
          );

          const sortedQuotes = [...quotes].sort((a, b) => a.breakdown.total - b.breakdown.total);
          const bestQuote = sortedQuotes[0] || null;

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
            selectedQuote: bestQuote
          });
        }

        if (parsedRows.length === 0) {
          throw new Error("No valid consignments found in CSV.");
        }

        setBulkManifestList(parsedRows);
      } catch (err: any) {
        setBulkUploadError(err.message || "Failed to process bulk CSV");
      }
    };
    reader.readAsText(file);
  };

  const handleAutoSelectCheapest = () => {
    setBulkManifestList((prev) =>
      prev.map((row) => {
        if (!row.quotes || row.quotes.length === 0) return row;
        const cheapest = [...row.quotes].sort((a, b) => a.breakdown.total - b.breakdown.total)[0];
        return { ...row, selectedQuote: cheapest };
      })
    );
  };

  const handleAutoSelectFastest = () => {
    setBulkManifestList((prev) =>
      prev.map((row) => {
        if (!row.quotes || row.quotes.length === 0) return row;
        const fastest = [...row.quotes].sort((a, b) => a.rateCard.sla_days - b.rateCard.sla_days)[0];
        return { ...row, selectedQuote: fastest };
      })
    );
  };

  const handleSelectCarrierForRow = (rowId: string, quoteVendorId: string) => {
    setBulkManifestList((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const match = r.quotes.find((q) => q.vendor.id === quoteVendorId) || r.quotes[0];
        return { ...r, selectedQuote: match };
      })
    );
  };

  const handleConfirmBatchBooking = async () => {
    if (bulkManifestList.length === 0) return;
    setIsBatchProcessing(true);

    const refString =
      bulkSettlementMethod === "direct_upi"
        ? bulkConsolidatedUtr
          ? `BULK-UPI-UTR-${bulkConsolidatedUtr}`
          : "BULK-DIRECT-UPI"
        : bulkSettlementMethod === "corporate_credit"
        ? "BULK-CORP-MONTHLY-CREDIT"
        : "BULK-DIRECT-TO-PAY-POD";

    const newBookingsToInsert: Partial<Booking>[] = bulkManifestList.map((row) => {
      const selected = row.selectedQuote || row.quotes[0];
      const carrierName = selected?.vendor?.name || "Delhivery B2B Express";
      const officialDocket = generateCarrierDocket(carrierName);
      const platformOrderId = `LC-${Math.floor(100000 + Math.random() * 900000)}`;
      const portalUrl = getOfficialCarrierTrackingUrl(carrierName, officialDocket);

      const enhancedBreakdown = {
        ...(selected?.breakdown || {
          base: 0,
          fuel: 0,
          docket: 0,
          fov: 0,
          handling: 0,
          oda: 0,
          gst: 0,
          freightSubtotal: 0,
          platformConvenienceFee: 25,
          total: 25
        }),
        settlement_type: bulkSettlementMethod,
        payment_method:
          bulkSettlementMethod === "direct_upi"
            ? "Direct Carrier UPI"
            : bulkSettlementMethod === "corporate_credit"
            ? "B2B Monthly Credit"
            : "Direct To-Pay POD",
        payment_ref: refString,
        carrier_upi: selected?.vendor?.upi_id
      };

      return {
        order_id: platformOrderId,
        awb_number: officialDocket,
        carrier_docket_no: officialDocket,
        carrier_portal_url: portalUrl,
        shipper_id: currentUser.id,
        vendor_id: selected?.vendor?.id || vendors[0].id,
        rate_card_id: selected?.rateCard?.id,
        shipper_name: currentUser.company_name || currentUser.full_name,
        shipper_phone: currentUser.phone || MERCHANT_DETAILS.phone,
        shipper_email: currentUser.email,
        shipper_gstin: currentUser.gstin || "07AAACA1234A1Z5",
        pickup_address: highVolumeMode ? MERCHANT_DETAILS.defaultWarehouseAddress : pickupAddress,
        consignee_name: row.consignee_name,
        consignee_phone: row.consignee_phone,
        consignee_gstin: row.consignee_gstin,
        delivery_address: row.delivery_address,
        origin_pin: highVolumeMode ? MERCHANT_DETAILS.defaultOriginPin : originPin,
        dest_pin: row.dest_pin,
        mode: selected?.rateCard?.mode || "surface",
        boxes: row.boxes,
        declared_value: row.declared_value,
        actual_weight: row.actualWeight,
        volumetric_weight: row.volumetricWeight,
        billable_weight: row.billableWeight,
        cost_breakdown: enhancedBreakdown,
        final_total: enhancedBreakdown.total,
        status: "Booked",
        tracking_history: [
          {
            status: "Booked",
            location: `${originZoneData.city} Warehouse (${MERCHANT_DETAILS.defaultOriginPin})`,
            timestamp: new Date().toISOString(),
            remarks: `Batch Order ${platformOrderId} generated. Carrier Docket ${officialDocket} assigned.`
          }
        ]
      };
    });

    try {
      const { data, error } = await supabase.from("bookings").insert(newBookingsToInsert).select("*, vendors(*)");
      const successfulBookings: Booking[] = (!error && data && data.length > 0)
        ? (data as Booking[])
        : newBookingsToInsert.map((b, idx) => ({
            ...(b as Booking),
            id: `book-bulk-${Date.now()}-${idx}`,
            created_at: new Date().toISOString(),
            vendors: vendors.find((v) => v.id === b.vendor_id) || vendors[0]
          }));

      setBookings((prev) => [...successfulBookings, ...prev]);
      setBatchPrintBookings(successfulBookings);
      setBulkManifestList([]);
      setBulkCsvFileName("");
      alert(`🎉 Successfully booked all ${successfulBookings.length} consignments! Thermal labels ready to print.`);
    } catch {
      alert("Encountered local fallback, saved manifest locally!");
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const calculatedQuotes = useMemo(() => {
    return calculateQuotesForShipment(originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors);
  }, [originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors]);

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

  return (
    <div className="min-h-screen bg-slate-900/5 text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative">
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        highVolumeMode={highVolumeMode}
        setHighVolumeMode={setHighVolumeMode}
        currentUser={currentUser}
        switchDemoRole={switchDemoRole}
        handleLogout={handleLogout}
        setShowAuthModal={setShowAuthModal}
      />

      {activeView === "landing" ? (
        <div className="flex-1 flex flex-col space-y-12 pb-12">
          {/* Hero Section */}
          <section className="relative overflow-hidden bg-slate-950 text-white pt-14 pb-20 px-4 lg:px-8 border-b border-slate-800">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
              <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
                <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 px-3.5 py-1 rounded-full text-xs font-bold">
                  <span>🚀 High-Volume Consignment Engine (40–50+ Parcels/Day)</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                  One-Click Bulk Freight Booking & Multi-Box 4x6 Thermal Labels.
                </h1>
                <p className="text-slate-300 text-sm max-w-xl">
                  Compare Delhivery, Blue Dart, Safexpress, TCI, and Gati rates across India. Upload semicolon-delimited CSVs, auto-assign lowest rates, and print continuous thermal labels with driver handover manifests.
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <button
                    onClick={() => {
                      setActiveView("dashboard");
                      setActivePortal("shipper");
                      setShipperSubTab("bulk");
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 flex items-center space-x-2"
                  >
                    <UploadIcon className="w-4 h-4" />
                    <span>Launch 50/Day Bulk Shipper Console</span>
                  </button>
                </div>
              </div>
              <div className="lg:col-span-5 flex justify-center">
                {!highVolumeMode ? (
                  <Hero3DTruck />
                ) : (
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center space-y-2">
                    <span className="text-3xl">⚡</span>
                    <h3 className="text-sm font-bold text-white">60FPS High-Volume Mode Active</h3>
                    <p className="text-xs text-slate-400">3D canvas paused to optimize enterprise bulk booking latency.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-3">
            <div className="flex items-center space-x-1 bg-slate-200/70 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActivePortal("shipper")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                  activePortal === "shipper" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
                }`}
              >
                Shipper Portal
              </button>
              <button
                onClick={() => setActivePortal("vendor")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition ${
                  activePortal === "vendor" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600"
                }`}
              >
                Carrier Operations Hub
              </button>
            </div>

            {activePortal === "shipper" ? (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  { id: "bulk", label: "⚡ High-Volume Bulk CSV (40-50/Day)" },
                  { id: "compare", label: "🔍 Single Shipment Calculator" },
                  { id: "shipments", label: "📦 Consignment Manifests & Thermal Print" },
                  { id: "tracker", label: "📍 Universal Carrier Tracker" },
                  { id: "rfq", label: "⚖️ Heavy Cargo Reverse Auction" }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setShipperSubTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      shipperSubTab === t.id
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {activePortal === "shipper" && shipperSubTab === "bulk" && (
            <BulkCsvTab
              highVolumeMode={highVolumeMode}
              bulkManifestList={bulkManifestList}
              setBulkManifestList={setBulkManifestList}
              onAutoSelectCheapest={handleAutoSelectCheapest}
              onAutoSelectFastest={handleAutoSelectFastest}
              onSelectCarrierForRow={handleSelectCarrierForRow}
              bulkSettlementMethod={bulkSettlementMethod}
              setBulkSettlementMethod={setBulkSettlementMethod}
              bulkConsolidatedUtr={bulkConsolidatedUtr}
              setBulkConsolidatedUtr={setBulkConsolidatedUtr}
              onConfirmBatchBooking={handleConfirmBatchBooking}
              isBatchProcessing={isBatchProcessing}
              handleBulkCsvUpload={handleBulkCsvUpload}
              bulkCsvFileName={bulkCsvFileName}
              bulkUploadError={bulkUploadError}
            />
          )}
        </main>
      )}

      {/* 4x6 Continuous Thermal Labels & Manifest Modal */}
      {(printableBooking || batchPrintBookings) && (
        <ThermalPrintModal
          printableBooking={printableBooking}
          batchPrintBookings={batchPrintBookings}
          onClose={() => {
            setPrintableBooking(null);
            setBatchPrintBookings(null);
          }}
        />
      )}

      <Footer
        openLegalModal={(tab) => {
          setLegalModalTab(tab);
          setShowLegalModal(true);
        }}
      />
    </div>
  );
}
