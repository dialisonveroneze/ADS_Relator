
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
  reach: number;
  clicks: number;
  linkClicks: number;
  results: number;
  costPerResult: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export enum DataLevel {
  ACCOUNT = 'Conta',
  CAMPAIGN = 'Campanha',
  AD_SET = 'Grupo de Anúncios',
  AD = 'Anúncio',
}