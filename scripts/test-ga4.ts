/**
 * GA4 연결 테스트 스크립트
 * 실행: npx tsx scripts/test-ga4.ts
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testGA4Connection() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  console.log('=== GA4 연결 테스트 ===\n');
  console.log('환경변수 확인:');
  console.log(`- Property ID: ${propertyId}`);
  console.log(`- Service Account: ${serviceEmail}`);
  console.log(`- Private Key: ${privateKey ? '설정됨 (' + privateKey.length + '자)' : '없음'}`);
  console.log('');

  if (!propertyId || !serviceEmail || !privateKey) {
    console.error('❌ 환경변수가 설정되지 않았습니다.');
    return;
  }

  try {
    const client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: serviceEmail,
        private_key: privateKey,
      },
    });

    console.log('GA4 API 호출 중...\n');

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'totalUsers' }],
    });

    console.log('✅ 연결 성공!');
    console.log(`총 사용자 (최근 7일): ${response.rows?.[0]?.metricValues?.[0]?.value || 0}`);
  } catch (error: any) {
    console.error('❌ 연결 실패:');
    console.error(`- 에러 코드: ${error.code}`);
    console.error(`- 에러 메시지: ${error.details || error.message}`);
    console.log('\n해결 방법:');
    console.log('1. GA4 관리 > 속성 설정 > 속성 액세스 관리에서 서비스 계정에 권한 부여');
    console.log('2. 속성 ID가 올바른지 확인 (GA4 관리 > 속성 설정에서 확인)');
    console.log('3. 권한 부여 후 몇 분 기다린 후 다시 시도');
  }
}

testGA4Connection();
