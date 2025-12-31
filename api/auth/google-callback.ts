
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code, error: googleError } = req.query;
    
    // Limpamos IDs e Secrets de qualquer caractere invisível que possa vir da Vercel
    const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '880633493696-3m5f7ks5rk534tomks1fmihir6qqph3a.apps.googleusercontent.com').trim();
    const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();

    if (googleError) {
        return res.status(400).send(`<div style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Erro do Google: ${googleError}</h1><p>Ocorreu um erro durante a autorização.</p><a href="/">Voltar ao início</a></div>`);
    }

    if (!code) return res.status(400).send('Código de autorização ausente.');

    if (!GOOGLE_CLIENT_SECRET) {
        return res.status(500).send(`
            <div style="font-family:sans-serif;padding:40px;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:10px;text-align:center;">
                <h2 style="color:#e53e3e;">Configuração Incompleta</h2>
                <p>A variável <strong>GOOGLE_CLIENT_SECRET</strong> não foi encontrada na Vercel.</p>
                <p>Por favor, adicione-a em Settings > Environment Variables.</p>
            </div>
        `);
    }

    // Construção robusta da Redirect URI
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/auth/google-callback`;

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code as string,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET, // Já está com .trim() acima
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }).toString(),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            const isInvalidClient = tokenData.error === 'invalid_client';
            return res.status(400).send(`
                <div style="font-family:sans-serif;padding:40px;max-width:600px;margin:auto;border:1px solid #feb2b2;background:#fff5f5;border-radius:10px;">
                    <h2 style="color:#c53030;">Erro de Autenticação: ${tokenData.error}</h2>
                    <p>${isInvalidClient 
                        ? '<strong>A Chave Secreta (Client Secret) foi recusada.</strong><br><br>Sua imagem da Vercel mostra que há espaços ou "quebras de linha" na sua variável. Por favor, edite a variável na Vercel, apague tudo e cole novamente garantindo que NÃO haja espaços no início ou fim.' 
                        : tokenData.error_description || 'Erro ao trocar código por token.'}
                    </p>
                    <div style="background:#eee;padding:15px;font-family:monospace;font-size:11px;border-radius:5px;margin-top:10px;overflow-x:auto;">
                        URL usada: ${redirectUri}<br>
                        Payload ID: ${GOOGLE_CLIENT_ID.substring(0, 15)}...
                    </div>
                    <p style="margin-top:20px;text-align:center;"><a href="/" style="background:#3182ce;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;font-weight:bold;">Tentar Novamente</a></p>
                </div>
            `);
        }

        // Salva os tokens nos cookies
        const cookies = [
            cookie.serialize('google_access_token', tokenData.access_token, {
                httpOnly: true, secure: true, maxAge: tokenData.expires_in, path: '/', sameSite: 'lax',
            })
        ];

        if (tokenData.refresh_token) {
            cookies.push(cookie.serialize('google_refresh_token', tokenData.refresh_token, {
                httpOnly: true, secure: true, maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax',
            }));
        }

        res.setHeader('Set-Cookie', cookies);
        res.redirect(302, '/');

    } catch (error) {
        console.error("Internal Auth Error:", error);
        res.status(500).send('Erro interno ao processar autenticação do Google.');
    }
}
