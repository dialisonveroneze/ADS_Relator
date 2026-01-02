
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
        // Passo 1: Listar as contas acessíveis (Esta chamada é a base de tudo)
        const listResponse = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listResponse.json();
        
        if (listData.error) {
             const errorMsg = listData.error.message || '';
             // Se falhar logo aqui, provavelmente é o token de teste em conta real
             if (listResponse.status === 403 || errorMsg.includes('developer_token') || errorMsg.includes('not_approved')) {
                 return res.status(403).json({
                     message: '⚠️ TOKEN DE TESTE: O Google Ads só permite que tokens de teste acessem "Contas de Teste". Crie um Gerenciador de Teste no painel do Google Ads.'
                 });
             }
             // Caso a API do Google retorne 501 ou outro erro na listagem principal
             return res.status(listResponse.status || 500).json({ message: `Erro Google Ads: ${errorMsg}` });
        }

        const resourceNames = listData.resourceNames || [];
        const accounts: AdAccount[] = [];

        // Passo 2: Tentar buscar detalhes, mas com FALLBACK TOTAL (Proteção contra 501)
        const fetchAccountDetails = async (resourceName: string) => {
            const customerId = resourceName.split('/')[1];
            
            try {
                // Tentativa de pegar o nome real via GET (Mais estável que search)
                const response = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                    }
                });

                const customer = await response.json();
                
                if (customer && customer.id && !customer.error) {
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
                    throw new Error("API returned error or no data");
                }
            } catch (e) {
                // FALLBACK: Se o Google der 501 (Not Implemented) ou qualquer outro erro nos detalhes,
                // adicionamos apenas o ID. Isso impede que o dashboard inteiro quebre.
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

        // Processa as contas em paralelo (limite de 15 para evitar timeouts)
        await Promise.all(resourceNames.slice(0, 15).map((rn: string) => fetchAccountDetails(rn)));

        const uniqueAccounts = Array.from(new Map(accounts.map(item => [item.id, item])).values());
        
        if (uniqueAccounts.length === 0 && resourceNames.length > 0) {
            // Garantia final: se as sub-chamadas falharam mas temos IDs, mostramos os IDs
            resourceNames.forEach((rn: string) => {
                const id = rn.split('/')[1];
                uniqueAccounts.push({ id, name: `Conta ${id}`, balance: 0, spendingLimit: 0, amountSpent: 0, currency: 'BRL', provider: 'google' });
            });
        }

        res.status(200).json(uniqueAccounts);

    } catch (error: any) {
        console.error("Erro interno accounts.ts:", error);
        res.status(500).json({ message: 'Erro interno ao processar contas. Verifique se o Developer Token está correto.' });
    }
}
