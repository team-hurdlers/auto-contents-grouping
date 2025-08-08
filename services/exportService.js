const ExcelJS = require('exceljs');

class ExportService {
    async exportToExcel(data) {
        console.log('Excel 내보내기 시작, 데이터 수:', data.length);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('GA4 데이터');

        // 컬럼 정의
        worksheet.columns = [
            { header: 'URL 경로', key: 'pagePath', width: 50 },
            { header: '페이지 제목', key: 'pageTitle', width: 40 },
            { header: '한국어 제목', key: 'koreanTitle', width: 50 },
            { header: '페이지뷰', key: 'pageviews', width: 15 }
        ];

        // 헤더 스타일링
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4472C4' }
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

        // 데이터 추가
        data.forEach((item, index) => {
            const row = worksheet.addRow({
                pagePath: item.pagePath || '',
                pageTitle: item.pageTitle || '',
                koreanTitle: item.koreanTitle || item.pageTitle || '',
                pageviews: parseInt(item.pageviews) || 0
            });

            // 짝수 행 배경색
            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'F2F2F2' }
                };
            }
        });

        // 필터 추가
        worksheet.autoFilter = {
            from: 'A1',
            to: `D${data.length + 1}`
        };

        // 첫 번째 행 고정
        worksheet.views = [
            { state: 'frozen', xSplit: 0, ySplit: 1 }
        ];

        // 페이지뷰 컬럼에 데이터 바 추가
        if (data.length > 0) {
            worksheet.addConditionalFormatting({
                ref: `D2:D${data.length + 1}`,
                rules: [
                    {
                        type: 'dataBar',
                        minLength: 0,
                        maxLength: 100,
                        gradient: true,
                        colors: ['FF4472C4', 'FF70AD47']
                    }
                ]
            });
        }

        console.log('Excel 파일 생성 완료');
        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    }

    async exportToCsv(data) {
        console.log('CSV 내보내기 시작, 데이터 수:', data.length);
        
        // CSV 헤더
        const headers = [
            'URL 경로',
            '페이지 제목', 
            '한국어 제목',
            '페이지뷰'
        ];

        // 데이터 행 생성
        const rows = data.map(item => [
            this.escapeCsvValue(item.pagePath || ''),
            this.escapeCsvValue(item.pageTitle || ''),
            this.escapeCsvValue(item.koreanTitle || item.pageTitle || ''),
            parseInt(item.pageviews) || 0
        ]);

        // CSV 내용 조합
        const csvLines = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ];

        const csvContent = csvLines.join('\n');
        console.log('CSV 파일 생성 완료');
        return csvContent;
    }

    escapeCsvValue(value) {
        if (typeof value !== 'string') {
            return value;
        }
        
        // 따옴표, 쉼표, 줄바꿈이 포함된 경우 따옴표로 감싸고 내부 따옴표는 이스케이프
        if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
    }

    // 데이터 검증 함수
    validateData(data) {
        if (!Array.isArray(data)) {
            throw new Error('데이터는 배열 형태여야 합니다.');
        }

        if (data.length === 0) {
            throw new Error('내보낼 데이터가 없습니다.');
        }

        // 첫 번째 항목의 구조 확인
        const firstItem = data[0];
        const requiredFields = ['pagePath', 'pageTitle', 'pageviews'];
        
        for (const field of requiredFields) {
            if (!(field in firstItem)) {
                console.warn(`경고: 필드 '${field}'가 데이터에 없습니다.`);
            }
        }

        console.log('데이터 검증 완료:', {
            총개수: data.length,
            샘플데이터: firstItem
        });

        return true;
    }
}

module.exports = new ExportService();