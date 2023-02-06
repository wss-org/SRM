const FC = require("@alicloud/fc2");

interface IConfig {
  accessKeyID: string;
  accessKeySecret: string;
  securityToken?: string;
  region: string;
  secure?: boolean;
  internal?: boolean;
  endpoint?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export = class FcClient extends FC {
  constructor(accountId: string, config: IConfig) {
    super(accountId, config);
  }
}
