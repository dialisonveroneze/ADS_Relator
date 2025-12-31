
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
    
    // Nome exato da variável esperado no sistema
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
        const listResponse = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listResponse.json();
        
        if (listData.error) {
             const errorMsg = listData.error.message || '';
             
             // Erro comum de "Operation is not implemented" acontece quando o token não está aprovado ou a conta não é MCC
             if (errorMsg.includes('supported') || errorMsg.includes('implemented') || listResponse.status === 403) {
                 return res.status(403).json({
                     message: 'Erro do Google Ads: Seu Developer Token (GOOGLE_DEVELOPER_TOKEN) ainda não foi aprovado ou você não está usando uma conta de Administrador (MCC). Verifique no Centro de API se o status é "Acesso Básico" ou "Acesso de Teste".'
                 });
             }
             
             return res.status(500).json({ message: `Erro Google API: ${errorMsg}` });
        }

        const resourceNames = listData.resourceNames || [];
        const accounts: AdAccount[] = [];

        const fetchSubAccounts = async (resourceName: string) => {
            const customerId = resourceName.split('/')[1];
            const query = `
                SELECT 
                    customer_client.id, 
                    customer_client.descriptive_name, 
                    customer_client.currency_code, 
                    customer_client.manager,
                    customer_client.status
                FROM customer_client
                WHERE customer_client.status = 'ENABLED' 
                AND customer_client.level <= 1
            `;

            try {
                const searchResponse = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                        'Content-Type': 'application/json',
                        'login-customer-id': customerId
                    },
                    body: JSON.stringify({ query })
                });
                
                const searchData = await searchResponse.json();
                if (searchData.results) {
                    searchData.results.forEach((row: any) => {
                        const client = row.customerClient;
                        if (!client.manager) {
                            accounts.push({
                                id: client.id,
                                name: client.descriptiveName || `Conta ${client.id}`,
                                balance: 0,
                                spendingLimit: 0,
                                amountSpent: 0,
                                currency: client.currencyCode,
                                provider: 'google'
                            });
                        }
                    });
                }
            } catch (e) { console.error(e); }
        };

        await Promise.all(resourceNames.slice(0, 10).map((rn: string) => fetchSubAccounts(rn)));

        if (accounts.length === 0) {
            for (const rn of resourceNames) {
                const id = rn.split('/')[1];
                accounts.push({
                    id: id, name: `Conta ${id}`, balance: 0, spendingLimit: 0, amountSpent: 0, currency: 'BRL', provider: 'google'
                });
            }
        }

        const uniqueAccounts = Array.from(new Map(accounts.map(item => [item.id, item])).values());
        res.status(200).json(uniqueAccounts);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Erro interno ao processar contas.' });
    }
}
