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

    if (!accountId || typeof accountId !== 'string' || !level || typeof level !== 'string' || !Object.values(DataLevel).includes(level as DataLevel)) {
        return res.status(400).json({ message: 'ID da conta e nível são obrigatórios.' });
    }
    const typedLevel = level as DataLevel;
    const dateRange = (dateRangeQuery || 'last_14_days') as DateRangeOption;
    const datePreset = datePresetMap[dateRange];
    const levelParam = levelMap[typedLevel];

    try {
        // SOLUÇÃO ROBUSTA:
        // Construímos a lista de campos dinamicamente. Para cada nível,
        // pedimos explicitamente o ID e o nome correspondentes, além das métricas.
        // Isso remove a ambiguidade e garante que a API retorne os dados corretos.
        let fields = 'spend,impressions';
        switch (typedLevel) {
            case DataLevel.CAMPAIGN:
                fields += ',campaign_id,campaign_name';
                break;
            case DataLevel.AD_SET:
                fields += ',adset_id,adset_name';
                break;
            case DataLevel.AD:
                fields += ',ad_id,ad_name';
                break;
        }
        
        const url = `https://graph.facebook.com/v19.0/${accountId}/insights?level=${levelParam}&fields=${fields}&date_preset=${datePreset}&time_increment=1&limit=500&access_token=${accessToken}`;
        
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
            let entityId: string;
            let entityName: string;

            switch (typedLevel) {
                case DataLevel.ACCOUNT:
                    entityId = item.account_id;
                    entityName = `Resumo Diário`;
                    break;
                case DataLevel.CAMPAIGN:
                    entityId = item.campaign_id;
                    entityName = item.campaign_name || `(Campanha sem nome)`;
                    break;
                case DataLevel.AD_SET:
                    entityId = item.adset_id;
                    entityName = item.adset_name || `(Grupo sem nome)`;
                    break;
                case DataLevel.AD:
                    entityId = item.ad_id;
                    entityName = item.ad_name || `(Anúncio sem nome)`;
                    break;
                default:
                     entityId = 'unknown';
                     entityName = `(Desconhecido)`;
            }
            
            const spend = parseFloat(item?.spend ?? '0');
            const impressions = parseInt(item?.impressions ?? '0', 10);
            const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
            
            return {
                id: `${entityId}_${item.date_start}`,
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

    } catch (error) {
        console.error(`Erro interno ao buscar KPIs para ${accountId}:`, error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
}