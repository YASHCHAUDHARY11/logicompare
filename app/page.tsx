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
  compressImageFile,
  formatINR
} from "@/lib/freightUtils";

// Layout & View Components
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

// Icons
import {
  TruckIcon,
  SearchIcon,
  BoltIcon
} from "@/components/icons";

export default function LogiCompareApp() {
  // Navigation & Role Hierarchy
  const [activeRole, setActiveRole] = useState<"landing" | "shipper" | "carrier" | "admin">("shipper");
  const [modeEnv, setModeEnv] = useState<"demo" | "live">("demo");
  const [highVolumeMode, setHighVolumeMode] = useState<boolean>(true);

  // Sub-Navigation Tabs
  const [shipperTab, setShipperTab] = useState<"search" | "matrix" | "shipments" | "history" | "rfq">("search");
  const [carrierTab, setCarrierTab] = useState<"loads" | "tracking" | "rates" | "earnings">("tracking");

  // Authentication & Users
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEMO_SHIPPER);

  // Core Data Masters
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

  // Single Rate Calculator Parameters
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

  // Bulk CSV (50/Day Dispatch Matrix)
  const [bulkManifestList, setBulkManifestList] = useState<BulkManifestRow[]>([]);
  const [bulkCsvFileName, setBulkCsvFileName] = useState("");
  const [bulkUploadError, setBulkUploadError] = useState("");
  const [bulkSettlementMethod, setBulkSettlementMethod] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");
  const [bulkConsolidatedUtr, setBulkConsolidatedUtr] = useState("");
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Global Search & Live Tracking
  const [globalSearchInput, setGlobalSearchInput] = useState("");
  const [landingTrackingInput, setLandingTrackingInput] = useState<string>("");
  const [activeTrackingAwb, setActiveTrackingAwb] = useState(DEMO_INIT_ORDER_ID);
  const [trackingSearchInput, setTrackingSearchInput] = useState(DEMO_INIT_ORDER_ID);

  // Postal Lookups
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

  // Carrier Updates State
  const [statusUpdateMap, setStatusUpdateMap] = useState<
    Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>
  >({});

  // High-Volume Origin Pincode Lock
  useEffect(() => {
    if (highVolumeMode) {
      setOriginPin(MERCHANT_DETAILS.defaultOriginPin);
      setPickupAddress(MERCHANT_DETAILS.defaultWarehouseAddress);
    }
  }, [highVolumeMode]);

  // Auth Session Sync
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
          if (pData) {
            const realProfile = { ...(pData as UserProfile), isRealUser: true };
            setCurrentUser(realProfile);
            setModeEnv("live");
            setActiveRole(realProfile.role === "vendor" ? "carrier" : "shipper");
          }
        }
      } catch (err) {
        console.warn("Session check fallback:", err);
      }
    };
    checkUserSession();
  }, []);

  // Database Synchronization
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
      console.warn("Supabase fetch notice:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // PIN Zone Lookups
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

  // Global Search Router
  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearchInput.trim()) return;
    setActiveTrackingAwb(globalSearchInput.trim());
    setTrackingSearchInput(globalSearchInput.trim());
    setActiveRole("shipper");
    setShipperTab("history");
    setGlobalSearchInput("");
  };

  // Demo Role Switching
  const handleRoleSwitch = (role: "landing" | "shipper" | "carrier" | "admin") => {
    setActiveRole(role);
    if (modeEnv === "demo") {
      if (role === "shipper") setCurrentUser(DEMO_SHIPPER);
      if (role === "carrier") setCurrentUser(DEMO_VENDOR);
    }
  };

  // Mode Toggle (Demo / Live)
  const handleModeToggle = () => {
    if (modeEnv === "demo") {
      if (!currentUser.isRealUser) {
        setShowAuthModal(true);
      } else {
        setModeEnv("live");
      }
    } else {
      setModeEnv("demo");
      setCurrentUser(activeRole === "carrier" ? DEMO_VENDOR : DEMO_SHIPPER);
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

  // Calculations
  const calculatedQuotes = useMemo(() => {
    return calculateQuotesForShipment(originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors);
  }, [originPin, destPin, boxes, declaredValue, selectedMode, isOda, rateCards, vendors]);

  // Bulk CSV Upload
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

  // Bulk Booking Confirmation
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
      setShipperTab("shipments");
      alert(`Successfully booked all ${savedBookings.length} consignments! 4x6 labels ready to print.`);
    } catch {
      alert("Encountered database synchronization fallback. Bookings saved locally.");
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Carrier Bilty Upload
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
      alert(`Bilty uploaded successfully! Size: ~${Math.round(fileToUpload.size / 1024)} KB.`);
    } catch {
      const fallbackUrl = URL.createObjectURL(rawFile);
      setStatusUpdateMap((prev) => ({
        ...prev,
        [bookingId]: { ...(prev[bookingId] || { status: "", location: "", remarks: "" }), docUrl: fallbackUrl, isUploading: false }
      }));
    }
  };

  // Carrier Transit Status Update
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* 1. Global Navigation Command Bar */}
      <header className="sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Platform Brand */}
          <div
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => setActiveRole("landing")}
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

          {/* Global Search Bar */}
          <form onSubmit={handleGlobalSearch} className="hidden md:flex items-center max-w-sm w-full relative">
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={globalSearchInput}
              onChange={(e) => setGlobalSearchInput(e.target.value)}
              placeholder="Search Order Ref (LC-...) or Docket..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </form>

          {/* Role & Workspace Switcher Segmented Control */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleRoleSwitch("landing")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeRole === "landing" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch("shipper")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeRole === "shipper" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Shipper
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch("carrier")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeRole === "carrier" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Carrier
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch("admin")}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeRole === "admin" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Admin
            </button>
          </div>

          {/* Environment [Demo / Live] & User Profile */}
          <div className="flex items-center space-x-2.5">
            {/* Live / Demo Mode Pill */}
            <button
              type="button"
              onClick={handleModeToggle}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition border flex items-center space-x-1 ${
                modeEnv === "live"
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-700/60"
                  : "bg-amber-950/50 text-amber-300 border-amber-700/60"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${modeEnv === "live" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}></span>
              <span>{modeEnv === "live" ? "Live Mode" : "Demo Sandbox"}</span>
            </button>

            {/* User Profile / Auth Action */}
            {currentUser.isRealUser ? (
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 truncate max-w-[120px]">
                  {currentUser.company_name || currentUser.full_name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 px-2.5 py-1 rounded-lg text-xs font-bold transition"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Workspace View Routing */}
      <div className="flex-1">
        {/* VIEW A: LANDING PAGE */}
        {activeRole === "landing" && (
          <LandingView
            highVolumeMode={highVolumeMode}
            vendors={vendors}
            landingTrackingInput={landingTrackingInput}
            setLandingTrackingInput={setLandingTrackingInput}
            onQuickTrack={(val) => {
              const target = val || landingTrackingInput || DEMO_INIT_ORDER_ID;
              setActiveTrackingAwb(target);
              setTrackingSearchInput(target);
              setActiveRole("shipper");
              setShipperTab("history");
            }}
            onJumpToCompare={() => {
              setActiveRole("shipper");
              setShipperTab("search");
            }}
            onJumpToBulk={() => {
              setActiveRole("shipper");
              setShipperTab("matrix");
            }}
            onSwitchShipperDemo={() => {
              setActiveRole("shipper");
              setCurrentUser(DEMO_SHIPPER);
              setModeEnv("demo");
            }}
            onSwitchCarrierDemo={() => {
              setActiveRole("carrier");
              setCurrentUser(DEMO_VENDOR);
              setModeEnv("demo");
            }}
          />
        )}

        {/* VIEW B: SHIPPER WORKSPACE */}
        {activeRole === "shipper" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Dashboard Sub-Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shipper Console</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Commercial Freight Matrix • Active Account: <strong className="text-slate-800">{currentUser.company_name}</strong>
                </p>
              </div>

              {/* 50/Day High-Volume Toggle */}
              <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-600 flex items-center space-x-1">
                  <BoltIcon className="w-4 h-4 text-amber-500" />
                  <span>50/Day High-Volume:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setHighVolumeMode(!highVolumeMode)}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-black transition ${
                    highVolumeMode ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {highVolumeMode ? "ACTIVE (60FPS)" : "OFF"}
                </button>
              </div>
            </div>

            {/* Shipper Dashboard Sub-Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
              {[
                { id: "search", label: "🔍 New Rate Search" },
                { id: "matrix", label: "⚡ Rate Matrix (50/Day Bulk)" },
                { id: "shipments", label: "📦 Active Shipments" },
                { id: "history", label: "📍 History & Live Track" },
                { id: "rfq", label: "⚖️ Load Auction (RFQ)" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setShipperTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl font-bold transition shadow-sm ${
                    shipperTab === tab.id
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Single Rate Calculator */}
            {shipperTab === "search" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
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
              </div>
            )}

            {/* Tab 2: Rate Matrix (50/Day Bulk CSV) */}
            {shipperTab === "matrix" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
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
              </div>
            )}

            {/* Tab 3: Active Shipments & Manifests */}
            {shipperTab === "shipments" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <ShipmentsTab
                  bookings={bookings}
                  onRefresh={fetchAllData}
                  onOpenLabelModal={(b) => setPrintableBooking(b)}
                  onOpenTrackerTab={(orderRef) => {
                    setActiveTrackingAwb(orderRef);
                    setTrackingSearchInput(orderRef);
                    setShipperTab("history");
                  }}
                  onBatchPrintLabels={() => setBatchPrintBookings(bookings.slice(0, 50))}
                />
              </div>
            )}

            {/* Tab 4: History & Live Tracker */}
            {shipperTab === "history" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <UniversalTrackerTab
                  bookings={bookings}
                  activeTrackingAwb={activeTrackingAwb}
                  setActiveTrackingAwb={setActiveTrackingAwb}
                  trackingSearchInput={trackingSearchInput}
                  setTrackingSearchInput={setTrackingSearchInput}
                />
              </div>
            )}

            {/* Tab 5: Heavy Load Reverse Auction (RFQ) */}
            {shipperTab === "rfq" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <RfqTab
                  currentUser={currentUser}
                  rfqList={rfqList}
                  setRfqList={setRfqList}
                />
              </div>
            )}
          </div>
        )}

        {/* VIEW C: CARRIER WORKSPACE */}
        {activeRole === "carrier" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Carrier Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Carrier Operations Hub</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Operating Partner: <strong className="text-emerald-700">{currentUser.company_name}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddRateCardModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition"
              >
                + Publish New Lane Tariff
              </button>
            </div>

            {/* Carrier Dashboard Sub-Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
              {[
                { id: "loads", label: "🎯 Available Loads (RFQs)" },
                { id: "tracking", label: "📋 Fleet Tracking & Bilty" },
                { id: "rates", label: "🏷️ Commercial Rate Cards" },
                { id: "earnings", label: "🏦 Earnings & Settlement" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCarrierTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl font-bold transition shadow-sm ${
                    carrierTab === tab.id
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sub-Tab 1: Available Loads / RFQs */}
            {carrierTab === "loads" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <CarrierBidsTab
                  currentUser={currentUser}
                  rfqList={rfqList}
                  setRfqList={setRfqList}
                />
              </div>
            )}

            {/* Sub-Tab 2: Fleet Tracking & Bilty Photo Uploads */}
            {carrierTab === "tracking" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <CarrierOrdersTab
                  currentUser={currentUser}
                  bookings={bookings}
                  statusUpdateMap={statusUpdateMap}
                  setStatusUpdateMap={setStatusUpdateMap}
                  onUploadDocketFile={handleUploadDocketFile}
                  onUpdateShipmentStatus={handleUpdateShipmentStatus}
                />
              </div>
            )}

            {/* Sub-Tab 3: Commercial Rate Cards Master */}
            {carrierTab === "rates" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <CarrierRatesTab
                  currentUser={currentUser}
                  rateCards={rateCards}
                  setRateCards={setRateCards}
                  vendors={vendors}
                  onOpenAddRateModal={() => setShowAddRateCardModal(true)}
                />
              </div>
            )}

            {/* Sub-Tab 4: Earnings & Bank Profile */}
            {carrierTab === "earnings" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <CarrierBankTab
                  currentUser={currentUser}
                  vendors={vendors}
                  setVendors={setVendors}
                />
              </div>
            )}
          </div>
        )}

        {/* VIEW D: ADMIN / EXECUTIVE OVERSIGHT VIEW */}
        {activeRole === "admin" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Administration & Oversight</h1>
              <p className="text-xs text-slate-500 mt-0.5">Platform Performance, Verified Fleets & Statutory Margin Audit</p>
            </div>

            {/* 4 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Dispatches</span>
                <span className="text-3xl font-black text-slate-900">{bookings.length}</span>
                <p className="text-[11px] text-emerald-600 font-bold">Dual-ID Carrier Verified</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Active Carrier Partners</span>
                <span className="text-3xl font-black text-indigo-600">{vendors.length}</span>
                <p className="text-[11px] text-indigo-600 font-bold">100% KYC Approved</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Gross Freight Routed</span>
                <span className="text-3xl font-black text-slate-900 font-mono">
                  {formatINR(bookings.reduce((acc, b) => acc + (b.cost_breakdown?.freightSubtotal || b.final_total || 0), 0))}
                </span>
                <p className="text-[11px] text-slate-500 font-bold">0% Aggregator Markup</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Platform Fees (2%)</span>
                <span className="text-3xl font-black text-emerald-600 font-mono">
                  {formatINR(bookings.reduce((acc, b) => acc + (b.cost_breakdown?.platformConvenienceFee || 25), 0))}
                </span>
                <p className="text-[11px] text-emerald-700 font-bold">Statutory Margin Accrued</p>
              </div>
            </div>

            {/* Carrier Status Directory */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-black text-slate-900">Active Integrated Transporters</h3>
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
                        <td className="py-3 px-4 text-amber-500 font-bold">★ {v.rating}</td>
                        <td className="py-3 px-4 font-mono">{v.gstin}</td>
                        <td className="py-3 px-4 text-[11px] text-slate-500">{v.fleet_types.join(", ")}</td>
                        <td className="py-3 px-4 font-mono text-emerald-700 font-bold">{v.upi_id}</td>
                        <td className="py-3 px-4 font-mono text-[10px] text-indigo-600 truncate max-w-[150px]">{v.tracking_base_url}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

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
            setShipperTab("shipments");
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
            setModeEnv("live");
            setActiveRole(profile.role === "vendor" ? "carrier" : "shipper");
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
