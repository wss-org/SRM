import Pop, { Config } from "@alicloud/pop-core";
import _ from "lodash";
import { getPopClient, requestOption, sleep } from "../utils";

export * from './type';

const getNasClient = (config: Config, region: string) => getPopClient({ ...config, endpoint: `http://nas.${region}.aliyuncs.com`, apiVersion: '2017-06-26' });

export async function getNasZones(region: string, client?: Pop, config?: Config): Promise<string[]> {
  const zoneIds = await describeZones(region, client, config);

  return [];
}

export async function describeZones(region: string, client?: Pop, config?: Config): Promise<any[]> {
  if (!client) {
    client = getNasClient(config as any, region);
  }

  const zones = await client.request('DescribeZones', { RegionId: region }, requestOption);
  return _.get(zones, 'Zones.Zone', []);
}
