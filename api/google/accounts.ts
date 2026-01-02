
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
             message: '⚠️ ERRO TÉCNICO: A variável GOOGLE_DEVELOPER_TOKEN não está configurada na Vercel.' 
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
             // Erro 501 costuma ser falta de permissão para ler metadados detalhados de contas específicas
             if (listResponse.status === 501) {
                 return res.status(501).json({ 
                     message: '⚠️ CONTA NÃO SUPORTADA: O Google Ads retornou "501 Not Implemented". Isso ocorre em contas que não permitem acesso via API de pesquisa detalhada ou tokens de teste.' 
                 });
             }
             if (listResponse.status === 403 || errorMsg.includes('developer_token') || errorMsg.includes('not_approved')) {
                 return res.status(403).json({
                     message: '⚠️ TOKEN DE TESTE DETECTADO: Seu token do Google Ads é nível "Teste". Ele só permite acessar contas de anúncio que você criou como "Contas de Teste" dentro de um Gerenciador (MCC) de Teste.'
                 });
             }
             return res.status(listResponse.status || 500).json({ message: `Erro Google Ads: ${errorMsg}` });
        }

        const resourceNames = listData.resourceNames || [];
        const accounts: AdAccount[] = [];

        // Tentativa de buscar detalhes
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

                if (response.status === 501) throw new Error("501");
                const data = await response.json();
                
                accounts.push({
                    id: data.id || customerId,
                    name: data.descriptiveName || `Conta ${data.id || customerId}`,
                    balance: 0,
                    spendingLimit: 0,
                    amountSpent: 0,
                    currency: data.currencyCode || 'BRL',
                    provider: 'google'
                });
            } catch (e) {
                // Se falhar o detalhe, ainda mostra o ID para não ficar vazio
                accounts.push({
                    id: customerId,
                    name: `Conta ID: ${customerId} (Sem Detalhes)`,
                    balance: 0,
                    spendingLimit: 0,
                    amountSpent: 0,
                    currency: 'BRL',
                    provider: 'google'
                });
            }
        };

        await Promise.all(resourceNames.slice(0, 15).map((rn: string) => fetchAccountDetails(rn)));

        const uniqueAccounts = Array.from(new Map(accounts.map(item => [item.id, item])).values());
        
        if (uniqueAccounts.length === 0) {
            return res.status(404).json({ message: 'Nenhuma conta acessível foi encontrada vinculada a este e-mail do Google.' });
        }

        res.status(200).json(uniqueAccounts);

    } catch (error: any) {
        console.error("Erro accounts.ts:", error);
        res.status(500).json({ message: 'Erro ao buscar contas. Verifique seu Developer Token.' });
    }
}
