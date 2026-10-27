"use client";

import React, { useMemo } from "react";
import { BoxItem, CalculatedQuote, PinLookupResult } from "@/types/freight";
import { BoxIcon, MapPinIcon, PlusIcon, TrashIcon, PlaneIcon, TruckIcon, ArrowRightIcon } from "@/components/icons";
import { RouteTrajectory3D } from "@/components/visuals/RouteTrajectory3D";
import { Interactive3DBox } from "@/components/visuals/Interactive3DBox";
import { formatINR } from "@/lib/freightUtils";

interface SingleCalculatorTabProps {
  highVolumeMode: boolean;
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
}

export function SingleCalculatorTab({
  highVolumeMode,
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
  onSelectQuoteForBooking
}: SingleCalculatorTabProps) {
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
  };

  const updateBox = (id: string, field: keyof BoxItem, value: number) => {
    setBoxes(boxes.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const currentBox3D = boxes[selectedBoxFor3D] || boxes[0];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
              <BoxIcon className="w-5 h-5 text-indigo-600" />
              <span>Pan-India Commercial Freight Calculator</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tariffs with 0% markups directly from carrier rate sheets. Platform fee is 2% (min ₹25).
            </p>
          </div>
          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black px-3 py-1 rounded-full w-fit">
            100% Direct Carrier Settlement
          </span>
        </div>

        {/* 4 Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black text-indigo-950 uppercase tracking-wider">Origin PIN (Pickup)</label>
              <button
                type="button"
                onClick={() => onOpenCityModal("origin")}
                className="text-[11px] text-indigo-700 hover:underline font-bold flex items-center space-x-1"
              >
                <MapPinIcon className="w-3.5 h-3.5" />
                <span>City Search</span>
              </button>
            </div>
            <input
              type="text"
              maxLength={6}
              value={originPin}
              disabled={highVolumeMode}
              onChange={(e) => setOriginPin(e.target.value)}
              className={`w-full border-2 rounded-lg px-3 py-2 text-sm font-mono font-bold ${
                highVolumeMode ? "bg-slate-200 text-slate-700 border-slate-300" : "bg-white text-slate-900 border-indigo-300"
              }`}
            />
            <div className="mt-2 text-[11px] font-bold text-indigo-800">
              📍 {originZoneData.city} ({originZoneData.hub})
            </div>
          </div>

          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black text-emerald-950 uppercase tracking-wider">Destination PIN (Drop)</label>
              <button
                type="button"
                onClick={() => onOpenCityModal("dest")}
                className="text-[11px] text-emerald-700 hover:underline font-bold flex items-center space-x-1"
              >
                <MapPinIcon className="w-3.5 h-3.5" />
                <span>City Search</span>
              </button>
            </div>
            <input
              type="text"
              maxLength={6}
              value={destPin}
              onChange={(e) => setDestPin(e.target.value)}
              className="w-full bg-white border-2 border-emerald-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none"
            />
            <div className="mt-2 text-[11px] font-bold text-emerald-800">
              🎯 {destZoneData.city} ({destZoneData.hub})
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">Declared Value (₹) FOV</label>
            <input
              type="number"
              value={declaredValue}
              onChange={(e) => setDeclaredValue(Number(e.target.value))}
              className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-2 font-medium">0.2% FOV transit risk coverage</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">Transport Mode</label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value as any)}
                className="w-full bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900"
              >
                <option value="all">All Modes (Air, Surface, FTL)</option>
                <option value="surface">Surface Express Only</option>
                <option value="air">Air Cargo Only</option>
              </select>
            </div>

            <label className="flex items-center space-x-2 mt-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isOda}
                onChange={(e) => setIsOda(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300"
              />
              <span className="text-xs text-slate-800 font-bold">ODA Surcharge (+₹450)</span>
            </label>
          </div>
        </div>

        {!highVolumeMode && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <RouteTrajectory3D originHub={originZoneData.hub} destHub={destZoneData.hub} />
          </div>
        )}

        {/* Box Specifications */}
        <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/70 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              Carton Specs ({boxes.length} Box Type{boxes.length > 1 ? "s" : ""})
            </span>
            <button
              type="button"
              onClick={addBox}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-black flex items-center space-x-1"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Box Type</span>
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
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Weight (Kg)</span>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={box.weight}
                      onChange={(e) => updateBox(box.id, "weight", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Length (cm)</span>
                    <input
                      type="number"
                      min={1}
                      value={box.length}
                      onChange={(e) => updateBox(box.id, "length", parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Width (cm)</span>
                    <input
                      type="number"
                      min={1}
                      value={box.width}
                      onChange={(e) => updateBox(box.id, "width", parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Height (cm)</span>
                    <input
                      type="number"
                      min={1}
                      value={box.height}
                      onChange={(e) => updateBox(box.id, "height", parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between sm:justify-end space-x-2 pt-2 sm:pt-0">
                    <span className="text-[10px] text-slate-500 font-mono font-bold">
                      {((box.length * box.width * box.height) / (selectedMode === "air" ? 5000 : 4500)).toFixed(1)}kg vol
                    </span>
                    {boxes.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeBox(box.id); }}
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
                <Interactive3DBox length={currentBox3D.length} width={currentBox3D.width} height={currentBox3D.height} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs">
            <div className="flex flex-wrap gap-6 font-medium">
              <div>
                <span className="text-slate-500">Dead Weight: </span>
                <span className="font-mono font-black text-slate-900">{totalActualWeight.toFixed(1)} kg</span>
              </div>
              <div>
                <span className="text-slate-500">Volumetric Weight: </span>
                <span className="font-mono font-black text-indigo-700">{totalVolumetricWeight.toFixed(2)} kg</span>
              </div>
              <div>
                <span className="text-slate-500">Chargeable Billable Wt: </span>
                <span className="font-mono font-black text-emerald-700 text-sm">{billableWeight.toFixed(1)} kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Carrier Quotes Cards */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">Direct Carrier Freight Comparison</h3>
            <span className="text-xs bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-1 rounded-full font-black">
              {calculatedQuotes.length} Rates Found
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {calculatedQuotes.map((quote) => (
              <div
                key={quote.rateCard.id}
                className="bg-white border-2 border-slate-200 hover:border-indigo-500 rounded-2xl p-5 shadow-xs hover:shadow-md transition"
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
                        {quote.rateCard.mode === "air" ? <PlaneIcon className="w-4 h-4 text-sky-600" /> : <TruckIcon className="w-4 h-4 text-emerald-600" />}
                        <span>{quote.rateCard.mode} Freight</span>
                      </span>
                      <span>•</span>
                      <span>SLA: <strong className="text-slate-900">{quote.rateCard.sla_days} Days</strong></span>
                      <span>•</span>
                      <span>Billable: <strong className="text-slate-900">{quote.billableWeight} kg</strong></span>
                      <span>•</span>
                      <span className="font-mono text-emerald-800 font-bold">UPI: {quote.vendor.upi_id}</span>
                    </div>
                  </div>

                  {/* Pricing Matrix */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs grid grid-cols-3 sm:grid-cols-5 gap-3 text-center sm:text-left">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">Base Freight</span>
                      <span className="font-bold text-slate-900">{formatINR(quote.breakdown.base)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">Fuel</span>
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
                      <span className="text-[10px] text-indigo-700 font-bold block">2% Fee</span>
                      <span className="font-black text-indigo-700">₹{quote.breakdown.platformConvenienceFee}</span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Total Outlay</span>
                      <span className="text-xl font-black text-emerald-700">{formatINR(quote.breakdown.total)}</span>
                    </div>
                    <button
                      onClick={() => onSelectQuoteForBooking(quote)}
                      className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition flex items-center space-x-1.5 shadow-sm"
                    >
                      <span>Direct Book</span>
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
