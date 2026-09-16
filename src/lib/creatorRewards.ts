export type CreatorTierId = "starter" | "basic" | "pro";

export interface CreatorTier {
  id: CreatorTierId;
  name: string;
  reward: string;
  views: number;
  signups: number;
  cta: string;
  featured?: boolean;
}

/** Milestone table — mirrored 1:1 by the server-side eligibility check. */
export const CREATOR_TIERS: CreatorTier[] = [
  { id: "starter", name: "Starter", reward: "1 Month Starter Plan Free", views: 5000, signups: 20, cta: "Claim Starter" },
  { id: "basic", name: "Basic", reward: "1 Month Basic Plan Free", views: 15000, signups: 50, cta: "Claim Basic" },
  { id: "pro", name: "Pro", reward: "1 Month Pro Plan Free", views: 40000, signups: 150, cta: "Claim Pro", featured: true },
];

export const REWARD_DAYS = 30;

/** Both conditions must be met. Display-only — the backend re-checks on approval. */
export const isTierEligible = (tier: CreatorTier, views: number, signups: number) =>
  views >= tier.views && signups >= tier.signups;

/** Highest tier the creator currently qualifies for (null if none). */
export const highestEligibleTier = (views: number, signups: number): CreatorTier | null => {
  for (let i = CREATOR_TIERS.length - 1; i >= 0; i--) {
    if (isTierEligible(CREATOR_TIERS[i], views, signups)) return CREATOR_TIERS[i];
  }
  return null;
};

/** Next tier to aim for, used for progress display. */
export const nextTier = (views: number, signups: number): CreatorTier => {
  const current = highestEligibleTier(views, signups);
  if (!current) return CREATOR_TIERS[0];
  const idx = CREATOR_TIERS.findIndex((t) => t.id === current.id);
  return CREATOR_TIERS[Math.min(idx + 1, CREATOR_TIERS.length - 1)];
};

export const PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram Reels" },
  { id: "youtube", label: "YouTube Shorts" },
  { id: "x", label: "X" },
  { id: "other", label: "Other" },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]["id"];

const HOSTS: Record<PlatformId, string[]> = {
  tiktok: ["tiktok.com", "vm.tiktok.com"],
  instagram: ["instagram.com", "instagr.am"],
  youtube: ["youtube.com", "youtu.be", "m.youtube.com"],
  x: ["x.com", "twitter.com"],
  other: [],
};

/** Rejects arbitrary URLs — the link must be a real post on the chosen platform. */
export const validateVideoUrl = (url: string, platform: PlatformId): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return "Enter a full video link starting with https://";
  }
  if (parsed.protocol !== "https:") return "The link must start with https://";
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (platform === "other") {
    if (!parsed.pathname || parsed.pathname === "/") return "Link to the specific post, not a profile or homepage.";
    return null;
  }
  const allowed = HOSTS[platform];
  if (!allowed.some((h) => host === h || host.endsWith(`.${h}`))) {
    return `That link isn't a ${PLATFORMS.find((p) => p.id === platform)?.label} post.`;
  }
  if (!parsed.pathname || parsed.pathname === "/") return "Link to the specific video, not a profile page.";
  return null;
};

export const CLAIM_RULES = [
  "Your video must include your Testio referral link in your bio or caption.",
  "No bot views or fake engagement.",
  "No purchased or fake signups.",
  "Submit when your video has reached its peak verified views.",
  "Your analytics screenshot must clearly show the relevant view information.",
  "Testio may reject fraudulent or misleading submissions.",
  "Disclose the incentive (free plan reward) where the platform or local advertising rules require it.",
];

export const UGC_RULES = [
  "Content must genuinely promote or discuss Testio.",
  "Content must be original or meaningfully created by you.",
  "No bots.",
  "No fake engagement.",
  "No purchased or fake views.",
  "No purchased or fake signups.",
  "No duplicate accounts.",
  "Self-referrals do not count.",
  "Submitted videos must stay publicly available for verification.",
  "Testio can reject fraudulent or misleading submissions.",
  "Disclose the incentive or free plan when platform rules require it.",
];
