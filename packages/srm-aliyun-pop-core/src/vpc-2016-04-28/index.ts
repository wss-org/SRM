import Pop, { Config } from "@alicloud/pop-core";
import { tracker } from "@serverless-cd/srm-aliyun-common";
import _ from "lodash";
import { getPopClient, requestOption, sleep } from "../utils";
import {
  IInitVpcConfig,
  IDescribeVpcs,
  IDescribeVpcsResponse,
  ICreateVpcResponse,
  ICreateVpc,
  IDescribeVSwitches,
  IDescribeVSwitchesResponse,
  ICreateVSwitch,
  ICreateVSwitchResponse,
  IGetInitVpcConfigAsFcResponse,
  IDescribeVSwitchAttributes,
  IDescribeVpcAttribute,
} from "./type";

export * from "./type";

export default class Vpc extends Pop {
  private config: Config;
  logger: any;
  default_vpc_cidr_block = "10.0.0.0/8";
  default_vsw_cidr_block = "10.20.0.0/24";
  vsw_cidr_block_index = 3;

  constructor(config: Config, logger: any = config) {
    super({
      ...config,
      endpoint: "https://vpc.aliyuncs.com",
      apiVersion: "2016-04-28",
    });
    this.config = config;
    this.logger = logger;
  }

  async setDefaultCiDrBlock(params: IDescribeVpcAttribute) {
    const { CidrBlock: cidrBlock } = await this.describeVpcAttribute(params);
    this.logger.debug(`get default CIDR block: ${cidrBlock}`);
    this.default_vpc_cidr_block = cidrBlock;
    const [ip, network] = _.split(cidrBlock, '/');
    let vswNetwork = Number(network);
    if (vswNetwork < 24) {
      vswNetwork = 24;
    } else {
      vswNetwork += 1;
      if (vswNetwork >= 29) {
        vswNetwork = 29;
      }
    }
    this.default_vsw_cidr_block = `${ip}/${vswNetwork}`;
  }

  /**
   * 获取 vpc 列表
   */
  async describeVpcs(params: IDescribeVpcs): Promise<IDescribeVpcsResponse> {
    const { region, vpcName, vpcId } = params;
    const pageSize = 50; // max value is 50.
    let requestPageNumber = 0;
    let totalCount: number;
    let pageNumber: number;

    let vpcs: any[] = [];
    const p = {
      RegionId: region,
      PageSize: pageSize,
    };
    if (vpcName) {
      _.set(p, "VpcName", vpcName);
    }
    if (vpcId) {
      _.set(p, "VpcId", vpcId);
    }
    do {
      _.set(p, "PageNumber", ++requestPageNumber);
      this.logger.debug(`DescribeVpcs params: ${JSON.stringify(p)}`);
      const rs: any = await this.request("DescribeVpcs", p, requestOption);

      totalCount = rs.TotalCount;
      if (totalCount === 0) {
        return { total: 0, list: [] };
      }
      pageNumber = rs.PageNumber;
      vpcs = vpcs.concat(rs?.Vpcs?.Vpc);
    } while (totalCount && pageNumber && pageNumber * pageSize < totalCount);

    return { total: totalCount, list: vpcs };
  }

  /**
   * 创建 vpc
   */
  async createVpc(params: ICreateVpc): Promise<ICreateVpcResponse> {
    const { region, vpcName, enableIpv6 = false } = params;
    const createParams = {
      RegionId: region,
      CidrBlock: this.default_vpc_cidr_block,
      EnableIpv6: enableIpv6,
      VpcName: vpcName,
      Description: params.description || vpcName,
    };
    const createRs: any = await this.request(
      "CreateVpc",
      createParams,
      requestOption
    );
    const vpcId = createRs.VpcId;

    // 验证 vpc 的状态
    let count = 0;
    let status: string = "";
    do {
      count++;
      await sleep(800);
      const { total, list: vpcs } = await this.describeVpcs({ region, vpcId });
      if (total) {
        status = _.get(vpcs, "[0].Status", "");
      }
    } while (count < 15 && status !== "Available");
    if (status !== "Available") {
      throw new Error(
        `Timeout while waiting for vpc ${vpcId} status to be 'Available'`
      );
    }

    return vpcId;
  }

