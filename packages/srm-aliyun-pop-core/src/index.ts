import Pop, { Config as IConfig } from '@alicloud/pop-core';
import { tracker } from '@serverless-cd/srm-aliyun-common';
import _ from 'lodash';
import { getFcZoneId } from './fc';
import Nas20170626, { IGetInitNasConfigAsFcOptions, IGetInitNasConfigAsFcResponse, IVpcConfig } from './nas-2017-06-26';
import Vpc20160428, { IGetInitVpcConfigAsFcOptions, IGetInitVpcConfigAsFcResponse } from './vpc-2016-04-28';

const { ROAClient: ROA } = require('@alicloud/pop-core');

export type Config = IConfig;

export default class PopClient extends Pop {
  private config: Config;
  logger: any

  constructor(config: Config, logger: any = console) {
    super(config);
    this.config = config;
    this.logger = logger;
  }

  @tracker()
  async request<T>(action: String, params: Object, options?: Object | undefined): Promise<T> {
    return await super.request(action, params, options);
  }

  async getInitVpcConfigAsFc(params: IGetInitVpcConfigAsFcOptions): Promise<IGetInitVpcConfigAsFcResponse> {
    const { rule, region } = params || {};
    if (_.isEmpty(rule) || !_.isString(rule)) {
      throw new Error(`Invalid rule: ${rule}`);
    }
    const fcZoneIds = await getFcZoneId(this.config, region);

    const vpcClient = new Vpc20160428(this.config, this.logger);
    return await vpcClient.initVpcConfig({ ...params, fcZoneIds });
  }

  async getInitNasConfigAsFc(params: IGetInitNasConfigAsFcOptions): Promise<IGetInitNasConfigAsFcResponse> {
    const { region, rule, vpcConfig = ({} as unknown as IVpcConfig) } = params || {};
    if (_.isEmpty(rule) || !_.isString(rule)) {
      throw new Error(`Invalid rule: ${rule}`);
    }

    const nasClient = new Nas20170626(region, this.config, this.logger);

    let storageType = '';
    let nasVswitch = '';
    let nasZone = '';
    let vpcId = _.get(vpcConfig, 'vpcId', '');
    const vpcIsEmpty = _.isEmpty(vpcId) && _.isEmpty(vpcConfig?.vswitchIds);
    // 如果 vpc 为空，则初始化 vpc 配置
    if (vpcIsEmpty) {
      const { zoneIds, type } = await nasClient.getNasZones();
      const initVpcConfig = await this.getInitVpcConfigAsFc({ region, rule, nasZoneIds: zoneIds });
      nasVswitch = initVpcConfig.nasVswitch as string;
      nasZone = initVpcConfig.nasZone as string;
      storageType = type;
      vpcId = initVpcConfig.vpcId;
      _.unset(initVpcConfig, 'nasVswitch');
      _.unset(initVpcConfig, 'nasZone');
      _.merge(vpcConfig, initVpcConfig);
    } else {
      const vswitchIds = _.get(vpcConfig, 'vswitchIds', []);
      if (_.isEmpty(vpcId) && !_.isEmpty(vswitchIds)) {
        throw new Error(`Invalid vpcConfig: ${JSON.stringify(vpcConfig)}. Please specify vpcId configuration.`);
      } else if (!_.isEmpty(vpcId) && _.isEmpty(vswitchIds)) {
        throw new Error(`Invalid vpcConfig: ${JSON.stringify(vpcConfig)}. Please specify vswitchIds configuration.`);
      }
    }

    // 如果存在复用则直接返回
    const nasFindConfig = await nasClient.findNas(vpcId, rule);
    if (_.isPlainObject(nasFindConfig)) {
      return {
        ...nasFindConfig,
        ...vpcConfig,
      } as unknown as IGetInitNasConfigAsFcResponse;
    }

    // 如果不存在则创建
    //   传入 vpc 时需要验证交换机的地区
    if (!vpcIsEmpty) {
      const vswitchIds = _.get(vpcConfig, 'vswitchIds', []);
      const vpcClient = new Vpc20160428(this.config, this.logger);
      const { list: vswDescribes } = await vpcClient.describeVSwitches({ region, vpcId });
      this.logger.debug(`vswDescribes for ${JSON.stringify(vswDescribes)}`);
      const vswitches = _.filter(vswDescribes, ({ VSwitchId }: any) => _.includes(vswitchIds, VSwitchId)).map(item => ({ vswitchId: item.VSwitchId, zoneId: item.ZoneId }));
      this.logger.debug(`vswitches for ${JSON.stringify(vswitches)}`);
      if (_.isEmpty(vswitches)) {
        throw new Error(`VswitchIds(${JSON.stringify(vswitchIds)}) cannot be queried in the vpcId(${vpcId}).`);
      }
      const zoneConfig = await nasClient.getNasZonesAsVSwitches(vswitches);
      nasVswitch = zoneConfig.vswitchId;
      storageType = zoneConfig.type;
      nasZone = zoneConfig.zoneId;
    }

    const nasConfig = await nasClient.makeNas({
      vpcId,
      storageType,
      nasConfig: (nasFindConfig as any[]),
      zoneId: nasZone,
      vswitchId: nasVswitch,
      description: rule,
    });
    return {
      ...nasConfig,
      ...vpcConfig,
    } as unknown as IGetInitNasConfigAsFcResponse;
  }
}

export const RPCClient = PopClient;


export class ROAClient extends ROA {
  constructor(config: Config) {
    super(config);
  }

  @tracker()
  async request(method: string, uriPattern: string, query = {}, body = '', headers = {}, opts = {}): Promise<any> {
    return await super.request(method, uriPattern, query, body, headers, opts);
  }

  @tracker()
  async put<T>(path: string, query?: Record<string, any>, body?: Record<string, any>, headers?: Record<string, string>, options?: Record<string, any>): Promise<T> {
    return await super.put(path, query, body, headers, options);
  }
}
