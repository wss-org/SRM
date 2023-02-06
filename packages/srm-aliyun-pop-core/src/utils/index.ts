import Pop, { Config } from "@alicloud/pop-core";
import _ from "lodash";

export const getPopClient = ({
  endpoint = '', apiVersion = '', accessKeyId, accessKeySecret, securityToken, opts
}: Config) => new Pop({
  endpoint,
  apiVersion,
  accessKeyId,
  accessKeySecret,
  // @ts-ignore
  securityToken,
  opts,
});

export const getAccountId = async (config: Config): Promise<string> => {
  const client = getPopClient({
    ...config,
    endpoint: 'https://sts.cn-hangzhou.aliyuncs.com',
    apiVersion: '2015-04-01'
  });

  const result = await client.request(
    'GetCallerIdentity',
    {},
    requestOption,
  );

  return _.get(result, 'AccountId', '');
};

export const requestOption = {
  method: 'POST',
};

export const sleep = (timer: number = 1000) => new Promise((resolve) => setTimeout(resolve, timer));
