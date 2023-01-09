import { Config } from '@alicloud/pop-core';
// @ts-ignore
import FC from '@alicloud/fc2';
import _ from 'lodash';
import { getAccountId } from '../utils';

const getFcClient = async (config: Config, region: string) => {
  let accountId = _.get(config, 'accountId', '');
  if (!accountId) {
    accountId = await getAccountId(config);
  }

  const {
    accessKeyId,
    accessKeySecret,
    securityToken,
  } = config;

  return new FC(accountId, {
    accessKeyID: accessKeyId,
    accessKeySecret,
    securityToken,
    region,
  });
}

export const getFcZoneId = async (config: Config, region: string): Promise<string[]> => {
  const client = await getFcClient(config, region);
  const rs = await client.getAccountSettings();

  return _.get(rs, 'data.availableAZs', []);
}