
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code, error: googleError } = req.query;
    
    // O ID do cliente pode ser fixo (público), mas o Secret DEVE vir do ambiente
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '880633493696-3m5f7ks5rk534tomks1fmihir6qqph3a.apps.googleusercontent.com';
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (googleError) {
        return res.status(400).send(`
            <div style="font-family: sans-serif; padding: 40px; text-align: center;">
                <h1 style="color: #e53e3e;">Erro do Google</h1>
                <p>O Google retornou um erro: <strong>${googleError}</strong></p>
                <p>Isso acontece se você cancelar o login ou se houver erro na tela de consentimento.</p>
                <a href="/" style="color: #3182ce;">Voltar ao Dashboard</a>
            </div>
        `);
    }

    if (!code || typeof code !== 'string') {
        return res.status(400).send('Código de autorização não recebido.');
    }

    // Se o Client Secret estiver faltando na Vercel
    if (!GOOGLE_CLIENT_SECRET) {
        return res.status(500).send(`
            <div style="font-family: sans-serif; padding: 40px; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 50px;">
                <h1 style="color: #2d3748;">Falta o "Client Secret" no Servidor</h1>
                <p>O Google enviou o código de autorização, mas o backend não consegue trocá-lo pelo Token porque a variável <strong>GOOGLE_CLIENT_SECRET</strong> não está configurada na Vercel.</p>
                <div style="background: #ebf8ff; border-left: 4px solid #4299e1; padding: 20px; margin: 20px 0;">
                    <strong>Passo a Passo para Corrigir:</strong><br>
                    1. No Google Cloud Console, copie a "Chave secreta do cliente" (ex: a que termina em <i>Elvw</i>).<br>
                    2. Vá no painel da <strong>Vercel</strong> do seu projeto.<br>
                    3. Entre em <strong>Settings > Environment Variables</strong>.<br>
                    4. Adicione a chave <code>GOOGLE_CLIENT_SECRET</code> com o valor copiado.<br>
                    5. Faça um novo <strong>Redeploy</strong> ou tente logar novamente.
                </div>
                <p style="font-size: 12px; color: #a0aec0;">ID do Cliente em uso: ${GOOGLE_CLIENT_ID}</p>
            </div>
        `);
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/auth/google-callback`;

    try {
        // TROCA DO CÓDIGO PELO TOKEN
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }).toString(),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            return res.status(400).send(`
                <div style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: auto;">
                    <h1 style="color: #e53e3e;">Erro na Troca de Token</h1>
                    <p>O Google recusou as credenciais fornecidas.</p>
                    <div style="background: #fff5f5; padding: 15px; border: 1px solid #feb2b2; border-radius: 5px; font-family: monospace;">
                        ${JSON.stringify(tokenData, null, 2)}
                    </div>
                    <p style="margin-top: 20px;"><strong>Causa provável:</strong> O <i>Client Secret</i> na Vercel não confere com o do Google Cloud, ou a <i>Redirect URI</i> configurada no Google Cloud não é exatamente: <br><code>${redirectUri}</code></p>
                </div>
            `);
        }

        const cookies = [
            cookie.serialize('google_access_token', tokenData.access_token, {
                httpOnly: true,
                secure: true,
                maxAge: tokenData.expires_in,
                path: '/',
                sameSite: 'lax',
            })
        ];

        if (tokenData.refresh_token) {
            cookies.push(cookie.serialize('google_refresh_token', tokenData.refresh_token, {
                httpOnly: true,
                secure: true,
                maxAge: 60 * 60 * 24 * 365,
                path: '/',
                sameSite: 'lax',
            }));
        }

        res.setHeader('Set-Cookie', cookies);
        res.redirect(302, '/');

    } catch (error) {
        console.error("Critical Auth Error:", error);
        res.status(500).send('Erro interno crítico na autenticação.');
    }
}
