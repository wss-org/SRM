import Pop, { Config } from "@alicloud/pop-core";
import _ from "lodash";
import { getPopClient, requestOption, sleep } from "../utils";

export * from './type';

const getNasClient = (config: Config, region: string) => getPopClient({ ...config, endpoint: `http://nas.${region}.aliyuncs.com`, apiVersion: '2017-06-26' });

export async function getNasZones(region: string, client?: Pop, config?: Config): Promise<{ zoneIds: string[]; type: 'Performance' | 'Capacity' }> {
  const zones = await describeZones(region, client, config);
  console.log(JSON.stringify(zones));

  const performances: string[] = [];
  const capacities: string[] = [];
  for (const zone of zones) {
    const zoneId = _.get(zone, 'ZoneId');
    const capacity = _.get(zone, 'Capacity.Protocol', []);
    const performance = _.get(zone, 'Performance.Protocol', []);
    if (!_.isEmpty(performance)) {
      performances.push(zoneId);
    }
    if (!_.isEmpty(capacity)) {
      capacities.push(zoneId);
    }
  }
  if (!_.isEmpty(performances)) {
    return { zoneIds: performances, type: 'Performance' };
  }
  if (!_.isEmpty(capacities)) {
    return { zoneIds: capacities, type: 'Capacity' };
  }
  throw new Error('Not fount nas zoneIds');
}

export async function describeZones(region: string, client?: Pop, config?: Config): Promise<any[]> {
  if (!client) {
    client = getNasClient(config as any, region);
  }

  const zones = await client.request('DescribeZones', { RegionId: region, FileSystemType: 'standard' }, requestOption);
  return _.get(zones, 'Zones.Zone', []);
}
