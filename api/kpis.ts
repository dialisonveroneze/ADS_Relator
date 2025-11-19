
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
  results: number;
  costPerResult: number;
  objective?: string;
  isPeriodTotal?: boolean;
}

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
    let fieldsList = ['spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks', 'actions', 'date_start', 'date_stop', 'objective'];
    
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

    // Helper function to format date as YYYY-MM-DD
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Calculate time_range manually
    const today = new Date();
    let since: string;
    let until: string = formatDate(today);

    switch (dateRange) {
        case 'last_7_days': {
            const d = new Date(today);
            d.setDate(today.getDate() - 7);
            since = formatDate(d);
            break;
        }
        case 'last_14_days': {
            const d = new Date(today);
            d.setDate(today.getDate() - 14);
            since = formatDate(d);
            break;
        }
        case 'last_30_days': {
            const d = new Date(today);
            d.setDate(today.getDate() - 30);
            since = formatDate(d);
            break;
        }
        case 'this_month': {
            const d = new Date(today.getFullYear(), today.getMonth(), 1);
            since = formatDate(d);
            break;
        }
        case 'last_month': {
            const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
            since = formatDate(firstDay);
            until = formatDate(lastDay);
            break;
        }
        default: {
            const d = new Date(today);
            d.setDate(today.getDate() - 14);
            since = formatDate(d);
        }
    }

    const timeRangeStr = JSON.stringify({ since, until });

    // Helper function to fetch data from Meta
    const fetchInsights = async (enableBreakdown: boolean) => {
        let allData: any[] = [];
        
        let url = `https://graph.facebook.com/v19.0/${accountId}/insights?` +
                  `level=${levelParam}` +
                  `&fields=${fields}` +
                  `&time_range=${timeRangeStr}` + 
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
        // Execute both requests in parallel:
        // 1. Daily breakdown (for Chart)
        // 2. Summary (for Table - correct totals)
        const [dailyRaw, summaryRaw] = await Promise.all([
             fetchInsights(true).catch(e => { 
                 console.warn("Daily fetch failed or empty", e.message); 
                 return []; 
             }),
             fetchInsights(false).catch(e => { 
                 console.warn("Summary fetch failed", e.message); 
                 return []; 
             })
        ]);

        if (dailyRaw.length === 0 && summaryRaw.length === 0) {
             return res.status(200).json([]);
        }

        const processData = (dataItems: any[], isPeriodTotal: boolean): KpiData[] => {
            return dataItems.map((item: any) => {
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
                
                // ----------- DYNAMIC RESULTS LOGIC -----------
                let resultsCount = 0;
                const objective = item.objective;
                const actions = item.actions || [];
                
                // Priority Configuration: Dynamic based on Objective
                let conversionPriorities: { key: string, mode: 'exact_first' | 'sum_partial' }[] = [];

                // Common conversion types
                const conversions = [
                    { key: 'messaging_conversation_started', mode: 'sum_partial' as const },
                    { key: 'leads', mode: 'sum_partial' as const },
                    { key: 'lead', mode: 'sum_partial' as const },
                    { key: 'purchase', mode: 'exact_first' as const },
                    { key: 'schedule', mode: 'sum_partial' as const },
                    { key: 'complete_registration', mode: 'sum_partial' as const },
                    { key: 'contact', mode: 'sum_partial' as const }, // Generic contact
                    { key: 'submit_application', mode: 'sum_partial' as const }
                ];
                
                // Check for Traffic or Engagement (including legacy names)
                const isTrafficOrEngagement = 
                    objective === 'OUTCOME_ENGAGEMENT' || 
                    objective === 'OUTCOME_TRAFFIC' || 
                    objective === 'TRAFFIC' || 
                    objective === 'MESSAGES' ||
                    objective === 'POST_ENGAGEMENT';

                // Determine priority order
                if (isTrafficOrEngagement) {
                    // For Engagement/Traffic, prioritize Conversations first
                    // Also included 'contact' which sometimes is used for messaging clicks
                    conversionPriorities = [
                        { key: 'messaging_conversation_started', mode: 'sum_partial' },
                        { key: 'contact', mode: 'sum_partial' },
                        { key: 'leads', mode: 'sum_partial' },
                        { key: 'lead', mode: 'sum_partial' },
                        { key: 'purchase', mode: 'exact_first' },
                        { key: 'schedule', mode: 'sum_partial' },
                        { key: 'complete_registration', mode: 'sum_partial' }
                    ];
                } else if (objective === 'OUTCOME_SALES' || objective === 'CONVERSIONS') {
                    // For Sales, prioritize Purchase
                    conversionPriorities = [
                        { key: 'purchase', mode: 'exact_first' },
                        { key: 'leads', mode: 'sum_partial' },
                        { key: 'lead', mode: 'sum_partial' },
                        { key: 'messaging_conversation_started', mode: 'sum_partial' },
                         // ...others
                         ...conversions.filter(c => !['purchase', 'leads', 'lead', 'messaging_conversation_started'].includes(c.key))
                    ];
                } else {
                    // Default / Leads / Awareness
                     conversionPriorities = [
                        { key: 'leads', mode: 'sum_partial' },
                        { key: 'lead', mode: 'sum_partial' },
                        { key: 'purchase', mode: 'exact_first' },
                        { key: 'messaging_conversation_started', mode: 'sum_partial' },
                        ...conversions.filter(c => !['purchase', 'leads', 'lead', 'messaging_conversation_started'].includes(c.key))
                     ];
                }

                // 1. Check for High Value Conversions
                for (const priority of conversionPriorities) {
                    if (priority.mode === 'exact_first') {
                        // Try exact match first (e.g. 'purchase' which is an aggregate)
                        let exactMatch = actions.find((a: any) => a.action_type === priority.key);
                        if (exactMatch) {
                            resultsCount = parseFloat(exactMatch.value);
                            if (resultsCount > 0) break; // Only break if we found a positive value
                        }
                    } else {
                        // SMART SUM LOGIC:
                        // First, check for common exact keys to avoid double counting
                        const exactKeys = [
                            `onsite_conversion.${priority.key}_7d`,
                            `${priority.key}_7d`,
                            `onsite_conversion.${priority.key}_1d`,
                            `${priority.key}_1d`,
                            `onsite_conversion.${priority.key}_28d`,
                            `${priority.key}_28d`
                        ];

                        let foundExact = false;
                        for (const k of exactKeys) {
                             const m = actions.find((a: any) => a.action_type === k);
                             if (m) {
                                 const val = parseFloat(m.value);
                                 if (val > 0) {
                                     resultsCount = val;
                                     foundExact = true;
                                     break;
                                 }
                             }
                        }

                        if (foundExact) {
                            break;
                        }

                        // Second, if no standard key found, fallback to summing partial matches
                        const matches = actions.filter((a: any) => a.action_type.includes(priority.key));
                        if (matches.length > 0) {
                            const sum = matches.reduce((acc: number, curr: any) => acc + parseFloat(curr.value), 0);
                            if (sum > 0) {
                                resultsCount = sum;
                                break;
                            }
                        }
                    }
                }

                // 2. If NO conversions found, fall back to Objective-based metrics
                let isReachBased = false;
                if (resultsCount === 0) {
                    if (objective === 'OUTCOME_TRAFFIC' || objective === 'LINK_CLICKS' || objective === 'TRAFFIC') {
                        resultsCount = inlineLinkClicks;
                    } 
                    else if (objective === 'OUTCOME_AWARENESS' || objective === 'BRAND_AWARENESS' || objective === 'REACH') {
                        resultsCount = reach;
                        isReachBased = true;
                    }
                }
                
                const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const cpc = clicks > 0 ? spend / clicks : 0;
                const costPerInlineLinkClick = inlineLinkClicks > 0 ? spend / inlineLinkClicks : 0;
                
                // Cost Per Result Calculation
                const costPerResult = resultsCount > 0 
                    ? (spend / resultsCount) * (isReachBased ? 1000 : 1) 
                    : 0;
                
                const uniqueId = isPeriodTotal 
                    ? `${entityId}_summary`
                    : `${entityId}_${item.date_start}`;

                return {
                    id: uniqueId,
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
                    costPerInlineLinkClick: costPerInlineLinkClick,
                    results: resultsCount,
                    costPerResult: costPerResult,
                    objective: objective,
                    isPeriodTotal: isPeriodTotal
                };
            });
        };

        const dailyFormatted = processData(dailyRaw, false);
        const summaryFormatted = processData(summaryRaw, true);

        // Return combined dataset
        res.status(200).json([...dailyFormatted, ...summaryFormatted]);

    } catch (error: any) {
        console.error(`Erro interno KPI:`, error);
        if (error.code === 190) {
             return res.status(401).json({ message: 'Token de acesso inválido ou expirado.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
}
