
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
        return res.status(401).json({ message: 'Sessão expirada. Conecte-se ao Google Ads novamente.' });
    }
    
    if (!developerToken) {
         return res.status(500).json({ 
             message: '⚠️ CONFIGURAÇÃO PENDENTE: Falta a variável GOOGLE_DEVELOPER_TOKEN na Vercel.' 
         });
    }

    try {
        // Passo 1: Listagem básica de IDs (mais estável)
        const listResponse = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listResponse.json();
        
        if (listData.error) {
             const errorMsg = listData.error.message || '';
             // 403 ou erros de token de teste
             if (listResponse.status === 403 || errorMsg.includes('developer_token') || errorMsg.includes('not_approved')) {
                 return res.status(403).json({
                     message: '⚠️ RESTRIÇÃO DE TESTE: Seu token do Google Ads é de "Acesso de Teste". Ele só permite visualizar "Contas de Teste".'
                 });
             }
             // Se a listagem principal retornar 501, tratamos aqui para não quebrar o front
             if (listResponse.status === 501 || listResponse.status === 500) {
                 return res.status(200).json([]); 
             }
             return res.status(listResponse.status || 500).json({ message: `Erro Google API: ${errorMsg}` });
        }

        const resourceNames = listData.resourceNames || [];
        const accounts: AdAccount[] = [];

        // Passo 2: Buscar detalhes com proteção total contra 501 (Not Implemented)
        const fetchAccountDetails = async (resourceName: string) => {
            const customerId = resourceName.split('/')[1];
            
            try {
                const response = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                    }
                });

                if (!response.ok) {
                    throw new Error(`Google API Error: ${response.status}`);
                }

                const data = await response.json();
                
                accounts.push({
                    id: data.id,
                    name: data.descriptiveName || `Conta ${data.id}`,
                    balance: 0,
                    spendingLimit: 0,
                    amountSpent: 0,
                    currency: data.currencyCode || 'BRL',
                    provider: 'google'
                });
            } catch (e) {
                // FALLBACK CRÍTICO: Se o Google disser "Not Implemented" nos detalhes (comum em 501),
                // apenas adicionamos a conta com o ID, permitindo que o usuário prossiga.
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

        // Processa em paralelo mas com limite de 10
        await Promise.all(resourceNames.slice(0, 10).map((rn: string) => fetchAccountDetails(rn)));

        const uniqueAccounts = Array.from(new Map(accounts.map(item => [item.id, item])).values());
        
        // Se a busca de detalhes falhou completamente mas temos IDs, garantimos o retorno
        if (uniqueAccounts.length === 0 && resourceNames.length > 0) {
            resourceNames.forEach((rn: string) => {
                const id = rn.split('/')[1];
                uniqueAccounts.push({ id, name: `Conta ${id}`, balance: 0, spendingLimit: 0, amountSpent: 0, currency: 'BRL', provider: 'google' });
            });
        }

        res.status(200).json(uniqueAccounts);

    } catch (error: any) {
        console.error("Erro crítico em accounts.ts:", error);
        res.status(200).json([]); // Retorna vazio em vez de 500 para evitar travamento visual
    }
}
