
"use client";

import React, { useState } from "react";
import { UserProfile } from "@/types/freight";
import { XMarkIcon } from "@/components/icons";
import { supabase } from "@/lib/supabaseClient";

interface AuthModalProps {
  onSuccess: (profile: UserProfile) => void;
  onClose: () => void;
}

export function AuthModal({ onSuccess, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"shipper" | "vendor">("shipper");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email,
            full_name: fullName,
            company_name: companyName,
            gstin,
            phone,
            role,
            vendor_id: role === "vendor" ? data.user.id : undefined,
            isRealUser: true
          };
          await supabase.from("profiles").upsert([profile]);
          onSuccess(profile);
          onClose();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const { data: pData } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
          if (pData) {
            onSuccess({ ...(pData as UserProfile), isRealUser: true });
          }
          onClose();
        }
      }
    } catch (err: any) {
      setMsg(err.message || "Auth error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900">{mode === "login" ? "Account Sign In" : "Register Logistics Enterprise"}</h3>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5" /></button>
        </div>

        {msg && <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded">{msg}</p>}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-600 mb-1">Business Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded p-2" />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded p-2" />
          </div>

          {mode === "signup" && (
            <>
              <div>
                <label className="block text-slate-600 mb-1">Full Name</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Company Name</label>
                <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">GSTIN</label>
                <input type="text" maxLength={15} value={gstin} onChange={(e) => setGstin(e.target.value)} className="w-full border rounded p-2 font-mono" />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full border rounded p-2">
                  <option value="shipper">Shipper (Manufacturer / Trader)</option>
                  <option value="vendor">Carrier / Transporter</option>
                </select>
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-2 rounded text-xs">
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2 border-t">
          {mode === "login" ? (
            <button onClick={() => setMode("signup")} className="text-indigo-600 hover:underline">Don't have an account? Sign up</button>
          ) : (
            <button onClick={() => setMode("login")} className="text-indigo-600 hover:underline">Already registered? Sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}
