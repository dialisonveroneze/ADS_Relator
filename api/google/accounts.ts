
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export interface AdAccount {
  id: string;
  name: string;
  balance: number;
  spendingLimit: number;
  amountSpent: number;
  currency: string;
  provider: 'google';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies.google_access_token;
    const developerToken = (process.env.GOOGLE_DEVELOPER_TOKEN || '').trim();

    if (!accessToken) {
        return res.status(401).json({ message: 'Sessão expirada no Google. Por favor, faça login novamente.' });
    }
    
    if (!developerToken) {
         return res.status(500).json({ 
             message: '⚠️ ERRO DE CONFIGURAÇÃO: A variável GOOGLE_DEVELOPER_TOKEN não foi configurada no ambiente Vercel.' 
         });
    }

    try {
        // Passo 1: Listagem básica de IDs (Endpoint mais estável da API)
        const listResponse = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listResponse.json();
        
        if (listData.error) {
             const errorMsg = listData.error.message || '';
             // Tratamento específico para Token de Teste tentando acessar Contas Reais
             if (listResponse.status === 403 || errorMsg.includes('developer_token') || errorMsg.includes('not_approved')) {
                 return res.status(403).json({
                     message: '⚠️ TOKEN DE TESTE DETECTADO: Seu Developer Token do Google Ads está em modo de teste e não tem permissão para ler contas de produção. Use uma conta de teste ou aguarde a aprovação do token pelo Google.'
                 });
             }
             return res.status(listResponse.status || 500).json({ message: `Erro Google API: ${errorMsg}` });
        }

        const resourceNames = listData.resourceNames || [];
        const accounts: AdAccount[] = [];

        // Passo 2: Buscar detalhes (Nome/Moeda) com proteção total contra falhas
        const fetchAccountDetails = async (resourceName: string) => {
            const customerId = resourceName.split('/')[1];
            
            try {
                // Tentativa de buscar metadados básicos
                const response = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                    }
                });

                if (!response.ok) throw new Error('Failed fetch');
                const customer = await response.json();
                
                if (customer && customer.id) {
                    accounts.push({
                        id: customer.id,
                        name: customer.descriptiveName || `Conta ${customer.id}`,
                        balance: 0,
                        spendingLimit: 0,
                        amountSpent: 0,
                        currency: customer.currencyCode || 'BRL',
                        provider: 'google'
                    });
                } else {
                    throw new Error('Invalid data');
                }
            } catch (e) {
                // FALLBACK: Se falhar em buscar detalhes (comum em 501 ou tokens de teste),
                // apenas adicionamos a conta com o ID básico para não quebrar o dashboard.
                accounts.push({
                    id: customerId,
                    name: `ID: ${customerId} (Dados Limitados)`,
                    balance: 0,
                    spendingLimit: 0,
                    amountSpent: 0,
                    currency: 'BRL',
                    provider: 'google'
                });
            }
        };

        // Processamos em paralelo mas limitamos a quantidade para evitar timeout da Vercel
        const limit = resourceNames.slice(0, 10);
        await Promise.all(limit.map((rn: string) => fetchAccountDetails(rn)));

        // Se sobraram contas além do limite de busca detalhada, adiciona elas apenas com ID
        if (resourceNames.length > 10) {
            resourceNames.slice(10).forEach(rn => {
                const id = rn.split('/')[1];
                accounts.push({ id, name: `Conta ${id}`, balance: 0, spendingLimit: 0, amountSpent: 0, currency: 'BRL', provider: 'google' });
            });
        }

        const uniqueAccounts = Array.from(new Map(accounts.map(item => [item.id, item])).values());
        res.status(200).json(uniqueAccounts);

    } catch (error: any) {
        console.error("Erro Crítico em /api/google/accounts:", error);
        res.status(500).json({ message: 'Erro interno ao processar as contas do Google Ads. Verifique os logs do servidor.' });
    }
}
