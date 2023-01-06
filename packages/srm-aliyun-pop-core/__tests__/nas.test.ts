import { describeZones } from '../src/nas';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const region = 'cn-hangzhou';

test.only('get fc account settings', async () => {
  const config = {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ACCESS_KEY_SECRET || '',
    endpoint: 'https://devops.cn-hangzhou.aliyuncs.com',
    apiVersion: '2021-06-25',
  }

  const zones = await describeZones(region, undefined, config);
  // console.log('zones: ', JSON.stringify(zones, null, 2));
  expect(Array.isArray(zones)).toBeTruthy();
})
