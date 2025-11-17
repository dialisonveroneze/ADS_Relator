// api/auth.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

// Este endpoint lida com o redirecionamento de volta da Meta após a autorização do usuário.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code } = req.query;
    const { META_APP_ID, META_APP_SECRET, ROOT_URL } = process.env;

    if (!code || typeof code !== 'string') {
        return res.status(400).send('Código de autorização inválido.');
    }

    if (!META_APP_ID || !META_APP_SECRET || !ROOT_URL) {
        console.error("Variáveis de ambiente faltando.");
        return res.status(500).send('Erro de configuração no servidor.');
    }
    
    // A redirect_uri aqui DEVE ser exatamente a mesma que foi enviada na URL de autorização.
    const redirectUri = `${ROOT_URL}/api/auth`;

    // Passo 2: Trocar o código de autorização por um access token.
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_APP_SECRET}&code=${code}`;

    try {
        const tokenResponse = await fetch(tokenUrl);
        const tokenData = await tokenResponse.json() as { access_token?: string; error?: any };

        if (tokenData.error || !tokenData.access_token) {
            console.error('Erro ao obter access token da Meta:', tokenData.error);
            return res.status(400).send('Falha ao obter token de acesso da Meta.');
        }

        const { access_token } = tokenData;

        // Armazena o access_token em um cookie seguro, httpOnly.
        // httpOnly: O cookie não pode ser acessado por JavaScript no cliente (protege contra XSS).
        // secure: O cookie só será enviado em requisições HTTPS.
        // path=/: O cookie está disponível em todo o site.
        // maxAge: Define o tempo de expiração do cookie (ex: 30 dias).
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
