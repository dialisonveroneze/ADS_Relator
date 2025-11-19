
// api/kpis.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

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

    if (!accountId || typeof accountId !== 'string' || !level || typeof level !== 'string') {
        return res.status(400).json({ message: 'ID da conta e nível são obrigatórios.' });
    }
    
    if (!Object.values(DataLevel).includes(level as DataLevel)) {
         return res.status(400).json({ message: 'Nível de dados inválido.' });
    }

    const typedLevel = level as DataLevel;
    const dateRange = (dateRangeQuery || 'last_14_days') as DateRangeOption;
    const levelParam = typedLevel;
    
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

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
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
            if (data.error) throw data.error;
            if (data.data && Array.isArray(data.data)) allData = allData.concat(data.data);
            url = data.paging && data.paging.next ? data.paging.next : null;
        }
        return allData;
    };

    try {
        const [dailyRaw, summaryRaw] = await Promise.all([
             fetchInsights(true).catch(e => []),
             fetchInsights(false).catch(e => [])
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
                const objective = item.objective;
                const actions = item.actions || [];

                // ----------- ALGORITMO WATERFALL DE RESULTADOS -----------
                let resultsCount = 0;

                // 1. Detecção de Objetivo baseado em NOME + API
                // Se o nome contiver "reconhecimento", "video view", "branding", força isAwareness
                const nameLower = entityName.toLowerCase();
                const isNameBasedAwareness = 
                    nameLower.includes('reconhecimento') || 
                    nameLower.includes('alcance') || 
                    nameLower.includes('video view') || 
                    nameLower.includes('visualização') || 
                    nameLower.includes('branding');

                const isAwareness = 
                    isNameBasedAwareness ||
                    objective === 'OUTCOME_AWARENESS' || 
                    objective === 'BRAND_AWARENESS' || 
                    objective === 'VIDEO_VIEWS' ||
                    objective === 'REACH';

                const isTraffic = 
                    objective === 'OUTCOME_TRAFFIC' || 
                    objective === 'TRAFFIC' || 
                    objective === 'LINK_CLICKS';

                // Funções auxiliares
                const getExactValue = (key: string) => {
                    const match = actions.find((a: any) => a.action_type === key);
                    return match ? parseFloat(match.value) : 0;
                };

                const getMessagingTotal = () => {
                    // Pega tudo que tem 'messaging_conversation_started'
                    const msgs = actions.filter((a: any) => a.action_type.includes('messaging_conversation_started'));
                    if (msgs.length === 0) return 0;

                    // Procura por chaves granulares (ex: _7d, _1d_view)
                    const granular = msgs.filter((a: any) => a.action_type.match(/_\d+d(_view)?$/));
                    
                    if (granular.length > 0) {
                        // Soma apenas as partes distintas
                        return granular.reduce((acc: number, curr: any) => acc + parseFloat(curr.value), 0);
                    }
                    // Fallback: Pega o maior valor encontrado (Total Unificado)
                    return Math.max(...msgs.map((a: any) => parseFloat(a.value)));
                };

                const getTrafficMessagingTotal = () => {
                    // Para tráfego p/ whatsApp, procuramos conversas ou cliques no whatsapp
                    // Prioriza Conversas Reais
                    const conversations = getMessagingTotal();
                    if (conversations > 0) return conversations;

                    // Se não, tenta omni_messaging ou click_to_whatsapp
                    const whatsappActions = actions.filter((a: any) => 
                        a.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
                        a.action_type === 'omni_messaging_conversation_started_7d' ||
                        a.action_type === 'contact_total' || // Em alguns casos raros
                        (a.action_type.includes('whatsapp') && !a.action_type.includes('view'))
                    );
                    
                    // Retorna o maior valor encontrado para evitar soma de duplicatas
                    if (whatsappActions.length > 0) {
                        return Math.max(...whatsappActions.map((a: any) => parseFloat(a.value)));
                    }
                    return 0;
                };


                // --- APLICAÇÃO DA LÓGICA DE PRIORIDADE ---

                // REGRA 1: Se é Reconhecimento (por API ou Nome), Resultado = Alcance. PONTO FINAL.
                if (isAwareness) {
                    resultsCount = reach;
                }
                else {
                    // REGRA 2: Busca Vendas (Prioridade Ouro)
                    resultsCount = getExactValue('purchase');

                    // REGRA 3: Busca Conversas (Prioridade Prata)
                    if (resultsCount === 0) {
                        // Se for Tráfego, usa a lógica estrita para evitar ruído (ex: leads falsos)
                        if (isTraffic) {
                             resultsCount = getTrafficMessagingTotal();
                        } else {
                             resultsCount = getMessagingTotal();
                        }
                    }

                    // REGRA 4: Busca Leads/Cadastros (Prioridade Bronze)
                    // APENAS se NÃO for Tráfego (para evitar que cliques de botão virem leads falsos em campanhas de tráfego)
                    if (resultsCount === 0 && !isTraffic) {
                        resultsCount = getExactValue('leads') || getExactValue('lead') || getExactValue('schedule');
                    }

                    // REGRA 5: Fallback para Tráfego (Base)
                    // Se é tráfego e não achou venda nem conversa -> Cliques no Link
                    if (resultsCount === 0 && isTraffic) {
                        resultsCount = inlineLinkClicks;
                        // Último recurso: Cliques gerais
                        if (resultsCount === 0) resultsCount = clicks;
                    }
                }

                const isReachBased = isAwareness;

                const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const cpc = clicks > 0 ? spend / clicks : 0;
                const costPerInlineLinkClick = inlineLinkClicks > 0 ? spend / inlineLinkClicks : 0;
                
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
                    date: item.date_start,
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

        res.status(200).json([...dailyFormatted, ...summaryFormatted]);

    } catch (error: any) {
        console.error(`Erro interno KPI:`, error);
        if (error.code === 190) {
             return res.status(401).json({ message: 'Token de acesso inválido ou expirado.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
}
