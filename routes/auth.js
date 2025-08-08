const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const router = express.Router();

// OAuth2 설정
const getRedirectUri = (req) => {
    const host = req.get('host');
    const protocol = req.protocol;
    return `${protocol}://${host}/api/auth/callback`;
};

const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);

// Google OAuth URL 생성 (login 경로로도 접근 가능)
router.get('/login', (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/analytics.edit',  // Admin API 권한
        'https://www.googleapis.com/auth/analytics.manage.users',  // 사용자 관리
        'https://www.googleapis.com/auth/analytics.manage.users.readonly',  // 사용자 읽기
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    // 동적 redirect URI 설정
    oauth2Client.redirectUri = getRedirectUri(req);
    
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
    });
    
    console.log('Generated OAuth URL:', authUrl);
    res.redirect(authUrl);
});

// Google OAuth URL 생성 (기존 경로 유지)
router.get('/google', (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/analytics.edit',  // Admin API 권한
        'https://www.googleapis.com/auth/analytics.manage.users',  // 사용자 관리
        'https://www.googleapis.com/auth/analytics.manage.users.readonly',  // 사용자 읽기
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    // 동적 redirect URI 설정
    oauth2Client.redirectUri = getRedirectUri(req);

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });

    res.redirect(authUrl);
});

// OAuth 콜백 처리
router.get('/callback', async (req, res) => {
    const { code } = req.query;
    
    try {
        // 동적 redirect URI 설정
        oauth2Client.redirectUri = getRedirectUri(req);
        
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        
        // 세션에 토큰 저장
        req.session.tokens = tokens;
        req.session.authenticated = true;
        
        console.log('OAuth 성공 - 세션 저장:', {
            sessionId: req.sessionID,
            hasTokens: !!tokens,
            authenticated: true
        });
        
        // 세션 저장을 명시적으로 실행
        req.session.save((err) => {
            if (err) {
                console.error('세션 저장 실패:', err);
                return res.redirect('/?auth=error');
            }
            console.log('세션 저장 완료, 리다이렉트');
            res.redirect('/?auth=success');
        });
    } catch (error) {
        console.error('OAuth error:', error);
        res.redirect('/?auth=error');
    }
});

// 로그아웃 (GET - OAuth 로그아웃)
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// 로그아웃 (POST - API 로그아웃)
router.post('/logout', (req, res) => {
    // 세션 제거
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// 인증 상태 확인
router.get('/status', (req, res) => {
    const isAuthenticated = !!req.session.authenticated || !!req.session.tokens;
    
    console.log('Auth status check:', {
        sessionId: req.sessionID,
        authenticated: isAuthenticated,
        hasTokens: !!req.session.tokens,
        hasAuthFlag: !!req.session.authenticated
    });
    
    res.json({
        authenticated: isAuthenticated,
        authType: isAuthenticated ? 'oauth' : 'none',
        user: req.session.user || null
    });
});

module.exports = router;