  /**
   * 获取 Vpc 信息
   */
  async describeVpcAttribute(params: IDescribeVpcAttribute): Promise<Record<string, any>> {
    const { region, vpcId } = params;
    return await this.request(
      "DescribeVpcAttribute",
      { VpcId: vpcId, RegionId: region },
      requestOption,
    );
  }

  /**
   * 获取 vswitch 列表
   */
  async describeVSwitches(
    params: IDescribeVSwitches
  ): Promise<IDescribeVSwitchesResponse> {
    const { region, vpcId, vswitchName, zoneId } = params;

    const pageSize = 50; // max value is 50.
    let requestPageNumber = 0;
    let total = 0;
    let vSwitches: any[] = [];
    const p = {
      RegionId: region,
      VpcId: vpcId,
      PageSize: pageSize,
    };
    if (vswitchName) {
      _.set(p, "VSwitchName", vswitchName);
    }
    if (zoneId) {
      _.set(p, "ZoneId", zoneId);
    }
    do {
      _.set(p, "PageNumber", ++requestPageNumber);
      this.logger.debug(`DescribeVSwitches params: ${JSON.stringify(p)}`);
      const rs: any = await this.request("DescribeVSwitches", p, requestOption);
      total = rs.TotalCount;
      if (total === 0) {
        return { total, list: vSwitches };
      }
      vSwitches = _.concat(vSwitches, _.get(rs, "VSwitches.VSwitch", []));
    } while (total && requestPageNumber * pageSize < total);

    return { total, list: vSwitches };
  }

  /**
   * 创建 vswitch
   */
  async createVSwitch(params: ICreateVSwitch): Promise<ICreateVSwitchResponse> {
    const { region, description, name, vpcId, zoneId } = params;
    let cidrBlock = this.default_vsw_cidr_block;

    let retryTimer = 0;

    do {
      const createParams = {
        RegionId: region,
        VpcId: vpcId,
        ZoneId: zoneId,
        VSwitchName: name,
        Description: description,
        CidrBlock: cidrBlock,
      };
      try {
        const createRs = await this.request(
          "CreateVSwitch",
          createParams,
          requestOption
        );
        return _.get(createRs, "VSwitchId", "");
      } catch (ex: any) {
        // 如果错误是 ip 冲突，则重拾
        if (ex.code === "InvalidCidrBlock.Overlapped") {
          const ips = cidrBlock.split(".");
          const i = Number(ips[this.vsw_cidr_block_index]) + (30 + retryTimer);
          if (i > 254) {
            throw ex;
          }
          _.set(ips, `[${this.vsw_cidr_block_index}]`, i);
          cidrBlock = ips.join(".");
        }

        if (retryTimer < 15) {
          retryTimer += 1;
        } else {
          throw ex;
        }
      }
    } while (true);
  }

  /**
   * 获取 vswitch 信息
   */
  async describeVSwitchAttributes(
    params: IDescribeVSwitchAttributes
  ): Promise<Record<string, any>> {
    return await this.request(
      "DescribeVSwitchAttributes",
      {
        RegionId: params.region,
        VSwitchId: params.vswitchId,
      },
      requestOption
    );
  }

  async initVpcConfig(
    params: IInitVpcConfig
  ): Promise<IGetInitVpcConfigAsFcResponse> {
    const vpcId = await this.mackVpc(params);
    this.logger.debug(`mack vpc id: ${vpcId}`);
    const { fcVswitch, nasVswitch, nasZone } = await this.mackVswitch(
      vpcId,
      params
    );
    this.logger.debug(
      `mack vswitch res:\n fcVswitch: ${fcVswitch}, nasVswitch: ${nasVswitch}, nasZone: ${nasZone}`
    );

    const securityGroupId = await this.mackSecurityGroup({
      vpcId,
      region: params.region,
      name: params.rule,
    });
    this.logger.debug(`mack securityGroup id: ${securityGroupId}`);

    return {
      vpcId,
      securityGroupId,
      vSwitchIds: [fcVswitch],
      nasVswitch,
      nasZone,
    };
  }

