
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
        // Passo 1: Listagem básica de IDs das contas acessíveis
        const listResponse = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listResponse.json();
        
        if (listData.error) {
             const errorMsg = listData.error.message || '';
             // Erro 403 costuma indicar token de teste tentando acessar conta real
             if (listResponse.status === 403 || errorMsg.includes('developer_token') || errorMsg.includes('not_approved')) {
                 return res.status(403).json({
                     message: '⚠️ RESTRIÇÃO DE TOKEN: Seu Developer Token do Google Ads está em modo "Acesso de Teste". Ele só pode acessar "Contas de Teste" (Test Accounts). Se você logou com uma conta que gerencia anúncios reais, a API retornará erro. Sugestão: Crie uma conta de teste no painel de desenvolvedor do Google Ads.'
                 });
             }
             return res.status(500).json({ message: `Erro Google API: ${errorMsg}` });
        }

        const resourceNames = listData.resourceNames || [];
        const accounts: AdAccount[] = [];

        // Passo 2: Buscar detalhes da conta usando GET (mais estável que SEARCH para metadados básicos)
        const fetchAccountDetails = async (resourceName: string) => {
            const customerId = resourceName.split('/')[1];
            
            try {
                // Usamos o endpoint de GET Customer em vez de SEARCH para evitar o erro 501 (Not Implemented)
                // que ocorre frequentemente com tokens de teste ou contas específicas.
                const response = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                    }
                });

                const customer = await response.json();
                
                if (customer.error) {
                    throw new Error(customer.error.message);
                }

                accounts.push({
                    id: customer.id,
                    name: customer.descriptiveName || `Conta ${customer.id}`,
                    balance: 0,
                    spendingLimit: 0,
                    amountSpent: 0,
                    currency: customer.currencyCode || 'BRL',
                    provider: 'google'
                });
            } catch (e) {
                // Fallback: Se falhar em pegar o nome, mantém apenas o ID para não quebrar o dashboard
                accounts.push({
                    id: customerId,
                    name: `ID: ${customerId}`,
                    balance: 0,
                    spendingLimit: 0,
                    amountSpent: 0,
                    currency: 'BRL',
                    provider: 'google'
                });
            }
        };

        // Executa as buscas de detalhes (limite de 15 para evitar timeout)
        await Promise.all(resourceNames.slice(0, 15).map((rn: string) => fetchAccountDetails(rn)));

        const uniqueAccounts = Array.from(new Map(accounts.map(item => [item.id, item])).values());
        
        // Se a busca de detalhes falhou em todas mas temos IDs, mostramos os IDs
        if (uniqueAccounts.length === 0 && resourceNames.length > 0) {
            resourceNames.forEach((rn: string) => {
                const id = rn.split('/')[1];
                uniqueAccounts.push({ id, name: `Conta ${id}`, balance: 0, spendingLimit: 0, amountSpent: 0, currency: 'BRL', provider: 'google' });
            });
        }

        res.status(200).json(uniqueAccounts);

    } catch (error: any) {
        console.error("Erro critico accounts.ts:", error);
        res.status(500).json({ message: error.message || 'Erro ao processar contas do Google Ads.' });
    }
}
