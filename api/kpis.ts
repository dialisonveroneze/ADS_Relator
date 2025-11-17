// api/kpis.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';
import { KpiData, DataLevel } from '../types';

// Mapeia nossos níveis de dados para os níveis da API da Meta
const levelMap: Record<DataLevel, string> = {
  [DataLevel.ACCOUNT]: 'account',
  [DataLevel.CAMPAIGN]: 'campaign',
  [DataLevel.AD_SET]: 'adset',
  [DataLevel.AD]: 'ad',
};

// Lista priorizada de tipos de ação para encontrar a métrica de "Resultado" mais relevante.
const prioritizedActionTypes = [
    'offsite_conversion.fb_pixel_purchase',
    'purchase',
    'offsite_conversion.fb_pixel_complete_registration',
    'complete_registration',
    'offsite_conversion.fb_pixel_lead',
    'lead',
    'offsite_conversion.fb_pixel_add_to_cart',
    'add_to_cart',
    'link_click',
    'landing_page_view',
];


export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies.meta_token;

    if (!accessToken) {
        return res.status(401).json({ message: 'Não autorizado: Token não encontrado.' });
    }

    const { accountId, level } = req.query;

    if (!accountId || typeof accountId !== 'string' || !level || typeof level !== 'string' || !Object.values(DataLevel).includes(level as DataLevel)) {
        return res.status(400).json({ message: 'ID da conta e nível são obrigatórios.' });
    }

    const today = new Date();
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(today.getDate() - 13);
    
    const dateRange = {
        since: fourteenDaysAgo.toISOString().split('T')[0],
        until: today.toISOString().split('T')[0],
    };

    try {
        const fields = 'spend,impressions,reach,clicks,inline_link_clicks,actions,cost_per_action_type,ctr,cpc,cpm';
        const levelParam = levelMap[level as DataLevel];
        
        let url = `https://graph.facebook.com/v19.0/${accountId}/insights?level=${levelParam}&fields=${fields}&time_range=${JSON.stringify(dateRange)}&time_increment=1&access_token=${accessToken}`;
        
        const metaResponse = await fetch(url);
        const data = await metaResponse.json();

        if (data.error) {
            console.error("Erro da API da Meta:", data.error);
            if (data.error.code === 190) {
                 return res.status(401).json({ message: 'Token de acesso inválido ou expirado.' });
            }
            return res.status(500).json({ message: data.error.message || 'Erro ao buscar dados da Meta.' });
        }
        
        // Formata os dados de insights para o tipo KpiData
        const formattedKpi: KpiData[] = (data.data || []).map((item: any) => {
            let resultAction = null;
            let costPerResultAction = null;

            if (item.actions) {
                for (const type of prioritizedActionTypes) {
                    resultAction = item.actions.find((a: any) => a.action_type === type);
                    if (resultAction) break;
                }
            }
            if (item.cost_per_action_type) {
                 for (const type of prioritizedActionTypes) {
                    costPerResultAction = item.cost_per_action_type.find((a: any) => a.action_type === type);
                    if (costPerResultAction) break;
                }
            }

            const results = resultAction ? resultAction.value : '0';
            const costPerResult = costPerResultAction ? costPerResultAction.value : '0';

            return {
                id: item[`${levelParam}_id`] ? `${item[`${levelParam}_id`]}_${item.date_start}` : `${accountId}_${item.date_start}`,
                name: item[`${levelParam}_name`] || `Resumo Diário`,
                level: level as DataLevel,
                date: item.date_start,
                amountSpent: parseFloat(item.spend || '0'),
                impressions: parseInt(item.impressions || '0', 10),
                reach: parseInt(item.reach || '0', 10),
                clicks: parseInt(item.clicks || '0', 10),
                linkClicks: parseInt(item.inline_link_clicks || '0', 10),
                results: parseInt(results, 10),
                costPerResult: parseFloat(costPerResult),
                ctr: parseFloat(item.ctr || '0'),
                cpc: parseFloat(item.cpc || '0'),
                cpm: parseFloat(item.cpm || '0'),
            };
        });

        res.status(200).json(formattedKpi);

    } catch (error) {
        console.error(`Erro interno ao buscar KPIs para ${accountId}:`, error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
}