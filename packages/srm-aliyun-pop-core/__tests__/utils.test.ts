import { getAccountId } from '../src/utils';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

test.only('get accountId', async () => {
  const config = {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ACCESS_KEY_SECRET || '',
    endpoint: 'https://devops.cn-hangzhou.aliyuncs.com',
    apiVersion: '2021-06-25',
  }

  const accountId = await getAccountId(config);
  expect(accountId).toBe(process.env.ACCOUNT_ID);
})
