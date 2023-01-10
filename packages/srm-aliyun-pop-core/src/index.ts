import Pop, { Config as IConfig } from "@alicloud/pop-core";
import { tracker } from "@serverless-cd/srm-aliyun-common";
import _ from "lodash";
import { getFcZoneId } from "./fc";
import Nas20170626, {
  IFindNasResponse,
  IGetInitNasConfigAsFcOptions,
  IGetInitNasConfigAsFcResponse,
  IVpcConfig,
} from "./nas-2017-06-26";
import Vpc20160428, {
  IGetInitVpcConfigAsFcOptions,
  IGetInitVpcConfigAsFcResponse,
} from "./vpc-2016-04-28";

const { ROAClient: ROA } = require("@alicloud/pop-core");

export type Config = IConfig;

export default class PopClient extends Pop {
  private config: Config;
  logger: any;

  constructor(config: Config, logger: any = console) {
    super(config);
    this.config = config;
    this.logger = logger;
  }

  @tracker()
  async request<T>(
    action: String,
    params: Object,
    options?: Object | undefined
  ): Promise<T> {
    return await super.request(action, params, options);
  }

  async getInitVpcConfigAsFc(
    params: IGetInitVpcConfigAsFcOptions
  ): Promise<IGetInitVpcConfigAsFcResponse> {
    const { rule, region } = params || {};
    if (_.isEmpty(rule) || !_.isString(rule)) {
      throw new Error(`Invalid rule: ${rule}`);
    }
    const fcZoneIds = await getFcZoneId(this.config, region);

    const vpcClient = new Vpc20160428(this.config, this.logger);
    return await vpcClient.initVpcConfig({ ...params, fcZoneIds });
  }

  async getInitNasConfigAsFc(
    params: IGetInitNasConfigAsFcOptions
  ): Promise<IGetInitNasConfigAsFcResponse> {
    const {
      region,
      rule,
      vpcConfig = {} as unknown as IVpcConfig,
    } = params || {};
    if (_.isEmpty(rule) || !_.isString(rule)) {
      throw new Error(`Invalid rule: ${rule}`);
    }

    const nasClient = new Nas20170626(region, this.config, this.logger);

    let storageType = "";
    let nasVswitch = "";
    let nasZone = "";
    let vpcId = _.get(vpcConfig, "vpcId", "");
    const vSwitchIds = _.get(vpcConfig, "vSwitchIds", []);
    const vpcIsEmpty = _.isEmpty(vpcId);
    if (!vpcIsEmpty && _.isEmpty(vSwitchIds)) {
      throw new Error(
        `Invalid vpcConfig: ${JSON.stringify(
          vpcConfig
        )}. Please specify vSwitchIds configuration.`
      );
    }
    // 如果 vpc 为空，则初始化 vpc 配置
    if (vpcIsEmpty) {
      const { zoneIds, type } = await nasClient.getNasZones();
      const initVpcConfig = await this.getInitVpcConfigAsFc({
        region,
        rule,
        nasZoneIds: zoneIds,
      });
      nasVswitch = initVpcConfig.nasVswitch as string;
      nasZone = initVpcConfig.nasZone as string;
      storageType = type;
      vpcId = initVpcConfig.vpcId;
      _.unset(initVpcConfig, "nasVswitch");
      _.unset(initVpcConfig, "nasZone");
      _.merge(vpcConfig, initVpcConfig);
    }

    // 如果存在复用则直接返回
    const nasFindConfig = await nasClient.findNas(vpcId, rule);
    if (_.isPlainObject(nasFindConfig)) {
      return {
        vpcConfig,
        ...(nasFindConfig as IFindNasResponse),
      };
    }

    // 如果传入了vpc配置
    if (!vpcIsEmpty) {
      let needCreateNasVSwitch = false; // 是否需要创建 nas 交换机
      const vpcClient = new Vpc20160428(this.config, this.logger);
      const { list: vswDescribes } = await vpcClient.describeVSwitches({
        region,
        vpcId,
      });
      // 如果传入了交换机，需要验证交换机的地区
      if (!_.isEmpty(vSwitchIds)) {
        this.logger.debug(`vswDescribes for ${JSON.stringify(vswDescribes)}`);
        const vSwitches = _.filter(vswDescribes, ({ VSwitchId }: any) =>
          _.includes(vSwitchIds, VSwitchId)
        ).map((item) => ({ vswitchId: item.VSwitchId, zoneId: item.ZoneId }));
        this.logger.debug(`vSwitches for ${JSON.stringify(vSwitches)}`);
        if (_.isEmpty(vSwitches)) {
          this.logger.debug(
            `VswitchIds(${JSON.stringify(
              vSwitchIds
            )}) cannot be queried in the vpcId(${vpcId}).`
          );
          needCreateNasVSwitch = true; // 如果没有查询到交换机，则需要创建
        } else {
          const zoneConfig = await nasClient.getNasZonesAsVSwitches(vSwitches);
          if (zoneConfig) {
            nasVswitch = zoneConfig.vswitchId;
            storageType = zoneConfig.type;
            nasZone = zoneConfig.zoneId;
          } else {
            needCreateNasVSwitch = true; // 如果没有查询到可用可用区的交换机，则需要重新创建
          }
        }
      }

      if (needCreateNasVSwitch) {
        const { zoneIds, type } = await nasClient.getNasZones();
        const createParams = {
          region,
          description: rule,
          name: rule,
          vpcId,
          zoneId: "",
        };
        // 防止没有复用的交换机，提前将 ip 地址处理好
        await vpcClient.setDefaultCiDrBlock({ vpcId, region });
        const { vswitchId, zoneId } = await vpcClient.mackZoneIdsVswitch(zoneIds, vswDescribes, createParams);

        storageType = type;
        nasVswitch = vswitchId;
        nasZone = zoneId;
      }
    }

    const nasConfig = await nasClient.makeNas({
      vpcId,
      storageType,
      nasConfig: nasFindConfig as any[],
      zoneId: nasZone,
      vswitchId: nasVswitch,
      description: rule,
    });
    return {
      ...(nasConfig as IFindNasResponse),
      vpcConfig,
    };
  }
}

export const RPCClient = PopClient;

export class ROAClient extends ROA {
  constructor(config: Config) {
    super(config);
  }

  @tracker()
  async request(
    method: string,
    uriPattern: string,
    query = {},
    body = "",
    headers = {},
    opts = {}
  ): Promise<any> {
    return await super.request(method, uriPattern, query, body, headers, opts);
  }

  @tracker()
  async put<T>(
    path: string,
    query?: Record<string, any>,
    body?: Record<string, any>,
    headers?: Record<string, string>,
    options?: Record<string, any>
  ): Promise<T> {
    return await super.put(path, query, body, headers, options);
  }
}
