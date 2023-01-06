import Pop, { Config as IConfig } from '@alicloud/pop-core';
import { tracker } from '@serverless-cd/srm-aliyun-common';
import _ from 'lodash';
import { getFcZoneId } from './fc';
import { getNasZones, IGetInitNasConfigAsFcOptions, IVpcConfig } from './nas';
import { initVpcConfig, IGetInitVpcConfigAsFcOptions, IGetInitVpcConfigAsFcResponse } from './vpc';

const { ROAClient: ROA } = require('@alicloud/pop-core');

export type Config = IConfig;

export default class PopClient extends Pop {
  private config: Config;

  constructor(config: Config) {
    super(config);
    this.config = config;
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

    return await initVpcConfig(this.config, { ...params, fcZoneIds });
  }

  async getInitNasConfigAsFc(params: IGetInitNasConfigAsFcOptions) {
    const { region, rule, vpcConfig = ({} as unknown as IVpcConfig) } = params || {};
    if (_.isEmpty(rule) || !_.isString(rule)) {
      throw new Error(`Invalid rule: ${rule}`);
    }

    let vpcId = _.get(vpcConfig, 'vpcId', '');
    let vswitchIds = _.get(vpcConfig, 'vswitchIds', []);

    const vpcIsEmpty = _.isEmpty(vpcConfig?.vpcId) && _.isEmpty(vpcConfig?.vswitchIds);
    if (vpcIsEmpty) {
      const nasZoneIds = await getNasZones(region, undefined, this.config);
      const initVpcConfig = await this.getInitVpcConfigAsFc({ region, rule, nasZoneIds });
      _.set(vpcConfig, 'vpcId', initVpcConfig.vpcId);
      _.set(vpcConfig, 'vswitchIds', initVpcConfig.vswitchIds);
      _.set(vpcConfig, 'securityGroupId', initVpcConfig.securityGroupId);
      vpcId = initVpcConfig.vpcId;
      vswitchIds = [initVpcConfig.nasVswitch || ''];
    } else if (_.isEmpty(vpcId) && !_.isEmpty(vswitchIds)) {
      throw new Error(`Invalid vpcConfig: ${JSON.stringify(vpcConfig)}. Please specify vpcId configuration.`);
    } else if (!_.isEmpty(vpcId) && _.isEmpty(vswitchIds)) {
      throw new Error(`Invalid vpcConfig: ${JSON.stringify(vpcConfig)}. Please specify vswitchIds configuration.`);
    }


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
