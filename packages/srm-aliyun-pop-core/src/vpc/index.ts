import Pop, { Config } from "@alicloud/pop-core";
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
} from "./type";

export * from "./type";

const getVpcClient = (config: Config) =>
  getPopClient({
    ...config,
    endpoint: "https://vpc.aliyuncs.com",
    apiVersion: "2016-04-28",
  });
const default_vpc_cidr_block = "10.0.0.0/8";
const default_vsw_cidr_block = "10.20.0.0/16";

/**
 * 获取 vpc 列表
 */
export async function describeVpcs(
  params: IDescribeVpcs,
  client?: Pop,
  config?: Config
): Promise<IDescribeVpcsResponse> {
  if (!client) {
    client = getVpcClient(config as any);
  }
  const { region, vpcName, vpcId } = params;
  const pageSize = 50; // max value is 50.
  let requestPageNumber = 0;
  let totalCount: number;
  let pageNumber: number;

  let vpcs: any[] = [];
  do {
    const rs: any = await client.request(
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
export async function createVpc(
  params: ICreateVpc,
  client?: Pop,
  config?: Config
): Promise<ICreateVpcResponse> {
  if (!client) {
    client = getVpcClient(config as any);
  }
  const {
    region,
    vpcName,
    enableIpv6 = false,
  } = params;
  const createParams = {
    RegionId: region,
    CidrBlock: default_vpc_cidr_block,
    EnableIpv6: enableIpv6,
    VpcName: vpcName,
    Description: params.description || vpcName,
  };
  const createRs: any = await client.request(
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
    const { total, list: vpcs } = await describeVpcs({ region, vpcId }, client);
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
export async function describeVSwitches(
  params: IDescribeVSwitches,
  client?: Pop,
  config?: Config
): Promise<IDescribeVSwitchesResponse> {
  if (!client) {
    client = getVpcClient(config as any);
  }
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
    const rs: any = await client.request("DescribeVSwitches", p, requestOption);
    total = rs.TotalCount;
    vswitches = _.concat(vswitches, _.get(rs, "VSwitches.VSwitch", []));
  } while (total && requestPageNumber * pageSize < total);

  return { total, list: vswitches };
}

/**
 * 创建 vswitch
 */
export async function createVSwitch(
  params: ICreateVSwitch,
  client?: Pop,
  config?: Config
): Promise<ICreateVSwitchResponse> {
  if (!client) {
    client = getVpcClient(config as any);
  }
  const { region, description, name, vpcId, zoneId } = params;
  let cidrBlock = default_vsw_cidr_block;

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
      const createRs = await client.request(
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

async function mackVpc(
  params: { region: string; rule: string; },
  client: Pop
) {
  const { region, rule } = params;
  let vpcId = "";
  const { total, list: vpcList } = await describeVpcs(params, client);
  if (total >= 1) {
    vpcId = _.get(vpcList, "[0].VpcId", "");
  } else {
    vpcId = await createVpc({ region, vpcName: rule }, client);
  }
  return vpcId;
}

async function mackVswitch(
  vpcId: string,
  params: IInitVpcConfig,
  client: Pop
): Promise<{ fcVswitch: string; nasVswitch: string }> {
  const { region, rule, fcZoneIds, nasZoneIds = [] } = params;
  const createParams: ICreateVSwitch = { region, description: rule, name: rule, vpcId, zoneId: '' };

  const { list: vswitches } = await describeVSwitches(
    { region, vpcId },
    client
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
      vswitchId = await createVSwitch(createParams, client);
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
    fcVswitch = await createVSwitch(createParams, client);
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
      nasVswitch = await createVSwitch(createParams, client);
    }
  }
  return { fcVswitch, nasVswitch };
}

async function mackSecurityGroup(params: { vpcId: string; region: string; name: string }, client: Pop) {
  const { vpcId, region, name } = params;

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

export async function initVpcConfig(
  config: Config,
  params: IInitVpcConfig
): Promise<IGetInitVpcConfigAsFcResponse> {
  const vpcClient = getPopClient({
    ...config,
    endpoint: "https://vpc.aliyuncs.com",
    apiVersion: "2016-04-28",
  });

  const vpcId = await mackVpc(params, vpcClient);
  const { fcVswitch, nasVswitch } = await mackVswitch(vpcId, params, vpcClient);
  console.log(fcVswitch, nasVswitch);


  const ecsClient = getPopClient({
    ...config,
    endpoint: "https://ecs.aliyuncs.com",
    apiVersion: "2014-05-26",
  });
  const securityGroupId = await mackSecurityGroup({ vpcId, region: params.region, name: params.rule }, ecsClient);

  return { vpcId, securityGroupId, vswitchIds: [fcVswitch], nasVswitch };
}
