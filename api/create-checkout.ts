
// api/create-checkout.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const origin = `${protocol}://${host}`;

    // Tenta pegar da variável de ambiente, senão usa a chave fornecida diretamente (Fallback)
    // IMPORTANTE: Em produção definitiva, configure MERCADOPAGO_ACCESS_TOKEN nas variáveis de ambiente da Vercel.
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-4fe02070-a79b-43fc-bcf0-78ba0743e6c7';

    // MODO SIMULAÇÃO (FALLBACK FINAL)
    // Se mesmo assim não tiver token, usa o modo de teste local.
    if (!accessToken) {
        console.warn("MERCADOPAGO_ACCESS_TOKEN ausente. Usando modo de simulação.");
        return res.status(200).json({ 
            url: `${origin}/api/payment-success?status=approved&mock=true`,
            isMock: true
        });
    }

    try {
        // Criação da Preferência de Pagamento via API REST do Mercado Pago
        const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                items: [
                    {
                        title: 'Assinatura ADS Relator Pro (Mensal)',
                        description: 'Acesso ilimitado ao dashboard de performance.',
                        quantity: 1,
                        currency_id: 'BRL',
                        unit_price: 19.90
                    }
                ],
                back_urls: {
                    success: `${origin}/api/payment-success`,
                    failure: `${origin}/`,
                    pending: `${origin}/`
                },
                auto_return: "approved",
                statement_descriptor: "ADS RELATOR",
                external_reference: `user_${Date.now()}` // Idealmente seria o ID do usuário
            })
        });

        const mpData = await mpResponse.json();

        if (!mpResponse.ok) {
            console.error('Erro Mercado Pago:', mpData);
            throw new Error(mpData.message || 'Erro ao criar preferência no Mercado Pago');
        }

        // Retorna o link do checkout (init_point para produção, sandbox_init_point para testes)
        return res.status(200).json({ url: mpData.init_point, isMock: false });

    } catch (error: any) {
        console.error("Erro no Checkout:", error);
        return res.status(500).json({ message: error.message || 'Erro ao criar sessão de pagamento.' });
    }
}
