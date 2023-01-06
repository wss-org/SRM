import FC from '../src';
// @ts-ignore
import FC2 from '@alicloud/fc2';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

test('FC Client', async () => {
  const fc = new FC(process.env.ACCOUNT_ID || '', {
    accessKeyID: process.env.ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ACCESS_KEY_SECRET || '',
    region: 'cn-hangzhou',
  });
  expect(fc instanceof FC2).toBeTruthy();

  const { data } = await fc.getAccountSettings();
  expect(data.availableAZs).toMatchObject([
    'cn-hangzhou-f',
    'cn-hangzhou-g',
    'cn-hangzhou-h',
    'cn-hangzhou-i',
    'cn-hangzhou-j'
  ]);
});