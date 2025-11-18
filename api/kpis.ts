// api/kpis.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

// Definindo tipos localmente para evitar erros de resolução de módulo no ambiente serverless (Vercel)
export enum DataLevel {
  ACCOUNT = 'account',
  CAMPAIGN = 'campaign',
  AD_SET = 'adset',
  AD = 'ad',
}

export type DateRangeOption = 'last_7_days' | 'last_14_days' | 'last_30_days' | 'this_month' | 'last_month';

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

// Mapeia nossas opções de período para os presets da API da Meta
const datePresetMap: Record<DateRangeOption, string> = {
    'last_7_days': 'last_7d',
    'last_14_days': 'last_14d',
    'last_30_days': 'last_30d',
    'this_month': 'this_month',
    'last_month': 'last_month',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies.meta_token;

    if (!accessToken) {
        return res.status(401).json({ message: 'Não autorizado: Token não encontrado.' });
    }

    const { accountId, level, dateRange: dateRangeQuery } = req.query;

    // Validate required parameters
    if (!accountId || typeof accountId !== 'string' || !level || typeof level !== 'string') {
        return res.status(400).json({ message: 'ID da conta e nível são obrigatórios.' });
    }
    
    // Ensure the level is valid based on our enum
    if (!Object.values(DataLevel).includes(level as DataLevel)) {
         return res.status(400).json({ message: 'Nível de dados inválido.' });
    }

    const typedLevel = level as DataLevel;
    const dateRange = (dateRangeQuery || 'last_14_days') as DateRangeOption;
    
    // The API level parameter now matches our enum directly
    const levelParam = typedLevel;
    
    // Define fields based on level
    // Added reach, clicks, inline_link_clicks (proxy for Results/Traffic)
    let fieldsList = ['spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks', 'date_start', 'date_stop'];
    
    switch (typedLevel) {
        case DataLevel.ACCOUNT:
            fieldsList.push('account_id', 'account_name');
            break;
        case DataLevel.CAMPAIGN:
            fieldsList.push('campaign_id', 'campaign_name');
            break;
        case DataLevel.AD_SET:
            fieldsList.push('campaign_id', 'campaign_name', 'adset_id', 'adset_name');
            break;
        case DataLevel.AD:
            fieldsList.push('campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name');
            break;
    }

    const fields = fieldsList.join(',');

    // Helper function to fetch data from Meta
    const fetchInsights = async (preset: string, enableBreakdown: boolean) => {
        let allData: any[] = [];
        
        let url = `https://graph.facebook.com/v19.0/${accountId}/insights?` +
                  `level=${levelParam}` +
                  `&fields=${fields}` +
                  `&date_preset=${preset}` +
                  `${enableBreakdown ? '&time_increment=1' : ''}` +
                  `&limit=100&access_token=${accessToken}`;

        while (url) {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                 throw data.error;
            }

            if (data.data && Array.isArray(data.data)) {
                allData = allData.concat(data.data);
            }
            
            url = data.paging && data.paging.next ? data.paging.next : null;
        }
        return allData;
    };

    try {
        const preset = datePresetMap[dateRange];
        
        const tryDailyBreakdown = !['this_month', 'last_month'].includes(dateRange);
        
        let allInsights: any[] = [];

        if (tryDailyBreakdown) {
            try {
                // Attempt 1: Get daily data for the chart
                allInsights = await fetchInsights(preset, true);
            } catch (err: any) {
                if (err.code === 190) throw err; // Auth error, fail immediately
                console.warn("Daily fetch failed, falling back to aggregate.", err.message);
            }
        }

        // FALLBACK / AGGREGATE MODE
        if (allInsights.length === 0) {
            console.log("Fetching aggregate data (fallback)...");
            try {
                allInsights = await fetchInsights(preset, false);
            } catch (retryErr) {
                console.error("Fallback fetch failed", retryErr);
            }
        }

        if (allInsights.length === 0) {
             return res.status(200).json([]);
        }

        const formattedKpi: KpiData[] = allInsights.map((item: any) => {
            let entityId: string;
            let entityName: string;
            
            const safeAccountId = item.account_id || accountId;

            switch (typedLevel) {
                case DataLevel.ACCOUNT:
                    entityId = safeAccountId;
                    entityName = item.account_name || "Resumo da Conta";
                    break;
                case DataLevel.CAMPAIGN:
                    entityId = item.campaign_id || "unknown_campaign";
                    entityName = item.campaign_name || "(Campanha Desconhecida)";
                    break;
                case DataLevel.AD_SET:
                    entityId = item.adset_id || "unknown_adset";
                    entityName = item.adset_name || "(Grupo Desconhecido)";
                    break;
                case DataLevel.AD:
                    entityId = item.ad_id || "unknown_ad";
                    entityName = item.ad_name || "(Anúncio Desconhecido)";
                    break;
                default:
                     entityId = safeAccountId;
                     entityName = "Desconhecido";
            }
            
            const spend = parseFloat(item?.spend ?? '0');
            const impressions = parseInt(item?.impressions ?? '0', 10);
            const reach = parseInt(item?.reach ?? '0', 10);
            const clicks = parseInt(item?.clicks ?? '0', 10);
            const inlineLinkClicks = parseInt(item?.inline_link_clicks ?? '0', 10);
            
            // Calculate rates locally for the row
            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const cpc = clicks > 0 ? spend / clicks : 0;
            const costPerInlineLinkClick = inlineLinkClicks > 0 ? spend / inlineLinkClicks : 0;
            
            return {
                id: `${entityId}_${item.date_start}_${Math.random()}`, // Unique Key
                entityId: entityId,
                name: entityName,
                level: typedLevel,
                date: item.date_start, // YYYY-MM-DD
                amountSpent: spend,
                impressions: impressions,
                reach: reach,
                clicks: clicks,
                inlineLinkClicks: inlineLinkClicks,
                cpm: cpm,
                ctr: ctr,
                cpc: cpc,
                costPerInlineLinkClick: costPerInlineLinkClick
            };
        });

        res.status(200).json(formattedKpi);

    } catch (error: any) {
        console.error(`Erro interno KPI:`, error);
        if (error.code === 190) {
             return res.status(401).json({ message: 'Token de acesso inválido ou expirado.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
}