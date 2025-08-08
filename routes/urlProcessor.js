const express = require('express');
const router = express.Router();
const urlParser = require('../services/urlParser');

// URL 리스트를 path 기준으로 그룹핑
router.post('/group-by-path', async (req, res) => {
    try {
        const { urls } = req.body;
        
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ 
                error: 'URLs array is required' 
            });
        }
        
        const grouped = urlParser.groupUrlsByPath(urls);
        
        res.json({
            success: true,
            groupCount: Object.keys(grouped).length,
            totalUrls: urls.length,
            groups: grouped
        });
    } catch (error) {
        console.error('Error grouping URLs:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// AI를 활용한 URL 분류 및 처리
router.post('/process-with-ai', async (req, res) => {
    try {
        const { 
            urls, 
            websiteContext = ''
        } = req.body;
        
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ 
                error: 'URLs array is required' 
            });
        }
        
        // AI로 URL 처리 (그룹화만 수행)
        const result = await urlParser.processUrlsWithAI(urls, {
            websiteContext
        });
        
        res.json({
            success: true,
            originalCount: result.originalCount,
            processedCount: result.processedCount,
            removedCount: result.removedCount,
            result: result.processedUrls,
            removedUrls: result.removedUrls,
            groupingDetails: result.groupingDetails
        });
    } catch (error) {
        console.error('Error processing URLs with AI:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// AI URL 그룹화 (개인화/세션 URL 그룹화)
router.post('/classify-personalized', async (req, res) => {
    try {
        const { urls, websiteContext = '' } = req.body;
        
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ 
                error: 'URLs array is required' 
            });
        }
        
        // AI로 URL 그룹화
        const groupingResult = await urlParser.groupUrlsWithAI(urls, websiteContext);
        
        // 그룹화된 URL과 개별 URL 정리
        const personalizedUrls = [];
        const generalUrls = [];
        
        // 그룹화된 URL들 (개인화로 분류)
        if (groupingResult.groups) {
            groupingResult.groups.forEach(group => {
                personalizedUrls.push(...group.members);
            });
        }
        
        // 개별 URL들 (일반으로 분류)
        if (groupingResult.standalone) {
            generalUrls.push(...groupingResult.standalone);
        }
        
        res.json({
            success: true,
            total: urls.length,
            personalized: {
                count: personalizedUrls.length,
                urls: personalizedUrls
            },
            general: {
                count: generalUrls.length,
                urls: generalUrls
            },
            groups: groupingResult.groups || [],
            message: groupingResult.groups ? `${groupingResult.groups.length}개 그룹 발견` : '그룹화된 URL 없음'
        });
    } catch (error) {
        console.error('Error grouping URLs:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// 중복 URL 제거
router.post('/remove-duplicates', async (req, res) => {
    try {
        const { urls } = req.body;
        
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ 
                error: 'URLs array is required' 
            });
        }
        
        const uniqueUrls = urlParser.removeDuplicateUrls(urls);
        
        res.json({
            success: true,
            originalCount: urls.length,
            uniqueCount: uniqueUrls.length,
            duplicatesRemoved: urls.length - uniqueUrls.length,
            urls: uniqueUrls
        });
    } catch (error) {
        console.error('Error removing duplicates:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// URL 상세 분석
router.post('/analyze-url', (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ 
                error: 'URL is required' 
            });
        }
        
        const parsed = urlParser.parseUrl(url);
        const category = urlParser.categorizeUrl(url);
        const isValid = urlParser.isValidUrl(url);
        const normalized = urlParser.normalizeUrl(url);
        const queryParams = urlParser.extractQueryParams(url);
        
        res.json({
            success: true,
            url,
            analysis: {
                parsed,
                category,
                isValid,
                normalized,
                queryParams
            }
        });
    } catch (error) {
        console.error('Error analyzing URL:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

module.exports = router;