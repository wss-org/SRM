import { Config as CoreConfig } from "@alicloud/pop-core";

export type Config = Omit<CoreConfig, 'endpoint' | 'apiVersion'>;

export interface IGetInitNasConfigAsFcOptions {
  region: string;
  rule: string;
  vpcConfig?: {
    vpcId: string;
    vSwitchIds: string[];
  };
}

export interface IVpcConfig {
  vpcId: string;
  vSwitchIds: string[];
  securityGroupId?: string;
}

export interface IGetInitNasConfigAsFcResponse {
  vpcConfig: IVpcConfig;
  fileSystemId: string;
  mountTargetDomain: string;
}

export interface IGetNasZonesAsVSwitchesResponse {
  type: 'Performance' | 'Capacity';
  vswitchId: string;
  zoneId: string;
}

export interface IMakeNas {
  nasConfig?: any[];
  storageType: string;
  zoneId: string;
  vswitchId: string;
  description: string;
  vpcId: string;
}

export interface IFindNasResponse { fileSystemId: string, mountTargetDomain: string }

