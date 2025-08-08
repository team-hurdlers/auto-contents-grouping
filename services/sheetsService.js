const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

class SheetsService {
    constructor() {
        this.sheets = null;
        this.drive = null;
        this.auth = null;
    }

    initializeClients(session) {
        console.log('Google Sheets 클라이언트 초기화 중...');
        
        if (!session || !session.tokens) {
            throw new Error('유효한 OAuth 토큰이 필요합니다.');
        }

        try {
            // OAuth2 클라이언트 설정
            this.auth = new OAuth2Client(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET
            );
            this.auth.setCredentials(session.tokens);

            // Google Sheets와 Drive API 초기화
            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            this.drive = google.drive({ version: 'v3', auth: this.auth });
            
            console.log('Google Sheets 클라이언트 초기화 완료');
        } catch (error) {
            console.error('Google Sheets 클라이언트 초기화 실패:', error);
            throw new Error(`Google Sheets 초기화 실패: ${error.message}`);
        }
    }

    async createSpreadsheet(title) {
        if (!this.sheets) {
            throw new Error('Google Sheets 클라이언트가 초기화되지 않았습니다.');
        }

        try {
            console.log(`새 스프레드시트 생성: "${title}"`);

            const response = await this.sheets.spreadsheets.create({
                resource: {
                    properties: {
                        title: title
                    },
                    sheets: [{
                        properties: {
                            title: 'GA4 데이터',
                            gridProperties: {
                                rowCount: 1000,
                                columnCount: 4
                            }
                        }
                    }]
                }
            });

            const spreadsheetId = response.data.spreadsheetId;
            const spreadsheetUrl = response.data.spreadsheetUrl;

            console.log(`스프레드시트 생성 완료: ${spreadsheetId}`);

            return {
                spreadsheetId,
                spreadsheetUrl
            };

        } catch (error) {
            console.error('스프레드시트 생성 오류:', error);
            if (error.response) {
                console.error('API 응답:', error.response.data);
            }
            throw new Error(`스프레드시트 생성 실패: ${error.message}`);
        }
    }

    async addDataToSheet(spreadsheetId, data) {
        if (!this.sheets) {
            throw new Error('Google Sheets 클라이언트가 초기화되지 않았습니다.');
        }

        try {
            console.log(`데이터 추가 시작: ${data.length}개 행`);

            // 헤더와 데이터 행 준비
            const headers = ['URL 경로', '페이지 제목', '한국어 제목', '페이지뷰'];
            const rows = [headers];
            
            // 데이터 행 추가
            data.forEach(item => {
                rows.push([
                    item.pagePath || '',
                    item.pageTitle || '',
                    item.koreanTitle || item.pageTitle || '',
                    parseInt(item.pageviews) || 0
                ]);
            });

            // 데이터 업데이트
            const range = `GA4 데이터!A1:D${rows.length}`;
            await this.sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: rows
                }
            });

            console.log(`데이터 추가 완료: ${rows.length - 1}개 데이터 행`);
            return { success: true, rowCount: rows.length - 1 };

        } catch (error) {
            console.error('데이터 추가 오류:', error);
            if (error.response) {
                console.error('API 응답:', error.response.data);
            }
            throw new Error(`데이터 추가 실패: ${error.message}`);
        }
    }

    async formatSheet(spreadsheetId) {
        if (!this.sheets) {
            return; // 포맷팅 실패해도 데이터는 있으니 무시
        }

        try {
            console.log('시트 포맷팅 시작');

            // 시트 정보 가져오기
            const sheetInfo = await this.sheets.spreadsheets.get({
                spreadsheetId
            });

            const sheetId = sheetInfo.data.sheets[0].properties.sheetId;

            // 포맷팅 요청
            const requests = [
                // 헤더 행 포맷팅
                {
                    repeatCell: {
                        range: {
                            sheetId: sheetId,
                            startRowIndex: 0,
                            endRowIndex: 1,
                            startColumnIndex: 0,
                            endColumnIndex: 4
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: {
                                    red: 0.27,
                                    green: 0.45,
                                    blue: 0.77
                                },
                                textFormat: {
                                    foregroundColor: {
                                        red: 1.0,
                                        green: 1.0,
                                        blue: 1.0
                                    },
                                    bold: true
                                },
                                horizontalAlignment: 'CENTER'
                            }
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                    }
                },
                // 열 자동 조정
                {
                    autoResizeDimensions: {
                        dimensions: {
                            sheetId: sheetId,
                            dimension: 'COLUMNS',
                            startIndex: 0,
                            endIndex: 4
                        }
                    }
                },
                // 첫 행 고정
                {
                    updateSheetProperties: {
                        properties: {
                            sheetId: sheetId,
                            gridProperties: {
                                frozenRowCount: 1
                            }
                        },
                        fields: 'gridProperties.frozenRowCount'
                    }
                }
            ];

            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: { requests }
            });

            console.log('시트 포맷팅 완료');

        } catch (error) {
            console.warn('시트 포맷팅 실패 (데이터는 정상 추가됨):', error.message);
        }
    }

    async exportToNewSheet(data, title = null) {
        try {
            // 제목 생성
            const timestamp = new Date().toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(/[\/\s:]/g, '-');
            
            const sheetTitle = title || `GA4 컨텐츠 그룹핑 결과_${timestamp}`;

            console.log('구글 시트 내보내기 시작:', {
                제목: sheetTitle,
                데이터수: data.length
            });

            // 1. 새 스프레드시트 생성
            const { spreadsheetId, spreadsheetUrl } = await this.createSpreadsheet(sheetTitle);

            // 2. 데이터 추가
            const dataResult = await this.addDataToSheet(spreadsheetId, data);

            // 3. 포맷팅 적용 (실패해도 무시)
            await this.formatSheet(spreadsheetId);

            console.log('구글 시트 내보내기 완료:', {
                스프레드시트ID: spreadsheetId,
                URL: spreadsheetUrl,
                추가된행수: dataResult.rowCount
            });

            return {
                success: true,
                spreadsheetId,
                spreadsheetUrl,
                rowCount: dataResult.rowCount
            };

        } catch (error) {
            console.error('구글 시트 내보내기 실패:', error);
            throw error;
        }
    }

    // 데이터 검증
    validateData(data) {
        if (!Array.isArray(data)) {
            throw new Error('데이터는 배열이어야 합니다.');
        }

        if (data.length === 0) {
            throw new Error('내보낼 데이터가 없습니다.');
        }

        if (data.length > 10000) {
            throw new Error('데이터가 너무 많습니다. 10,000개 이하로 제한해주세요.');
        }

        return true;
    }
}

module.exports = new SheetsService();