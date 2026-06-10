// Von Worker und Frontend gemeinsam genutzte Typen.

export type Role = "mitglied" | "vorstand";
export type DrinkSource = "mitglied" | "tresen" | "admin";

export interface PublicMember {
  id: number;
  name: string;
  color: string;
  role: Role;
}

export interface AdminMember extends PublicMember {
  active: boolean;
  createdAt: number;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  freeText: boolean;
  active: boolean;
}

export interface Drink {
  id: number;
  memberId: number;
  memberName?: string;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  note: string | null;
  source: DrinkSource;
  createdAt: number;
}

export interface MeSummary {
  today: Drink[];
  monthCounts: { categoryId: number; count: number }[];
}

export interface OverviewRow {
  memberId: number;
  memberName: string;
  active: boolean;
  counts: Record<number, number>;
  total: number;
}

export interface StatsResponse {
  perDay: { date: string; counts: Record<number, number> }[];
  topDrinkers: { memberId: number; memberName: string; count: number }[];
  heatmap: number[][]; // [weekday 0=Mo..6=So][hour 0..23]
  total: number;
}

export interface LogEntry extends Drink {
  deletedAt: number | null;
  deletedByName: string | null;
}

export interface AuditEntry {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: string;
  details: string | null;
  createdAt: number;
}

export interface ClubSettings {
  clubName: string;
  logo: string | null; // data-URL
}

export interface QueuedBooking {
  clientId: string;
  categoryId: number;
  note: string | null;
  createdAt: number;
}
