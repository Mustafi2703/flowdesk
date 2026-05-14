import type { TeamMember } from "./types";

export const TEAM: TeamMember[] = [
  { id: "rushabh", name: "Rushabh Shah", role: "director", dept: "Leadership", avatar: "RS", canAssign: true },
  { id: "vishven", name: "Vishven", role: "director", dept: "Leadership", avatar: "VD", canAssign: true },
  { id: "paumil", name: "Paumil", role: "account_manager", dept: "Account", avatar: "PA", canAssign: true },
  { id: "bhavesh", name: "Bhavesh", role: "account_manager", dept: "Account", avatar: "BH", canAssign: true },
  { id: "sanjana", name: "Sanjana", role: "marketing", dept: "Marketing", avatar: "SJ", canAssign: false },
  { id: "aarti", name: "Aarti", role: "sr_designer", dept: "Design", avatar: "AA", canAssign: false },
  { id: "poornima", name: "Poornima", role: "sr_designer", dept: "Design", avatar: "PO", canAssign: false },
  { id: "kalgi", name: "Kalgi", role: "designer", dept: "Design", avatar: "KA", canAssign: false },
  { id: "mohit", name: "Mohit", role: "designer", dept: "Design", avatar: "MO", canAssign: false },
  { id: "suhani", name: "Suhani", role: "intern_designer", dept: "Design", avatar: "SU", canAssign: false },
  { id: "aastha", name: "Aastha", role: "sr_content", dept: "Content", avatar: "AS", canAssign: false },
  { id: "karan", name: "Karan", role: "content", dept: "Content", avatar: "KR", canAssign: false },
  { id: "pari", name: "Pari", role: "intern_content", dept: "Content", avatar: "PA2", canAssign: false },
  { id: "apurv", name: "Apurv", role: "sr_editor", dept: "Video", avatar: "AP", canAssign: false },
  { id: "anthony", name: "Anthony", role: "editor", dept: "Video", avatar: "AN", canAssign: false },
  { id: "hariom", name: "Hari Om", role: "intern_editor", dept: "Video", avatar: "HO", canAssign: false },
  { id: "saumya", name: "Saumya", role: "ai_content", dept: "AI", avatar: "SA", canAssign: false },
  { id: "bhautik", name: "Bhautik", role: "brand_manager", dept: "Brand", avatar: "BU", canAssign: true },
  { id: "anushka", name: "Anushka", role: "brand_manager", dept: "Brand", avatar: "AU", canAssign: true },
  { id: "jaydip", name: "Jaydip", role: "developer", dept: "Dev", avatar: "JD", canAssign: false },
  { id: "siddhant", name: "Siddhant", role: "developer", dept: "Dev", avatar: "SD", canAssign: false },
];

export const ROLE_LABELS: Record<string, string> = {
  director: "Director",
  account_manager: "Account Manager",
  marketing: "Marketing",
  sr_designer: "Sr. Designer",
  designer: "Designer",
  intern_designer: "Intern Designer",
  sr_content: "Sr. Content Strategist",
  content: "Content Strategist",
  intern_content: "Intern Writer",
  sr_editor: "Sr. Video Editor",
  editor: "Video Editor",
  intern_editor: "Intern Editor",
  ai_content: "AI Content Creator",
  brand_manager: "Brand Manager",
  developer: "Developer",
};

export const DEPT_COLOR: Record<string, string> = {
  Leadership: "#f97316",
  Account: "#06b6d4",
  Marketing: "#ec4899",
  Design: "#a78bfa",
  Content: "#34d399",
  Video: "#fb923c",
  AI: "#38bdf8",
  Brand: "#fbbf24",
  Dev: "#4ade80",
};

export const BRANDS = [
  "Dinamoo",
  "HR",
  "Powerpalazzo",
  "Ayodhya",
  "Shree Ramji",
  "SRE",
  "Quick Furnish",
  "Pexlar",
  "Minotti Ahmedabad",
  "Minotti Mumbai",
  "SoulStory",
  "Reflection",
  "Eternix",
  "ASC",
  "Chiripal",
  "Polite Enterprise",
  "Aastha Group",
  "Parshwanath",
  "Curio",
  "SP",
  "Brickverse",
  "GCA",
  "Bel Ample",
  "Elements",
  "Naroto",
  "SmartiQo",
  "Roots of Gujarat",
  "Scrumfolks",
  "GESIA",
];

export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export const PRIORITY_COLOR: Record<string, string> = {
  Low: "#4ade80",
  Medium: "#fbbf24",
  High: "#fb923c",
  Urgent: "#ef4444",
};

export const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  assigned: { label: "Assigned", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  in_progress: { label: "In Progress", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  submitted: { label: "Submitted", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  issue: { label: "Issue Raised", color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  reviewed: { label: "Reviewed ✓", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  closed: { label: "Closed ✓✓", color: "#475569", bg: "rgba(71,85,105,0.12)" },
  changes: { label: "Changes Needed", color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
};

export function teamMember(id: string) {
  return TEAM.find((t) => t.id === id);
}

export function isManagerId(id: string) {
  return teamMember(id)?.canAssign ?? false;
}
