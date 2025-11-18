
export interface AdAccount {
  id: string;
  name: string;
  balance: number;
  spendingLimit: number;
  amountSpent: number;
  currency: string;
}

export interface KpiData {
  id: string;
  entityId: string;
  name: string;
  level: DataLevel;
  date: string;
  amountSpent: number;
  impressions: number;
  cpm: number;
  reach: number;
  clicks: number;
  inlineLinkClicks: number;
  ctr: number;
  cpc: number;
  costPerInlineLinkClick: number;
}

export enum DataLevel {
  ACCOUNT = 'account',
  CAMPAIGN = 'campaign',
  AD_SET = 'adset',
  AD = 'ad',
}

export const DATA_LEVEL_LABELS: Record<DataLevel, string> = {
  [DataLevel.ACCOUNT]: 'Conta',
  [DataLevel.CAMPAIGN]: 'Campanha',
  [DataLevel.AD_SET]: 'Grupo de Anúncios',
  [DataLevel.AD]: 'Anúncio',
};

export type DateRangeOption = 'last_7_days' | 'last_14_days' | 'last_30_days' | 'this_month' | 'last_month';
