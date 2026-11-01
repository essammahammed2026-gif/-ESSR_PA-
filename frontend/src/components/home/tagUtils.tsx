"use client";

import React from "react";
import {
  Clock,
  PlayCircle,
  CheckCircle2,
  Tag,
  Bookmark,
  Flag,
  AlertCircle,
  Star,
  Flame,
  Zap,
  Shield,
  Sparkles,
  CheckSquare,
  HelpCircle,
  LucideIcon,
  BookOpen,
  LayoutGrid,
  Scissors,
  Book,
} from "lucide-react";
import type { CustomTag } from "./types";

export const AVAILABLE_TAG_ICONS: Record<string, LucideIcon> = {
  Clock,
  PlayCircle,
  CheckCircle2,
  Tag,
  Bookmark,
  Flag,
  AlertCircle,
  Star,
  Flame,
  Zap,
  Shield,
  Sparkles,
  CheckSquare,
};

export const AVAILABLE_TAG_COLORS = [
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "Fuchsia", hex: "#d946ef" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Slate", hex: "#94a3b8" },
];

export const DEFAULT_TAGS: CustomTag[] = [
  { id: "pending", name: "Pending", color: "#f59e0b", icon: "Clock" },
  { id: "in-progress", name: "In-Progress", color: "#06b6d4", icon: "PlayCircle" },
  { id: "done", name: "Done", color: "#10b981", icon: "CheckCircle2" },
];

export function resolveTag(tagId: string, customTags: CustomTag[] = []): CustomTag {
  const all = customTags.length > 0 ? customTags : DEFAULT_TAGS;
  const match = all.find((t) => t.id === tagId);
  if (match) return match;

  // Fallback for custom or unknown IDs
  return {
    id: tagId,
    name: tagId.charAt(0).toUpperCase() + tagId.slice(1).replace(/-/g, " "),
    color: "#06b6d4",
    icon: "Tag",
  };
}

export function TagIconComponent({
  iconName,
  size = 14,
  className = "",
  style,
}: {
  iconName: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = AVAILABLE_TAG_ICONS[iconName] || Tag || HelpCircle;
  return <Icon size={size} className={className} style={style} />;
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getStudioInfo(type: string) {
  switch (type) {
    case "book_scan":
      return {
        label: "Book Studio",
        icon: BookOpen,
        dotColor: "bg-amber-400",
        textColor: "text-amber-300",
      };
    case "imposing":
      return {
        label: "Imposition",
        icon: LayoutGrid,
        dotColor: "bg-cyan-400",
        textColor: "text-cyan-300",
      };
    case "contour":
      return {
        label: "Die-Cut",
        icon: Scissors,
        dotColor: "bg-fuchsia-400",
        textColor: "text-fuchsia-300",
      };
    case "flipbook":
      return {
        label: "3D Proof",
        icon: Book,
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-300",
      };
    default:
      return {
        label: "Prepress",
        icon: BookOpen,
        dotColor: "bg-slate-400",
        textColor: "text-slate-300",
      };
  }
}
