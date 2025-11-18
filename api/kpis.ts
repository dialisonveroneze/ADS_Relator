// api/kpis.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';
import { KpiData, DataLevel, DateRangeOption } from '../types';

// Mapeia nossos níveis de dados para os níveis da API da Meta
const levelMap: Record<DataLevel, string> = {
  [DataLevel.ACCOUNT]: 'account',
  [DataLevel.CAMPAIGN]: 'campaign',
  [DataLevel.AD_SET]: 'adset',
  [DataLevel.AD]: 'ad',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies.meta_token;

    if (!accessToken) {
        return res.status(401).json({ message: 'Não autorizado: Token não encontrado.' });
    }

    const { accountId, level, dateRange: dateRangeQuery } = req.query;

    if (!accountId || typeof accountId !== 'string' || !level || typeof level !== 'string' || !Object.values(DataLevel).includes(level as DataLevel)) {
        return res.status(400).json({ message: 'ID da conta e nível são obrigatórios.' });
    }
    const typedLevel = level as DataLevel;
    const dateRange = (dateRangeQuery || 'last_14_days') as DateRangeOption;

    let since: string;
    let until: string;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normaliza para o início do dia em UTC

    switch (dateRange) {
        case 'last_7_days':
            until = today.toISOString().split('T')[0];
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setUTCDate(today.getUTCDate() - 6);
            since = sevenDaysAgo.toISOString().split('T')[0];
            break;
        case 'last_30_days':
            until = today.toISOString().split('T')[0];
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setUTCDate(today.getUTCDate() - 29);
            since = thirtyDaysAgo.toISOString().split('T')[0];
            break;
        case 'this_month':
            until = today.toISOString().split('T')[0];
            const firstDayThisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
            since = firstDayThisMonth.toISOString().split('T')[0];
            break;
        case 'last_month':
            const firstDayCurrentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
            const lastDayLastMonth = new Date(firstDayCurrentMonth);
            lastDayLastMonth.setUTCDate(0); // Vai para o último dia do mês anterior
            until = lastDayLastMonth.toISOString().split('T')[0];

            const firstDayLastMonth = new Date(Date.UTC(lastDayLastMonth.getUTCFullYear(), lastDayLastMonth.getUTCMonth(), 1));
            since = firstDayLastMonth.toISOString().split('T')[0];
            break;
        case 'last_14_days':
        default:
            until = today.toISOString().split('T')[0];
            const fourteenDaysAgo = new Date(today);
            fourteenDaysAgo.setUTCDate(today.getUTCDate() - 13);
            since = fourteenDaysAgo.toISOString().split('T')[0];
            break;
    }
    
    const timeRange = { since, until };

    try {
        // Define os campos base, excluindo métricas calculadas (CTR, CPC, CPM) para maior estabilidade
        const coreFields = 'spend,impressions,reach,clicks,inline_link_clicks';
        const resultFields = 'results,cost_per_result'; // Apenas para níveis onde fazem sentido

        let requestedFields = coreFields;
        
        // **CORREÇÃO CRÍTICA**: Só solicita `results` para níveis onde são aplicáveis.
        if (typedLevel !== DataLevel.ACCOUNT) {
            requestedFields += `,${resultFields}`;
        }

        let dynamicFields = '';
        switch (typedLevel) {
            case DataLevel.CAMPAIGN:
                dynamicFields = ',campaign_id,campaign_name';
                break;
            case DataLevel.AD_SET:
                dynamicFields = ',adset_id,adset_name,campaign_id,campaign_name';
                break;
            case DataLevel.AD:
                dynamicFields = ',ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name';
                break;
        }
        
        const fields = requestedFields + dynamicFields;
        const levelParam = levelMap[typedLevel];
        
        let url = `https://graph.facebook.com/v19.0/${accountId}/insights?level=${levelParam}&fields=${fields}&time_range=${JSON.stringify(timeRange)}&time_increment=1&limit=500&access_token=${accessToken}`;
        
        const metaResponse = await fetch(url);
        const data = await metaResponse.json();

        if (data.error) {
            console.error("Erro da API da Meta:", data.error);
            if (data.error.code === 190) {
                 return res.status(401).json({ message: 'Token de acesso inválido ou expirado.' });
            }
            return res.status(500).json({ message: data.error.message || 'Erro ao buscar dados da Meta.' });
        }
        
        const formattedKpi: KpiData[] = (data.data || []).map((item: any) => {
            const entityId = item[`${levelParam}_id`] || accountId;
            let entityName: string;

            switch (typedLevel) {
                case DataLevel.ACCOUNT:
                    entityName = `Resumo Diário`;
                    break;
                case DataLevel.CAMPAIGN:
                    entityName = item.campaign_name || `(Sem Nome - ID: ${entityId})`;
                    break;
                case DataLevel.AD_SET:
                    entityName = `${item.campaign_name || '(Campanha sem nome)'} > ${item.adset_name || `(Grupo sem nome - ID: ${entityId})`}`;
                    break;
                case DataLevel.AD:
                    entityName = `${item.campaign_name || '(Campanha sem nome)'} > ${item.adset_name || '(Grupo sem nome)'} > ${item.ad_name || `(Anúncio sem nome - ID: ${entityId})`}`;
                    break;
                default:
                     entityName = `(ID: ${entityId})`;
            }
            
            // Parse das métricas base
            const spend = parseFloat(item?.spend ?? '0');
            const impressions = parseInt(item?.impressions ?? '0', 10);
            const clicks = parseInt(item?.clicks ?? '0', 10);

            // Cálculo manual das métricas para maior robustez
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const cpc = clicks > 0 ? spend / clicks : 0;
            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
            
            // Parse das métricas de resultado (apenas se foram solicitadas)
            let results = 0;
            let costPerResult = 0;
            if (typedLevel !== DataLevel.ACCOUNT) {
                if (item.results && Array.isArray(item.results)) {
                    results = item.results.reduce((total, action) => total + parseInt(action.value || '0', 10), 0);
                }
                
                if (item.cost_per_result && Array.isArray(item.cost_per_result) && item.cost_per_result.length > 0) {
                    costPerResult = parseFloat(item.cost_per_result[0].value || '0');
                } else if (results > 0) {
                    costPerResult = spend / results;
                }
            }
            
            return {
                id: `${entityId}_${item.date_start}`,
                entityId: entityId,
                name: entityName,
                level: typedLevel,
                date: item.date_start,
                amountSpent: spend,
                impressions: impressions,
                reach: parseInt(item?.reach ?? '0', 10),
                clicks: clicks,
                linkClicks: parseInt(item?.inline_link_clicks ?? '0', 10),
                results: results,
                costPerResult: costPerResult,
                ctr: ctr,
                cpc: cpc,
                cpm: cpm,
            };
        });

        res.status(200).json(formattedKpi);

    } catch (error) {
        console.error(`Erro interno ao buscar KPIs para ${accountId}:`, error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
}