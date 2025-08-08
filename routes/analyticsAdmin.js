const express = require('express');
const router = express.Router();
const AnalyticsAdminService = require('../services/analyticsAdminServiceV2');

// 인증 확인 미들웨어
function requireAuth(req, res, next) {
    if (!req.session || !req.session.tokens) {
        return res.status(401).json({
            success: false,
            error: 'Google 계정 로그인이 필요합니다.'
        });
    }
    next();
}

// GA4 계정 목록 가져오기
router.get('/accounts', requireAuth, async (req, res) => {
    try {
        const adminService = new AnalyticsAdminService();
        adminService.initializeFromSession(req.session);
        
        const accounts = await adminService.getAccounts();
        
        res.json({
            success: true,
            accounts: accounts,
            debug: {
                totalCount: accounts.length,
                message: `총 ${accounts.length}개 계정 로드됨`
            }
        });
        
    } catch (error) {
        console.error('계정 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 특정 계정의 속성 목록 가져오기
router.get('/accounts/:accountName/properties', requireAuth, async (req, res) => {
    try {
        let { accountName } = req.params;
        
        if (!accountName) {
            return res.status(400).json({
                success: false,
                error: '계정 이름이 필요합니다.'
            });
        }
        
        // URL 인코딩된 경우 디코딩
        accountName = decodeURIComponent(accountName);
        
        // accounts/ prefix 처리 - 이미 있으면 그대로, 없으면 추가
        // "accounts/39246837" 형태로 들어오면 그대로 사용
        // "39246837" 형태로 들어오면 prefix 추가
        if (!accountName.includes('/')) {
            accountName = `accounts/${accountName}`;
        }
        
        console.log('속성 조회 요청 - 계정:', accountName);
        
        const adminService = new AnalyticsAdminService();
        adminService.initializeFromSession(req.session);
        
        const properties = await adminService.getProperties(accountName);
        
        res.json({
            success: true,
            accountName: accountName,
            properties: properties
        });
        
    } catch (error) {
        console.error('속성 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 특정 속성의 데이터 스트림 목록 가져오기
router.get('/properties/:propertyName/datastreams', requireAuth, async (req, res) => {
    try {
        const { propertyName } = req.params;
        
        if (!propertyName) {
            return res.status(400).json({
                success: false,
                error: '속성 이름이 필요합니다.'
            });
        }
        
        const adminService = new AnalyticsAdminService();
        adminService.initializeFromSession(req.session);
        
        const dataStreams = await adminService.getDataStreams(propertyName);
        
        res.json({
            success: true,
            propertyName: propertyName,
            dataStreams: dataStreams
        });
        
    } catch (error) {
        console.error('데이터 스트림 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 특정 데이터 스트림 상세 정보 가져오기
router.get('/datastreams/:streamName', requireAuth, async (req, res) => {
    try {
        const { streamName } = req.params;
        
        if (!streamName) {
            return res.status(400).json({
                success: false,
                error: '데이터 스트림 이름이 필요합니다.'
            });
        }
        
        const adminService = new AnalyticsAdminService();
        adminService.initializeFromSession(req.session);
        
        const streamDetails = await adminService.getDataStreamDetails(streamName);
        
        res.json({
            success: true,
            dataStream: streamDetails
        });
        
    } catch (error) {
        console.error('데이터 스트림 상세 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 전체 계층 구조 가져오기 (계정 → 속성 → 데이터 스트림)
router.get('/hierarchy', requireAuth, async (req, res) => {
    try {
        const adminService = new AnalyticsAdminService();
        adminService.initializeFromSession(req.session);
        
        const hierarchy = await adminService.getFullHierarchy();
        
        res.json({
            success: true,
            hierarchy: hierarchy,
            summary: {
                accountCount: hierarchy.length,
                totalProperties: hierarchy.reduce((sum, account) => sum + (account.properties?.length || 0), 0),
                totalDataStreams: hierarchy.reduce((sum, account) => 
                    sum + (account.properties?.reduce((propSum, prop) => 
                        propSum + (prop.dataStreams?.length || 0), 0) || 0), 0
                )
            }
        });
        
    } catch (error) {
        console.error('전체 계층 구조 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 계정/속성/스트림 검색
router.post('/search', requireAuth, async (req, res) => {
    try {
        const { query, type } = req.body; // type: 'account', 'property', 'datastream'
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: '검색어가 필요합니다.'
            });
        }
        
        const adminService = new AnalyticsAdminService();
        adminService.initializeFromSession(req.session);
        
        const hierarchy = await adminService.getFullHierarchy();
        
        let results = [];
        
        hierarchy.forEach(account => {
            // 계정 검색
            if (!type || type === 'account') {
                if (account.displayName.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        type: 'account',
                        account: account,
                        property: null,
                        dataStream: null
                    });
                }
            }
            
            // 속성 및 데이터 스트림 검색
            if (account.properties) {
                account.properties.forEach(property => {
                    // 속성 검색
                    if (!type || type === 'property') {
                        if (property.displayName.toLowerCase().includes(query.toLowerCase())) {
                            results.push({
                                type: 'property',
                                account: account,
                                property: property,
                                dataStream: null
                            });
                        }
                    }
                    
                    // 데이터 스트림 검색
                    if (!type || type === 'datastream') {
                        if (property.dataStreams) {
                            property.dataStreams.forEach(stream => {
                                if (stream.displayName.toLowerCase().includes(query.toLowerCase())) {
                                    results.push({
                                        type: 'datastream',
                                        account: account,
                                        property: property,
                                        dataStream: stream
                                    });
                                }
                            });
                        }
                    }
                });
            }
        });
        
        res.json({
            success: true,
            query: query,
            type: type || 'all',
            results: results,
            count: results.length
        });
        
    } catch (error) {
        console.error('검색 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;