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
