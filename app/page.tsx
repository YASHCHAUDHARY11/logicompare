'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

// --- Type Definitions ---
interface SearchParams {
  originPin: string;
  destPin: string;
  actualWeight: number;
  length: number;
  width: number;
  height: number;
  mode: 'surface' | 'air';
}

interface CalculatedQuote {
  rateCardId: string;
  vendorId: string;
  vendorName: string;
  badge: string;
  rating: number;
  slaDays: number;
  mode: string;
  actualWeight: number;
  volumetricWeight: number;
  billableWeight: number;
  basePrice: number;
  fuelSurcharge: number;
  docketCharge: number;
  subtotal: number;
  gst: number;
  totalCost: number;
}

interface BookingRecord {
  id: string;
  shipper_name: string;
  shipper_phone: string;
  origin_pin: string;
  dest_pin: string;
  mode: string;
  billable_weight: number;
  final_total: number;
  status: string;
  created_at: string;
  vendors?: { name: string };
}

export default function LogiComparePage() {
  const [role, setRole] = useState<'shipper' | 'vendor'>('shipper');

  // --- Shipper State ---
  const [searchParams, setSearchParams] = useState<SearchParams>({
    originPin: '110001',
    destPin: '400001',
    actualWeight: 12,
    length: 40,
    width: 30,
    height: 25,
    mode: 'surface',
  });
  const [quotes, setQuotes] = useState<CalculatedQuote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [sortBy, setSortBy] = useState<'price' | 'sla'>('price');

  // --- Modal State ---
  const [selectedQuote, setSelectedQuote] = useState<CalculatedQuote | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({ name: '', phone: '', email: '' });
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  // --- Vendor Dashboard State ---
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [vendorBookings, setVendorBookings] = useState<BookingRecord[]>([]);
  const [newRateCard, setNewRateCard] = useState({
    vendorId: '',
    originPrefix: '110',
    destPrefix: '400',
    mode: 'surface',
    minWeight: 5,
    baseRate: 350,
    perKgRate: 18,
    fuelSurchargePct: 10,
    docketCharge: 50,
    slaDays: 3,
  });
  const [vendorMsg, setVendorMsg] = useState('');

  // Initial Fetch of Vendor metadata
  useEffect(() => {
    fetchVendors();
    if (role === 'vendor') {
      fetchVendorInquiries();
    }
  }, [role]);

  const fetchVendors = async () => {
    const { data } = await supabase.from('vendors').select('id, name');
    if (data && data.length > 0) {
      setVendors(data);
      if (!newRateCard.vendorId) {
        setNewRateCard((prev) => ({ ...prev, vendorId: data[0].id }));
      }
    }
  };

  const fetchVendorInquiries = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, vendors(name)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVendorBookings(data as BookingRecord[]);
    }
  };

  // --- Rate Comparison Engine ---
  const handleCalculateRates = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoadingQuotes(true);

    try {
      // 1. Calculate Volumetric & Billable Weight
      // Surface divisor: 4500 cm3/kg | Air divisor: 5000 cm3/kg
      const divisor = searchParams.mode === 'surface' ? 4500 : 5000;
      const volWeight = Number(
        ((searchParams.length * searchParams.width * searchParams.height) / divisor).toFixed(2)
      );
      const billable = Math.max(searchParams.actualWeight, volWeight);

      // 2. Fetch Rate Cards matching prefix
      // Pulling active cards for chosen mode
      const { data: cards, error } = await supabase
        .from('rate_cards')
        .select(`
          id, vendor_id, origin_prefix, dest_prefix, mode,
          min_weight_kg, base_rate, per_kg_rate, fuel_surcharge_pct,
          docket_charge, sla_days,
          vendors (id, name, badge, rating)
        `)
        .eq('mode', searchParams.mode)
        .eq('is_active', true);

      if (error) throw error;

      if (!cards || cards.length === 0) {
        setQuotes([]);
        setLoadingQuotes(false);
        return;
      }

      // 3. Filter prefixes & calculate exact breakdown
      const origin3 = searchParams.originPin.slice(0, 3);
      const dest3 = searchParams.destPin.slice(0, 3);

      const calculated: CalculatedQuote[] = [];

      for (const card of cards as any[]) {
        // Prefix matching: supports 3-digit or full pincode matching
        const originMatch = searchParams.originPin.startsWith(card.origin_prefix) || card.origin_prefix.startsWith(origin3);
        const destMatch = searchParams.destPin.startsWith(card.dest_prefix) || card.dest_prefix.startsWith(dest3);

        if (originMatch && destMatch) {
          const minWt = Number(card.min_weight_kg);
          const baseRate = Number(card.base_rate);
          const incRate = Number(card.per_kg_rate);
          const fuelPct = Number(card.fuel_surcharge_pct);
          const docket = Number(card.docket_charge);

          // Base calculation
          const excessWeight = Math.max(0, billable - minWt);
          const basePrice = Number((baseRate + excessWeight * incRate).toFixed(2));
          const fuelSurcharge = Number(((basePrice * fuelPct) / 100).toFixed(2));
          const subtotal = Number((basePrice + fuelSurcharge + docket).toFixed(2));
          const gst = Number((subtotal * 0.18).toFixed(2));
          const totalCost = Number((subtotal + gst).toFixed(2));

          calculated.push({
            rateCardId: card.id,
            vendorId: card.vendors.id,
            vendorName: card.vendors.name,
            badge: card.vendors.badge,
            rating: Number(card.vendors.rating),
            slaDays: card.sla_days,
            mode: card.mode,
            actualWeight: searchParams.actualWeight,
            volumetricWeight: volWeight,
            billableWeight: billable,
            basePrice,
            fuelSurcharge,
            docketCharge: docket,
            subtotal,
            gst,
            totalCost,
          });
        }
      }

      // 4. Default Sort: Lowest Total Cost
      calculated.sort((a, b) => a.totalCost - b.totalCost);
      setQuotes(calculated);
    } catch (err: any) {
      console.error('Pricing Error:', err);
    } finally {
      setLoadingQuotes(false);
    }
  };

  // Run initial calculation on page load
  useEffect(() => {
    handleCalculateRates();
  }, []);

  // Sort handler
  const sortedQuotes = [...quotes].sort((a, b) => {
    if (sortBy === 'price') return a.totalCost - b.totalCost;
    return a.slaDays - b.slaDays;
  });

  // --- Booking Submission Handler ---
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;
    setBookingLoading(true);

    try {
      const { error } = await supabase.from('bookings').insert({
        vendor_id: selectedQuote.vendorId,
        rate_card_id: selectedQuote.rateCardId,
        shipper_name: bookingForm.name,
        shipper_phone: bookingForm.phone,
        shipper_email: bookingForm.email,
        origin_pin: searchParams.originPin,
        dest_pin: searchParams.destPin,
        mode: searchParams.mode,
        cargo_weight: searchParams.actualWeight,
        dimensions_cm: {
          length: searchParams.length,
          width: searchParams.width,
          height: searchParams.height,
        },
        volumetric_weight: selectedQuote.volumetricWeight,
        billable_weight: selectedQuote.billableWeight,
        final_total: selectedQuote.totalCost,
        status: 'Confirmed',
      });

      if (error) throw error;
      setBookingSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setBookingSuccess(false);
        setBookingForm({ name: '', phone: '', email: '' });
      }, 2000);
    } catch (err: any) {
      alert(`Booking Failed: ${err.message}`);
    } finally {
      setBookingLoading(false);
    }
  };

  // --- Vendor: Create New Rate Card ---
  const handleCreateRateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setVendorMsg('');
    try {
      const { error } = await supabase.from('rate_cards').insert({
        vendor_id: newRateCard.vendorId,
        origin_prefix: newRateCard.originPrefix,
        dest_prefix: newRateCard.destPrefix,
        mode: newRateCard.mode,
        min_weight_kg: Number(newRateCard.minWeight),
        base_rate: Number(newRateCard.baseRate),
        per_kg_rate: Number(newRateCard.perKgRate),
        fuel_surcharge_pct: Number(newRateCard.fuelSurchargePct),
        docket_charge: Number(newRateCard.docketCharge),
        sla_days: Number(newRateCard.slaDays),
        is_active: true,
      });

      if (error) throw error;
      setVendorMsg('✅ Rate Card published successfully!');
      setTimeout(() => setVendorMsg(''), 4000);
    } catch (err: any) {
      setVendorMsg(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* 1. Header & Role Switcher */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-black text-white shadow-md shadow-indigo-200">
              LC
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Logi<span className="text-indigo-600">Compare</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">B2B Freight Rate Matrix & Booking</p>
            </div>
          </div>

          {/* Role Switcher Pill */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setRole('shipper')}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                role === 'shipper'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📦 Shipper Matrix
            </button>
            <button
              onClick={() => setRole('vendor')}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                role === 'vendor'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏢 Logistics Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Content View Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {role === 'shipper' ? (
          <div>
            {/* 2. Shipper Search Engine */}
            <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Compare Freight Quotes</h2>
                  <p className="text-xs text-slate-500">
                    Real-time B2B pricing with accurate volumetric calculations & GST breakdowns
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    Mode: {searchParams.mode.toUpperCase()}
                  </span>
                </div>
              </div>

              <form onSubmit={handleCalculateRates} className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
                {/* Origin Pincode */}
                <div className="md:col-span-3 lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Origin PIN</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={searchParams.originPin}
                    onChange={(e) => setSearchParams({ ...searchParams, originPin: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. 110001"
                  />
                </div>

                {/* Destination Pincode */}
                <div className="md:col-span-3 lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Destination PIN</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={searchParams.destPin}
                    onChange={(e) => setSearchParams({ ...searchParams, destPin: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. 400001"
                  />
                </div>

                {/* Actual Weight */}
                <div className="md:col-span-2 lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Actual Wt (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    required
                    value={searchParams.actualWeight}
                    onChange={(e) => setSearchParams({ ...searchParams, actualWeight: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Dimensions (L x W x H) */}
                <div className="md:col-span-4 lg:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Dimensions (L × W × H cm)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="L"
                      min="1"
                      value={searchParams.length}
                      onChange={(e) => setSearchParams({ ...searchParams, length: Number(e.target.value) })}
                      className="w-1/3 rounded-lg border border-slate-300 px-2 py-2 text-center text-sm focus:border-indigo-500 focus:outline-none"
                    />
                    <span className="text-slate-400">×</span>
                    <input
                      type="number"
                      placeholder="W"
                      min="1"
                      value={searchParams.width}
                      onChange={(e) => setSearchParams({ ...searchParams, width: Number(e.target.value) })}
                      className="w-1/3 rounded-lg border border-slate-300 px-2 py-2 text-center text-sm focus:border-indigo-500 focus:outline-none"
                    />
                    <span className="text-slate-400">×</span>
                    <input
                      type="number"
                      placeholder="H"
                      min="1"
                      value={searchParams.height}
                      onChange={(e) => setSearchParams({ ...searchParams, height: Number(e.target.value) })}
                      className="w-1/3 rounded-lg border border-slate-300 px-2 py-2 text-center text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Mode */}
                <div className="md:col-span-3 lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Mode</label>
                  <select
                    value={searchParams.mode}
                    onChange={(e) =>
                      setSearchParams({ ...searchParams, mode: e.target.value as 'surface' | 'air' })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="surface">Surface Express</option>
                    <option value="air">Air Cargo</option>
                  </select>
                </div>

                {/* Submit Button */}
                <div className="md:col-span-3 lg:col-span-1 flex items-end">
                  <button
                    type="submit"
                    disabled={loadingQuotes}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                  >
                    {loadingQuotes ? '...' : 'Search'}
                  </button>
                </div>
              </form>

              {/* Dynamic Weight Indicator Banner */}
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100">
                <span className="font-semibold text-slate-800">Calculation Metrics:</span>
                <span>Actual Wt: <strong className="text-slate-900">{searchParams.actualWeight} kg</strong></span>
                <span>•</span>
                <span>
                  Volumetric Wt: <strong className="text-slate-900">
                    {(
                      (searchParams.length * searchParams.width * searchParams.height) /
                      (searchParams.mode === 'surface' ? 4500 : 5000)
                    ).toFixed(2)} kg
                  </strong>
                </span>
                <span>•</span>
                <span className="rounded bg-indigo-100 px-2 py-0.5 font-medium text-indigo-800">
                  Billable Weight: {Math.max(
                    searchParams.actualWeight,
                    Number(
                      (
                        (searchParams.length * searchParams.width * searchParams.height) /
                        (searchParams.mode === 'surface' ? 4500 : 5000)
                      ).toFixed(2)
                    )
                  )} kg
                </span>
              </div>
            </section>

            {/* 3. Rate Comparison Matrix Section */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Available Logistics Partners ({sortedQuotes.length})
              </h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Sort by:</span>
                <button
                  onClick={() => setSortBy('price')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    sortBy === 'price' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  Lowest Price
                </button>
                <button
                  onClick={() => setSortBy('sla')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    sortBy === 'sla' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  Fastest Delivery
                </button>
              </div>
            </div>

            {loadingQuotes ? (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <div className="animate-pulse text-sm text-slate-500">Calculating carrier matrix...</div>
              </div>
            ) : sortedQuotes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <p className="text-sm font-medium text-slate-600">
                  No active rate cards found for route {searchParams.originPin.slice(0, 3)}xxx → {searchParams.destPin.slice(0, 3)}xxx
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Switch to the "Logistics Dashboard" to add a rate card for this route.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedQuotes.map((quote, idx) => (
                  <div
                    key={quote.rateCardId}
                    className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md md:flex-row md:items-center"
                  >
                    {idx === 0 && sortBy === 'price' && (
                      <span className="absolute left-0 top-0 rounded-br-lg bg-emerald-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Best Value
                      </span>
                    )}

                    {/* Left: Vendor & SLA Info */}
                    <div className="mb-4 md:mb-0 md:w-1/3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-slate-900">{quote.vendorName}</h4>
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                          ★ {quote.rating}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                          {quote.badge}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-indigo-600">
                          ⚡ {quote.slaDays} {quote.slaDays === 1 ? 'Day' : 'Days'} Transit SLA
                        </span>
                      </div>
                    </div>

                    {/* Middle: Line-Item Cost Breakdown */}
                    <div className="mb-4 grid grid-cols-4 gap-2 border-y border-slate-100 py-3 md:mb-0 md:w-5/12 md:border-y-0 md:border-x md:px-6 md:py-0 text-center">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Base Freight</p>
                        <p className="text-xs font-semibold text-slate-700">₹{quote.basePrice}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Fuel + Docket</p>
                        <p className="text-xs font-semibold text-slate-700">₹{quote.fuelSurcharge + quote.docketCharge}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">GST (18%)</p>
                        <p className="text-xs font-semibold text-slate-700">₹{quote.gst}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Billable Wt</p>
                        <p className="text-xs font-semibold text-indigo-600">{quote.billableWeight} kg</p>
                      </div>
                    </div>

                    {/* Right: Total Price & Book Button */}
                    <div className="flex items-center justify-between md:w-1/4 md:flex-col md:items-end md:justify-center">
                      <div className="text-left md:text-right">
                        <span className="text-[11px] font-medium text-slate-400">Total Net Cost</span>
                        <div className="text-2xl font-black text-slate-900">₹{quote.totalCost}</div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedQuote(quote);
                          setIsModalOpen(true);
                        }}
                        className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
                      >
                        Book Now →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* 4. Logistics Company / Vendor Dashboard */
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left: Create/Update Rate Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
              <h3 className="text-base font-bold text-slate-900">Create / Update Rate Card</h3>
              <p className="mb-4 text-xs text-slate-500">
                Configure your pricing per route, transport mode, fuel surcharge, and docket fees.
              </p>

              {vendorMsg && (
                <div className="mb-4 rounded-lg bg-slate-100 p-3 text-xs font-medium text-slate-800">
                  {vendorMsg}
                </div>
              )}

              <form onSubmit={handleCreateRateCard} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Select Vendor Profile</label>
                  <select
                    value={newRateCard.vendorId}
                    onChange={(e) => setNewRateCard({ ...newRateCard, vendorId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Origin Prefix</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 110"
                      value={newRateCard.originPrefix}
                      onChange={(e) => setNewRateCard({ ...newRateCard, originPrefix: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Dest Prefix</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 400"
                      value={newRateCard.destPrefix}
                      onChange={(e) => setNewRateCard({ ...newRateCard, destPrefix: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Freight Mode</label>
                    <select
                      value={newRateCard.mode}
                      onChange={(e) => setNewRateCard({ ...newRateCard, mode: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
                    >
                      <option value="surface">Surface</option>
                      <option value="air">Air</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Transit SLA (Days)</label>
                    <input
                      type="number"
                      min="1"
                      value={newRateCard.slaDays}
                      onChange={(e) => setNewRateCard({ ...newRateCard, slaDays: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Min Weight (kg)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newRateCard.minWeight}
                      onChange={(e) => setNewRateCard({ ...newRateCard, minWeight: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Base Rate (₹)</label>
                    <input
                      type="number"
                      value={newRateCard.baseRate}
                      onChange={(e) => setNewRateCard({ ...newRateCard, baseRate: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Per Kg (₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newRateCard.perKgRate}
                      onChange={(e) => setNewRateCard({ ...newRateCard, perKgRate: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Fuel Sur (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newRateCard.fuelSurchargePct}
                      onChange={(e) =>
                        setNewRateCard({ ...newRateCard, fuelSurchargePct: Number(e.target.value) })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Docket (₹)</label>
                    <input
                      type="number"
                      value={newRateCard.docketCharge}
                      onChange={(e) => setNewRateCard({ ...newRateCard, docketCharge: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Publish Rate Card
                </button>
              </form>
            </div>

            {/* Right: Real-time Inquiries & Bookings */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Shipment Inquiries & Bookings</h3>
                  <p className="text-xs text-slate-500">Real-time bookings placed by shippers through LogiCompare</p>
                </div>
                <button
                  onClick={fetchVendorInquiries}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium hover:bg-slate-50"
                >
                  ↻ Refresh
                </button>
              </div>

              {vendorBookings.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No bookings received yet. Book a shipment from the Shipper Matrix to test live sync!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400">
                        <th className="pb-2 font-medium">Shipper</th>
                        <th className="pb-2 font-medium">Route</th>
                        <th className="pb-2 font-medium">Carrier</th>
                        <th className="pb-2 font-medium">Billable</th>
                        <th className="pb-2 font-medium">Total</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendorBookings.map((b) => (
                        <tr key={b.id} className="text-slate-700">
                          <td className="py-2.5">
                            <p className="font-semibold text-slate-900">{b.shipper_name}</p>
                            <p className="text-[10px] text-slate-400">{b.shipper_phone}</p>
                          </td>
                          <td className="py-2.5">
                            {b.origin_pin} → {b.dest_pin}
                            <span className="ml-1 text-[10px] text-slate-400">({b.mode})</span>
                          </td>
                          <td className="py-2.5 font-medium">{b.vendors?.name || 'Assigned'}</td>
                          <td className="py-2.5">{b.billable_weight} kg</td>
                          <td className="py-2.5 font-bold text-slate-900">₹{b.final_total}</td>
                          <td className="py-2.5">
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 5. "Book Now" Confirmation Modal */}
      {isModalOpen && selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-slate-900">Confirm Shipment Booking</h3>
            <p className="mt-1 text-xs text-slate-500">
              Booking carrier: <strong className="text-indigo-600">{selectedQuote.vendorName}</strong>
            </p>

            {/* Quote Summary Box */}
            <div className="my-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-100 space-y-1">
              <div className="flex justify-between">
                <span>Route:</span>
                <span className="font-semibold">{searchParams.originPin} → {searchParams.destPin}</span>
              </div>
              <div className="flex justify-between">
                <span>Transit SLA:</span>
                <span className="font-semibold">{selectedQuote.slaDays} Business Days</span>
              </div>
              <div className="flex justify-between">
                <span>Billable Weight:</span>
                <span className="font-semibold">{selectedQuote.billableWeight} kg</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold text-slate-900">
                <span>Total Payable (incl. GST):</span>
                <span>₹{selectedQuote.totalCost}</span>
              </div>
            </div>

            {bookingSuccess ? (
              <div className="rounded-xl bg-emerald-50 p-4 text-center text-xs font-bold text-emerald-700">
                🎉 Consignment RFQ Created Successfully! Vendor has been notified.
              </div>
            ) : (
              <form onSubmit={handleConfirmBooking} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Shipper / Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Acme Industrial Corp"
                    value={bookingForm.name}
                    onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Contact Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={bookingForm.phone}
                    onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Official Work Email</label>
                  <input
                    type="email"
                    required
                    placeholder="logistics@acmecorp.com"
                    value={bookingForm.email}
                    onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-1/2 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="w-1/2 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {bookingLoading ? 'Confirming...' : 'Place Order'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
