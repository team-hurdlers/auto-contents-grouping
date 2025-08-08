const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'ga4-content-grouping-secret',
    resave: true, // 세션이 수정되지 않아도 저장
    saveUninitialized: true, // 초기화되지 않은 세션도 저장
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: false, // 개발 환경에서는 false로 설정
        httpOnly: true,
        sameSite: 'lax' // CSRF 보호하면서 일반적인 요청은 허용
    }
}));


// Routes
const authRoutes = require('./routes/auth');
const analyticsRoutes = require('./routes/analytics');
const analyticsAdminRoutes = require('./routes/analyticsAdmin');
const exportRoutes = require('./routes/export');
const adminRoutes = require('./routes/admin');
const urlProcessorRoutes = require('./routes/urlProcessor');

app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/analytics-admin', analyticsAdminRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/url-processor', urlProcessorRoutes);

// OAuth 상태 확인 엔드포인트
app.get('/api/check-auth', (req, res) => {
    res.json({
        authenticated: !!req.session.tokens,
        user: req.session.user || null
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: isProduction ? 'production' : 'development',
        authenticated: !!req.session.tokens
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: isProduction ? 'Internal Server Error' : err.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 GA4 Content Grouping Tool is ready!`);
    console.log(`🌍 Environment: ${isProduction ? 'Production' : 'Development'}`);
});