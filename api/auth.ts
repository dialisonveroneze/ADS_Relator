// api/auth.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

// Este endpoint lida com o redirecionamento de volta da Meta após a autorização do usuário.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code } = req.query;
    const { META_APP_ID, META_APP_SECRET } = process.env;

    if (!code || typeof code !== 'string') {
        return res.status(400).send('Código de autorização inválido.');
    }

    if (!META_APP_ID || !META_APP_SECRET) {
        console.error("Variáveis de ambiente faltando.");
        return res.status(500).send('Erro de configuração no servidor.');
    }
    
    // A redirect_uri aqui DEVE ser exatamente a mesma que foi enviada na URL de autorização pelo Frontend.
    // Usamos os headers da requisição para determinar o domínio atual dinamicamente.
    // Isso permite que o login funcione tanto em localhost, quanto em deploys de preview da Vercel e produção.
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/auth`;

    // Passo 2: Trocar o código de autorização por um access token.
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_APP_SECRET}&code=${code}`;

    try {
        const tokenResponse = await fetch(tokenUrl);
        const tokenData = await tokenResponse.json() as { access_token?: string; error?: any };

        if (tokenData.error || !tokenData.access_token) {
            console.error('Erro ao obter access token da Meta:', tokenData.error);
            // Log útil para debug: mostra qual URI foi enviada para ajudar a conferir no painel do FB
            console.error('URI de redirecionamento usada:', redirectUri);
            return res.status(400).send('Falha ao obter token de acesso da Meta. Verifique se a URL de redirecionamento está autorizada no painel do Facebook.');
        }

        const { access_token } = tokenData;

        // Armazena o access_token em um cookie seguro, httpOnly.
        res.setHeader('Set-Cookie', cookie.serialize('meta_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 60 * 60 * 24 * 30, // 30 dias
            path: '/',
            sameSite: 'lax',
        }));

        // Passo 3: Redirecionar o usuário de volta para a página principal do dashboard.
        res.redirect(302, '/');

    } catch (error) {
        console.error("Erro interno no callback de autenticação:", error);
        res.status(500).send('Erro interno do servidor.');
    }
}