  /**
   * 根据可用区列表获取可用的交换机ID和交换机可用区
   * @param zoneIds 可用区列表
   * @param vSwitches 已存在的交换机列表
   * @param createParams 创建交换机的参数
   * @returns
   */
  async mackZoneIdsVswitch(
    zoneIds: string[],
    vSwitches: any[],
    createParams: ICreateVSwitch
  ): Promise<{ vswitchId: string; zoneId: string }> {
    const findVSwitches = _.find(vSwitches, (vswitch) =>
      _.includes(zoneIds, vswitch.ZoneId)
    );
    let vswitchId: string;
    let zoneId: string;
    if (!_.isEmpty(findVSwitches)) {
      vswitchId = findVSwitches.VSwitchId;
      zoneId = findVSwitches.ZoneId;
    } else {
      createParams.zoneId = zoneIds[0];
      zoneId = zoneIds[0];
      vswitchId = await this.createVSwitch(createParams);
    }
    return { vswitchId, zoneId };
  }


  private async mackVpc(params: { region: string; rule: string }) {
    const { region, rule } = params;
    let vpcId = "";
    const { total, list: vpcList } = await this.describeVpcs({
      region,
      vpcName: rule,
    });
    this.logger.debug(`describe vpcs total: ${total}`);
    if (total >= 1) {
      vpcId = _.get(vpcList, "[0].VpcId", "");
    } else {
      this.logger.debug("Need create vpc");
      vpcId = await this.createVpc({ region, vpcName: rule });
    }
    return vpcId;
  }

  private async mackVswitch(
    vpcId: string,
    params: IInitVpcConfig
  ): Promise<{ fcVswitch: string; nasVswitch: string; nasZone: string }> {
    const { region, rule, fcZoneIds, nasZoneIds = [] } = params;
    const createParams: ICreateVSwitch = {
      region,
      description: rule,
      name: rule,
      vpcId,
      zoneId: "",
    };

    const { list: vSwitches } = await this.describeVSwitches({ region, vpcId });

    const zoneIds = _.intersection(fcZoneIds, nasZoneIds);
    // 如果存在交集，则统一处理
    if (!_.isEmpty(zoneIds)) {
      const { vswitchId, zoneId } = await this.mackZoneIdsVswitch(
        zoneIds,
        vSwitches,
        createParams
      );
      return { fcVswitch: vswitchId, nasVswitch: vswitchId, nasZone: zoneId };
    }

    // 如果不存在交集，则各自处理 vsw
    // 处理Fc的交换机
    const { vswitchId: fcVswitch } = await this.mackZoneIdsVswitch(
      fcZoneIds,
      vSwitches,
      createParams
    );
    // 如果 nasZoneId 不存在，则不需要处理
    const { vswitchId: nasVswitch, zoneId: nasZone } =
      await this.mackZoneIdsVswitch(nasZoneIds, vSwitches, createParams);

    return { fcVswitch, nasVswitch, nasZone };
  }

  private async mackSecurityGroup(params: {
    vpcId: string;
    region: string;
    name: string;
  }) {
    const { vpcId, region, name } = params;

    const client = getPopClient({
      ...this.config,
      endpoint: "https://ecs.aliyuncs.com",
      apiVersion: "2014-05-26",
    });

    const rs: any = await client.request(
      "DescribeSecurityGroups",
      {
        RegionId: region,
        VpcId: vpcId,
        SecurityGroupName: name,
      },
      requestOption
    );

    const securityGroups = _.get(rs, "SecurityGroups.SecurityGroup", []);
    if (!_.isEmpty(securityGroups)) {
      return _.get(securityGroups, "[0].SecurityGroupId", "");
    }
    const createRs = await client.request(
      "CreateSecurityGroup",
      {
        RegionId: region,
        SecurityGroupName: name,
        Description: name,
        VpcId: vpcId,
        SecurityGroupType: "normal",
      },
      requestOption
    );
    return _.get(createRs, "SecurityGroupId", "");
  }

  @tracker()
  async request<T>(
    action: String,
    params: Object,
    options?: Object | undefined
  ): Promise<T> {
    return await super.request(action, params, options);
  }
}
