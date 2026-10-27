"use client";

import React, { useState, useEffect, useRef } from "react";

export function Hero3DTruck() {
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

      // 1. Perspective Road Perspective Guidelines
      ctx.save();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
      ctx.lineWidth = 1;
      for (let i = -140; i <= 140; i += 28) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 1.8, cy + 50);
        ctx.lineTo(cx + i * 0.5, cy - 20);
        ctx.stroke();
      }

      // Moving Highway Road Dashed Line
      const stripeOffset = (Date.now() / (speed === "turbo" ? 35 : 75)) % 40;
      ctx.strokeStyle = "rgba(52, 211, 153, 0.5)";
      ctx.lineWidth = 2;
      for (let y = -20; y < 60; y += 20) {
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy + y + stripeOffset);
        ctx.lineTo(cx - 2, cy + y + stripeOffset + 10);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Chassis Ground Drop Shadow
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 30, 85, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Truck Vehicle Assembly
      ctx.save();
      ctx.translate(cx, cy);

      // A. Cargo Container Box
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

      // Corrugated Container Vertical Ribs
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      for (let rx = -70; rx < 10; rx += 8) {
        ctx.beginPath();
        ctx.moveTo(rx, -36);
        ctx.lineTo(rx, 8);
        ctx.stroke();
      }

      // Container Branding & Fleet Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText("LOGICOMPARE B2B", -68, -12);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 7px sans-serif";
      ctx.fillText("EXPRESS CARGO LINEHAUL", -68, -2);

      // B. Driver Cabin Aerodynamic Shell
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

      // Windshield Glass with Sunlight Reflection
      ctx.fillStyle = "rgba(186, 230, 253, 0.85)";
      ctx.beginPath();
      ctx.moveTo(38, -25);
      ctx.lineTo(50, -9);
      ctx.lineTo(24, -9);
      ctx.lineTo(24, -25);
      ctx.closePath();
      ctx.fill();

      // Front Headlight Beam Ray
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

      // C. Heavy-Duty Multi-Axle Rotating Wheels
      wheelAngle += speed === "turbo" ? 0.35 : 0.16;
      const wheelPositions = [-62, -42, 28, 46];
      wheelPositions.forEach((wx) => {
        ctx.save();
        ctx.translate(wx, 14);
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
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
    <div className="relative flex flex-col items-center bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-xl w-full max-w-sm">
      <div className="flex items-center justify-between w-full px-2 mb-1">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-mono font-bold text-slate-200">3D Linehaul Container Transit</span>
        </div>
        <button
          onClick={() => setSpeed(speed === "normal" ? "turbo" : "normal")}
          className="text-[10px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-900/60 border border-indigo-500/40 px-2.5 py-1 rounded-full hover:bg-indigo-800 transition"
        >
          {speed === "turbo" ? "⚡ Turbo Speed" : "▶ Normal Transit"}
        </button>
      </div>

      <canvas ref={canvasRef} width={340} height={170} className="w-full max-w-[340px] h-[170px]" />

      <div className="flex items-center justify-between w-full text-[10px] text-slate-400 pt-2 border-t border-slate-800 font-mono">
        <span>Vehicle: 32ft MXL Container</span>
        <span className="text-emerald-400 font-bold">GPS Active • Linehaul</span>
      </div>
    </div>
  );
}
