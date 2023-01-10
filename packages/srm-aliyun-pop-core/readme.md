### getInitVpcConfigAsFc

#### 接收参数

```TypeScript
interface IInitVpcConfig {
  region: string;
  rule: string;
  nasZoneIds?: string[]; // 如果传入了 nas 的可用区，则需要创建和返回 nasSwitchId
}
```

#### 处理逻辑

![](https://img.alicdn.com/imgextra/i2/O1CN01neTBfw1XXorfV8mMN_!!6000000002934-2-tps-1956-1460.png)

#### 返回参数

```TypeScript
interface IResponse {
  vpcId: string;
  vSwitchIds: string[];
  securityGroupId: string;
  nasVswitch?: string; // 如果传入 nasZoneId，则需要返回
  nasZone?: string; // 如果传入 nasZoneId，则需要返回
}
```

### getInitNasConfigAsFc

#### 接收参数

```TypeScript
interface IConfig {
  region: string;
  rule: string;
  vpcConfig?: {
    vpcId: string; // 如果传入了 vpcId，则不再处理 fc 的交换机和安全组
    vSwitchIds?: string[];
  }
}
```

#### 处理逻辑

![](https://img.alicdn.com/imgextra/i3/O1CN019lsyod1r4JfK1b3K8_!!6000000005577-2-tps-2014-1450.png)

#### 返回结果

```TypeScript
interface IResponse {
  vpcConfig: {
    vpcId: string;
    vSwitchIds?: string[]; // 如果传入了 vpcId，但是没有传入 vSwitchIds 则不会返回 vSwitchIds
    securityGroupId?: string; // 如果传入了 vpcId，则不返回 securityGroupId
  };
  fileSystemId: string;
  mountTargetDomain: string;
}
```
