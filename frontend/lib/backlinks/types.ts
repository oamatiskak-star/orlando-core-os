// Backlink Factory types (migratie 141/142). Spiegelt affiliate-programs.

export type BacklinkCategory =
  | 'owned' | 'directory_saas' | 'directory_ai' | 'directory_nl'
  | 'community' | 'blog_outreach' | 'pr' | 'other';

export type BacklinkStatus =
  | 'not_started' | 'queued' | 'submitted' | 'pending' | 'live' | 'rejected' | 'na';

export type BacklinkTargetRow = {
  id: string;
  site: string;
  name: string;
  category: BacklinkCategory;
  url: string | null;
  domain_rating: number | null;
  dofollow: boolean | null;
  cost: 'free' | 'freemium' | 'paid';
  tier: number;
  submit_status: BacklinkStatus;
  target_page: string | null;
  placement_url: string | null;
  notes: string | null;
  next_action_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BacklinkOverviewRow = {
  site: string;
  total_targets: number;
  live: number;
  in_progress: number;
  todo: number;
  referring_domains_live: number;
};

export const BACKLINK_CATEGORY_LABEL: Record<BacklinkCategory, string> = {
  owned: 'Owned (eigen kanalen)',
  directory_saas: 'SaaS / startup directory',
  directory_ai: 'AI directory',
  directory_nl: 'NL / EU directory',
  community: 'Community',
  blog_outreach: 'Blog outreach',
  pr: 'PR / pers',
  other: 'Overig',
};

export const BACKLINK_STATUS_LABEL: Record<BacklinkStatus, string> = {
  not_started: 'Not started',
  queued: 'Queued',
  submitted: 'Submitted',
  pending: 'Pending',
  live: 'Live',
  rejected: 'Rejected',
  na: 'N.v.t.',
};

export const BACKLINK_STATUS_OPTIONS: BacklinkStatus[] =
  ['not_started', 'queued', 'submitted', 'pending', 'live', 'rejected', 'na'];

export const BACKLINK_CATEGORY_OPTIONS: BacklinkCategory[] =
  ['owned', 'directory_saas', 'directory_ai', 'directory_nl', 'community', 'blog_outreach', 'pr', 'other'];
