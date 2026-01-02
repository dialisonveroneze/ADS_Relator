
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

enum DataLevel {
  ACCOUNT = 'account',
  CAMPAIGN = 'campaign',
  AD_SET = 'adset',
  AD = 'ad',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies.google_access_token;
    const developerToken = (process.env.GOOGLE_DEVELOPER_TOKEN || '').trim();

    if (!accessToken || !developerToken) {
        return res.status(401).json({ message: 'Token de acesso ou Developer Token ausente.' });
    }

    const { accountId, level, dateRange } = req.query;
    
    if (!accountId || typeof accountId !== 'string' || !level || typeof level !== 'string') {
        return res.status(400).json({ message: 'Parâmetros obrigatórios ausentes.' });
    }
    
    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    let startDate = formatDate(new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000));
    let endDate = formatDate(today);
    
    if (dateRange === 'last_7_days') startDate = formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
    else if (dateRange === 'last_30_days') startDate = formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
    else if (dateRange === 'this_month') startDate = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
    else if (dateRange === 'last_month') {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);
        startDate = formatDate(first);
        endDate = formatDate(last);
    }

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

    let query = '';
    switch (level) {
        case DataLevel.ACCOUNT:
            query = `SELECT ${metrics} FROM customer WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`;
            break;
        case DataLevel.CAMPAIGN:
            query = `SELECT campaign.id, campaign.name, ${metrics} FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND campaign.status = 'ENABLED'`;
            break;
        case DataLevel.AD_SET:
             query = `SELECT ad_group.id, ad_group.name, ${metrics} FROM ad_group WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND ad_group.status = 'ENABLED'`;
             break;
        case DataLevel.AD:
             query = `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ${metrics} FROM ad_group_ad WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' AND ad_group_ad.status = 'ENABLED'`;
             break;
        default:
            return res.status(400).json({ message: 'Nível inválido' });
    }

    try {
        const response = await fetch(`https://googleads.googleapis.com/v18/customers/${accountId}/googleAds:search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
                'Content-Type': 'application/json',
                // REMOVIDO: login-customer-id pode causar 501 se a conta não for MCC ou se houver conflito de token de teste
            },
            body: JSON.stringify({ query })
        });

        const data = await response.json();
        
        if (data.error) {
            // Se der 501 aqui, tentamos uma última vez COM o header (algumas contas exigem, outras proíbem)
            if (response.status === 501 || data.error.message.includes('not implemented')) {
                const retryResponse = await fetch(`https://googleads.googleapis.com/v18/customers/${accountId}/googleAds:search`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                        'Content-Type': 'application/json',
                        'login-customer-id': accountId 
                    },
                    body: JSON.stringify({ query })
                });
                const retryData = await retryResponse.json();
                if (retryData.error) throw retryData.error;
                return res.status(200).json(formatResults(retryData.results || [], level, accountId));
            }
            throw data.error;
        }

        res.status(200).json(formatResults(data.results || [], level, accountId));

    } catch (error: any) {
        console.error("Erro KPIs Google:", error);
        res.status(500).json({ message: error.message || 'Erro ao buscar KPIs do Google.' });
    }
}

function formatResults(results: any[], level: string, accountId: string) {
    return results.map((row: any) => {
        const m = row.metrics;
        const segmentDate = row.segments.date;
        
        let id = accountId, name = 'Conta Google';
        if (level === DataLevel.CAMPAIGN) { id = row.campaign.id; name = row.campaign.name; }
        else if (level === DataLevel.AD_SET) { id = row.adGroup.id; name = row.adGroup.name; }
        else if (level === DataLevel.AD) { id = row.adGroupAd.ad.id; name = row.adGroupAd.ad.name || 'Anúncio'; }

        const spend = (parseInt(m.costMicros) || 0) / 1000000;
        const impressions = parseInt(m.impressions) || 0;
        const clicks = parseInt(m.clicks) || 0;
        const conversions = parseFloat(m.conversions) || 0;

        return {
            id: `${id}_${segmentDate}`,
            entityId: id,
            name: name,
            level: level,
            date: segmentDate,
            amountSpent: spend,
            impressions: impressions,
            reach: impressions,
            clicks: clicks,
            inlineLinkClicks: clicks,
            ctr: (parseFloat(m.ctr) || 0) * 100,
            cpc: (parseFloat(m.averageCpc) || 0) / 1000000,
            cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
            costPerInlineLinkClick: (parseFloat(m.averageCpc) || 0) / 1000000,
            results: conversions,
            costPerResult: conversions > 0 ? spend / conversions : 0,
            isPeriodTotal: false
        };
    });
}
