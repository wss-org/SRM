import Pop, { Config } from "@alicloud/pop-core";
import { tracker } from '@serverless-cd/srm-aliyun-common';
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
} from "./type";

export * from "./type";

export default class Vpc extends Pop {
  private config: Config;
  default_vpc_cidr_block = "10.0.0.0/8";
  default_vsw_cidr_block = "10.20.0.0/16";

  constructor(config: Config) {
    super({
      ...config,
      endpoint: "https://vpc.aliyuncs.com",
      apiVersion: "2016-04-28",
    });
    this.config = config;
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
    do {
      const rs: any = await this.request(
        "DescribeVpcs",
        {
          RegionId: region,
          VpcName: vpcName,
          VpcId: vpcId,
          PageSize: pageSize,
          PageNumber: ++requestPageNumber,
        },
        requestOption
      );

      totalCount = rs.TotalCount;
      pageNumber = rs.PageNumber;
      vpcs = vpcs.concat(rs?.Vpcs?.Vpc);
    } while (totalCount && pageNumber && pageNumber * pageSize < totalCount);

    return { total: totalCount, list: vpcs };
  }

  /**
   * 创建 vpc
   */
  async createVpc(
    params: ICreateVpc,
  ): Promise<ICreateVpcResponse> {
    const {
      region,
      vpcName,
      enableIpv6 = false,
    } = params;
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
   * 获取 vswitch 列表
   */
  async describeVSwitches(
    params: IDescribeVSwitches
  ): Promise<IDescribeVSwitchesResponse> {
    const { region, vpcId, vswitchName, zoneId } = params;

    const pageSize = 50; // max value is 50.
    let requestPageNumber = 0;
    let total = 0;
    let vswitches: any[] = [];
    do {
      const p = {
        RegionId: region,
        VpcId: vpcId,
        VSwitchName: vswitchName,
        ZoneId: zoneId,
        PageSize: pageSize,
      };
      const rs: any = await this.request("DescribeVSwitches", p, requestOption);
      total = rs.TotalCount;
      vswitches = _.concat(vswitches, _.get(rs, "VSwitches.VSwitch", []));
    } while (total && requestPageNumber * pageSize < total);

    return { total, list: vswitches };
  }

  /**
   * 创建 vswitch
   */
  async createVSwitch(
    params: ICreateVSwitch
  ): Promise<ICreateVSwitchResponse> {
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
          _.set(ips, "[1]", (ips[1] as unknown as number) / 1 + 1);
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
  async describeVSwitchAttributes(params: IDescribeVSwitchAttributes): Promise<Record<string, any>> {
    return await this.request('DescribeVSwitchAttributes', {
      RegionId: params.region,
      VSwitchId: params.vswitchId,
    }, requestOption);
  }


  async initVpcConfig(
    params: IInitVpcConfig
  ): Promise<IGetInitVpcConfigAsFcResponse> {

    const vpcId = await this.mackVpc(params);
    const { fcVswitch, nasVswitch } = await this.mackVswitch(vpcId, params);
    console.log(fcVswitch, nasVswitch);

    const securityGroupId = await this.mackSecurityGroup({ vpcId, region: params.region, name: params.rule });

    return { vpcId, securityGroupId, vswitchIds: [fcVswitch], nasVswitch };
  }


  private async mackVpc(
    params: { region: string; rule: string; }
  ) {
    const { region, rule } = params;
    let vpcId = "";
    const { total, list: vpcList } = await this.describeVpcs(params);
    if (total >= 1) {
      vpcId = _.get(vpcList, "[0].VpcId", "");
    } else {
      vpcId = await this.createVpc({ region, vpcName: rule });
    }
    return vpcId;
  }

  private async mackVswitch(
    vpcId: string,
    params: IInitVpcConfig,
  ): Promise<{ fcVswitch: string; nasVswitch: string }> {
    const { region, rule, fcZoneIds, nasZoneIds = [] } = params;
    const createParams: ICreateVSwitch = { region, description: rule, name: rule, vpcId, zoneId: '' };

    const { list: vswitches } = await this.describeVSwitches(
      { region, vpcId },
    );

    const zoneIds = _.intersection(fcZoneIds, nasZoneIds);
    // 如果存在交集，则统一处理
    if (!_.isEmpty(zoneIds)) {
      const findVswitches = _.find(vswitches, (vswitch) =>
        _.includes(zoneIds, vswitch.ZoneId)
      );
      let vswitchId: string;
      if (!_.isEmpty(findVswitches)) {
        vswitchId = findVswitches.VSwitchId;
      } else {
        createParams.zoneId = zoneIds[0];
        vswitchId = await this.createVSwitch(createParams);
      }
      return { fcVswitch: vswitchId, nasVswitch: vswitchId };
    }

    // 如果不存在交集，则各自处理 vsw
    let fcVswitch = "";
    const findFcVswitches = _.find(vswitches, (vswitch) =>
      _.includes(fcZoneIds, vswitch.ZoneId)
    );
    if (!_.isEmpty(findFcVswitches)) {
      fcVswitch = findFcVswitches.VSwitchId;
    } else {
      createParams.zoneId = fcZoneIds[0];
      fcVswitch = await this.createVSwitch(createParams);
    }

    // 如果 nasZoneId 不存在，则不需要处理
    let nasVswitch = "";
    if (!_.isEmpty(nasZoneIds)) {
      const findNasVswitches = _.find(vswitches, (vswitch) =>
        _.includes(nasZoneIds, vswitch.ZoneId)
      );
      if (!_.isEmpty(findNasVswitches)) {
        nasVswitch = findNasVswitches.VSwitchId;
      } else {
        createParams.zoneId = nasZoneIds[0];
        nasVswitch = await this.createVSwitch(createParams);
      }
    }
    return { fcVswitch, nasVswitch };
  }

  private async mackSecurityGroup(params: { vpcId: string; region: string; name: string }) {
    const { vpcId, region, name } = params;

    const client = getPopClient({
      ...this.config,
      endpoint: "https://ecs.aliyuncs.com",
      apiVersion: "2014-05-26",
    });

    const rs: any = await client.request('DescribeSecurityGroups', {
      RegionId: region,
      VpcId: vpcId,
      SecurityGroupName: name,
    }, requestOption);

    const securityGroups = _.get(rs, 'SecurityGroups.SecurityGroup', []);
    if (!_.isEmpty(securityGroups)) {
      return _.get(securityGroups, '[0].SecurityGroupId', '');
    }
    const createRs = await client.request('CreateSecurityGroup', {
      RegionId: region,
      SecurityGroupName: name,
      Description: name,
      VpcId: vpcId,
      SecurityGroupType: 'normal',
    }, requestOption);
    return _.get(createRs, 'SecurityGroupId', '');
  }

  @tracker()
  async request<T>(action: String, params: Object, options?: Object | undefined): Promise<T> {
    return await super.request(action, params, options);
  }
}
