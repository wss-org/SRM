export interface IGetInitVpcConfigAsFcOptions {
  region: string;
  rule: string;
  nasZoneIds?: string[];
}

export interface IGetInitVpcConfigAsFcResponse {
  vpcId: string;
  vswitchIds: string[];
  securityGroupId?: string;
  nasVswitch?: string;
}

export interface IInitVpcConfig extends IGetInitVpcConfigAsFcOptions {
  fcZoneIds: string[];
}

export interface IDescribeVpcs {
  region: string;
  vpcName?: string;
  vpcId?: string;
}

export interface IDescribeVpcsResponse {
  total: Number;
  list: Record<string, any>[];
}

export interface ICreateVpc {
  region: string;
  vpcName: string;
  description?: string;
  enableIpv6?: boolean;
}

export type ICreateVpcResponse = string;


export interface IDescribeVSwitches {
  region: string;
  vpcId: string;
  vswitchName?: string;
  zoneId?: string;
}

export interface IDescribeVSwitchesResponse {
  total: Number;
  list: Record<string, any>[];
}

export interface ICreateVSwitch {
  region: string;
  vpcId: string;
  zoneId: string;
  name: string;
  description?: string;
}

export type ICreateVSwitchResponse = string;


export interface IDescribeVSwitchAttributes {
  region: string;
  vswitchId: string;
}
