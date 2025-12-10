
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

enum DataLevel {
  ACCOUNT = 'account',
  CAMPAIGN = 'campaign',
  AD_SET = 'adset', // Mapped to AdGroup
  AD = 'ad',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies.google_access_token;
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;

    if (!accessToken || !developerToken) {
        return res.status(401).json({ message: 'Não autorizado ou configuração inválida.' });
    }

    const { accountId, level, dateRange } = req.query;
    
    // Date Logic
    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    let startDate = formatDate(new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000));
    let endDate = formatDate(today);
    
    if (dateRange === 'last_7_days') startDate = formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
    if (dateRange === 'last_30_days') startDate = formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
    // ... add other ranges if needed

    // GAQL Query Construction
    let query = '';
    let resource = '';
    
    // Select basic metrics compatible with our dashboard
    // Note: Google costs are in micros (1/1,000,000)
    const metrics = `
        segments.date, 
        metrics.cost_micros, 
        metrics.impressions, 
        metrics.clicks, 
        metrics.ctr, 
        metrics.average_cpc, 
        metrics.conversions, 
        metrics.cost_per_conversion
    `;

    switch (level) {
        case DataLevel.ACCOUNT:
            resource = 'customer';
            query = `SELECT ${metrics} FROM customer WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`;
            break;
        case DataLevel.CAMPAIGN:
            resource = 'campaign';
            query = `SELECT campaign.id, campaign.name, ${metrics} FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`;
            break;
        case DataLevel.AD_SET:
             resource = 'ad_group';
             query = `SELECT ad_group.id, ad_group.name, ${metrics} FROM ad_group WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`;
             break;
        case DataLevel.AD:
             resource = 'ad_group_ad';
             query = `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ${metrics} FROM ad_group_ad WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`;
             break;
        default:
            return res.status(400).json({ message: 'Nível inválido' });
    }

    try {
        const response = await fetch(`https://googleads.googleapis.com/v14/customers/${accountId}/googleAds:search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
                'Content-Type': 'application/json',
                'login-customer-id': accountId // Usually required if acting as manager, strictly speaking accountId is target
            },
            body: JSON.stringify({ query })
        });

        const data = await response.json();
        
        if (data.error) throw data.error;

        const results = data.results || [];
        
        // Map to KpiData
        const formattedData = results.map((row: any) => {
            const m = row.metrics;
            const segmentDate = row.segments.date;
            
            let id = '';
            let name = '';

            if (level === DataLevel.ACCOUNT) {
                id = accountId as string;
                name = 'Conta Google';
            } else if (level === DataLevel.CAMPAIGN) {
                id = row.campaign.id;
                name = row.campaign.name;
            } else if (level === DataLevel.AD_SET) {
                id = row.adGroup.id;
                name = row.adGroup.name;
            } else if (level === DataLevel.AD) {
                id = row.adGroupAd.ad.id || 'N/A';
                name = row.adGroupAd.ad.name || 'Anúncio';
            }

            const spend = (parseInt(m.costMicros) || 0) / 1000000;
            const impressions = parseInt(m.impressions) || 0;
            const clicks = parseInt(m.clicks) || 0;
            const conversions = parseFloat(m.conversions) || 0;

            // Computed
            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
            const ctr = (parseFloat(m.ctr) || 0) * 100; // Google returns 0.05 for 5%
            const cpc = (parseFloat(m.averageCpc) || 0) / 1000000;
            const costPerResult = conversions > 0 ? spend / conversions : 0;

            return {
                id: `${id}_${segmentDate}`,
                entityId: id,
                name: name,
                level: level,
                date: segmentDate,
                amountSpent: spend,
                impressions: impressions,
                reach: impressions, // Approx for Google Search
                clicks: clicks,
                inlineLinkClicks: clicks, // Approx
                ctr: ctr,
                cpc: cpc,
                cpm: cpm,
                costPerInlineLinkClick: cpc,
                results: conversions,
                costPerResult: costPerResult,
                objective: 'CONVERSIONS', // generic
                isPeriodTotal: false
            };
        });

        res.status(200).json(formattedData);

    } catch (error) {
        console.error("Google KPI Error:", error);
        res.status(500).json({ message: 'Erro ao buscar KPIs do Google.' });
    }
}
