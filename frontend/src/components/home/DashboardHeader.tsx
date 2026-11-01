"use client";

import React from "react";
import { HardDrive, Layers, RefreshCw, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import type { WorkshopTelemetry } from "./types";
import { formatMmInUnit, LengthUnit, UNIT_OPTIONS } from "@/lib/units";

interface DashboardHeaderProps {
  telemetry: WorkshopTelemetry | null;
  backendStatus: "checking" | "online" | "offline";
  unit: LengthUnit;
  onUnitChange: (unit: LengthUnit) => void;
  onOpenRetentionModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function DashboardHeader({
  telemetry,
  backendStatus,
  unit,
  onUnitChange,
  onOpenRetentionModal,
  onRefresh,
  isRefreshing,
}: DashboardHeaderProps) {
  const totalStorageBytes = telemetry?.storage.total_bytes ?? 0;
  const activeCount = telemetry?.total_active_sessions ?? 0;
  const exportsCount = telemetry?.total_exports ?? 0;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#242A38]">
      <div className="flex items-center space-x-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Print Shop Command Center</span>
          </h1>
          <p className="text-xs text-slate-400">
            Unified prepress workstation, project registry &amp; batch intake
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Unit Selector */}
        <div className="flex items-center bg-[#131720] border border-[#242A38] rounded-lg px-2 py-1">
          <span className="text-[11px] text-slate-400 mr-1.5 font-medium">Unit:</span>
          <select
            value={unit}
            onChange={(e) => onUnitChange(e.target.value as LengthUnit)}
            className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
          >
            {UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#181D27] text-white">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Active Projects Telemetry */}
        <div
          className="flex items-center space-x-1.5 bg-[#131720] border border-[#242A38] px-2.5 py-1 rounded-lg text-slate-300"
          title={`Active Projects: ${activeCount} (${telemetry?.total_archived_sessions ?? 0} archived)`}
        >
          <Layers size={13} className="text-cyan-400" />
          <span className="font-semibold text-white">{activeCount}</span>
          <span className="text-[11px] text-slate-400">Projects</span>
        </div>

        {/* Storage Footprint & Retention Trigger */}
        <button
          type="button"
          onClick={onOpenRetentionModal}
          className="flex items-center space-x-1.5 bg-[#131720] hover:bg-slate-800 border border-[#242A38] px-2.5 py-1 rounded-lg text-slate-300 transition-colors cursor-pointer group"
          title="Storage footprint & export retention policy. Click to configure."
        >
          <HardDrive size={13} className="text-amber-400 group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-white">{formatBytes(totalStorageBytes)}</span>
          <span className="text-[10px] text-slate-400 flex items-center space-x-0.5">
            <Clock size={11} className="text-slate-500" />
            <span>Storage</span>
          </span>
        </button>

        {/* Refresh Telemetry */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1.5 bg-[#131720] hover:bg-slate-800 border border-[#242A38] rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh dashboard state"
        >
          <RefreshCw size={13} className={isRefreshing ? "animate-spin text-cyan-400" : ""} />
        </button>

        {/* Backend Status Badge */}
        <div
          className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[11px] font-semibold ${
            backendStatus === "online"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : backendStatus === "checking"
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
              : "bg-red-500/10 text-red-400 border-red-500/30"
          }`}
        >
          {backendStatus === "online" ? (
            <>
              <CheckCircle2 size={12} />
              <span>Online</span>
            </>
          ) : backendStatus === "checking" ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              <span>Connecting</span>
            </>
          ) : (
            <>
              <AlertCircle size={12} />
              <span>Engine Offline</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
