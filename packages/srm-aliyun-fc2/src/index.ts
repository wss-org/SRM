const FC = require("@alicloud/fc2");

export interface IConfg {
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

export default class FcClient extends FC {
  constructor(accountid: string, config: IConfg) {
    super(accountid, config);
  }
}
