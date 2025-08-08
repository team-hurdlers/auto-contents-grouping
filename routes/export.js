const express = require('express');
const router = express.Router();
const exportService = require('../services/exportService');
const sheetsService = require('../services/sheetsService');

// Export to Excel
router.post('/excel', async (req, res) => {
    try {
        const { data, filename = 'ga4-content-grouping' } = req.body;

        console.log('Excel 내보내기 요청:', {
            dataLength: data?.length,
            sampleData: data?.[0]
        });

        if (!data || !Array.isArray(data)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        // 데이터 검증
        exportService.validateData(data);

        const buffer = await exportService.exportToExcel(data);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}-${Date.now()}.xlsx"`);
        res.send(buffer);

    } catch (error) {
        console.error('Error exporting to Excel:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export to CSV
router.post('/csv', async (req, res) => {
    try {
        const { data, filename = 'ga4-content-grouping' } = req.body;

        console.log('CSV 내보내기 요청:', {
            dataLength: data?.length,
            sampleData: data?.[0]
        });

        if (!data || !Array.isArray(data)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        // 데이터 검증
        exportService.validateData(data);

        const csv = await exportService.exportToCsv(data);
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}-${Date.now()}.csv"`);
        res.send('\ufeff' + csv); // Add BOM for Excel UTF-8 compatibility

    } catch (error) {
        console.error('Error exporting to CSV:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export to Google Sheets
router.post('/sheets', async (req, res) => {
    try {
        const { data, title } = req.body;

        console.log('구글 시트 내보내기 요청:', {
            dataLength: data?.length,
            title: title,
            hasSession: !!req.session,
            hasTokens: !!req.session?.tokens
        });

        // 데이터 검증
        if (!data || !Array.isArray(data)) {
            return res.status(400).json({ error: '유효하지 않은 데이터 형식입니다.' });
        }

        // 세션 확인
        if (!req.session || !req.session.tokens) {
            return res.status(401).json({ 
                error: 'Google 계정 로그인이 필요합니다. 구글 시트 생성 권한이 필요합니다.' 
            });
        }

        // 데이터 검증
        sheetsService.validateData(data);
        
        console.log('구글 시트로 내보내기 시작...');
        
        // Sheets 서비스 초기화
        sheetsService.initializeClients(req.session);

        // 새 스프레드시트 생성 및 데이터 추가
        const result = await sheetsService.exportToNewSheet(data, title);

        console.log('구글 시트 내보내기 완료:', result.spreadsheetUrl);

        res.json({
            success: true,
            message: '구글 시트가 성공적으로 생성되었습니다!',
            spreadsheetId: result.spreadsheetId,
            spreadsheetUrl: result.spreadsheetUrl,
            rowCount: result.rowCount
        });

    } catch (error) {
        console.error('구글 시트 내보내기 오류:', error);
        
        let errorMessage = '구글 시트 내보내기 중 오류가 발생했습니다.';
        
        // 권한 관련 오류 처리
        if (error.message.includes('insufficient authentication') || 
            error.message.includes('Request had insufficient authentication') ||
            error.message.includes('401')) {
            errorMessage = '구글 시트 접근 권한이 없습니다. 다시 로그인해주세요.';
        } else if (error.message.includes('quota') || error.message.includes('429')) {
            errorMessage = 'API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('403')) {
            errorMessage = '구글 시트 생성 권한이 없습니다. 계정 권한을 확인해주세요.';
        } else {
            errorMessage = error.message || errorMessage;
        }
        
        res.status(500).json({ 
            error: errorMessage
        });
    }
});

module.exports = router;