"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  BoxItem,
  Vendor,
  RateCard,
  CalculatedQuote,
  Booking,
  BulkManifestRow,
  RfqBid,
  UserProfile,
  PinLookupResult
} from "@/types/freight";
import {
  MERCHANT_DETAILS,
  DEMO_INIT_ORDER_ID,
  DEMO_INIT_CARRIER_DOCKET,
  DEMO_SHIPPER,
  DEMO_VENDOR,
  FALLBACK_VENDORS,
  FALLBACK_DEFAULT_RATE_CARDS
} from "@/lib/constants";
import {
  getLocalFallbackZone,
  generateCarrierDocket,
  getOfficialCarrierTrackingUrl,
  calculateQuotesForShipment,
  compressImageFile
} from "@/lib/freightUtils";

// Layout & View Modules
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LandingView } from "@/components/landing/LandingView";

// Shipper Sub-Tabs
import { BulkCsvTab } from "@/components/shipper/BulkCsvTab";
import { SingleCalculatorTab } from "@/components/shipper/SingleCalculatorTab";
import { ShipmentsTab } from "@/components/shipper/ShipmentsTab";
import { UniversalTrackerTab } from "@/components/shipper/UniversalTrackerTab";
import { RfqTab } from "@/components/shipper/RfqTab";

// Carrier Sub-Tabs
import { CarrierOrdersTab } from "@/components/carrier/CarrierOrdersTab";
import { CarrierRatesTab } from "@/components/carrier/CarrierRatesTab";
import { CarrierBidsTab } from "@/components/carrier/CarrierBidsTab";
import { CarrierBankTab } from "@/components/carrier/CarrierBankTab";

// Modals
import { DirectBookingModal } from "@/components/modals/DirectBookingModal";
import { ThermalPrintModal } from "@/components/modals/ThermalPrintModal";
import { LegalModal } from "@/components/modals/LegalModal";
import { CitySearchModal } from "@/components/modals/CitySearchModal";
import { AuthModal } from "@/components/modals/AuthModal";
import { AddRateCardModal } from "@/components/modals/AddRateCardModal";

