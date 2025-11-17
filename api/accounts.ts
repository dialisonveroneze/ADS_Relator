// api/accounts.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';
import { AdAccount } from '../types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies.meta_token;

    if (!accessToken) {
        return res.status(401).json({ message: 'Não autorizado: Token não encontrado.' });
    }

    try {
        const fields = 'id,name,balance,spend_cap,amount_spent,currency,prepay_balance';
        let allAccounts: any[] = [];
        let url = `https://graph.facebook.com/v19.0/me/adaccounts?fields=${fields}&limit=100&access_token=${accessToken}`;

        // Loop de paginação para buscar todas as contas
        while (url) {
            const metaResponse = await fetch(url);
            const data = await metaResponse.json();

            if (data.error) {
                console.error("Erro da API da Meta:", data.error);
                if (data.error.code === 190) {
                     return res.status(401).json({ message: 'Token de acesso inválido ou expirado.' });
                }
                return res.status(500).json({ message: data.error.message || 'Erro ao buscar dados da Meta.' });
            }

            allAccounts = allAccounts.concat(data.data);
            
            // Verifica se existe uma próxima página
            url = data.paging && data.paging.next ? data.paging.next : null;
        }
        
        // Formata os dados da Meta para o tipo que nosso frontend espera.
        const formattedAccounts: AdAccount[] = allAccounts.map((acc: any) => {
            // Lógica para determinar o saldo correto: prioriza o saldo pré-pago se existir.
            let finalBalance = 0;
            // A API de pré-pago retorna um objeto com 'amount' e 'currency'
            if (acc.prepay_balance && acc.prepay_balance.amount) {
                finalBalance = parseFloat(acc.prepay_balance.amount);
            } else {
                // O saldo normal vem em centavos como uma string
                finalBalance = parseFloat(acc.balance || '0');
            }

            return {
                id: acc.id,
                name: acc.name,
                balance: finalBalance / 100, // Converte de centavos para a unidade principal
                spendingLimit: parseFloat(acc.spend_cap || '0') / 100, 
                amountSpent: parseFloat(acc.amount_spent || '0') / 100,
                currency: acc.currency,
            };
        });

        res.status(200).json(formattedAccounts);

    } catch (error) {
        console.error("Erro interno ao buscar contas:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
}