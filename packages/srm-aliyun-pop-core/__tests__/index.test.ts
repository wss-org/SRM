import Pop, { ROAClient } from '../src';
import _ from 'lodash';
import PopClient from '@alicloud/pop-core';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

test('ROAClient', async () => {
  const config = {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ACCESS_KEY_SECRET || '',
    endpoint: 'https://devops.cn-hangzhou.aliyuncs.com',
    apiVersion: '2021-06-25',
  }
  const codeupClient = new ROAClient(config);
  expect(codeupClient instanceof require('@alicloud/pop-core').ROAClient).toBeTruthy();
  await expect((async () => {
    await codeupClient.request('GET', '/repository/list', {
      organizationId: '60b045b52c5969c370c5a63e'
    }, JSON.stringify({}), {
      'Content-Type': 'application/json',
    }, {});
  })()).resolves.toBeUndefined();
});

test.only('getInitNasConfigAsFc', async () => {
  const region = 'cn-chengdu';
  const config = {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ACCESS_KEY_SECRET || '',
    endpoint: `http://nas.${region}.aliyuncs.com`,
    apiVersion: '2017-06-26',
  }
  const codeupClient = new Pop(config);
  expect(codeupClient instanceof PopClient).toBeTruthy();
  await codeupClient.getInitNasConfigAsFc({
    region,
    rule: 'test-srm-client'
  });
})
