const express = require('express');
const router = express.Router();
const gaService = require('../services/gaService');
const urlParser = require('../services/urlParser');
const aiMappingService = require('../services/aiMappingService');
const dataProcessor = require('../utils/dataProcessor');

// Get GA4 properties list
router.get('/properties', async (req, res) => {
    try {
        // OAuth 사용시 세션에서 토큰 전달
        const properties = await gaService.listProperties(req.session);
        res.json({ success: true, properties });
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fetch GA4 data
router.post('/fetch-data', async (req, res) => {
    try {
        const {
            propertyId,
            startDate,
            endDate,
            minPageviews = 0,
            includePaths = [],
            excludePaths = []
        } = req.body;

        // Validate inputs
        if (!propertyId) {
            return res.status(400).json({ error: 'Property ID is required' });
        }

        // Fetch data from GA4
        const rawData = await gaService.fetchAnalyticsData({
            propertyId: propertyId || process.env.GA4_PROPERTY_ID,
            startDate: startDate || '30daysAgo',
            endDate: endDate || 'today'
        }, req.session);

        // Process and filter data
        const processedData = dataProcessor.processData(rawData, {
            minPageviews,
            includePaths,
            excludePaths
        });

        // Parse URLs and extract paths
        const parsedData = processedData.map(item => ({
            ...item,
            ...urlParser.parseUrl(item.pagePath)
        }));

        res.json({
            success: true,
            data: parsedData,
            totalRows: parsedData.length,
            dateRange: { startDate, endDate }
        });

    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Process URLs with AI mapping
router.post('/process-mapping', async (req, res) => {
    try {
        const { data, useCache = true, websiteContext = '' } = req.body;

        if (!data || !Array.isArray(data)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        console.log('\n=== AI 한글 번역 시작 ===');
        console.log(`총 URL 수: ${data.length}개`);

        // Extract unique paths for mapping
        const uniquePaths = new Set();
        data.forEach(item => {
            if (item.depth1) uniquePaths.add(item.depth1);
            if (item.depth2) uniquePaths.add(item.depth2);
            if (item.depth3) uniquePaths.add(item.depth3);
            if (item.depth4) uniquePaths.add(item.depth4);
            if (item.depth5) uniquePaths.add(item.depth5);
            if (item.depth6) uniquePaths.add(item.depth6);
            if (item.depth7) uniquePaths.add(item.depth7);
            if (item.depth8) uniquePaths.add(item.depth8);
            if (item.depth9) uniquePaths.add(item.depth9);
            if (item.depth10) uniquePaths.add(item.depth10);
        });

        console.log(`고유 경로 추출 완료: ${uniquePaths.size}개`);
        console.log('AI 번역 시작...\n');

        // Get AI mappings
        const mappings = await aiMappingService.getMappings(
            Array.from(uniquePaths),
            { useCache, websiteContext }
        );

        // Apply mappings to data
        const mappedData = data.map(item => ({
            ...item,
            koreanPath: [
                item.depth1 ? (mappings[item.depth1] || item.depth1) : null,
                item.depth2 ? (mappings[item.depth2] || item.depth2) : null,
                item.depth3 ? (mappings[item.depth3] || item.depth3) : null,
                item.depth4 ? (mappings[item.depth4] || item.depth4) : null,
                item.depth5 ? (mappings[item.depth5] || item.depth5) : null,
                item.depth6 ? (mappings[item.depth6] || item.depth6) : null,
                item.depth7 ? (mappings[item.depth7] || item.depth7) : null,
                item.depth8 ? (mappings[item.depth8] || item.depth8) : null,
                item.depth9 ? (mappings[item.depth9] || item.depth9) : null,
                item.depth10 ? (mappings[item.depth10] || item.depth10) : null
            ].filter(Boolean).join(' | ')
        }));

        res.json({
            success: true,
            data: mappedData,
            mappings,
            totalMapped: Object.keys(mappings).length
        });

    } catch (error) {
        console.error('Error processing mappings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update mapping cache
router.post('/update-mapping', async (req, res) => {
    try {
        const { path, koreanValue } = req.body;

        if (!path || !koreanValue) {
            return res.status(400).json({ error: 'Path and Korean value are required' });
        }

        await aiMappingService.updateMapping(path, koreanValue);
        res.json({ success: true, message: 'Mapping updated successfully' });

    } catch (error) {
        console.error('Error updating mapping:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get mapping cache
router.get('/mappings', async (req, res) => {
    try {
        const mappings = await aiMappingService.getAllMappings();
        res.json({ success: true, mappings });
    } catch (error) {
        console.error('Error fetching mappings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear mapping cache
router.post('/clear-cache', async (req, res) => {
    try {
        const result = await aiMappingService.clearCache();
        res.json({ success: true, message: 'Cache cleared', result });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;