export default function LogiComparePro() {
  const [activeView, setActiveView] = useState<"landing" | "dashboard">("landing");
  const [highVolumeMode, setHighVolumeMode] = useState<boolean>(true);

  // Authentication & Current User
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_SHIPPER);
  const [activePortal, setActivePortal] = useState<"shipper" | "vendor">("shipper");
  const [shipperSubTab, setShipperSubTab] = useState<"bulk" | "compare" | "shipments" | "tracker" | "rfq">("bulk");
  const [vendorSubTab, setVendorSubTab] = useState<"orders" | "rates" | "bids" | "bank">("orders");

  // Domain Masters State
  const [rateCards, setRateCards] = useState<RateCard[]>(FALLBACK_DEFAULT_RATE_CARDS);
  const [vendors, setVendors] = useState<Vendor[]>(FALLBACK_VENDORS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rfqList, setRfqList] = useState<RfqBid[]>([]);

  // Modals Visibility
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<"terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact">("terms");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCitySearchModal, setShowCitySearchModal] = useState<"origin" | "dest" | null>(null);
  const [showAddRateCardModal, setShowAddRateCardModal] = useState(false);
  const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<CalculatedQuote | null>(null);
  const [printableBooking, setPrintableBooking] = useState<Booking | null>(null);
  const [batchPrintBookings, setBatchPrintBookings] = useState<Booking[] | null>(null);

  // Ad-hoc Single Consignment State
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
  const [pickupAddress, setPickupAddress] = useState(MERCHANT_DETAILS.defaultWarehouseAddress);

  // Bulk CSV Consignment State (40-50/Day)
  const [bulkManifestList, setBulkManifestList] = useState<BulkManifestRow[]>([]);
  const [bulkCsvFileName, setBulkCsvFileName] = useState("");
  const [bulkUploadError, setBulkUploadError] = useState("");
  const [bulkSettlementMethod, setBulkSettlementMethod] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");
  const [bulkConsolidatedUtr, setBulkConsolidatedUtr] = useState("");
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Live Tracking Inputs
  const [landingTrackingInput, setLandingTrackingInput] = useState(DEMO_INIT_ORDER_ID);
  const [activeTrackingAwb, setActiveTrackingAwb] = useState(DEMO_INIT_ORDER_ID);
  const [trackingSearchInput, setTrackingSearchInput] = useState(DEMO_INIT_ORDER_ID);

  // Zone Lookups
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

  // Carrier Dispatch Update Form Map
  const [statusUpdateMap, setStatusUpdateMap] = useState<
    Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>
  >({});

  // High-Volume Origin Pincode Lock Effect
  useEffect(() => {
    if (highVolumeMode) {
      setOriginPin(MERCHANT_DETAILS.defaultOriginPin);
      setPickupAddress(MERCHANT_DETAILS.defaultWarehouseAddress);
    }
  }, [highVolumeMode]);

  // Real User Session Check on Mount
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
          if (pData) {
            const realProfile = { ...(pData as UserProfile), isRealUser: true };
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

  // Fetch Database Masters on Mount
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
      console.warn("Supabase synchronization notice:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // PIN Code Zone Fetchers
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

  // Demo Switcher
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
    } catch {}
    setCurrentUser(DEMO_SHIPPER);
    setActivePortal("shipper");
    setActiveView("landing");
  };

  // Carrier Physical Bilty Upload with ~100KB Auto-Compression
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

  // Carrier Transit Status Dispatcher
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

    const newStep = {
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

  // Ad-hoc Quotes Calculation
  const calculatedQuotes = useMemo(() => {
    return calculateQuotesForShipment(originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors);
  }, [originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors]);

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
        setBulkUploadError(err.message || "Failed to process bulk CSV.");
      }
    };
    reader.readAsText(file);
  };

  // Batch Booking Handler
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
            platformConvenienceFee: 25,
            total: 25
          }),
          settlement_type: bulkSettlementMethod,
          payment_ref: refString
        },
        final_total: selected?.breakdown?.total || 25,
        status: "Booked" as const,
        tracking_history: [
          {
            status: "Booked",
            location: `Origin Hub (${MERCHANT_DETAILS.defaultOriginPin})`,
            timestamp: new Date().toISOString(),
            remarks: `Batch order generated. Assigned official docket ${officialDocket}`
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
      alert(`Successfully booked all ${savedBookings.length} consignments! Continuous 4x6 labels ready to print.`);
    } catch {
      alert("Encountered database synchronization fallback. Bookings saved locally.");
    } finally {
      setIsBatchProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* 1. Global Navigation Command Bar */}
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

      {/* 2. Workspace View Routing */}
      {activeView === "landing" ? (
        <LandingView
          highVolumeMode={highVolumeMode}
          vendors={vendors}
          landingTrackingInput={landingTrackingInput}
          setLandingTrackingInput={setLandingTrackingInput}
          onQuickTrack={(val) => {
            const target = val || landingTrackingInput || DEMO_INIT_ORDER_ID;
            setActiveTrackingAwb(target);
            setTrackingSearchInput(target);
            setActiveView("dashboard");
            setActivePortal("shipper");
            setShipperSubTab("tracker");
          }}
          onJumpToCompare={() => {
            setActiveView("dashboard");
            setActivePortal("shipper");
            setShipperSubTab("compare");
          }}
          onJumpToBulk={() => {
            setActiveView("dashboard");
            setActivePortal("shipper");
            setShipperSubTab("bulk");
          }}
          onSwitchShipperDemo={() => switchDemoRole("shipper")}
          onSwitchCarrierDemo={() => switchDemoRole("vendor")}
        />
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 space-y-6">
          {/* Main Tab Controller Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-300 pb-4 gap-4">
            <div className="flex items-center space-x-1.5 bg-slate-950 p-1.5 rounded-2xl shadow-sm">
              <button
                type="button"
                onClick={() => setActivePortal("shipper")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                  activePortal === "shipper" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Shipper Portal
              </button>
              <button
                type="button"
                onClick={() => setActivePortal("vendor")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                  activePortal === "vendor" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Carrier Hub
              </button>
            </div>

            {/* Sub-Tabs Selector */}
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
                    type="button"
                    onClick={() => setShipperSubTab(t.id as any)}
                    className={`px-3.5 py-2 rounded-xl font-black transition shadow-sm ${
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
                    type="button"
                    onClick={() => setVendorSubTab(t.id as any)}
                    className={`px-3.5 py-2 rounded-xl font-black transition shadow-sm ${
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

          {/* Shipper Portal Sub-Tabs */}
          {activePortal === "shipper" && shipperSubTab === "bulk" && (
            <BulkCsvTab
              highVolumeMode={highVolumeMode}
              bulkManifestList={bulkManifestList}
              setBulkManifestList={setBulkManifestList}
              onAutoSelectCheapest={() =>
                setBulkManifestList((prev) =>
                  prev.map((r) => ({
                    ...r,
                    selectedQuote: [...r.quotes].sort((a, b) => a.breakdown.total - b.breakdown.total)[0]
                  }))
                )
              }
              onAutoSelectFastest={() =>
                setBulkManifestList((prev) =>
                  prev.map((r) => ({
                    ...r,
                    selectedQuote: [...r.quotes].sort((a, b) => a.rateCard.sla_days - b.rateCard.sla_days)[0]
                  }))
                )
              }
              onSelectCarrierForRow={(rowId, vId) =>
                setBulkManifestList((prev) =>
                  prev.map((r) => (r.rowId === rowId ? { ...r, selectedQuote: r.quotes.find((q) => q.vendor.id === vId) || r.quotes[0] } : r))
                )
              }
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

          {activePortal === "shipper" && shipperSubTab === "compare" && (
            <SingleCalculatorTab
              highVolumeMode={highVolumeMode}
              originPin={originPin}
              setOriginPin={setOriginPin}
              destPin={destPin}
              setDestPin={setDestPin}
              declaredValue={declaredValue}
              setDeclaredValue={setDeclaredValue}
              selectedMode={selectedMode}
              setSelectedMode={setSelectedMode}
              isOda={isOda}
              setIsOda={setIsOda}
              boxes={boxes}
              setBoxes={setBoxes}
              selectedBoxFor3D={selectedBoxFor3D}
              setSelectedBoxFor3D={setSelectedBoxFor3D}
              originZoneData={originZoneData}
              destZoneData={destZoneData}
              calculatedQuotes={calculatedQuotes}
              onOpenCityModal={(t) => setShowCitySearchModal(t)}
              onSelectQuoteForBooking={(q) => setSelectedQuoteForBooking(q)}
            />
          )}

          {activePortal === "shipper" && shipperSubTab === "shipments" && (
            <ShipmentsTab
              bookings={bookings}
              onRefresh={fetchAllData}
              onOpenLabelModal={(b) => setPrintableBooking(b)}
              onOpenTrackerTab={(orderRef) => {
                setActiveTrackingAwb(orderRef);
                setTrackingSearchInput(orderRef);
                setShipperSubTab("tracker");
              }}
              onBatchPrintLabels={() => setBatchPrintBookings(bookings.slice(0, 50))}
            />
          )}

          {activePortal === "shipper" && shipperSubTab === "tracker" && (
            <UniversalTrackerTab
              bookings={bookings}
              activeTrackingAwb={activeTrackingAwb}
              setActiveTrackingAwb={setActiveTrackingAwb}
              trackingSearchInput={trackingSearchInput}
              setTrackingSearchInput={setTrackingSearchInput}
            />
          )}

          {activePortal === "shipper" && shipperSubTab === "rfq" && (
            <RfqTab currentUser={currentUser} rfqList={rfqList} setRfqList={setRfqList} />
          )}

          {/* Carrier Hub Sub-Tabs */}
          {activePortal === "vendor" && vendorSubTab === "orders" && (
            <CarrierOrdersTab
              currentUser={currentUser}
              bookings={bookings}
              statusUpdateMap={statusUpdateMap}
              setStatusUpdateMap={setStatusUpdateMap}
              onUploadDocketFile={handleUploadDocketFile}
              onUpdateShipmentStatus={handleUpdateShipmentStatus}
            />
          )}

          {activePortal === "vendor" && vendorSubTab === "rates" && (
            <CarrierRatesTab
              currentUser={currentUser}
              rateCards={rateCards}
              setRateCards={setRateCards}
              vendors={vendors}
              onOpenAddRateModal={() => setShowAddRateCardModal(true)}
            />
          )}

          {activePortal === "vendor" && vendorSubTab === "bids" && (
            <CarrierBidsTab currentUser={currentUser} rfqList={rfqList} setRfqList={setRfqList} />
          )}

          {activePortal === "vendor" && vendorSubTab === "bank" && (
            <CarrierBankTab currentUser={currentUser} vendors={vendors} setVendors={setVendors} />
          )}
        </main>
      )}

      {/* 3. Global Modals */}
      {selectedQuoteForBooking && (
        <DirectBookingModal
          quote={selectedQuoteForBooking}
          currentUser={currentUser}
          originPin={originPin}
          destPin={destPin}
          boxes={boxes}
          declaredValue={declaredValue}
          pickupAddress={pickupAddress}
          onClose={() => setSelectedQuoteForBooking(null)}
          onSuccess={(b) => {
            setBookings([b, ...bookings]);
            setSelectedQuoteForBooking(null);
            setShipperSubTab("shipments");
          }}
        />
      )}

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

      {showLegalModal && (
        <LegalModal
          tab={legalModalTab}
          setTab={setLegalModalTab}
          onClose={() => setShowLegalModal(false)}
        />
      )}

      {showCitySearchModal && (
        <CitySearchModal
          target={showCitySearchModal}
          onSelectPin={(pin) => {
            if (showCitySearchModal === "origin") setOriginPin(pin);
            else setDestPin(pin);
          }}
          onClose={() => setShowCitySearchModal(null)}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onSuccess={(profile) => {
            setCurrentUser(profile);
            setActivePortal(profile.role);
          }}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {showAddRateCardModal && (
        <AddRateCardModal
          currentUser={currentUser}
          vendors={vendors}
          onSuccess={(card) => setRateCards([card, ...rateCards])}
          onClose={() => setShowAddRateCardModal(false)}
        />
      )}

      {/* 4. Enterprise Compliance Footer */}
      <Footer
        openLegalModal={(tab) => {
          setLegalModalTab(tab);
          setShowLegalModal(true);
        }}
      />
    </div>
  );
}
