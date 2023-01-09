export interface IGetInitNasConfigAsFcOptions {
  region: string;
  rule: string;
  vpcConfig?: {
    vpcId: string;
    vswitchIds: string[];
  };
}

export interface IVpcConfig {
  vpcId: string;
  vswitchIds: string[];
  securityGroupId?: string;
}

export interface IGetInitNasConfigAsFcResponse {
  vpcConfig: IVpcConfig;
  fileSystemId: string;
  mountPoint: string;
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

