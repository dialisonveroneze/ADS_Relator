
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
}

export enum DataLevel {
  ACCOUNT = 'Conta',
  CAMPAIGN = 'Campanha',
  AD_SET = 'Grupo de Anúncios',
  AD = 'Anúncio',
}

export type DateRangeOption = 'last_7_days' | 'last_14_days' | 'last_30_days' | 'this_month' | 'last_month';