import { getFcZoneId } from '../src/fc';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const region = 'cn-hangzhou';

test.only('get fc account settings', async () => {
  const config = {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ACCESS_KEY_SECRET || '',
    endpoint: 'https://devops.cn-hangzhou.aliyuncs.com',
    apiVersion: '2021-06-25',
  }

  const zones = await getFcZoneId(config, region);
  expect(zones).toMatchObject([
    'cn-hangzhou-f',
    'cn-hangzhou-g',
    'cn-hangzhou-h',
    'cn-hangzhou-i',
    'cn-hangzhou-j'
  ]);
})
