
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
    // Added actions to calculate results and objective to determine WHAT the result is
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

    // Calculate time_range manually to ensure compatibility with time_increment=1
    // Using time_range instead of date_preset fixes issues with monthly views returning empty data when broken down by day.
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
            // First day of previous month
            const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            // Last day of previous month (day 0 of current month)
            const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
            since = formatDate(firstDay);
            until = formatDate(lastDay);
            break;
        }
        default: {
            // Default fallback
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
        
        let allInsights: any[] = [];
        
        // Always try to fetch daily breakdown first to populate the chart
        // Since we are using explicit time_range, this should work for 'this_month' and 'last_month' too.
        try {
            allInsights = await fetchInsights(true);
        } catch (err: any) {
            if (err.code === 190) throw err; // Auth error, fail immediately
            console.warn("Daily fetch failed, falling back to aggregate.", err.message);
        }

        // FALLBACK / AGGREGATE MODE
        // If daily fetch returned no data (or failed silently), try fetching without breakdown to at least show the table totals.
        if (allInsights.length === 0) {
            console.log("Fetching aggregate data (fallback)...");
            try {
                allInsights = await fetchInsights(false);
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
            
            // ----------- DYNAMIC RESULTS LOGIC -----------
            let resultsCount = 0;
            const objective = item.objective; // e.g., OUTCOME_AWARENESS, OUTCOME_TRAFFIC, OUTCOME_LEADS

            // 1. Awareness Campaigns: Result = Reach
            if (objective === 'OUTCOME_AWARENESS' || objective === 'BRAND_AWARENESS' || objective === 'REACH') {
                resultsCount = reach;
            } 
            // 2. Traffic Campaigns: Result = Link Clicks
            else if (objective === 'OUTCOME_TRAFFIC' || objective === 'LINK_CLICKS') {
                resultsCount = inlineLinkClicks;
            } 
            // 3. Conversion/Engagement Campaigns: Result = Specific Actions
            else {
                const actions = item.actions || [];
                
                // List of actions that count as "Results" for performance campaigns
                // Includes pixel events and messaging events (WhatsApp, Instagram Direct, Messenger)
                const conversionActions = [
                    'purchase', 
                    'offsite_conversion.fb_pixel_purchase',
                    'lead', 
                    'offsite_conversion.fb_pixel_lead',
                    'complete_registration', 
                    'offsite_conversion.fb_pixel_complete_registration',
                    'submit_application', 
                    'schedule', 
                    'contact',
                    'mobile_app_install',
                    // Messaging Conversions (Critical for Engagement campaigns)
                    'onsite_conversion.messaging_conversation_started_7d',
                    'messaging_conversation_started_7d',
                    'onsite_conversion.messaging_first_reply'
                ];
                
                if (Array.isArray(actions)) {
                    actions.forEach((action: any) => {
                        // Check if the action type matches one of our key conversion metrics
                        if (conversionActions.includes(action.action_type)) {
                            resultsCount += parseFloat(action.value);
                        }
                    });
                }
            }
            
            // Calculate rates locally for the row
            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const cpc = clicks > 0 ? spend / clicks : 0;
            const costPerInlineLinkClick = inlineLinkClicks > 0 ? spend / inlineLinkClicks : 0;
            const costPerResult = resultsCount > 0 ? spend / resultsCount : 0;
            
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
                costPerInlineLinkClick: costPerInlineLinkClick,
                results: resultsCount,
                costPerResult: costPerResult
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
