// api/kpis.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';
import { KpiData, DataLevel, DateRangeOption } from '../types';

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
    
    // The API level parameter now matches our enum directly (account, campaign, adset, ad)
    const levelParam = typedLevel;
    
    // Define fields based on level to avoid requesting invalid fields for the aggregation level
    let fieldsList = ['spend', 'impressions', 'date_start', 'date_stop'];
    
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

    // Helper function to fetch data from Meta, handling pagination
    const fetchInsights = async (timeQuery: string, enableBreakdown: boolean) => {
        let allData: any[] = [];
        let url = `https://graph.facebook.com/v19.0/${accountId}/insights?level=${levelParam}&fields=${fields}${timeQuery}${enableBreakdown ? '&time_increment=1' : ''}&limit=100&access_token=${accessToken}`;

        while (url) {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                 // Propagate error to be handled by the caller
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
        let timeQuery = '';
        let shouldBreakdown = false;
        
        const today = new Date();
        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        // STRATEGY: 
        // 1. For "This Month" / "Last Month", use date_preset and DISABLE breakdown. 
        //    Mixing presets + time_increment often causes empty data returns in Meta API v19+.
        // 2. For "Last X Days", use explicit time_range and ENABLE breakdown.
        //    Explicit ranges are more robust for granular data.

        if (['this_month', 'last_month'].includes(dateRange)) {
             timeQuery = `&date_preset=${datePresetMap[dateRange]}`;
             shouldBreakdown = false; 
        } else {
             const end = new Date();
             const start = new Date();
             
             // Note: We calculate dates in UTC (Server time). 
             // Ideally, we should know the Ad Account timezone, but this is a robust approximation.
             if (dateRange === 'last_7_days') start.setDate(today.getDate() - 7);
             else if (dateRange === 'last_14_days') start.setDate(today.getDate() - 14);
             else if (dateRange === 'last_30_days') start.setDate(today.getDate() - 30);
             
             const rangeJSON = JSON.stringify({ since: formatDate(start), until: formatDate(end) });
             timeQuery = `&time_range=${encodeURIComponent(rangeJSON)}`;
             shouldBreakdown = true;
        }

        let allInsights: any[] = [];

        try {
            // Attempt 1: Fetch with the preferred strategy (likely with breakdown for days)
            allInsights = await fetchInsights(timeQuery, shouldBreakdown);
        } catch (err: any) {
            // If it's an Auth error (190), stop immediately.
            if (err.code === 190) throw err;
            
            // If it's another error and we were trying to breakdown, log and fall through to retry
            console.warn("Initial fetch failed, attempting fallback.", err.message);
        }

        // FAILSAFE / FALLBACK:
        // If the first attempt returned NO DATA (empty array) AND we were trying to get a daily breakdown,
        // it's possible the API is strict about limits or low-volume data.
        // We try again WITHOUT breakdown to ensure the user at least sees the TOTALS in the table.
        if (allInsights.length === 0 && shouldBreakdown) {
            console.log("Daily breakdown returned empty. Retrying with aggregate data...");
            try {
                allInsights = await fetchInsights(timeQuery, false);
            } catch (retryErr) {
                console.error("Fallback fetch also failed", retryErr);
                // If fallback fails, we just return the empty array or the previous error state
            }
        }

        if (allInsights.length === 0) {
             return res.status(200).json([]);
        }

        const formattedKpi: KpiData[] = allInsights.map((item: any) => {
            let entityId: string;
            let entityName: string;

            // Fallback ID logic
            const safeAccountId = item.account_id || accountId;

            switch (typedLevel) {
                case DataLevel.ACCOUNT:
                    entityId = safeAccountId;
                    entityName = item.account_name || "Resumo da Conta";
                    break;
                case DataLevel.CAMPAIGN:
                    entityId = item.campaign_id || `camp_${Math.random().toString(36).substr(2, 9)}`;
                    entityName = item.campaign_name || "(Campanha sem nome)";
                    break;
                case DataLevel.AD_SET:
                    entityId = item.adset_id || `adset_${Math.random().toString(36).substr(2, 9)}`;
                    entityName = `${item.campaign_name || "?"} > ${item.adset_name || "(Grupo sem nome)"}`;
                    break;
                case DataLevel.AD:
                    entityId = item.ad_id || `ad_${Math.random().toString(36).substr(2, 9)}`;
                    entityName = `${item.campaign_name || "?"} > ${item.adset_name || "?"} > ${item.ad_name || "(Anúncio sem nome)"}`;
                    break;
                default:
                     entityId = safeAccountId;
                     entityName = "(Desconhecido)";
            }
            
            const spend = parseFloat(item?.spend ?? '0');
            const impressions = parseInt(item?.impressions ?? '0', 10);
            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
            
            return {
                id: `${entityId}_${item.date_start}`, // Unique ID for React key
                entityId: entityId,
                name: entityName,
                level: typedLevel,
                date: item.date_start,
                amountSpent: spend,
                impressions: impressions,
                cpm: cpm,
            };
        });

        res.status(200).json(formattedKpi);

    } catch (error: any) {
        console.error(`Erro interno ao buscar KPIs para ${accountId}:`, error);
        if (error.code === 190) {
             return res.status(401).json({ message: 'Token de acesso inválido ou expirado.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
}
