import { sleep, update } from "./decorator";
import FC from "@alicloud/fc2";

export class FcClient extends FC {
  accountid;
  config = {};
  constructor(accountid, config) {
    super(accountid, config);
    this.accountid = accountid;
    this.config = config;
  }
  @update({
    // 强制更新
    condition: () => true,
  })
  async createService(serviceName, options = {}) {
    await sleep(100);
    console.log("createService");
  }
}
