export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';

export interface Plan {
  maxRepos: number;
  maxPRsPerMonth: number;
  historyDays: number;
  maxTeamMembers: number;
  hasEngineeringHealth: boolean;
  hasDashboard: boolean;
  priceMonthly: number;
}

export const PLANS: Record<PlanTier, Plan> = {
  free: {
    maxRepos: 1,
    maxPRsPerMonth: 50,
    historyDays: 30,
    maxTeamMembers: 3,
    hasEngineeringHealth: false,
    hasDashboard: true,           // everyone sees the dashboard
    priceMonthly: 0,
  },
  starter: {
    maxRepos: 1,
    maxPRsPerMonth: Infinity,
    historyDays: 90,
    maxTeamMembers: 10,
    hasEngineeringHealth: false,
    hasDashboard: true,
    priceMonthly: 19900,
  },
  professional: {
    maxRepos: 5,
    maxPRsPerMonth: Infinity,
    historyDays: Infinity,
    maxTeamMembers: Infinity,
    hasEngineeringHealth: true,
    hasDashboard: true,
    priceMonthly: 59900,
  },
  enterprise: {
    maxRepos: Infinity,
    maxPRsPerMonth: Infinity,
    historyDays: Infinity,
    maxTeamMembers: Infinity,
    hasEngineeringHealth: true,
    hasDashboard: true,
    priceMonthly: 149900,
  },
};

export function getPlan(tier: string): Plan {
  return PLANS[tier as PlanTier] ?? PLANS.free;
}
