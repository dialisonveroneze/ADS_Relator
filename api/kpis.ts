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
    
    // The API level parameter now matches our enum directly
    const levelParam = typedLevel;
    
    // Define fields based on level
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

    // Helper function to fetch data from Meta
    const fetchInsights = async (preset: string, enableBreakdown: boolean) => {
        let allData: any[] = [];
        
        // CRITICAL FIX: Filter to ONLY return rows with impressions > 0.
        // This prevents the API from returning pages of "empty" data for paused/deleted ads,
        // which causes timeouts and empty reports.
        const filtering = [{ field: 'impressions', operator: 'GREATER_THAN', value: 0 }];
        const filterParam = `&filtering=${encodeURIComponent(JSON.stringify(filtering))}`;
        
        // We use date_preset for everything now as it is safer than manual time_range calculations regarding timezones.
        // We enable time_increment=1 only for short ranges (last_X_days) to populate the chart.
        // For monthly presets, we disable it to prevent the known API bug returning empty lists.
        let url = `https://graph.facebook.com/v19.0/${accountId}/insights?` +
                  `level=${levelParam}` +
                  `&fields=${fields}` +
                  `&date_preset=${preset}` +
                  `${enableBreakdown ? '&time_increment=1' : ''}` +
                  `${filterParam}` + 
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
        
        // We only try to breakdown by day if it is NOT a monthly preset.
        // "Last X Days" presets work fine with time_increment=1.
        // "This/Last Month" do NOT work fine with time_increment=1 (API bug).
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
        // If daily fetch failed OR returned empty (possible strict filtering) OR we skipped it (monthly mode):
        // We fetch the total aggregate data. 
        // This ensures the TABLE always has data, even if the chart (daily) is empty.
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
            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
            
            return {
                id: `${entityId}_${item.date_start}_${Math.random()}`, // Unique Key
                entityId: entityId,
                name: entityName,
                level: typedLevel,
                date: item.date_start, // YYYY-MM-DD
                amountSpent: spend,
                impressions: impressions,
                cpm: cpm,
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
