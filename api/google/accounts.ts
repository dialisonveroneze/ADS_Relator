
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export interface AdAccount {
  id: string;
  name: string;
  balance: number;
  spendingLimit: number;
  amountSpent: number;
  currency: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies.google_access_token;
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;

    if (!accessToken) {
        return res.status(401).json({ message: 'Sessão expirada. Por favor, conecte-se ao Google novamente.' });
    }
    
    if (!developerToken) {
         console.error("ERRO: GOOGLE_DEVELOPER_TOKEN não configurado.");
         return res.status(500).json({ message: 'Configuração do servidor incompleta: Falta o Developer Token do Google Ads.' });
    }

    try {
        const listCustResponse = await fetch('https://googleads.googleapis.com/v14/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listCustResponse.json();
        
        if (listData.error) {
             console.error("Google List Error:", listData.error);
             return res.status(listCustResponse.status).json({ message: listData.error.message || 'Erro na API do Google.' });
        }

        const resourceNames = listData.resourceNames || [];
        const accounts: AdAccount[] = [];

        for (const resourceName of resourceNames.slice(0, 10)) {
            const customerId = resourceName.split('/')[1];
            
            const query = `
                SELECT 
                    customer.id, 
                    customer.descriptive_name, 
                    customer.currency_code 
                FROM customer 
                LIMIT 1
            `;

            const queryResponse = await fetch(`https://googleads.googleapis.com/v14/customers/${customerId}/googleAds:search`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'developer-token': developerToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });
            
            const queryData = await queryResponse.json();
            
            if (queryData.results && queryData.results.length > 0) {
                const info = queryData.results[0].customer;
                accounts.push({
                    id: info.id,
                    name: info.descriptiveName || `Conta ${info.id}`,
                    balance: 0,
                    spendingLimit: 0, 
                    amountSpent: 0,
                    currency: info.currencyCode
                });
            }
        }

        res.status(200).json(accounts);

    } catch (error: any) {
        console.error("Erro Fatal Google API:", error);
        res.status(500).json({ message: 'Erro interno ao processar contas do Google Ads.' });
    }
}
