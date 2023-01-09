### getInitVpcConfigAsFc

#### 接收参数

```
interface IInitVpcConfig {
  region: string;
  rule: string;
  nasZoneIds?: string[];
}
```

#### 处理逻辑

1. 首先是获取到指定地区 FC 的可用区
2. 获取 vpcId：根据`rule`获取看是否已经存在存量的 VPC

   I. 如果已经存在则复用之前的 VPC  
   II. 如果不存在则创建 VPC

3. 获取 vswitch（包括 fc 交换机，如果传入了 nas 还有 nas 的交换机）  
   I. 根据 `vpcId` 和 `rule` 获取交换机的列表  
   II. 取传入的 FC 可用区和 NAS 的可用区的交集  
    a. 如果存在交集，则统一处理：查看交换机列表中是否存在，存在则复用；不存在则创建一个交换机【可用区取交集的第一个元素】  
    b. 如果不存在交集，则分开处理。
   1. 先查看 FC 可用区交换机列表中是否存在，存在则服用，不存在则创建一个交换机
   2. 如果传入了 NAS 可用区，则也需要查看可用区交换机列表中是否存在，存在则服用，不存在则创建一个交换机
   3. 如果没有传入 NAS 可用区，则跳过处理 NAS 可用区的逻辑
4. 获取 securityGroupId，根据 `vpcId` 和`rule` 查询安全组列表，存在则复用；不存在则创建
5. 返回字段

```
interface IGetInitVpcConfigAsFcResponse {
  vpcId: string;
  vswitchIds: string[];
  securityGroupId?: string;
  nasVswitch?: string;
}
```

### getInitNasConfigAsFc

#### 接收参数

```
interface IInitVpcConfig {
  region: string;
  rule: string;
  vpcConfig?: {
    vpcId: string;
    vswitchIds: string[];
  }
}
```

#### 处理逻辑

- 如果没有传入`vpcConfig`

1. 获取 NAS 的可用区，优先获取 Performance（性能型）可用区，其次是 Capacity（容量型）可用区
2. 调用 [getInitVpcConfigAsFc](#getInitVpcConfigAsFc)
3. 通过 `rule`、`vpcId` 查询是否已经存在挂载点  
   I. 如果存在则直接复用，返回  
   II. 如果不存在，则根据 `rule`、`vpcId`、`nasVswitch`和可用区的类型[创建挂载点](#创建挂载点)
4. 返回数据

- 如果传入了 `vpcConfig`

1. 通过 `rule`、`vpcId` 查询是否已经存在挂载点  
   I. 如果存在则直接复用，返回  
   II. 如果不存在  
    a. 则获取传入的 vswitchIds 的可用区  
    b. 对比 NAS 可用区，优先取可创建 Performance（性能型）的交换机，如果不存在可用的可用区，则抛出异常。 根据 `rule`、`vpcId`、`nasVswitch`和可用区的类型[创建挂载点](#创建挂载点)

##### 创建挂载点

由于我们仅处理通用型 NAS，所以我们先去判断获取的文件系统下面存在几个挂载点，如果是一个或者零个，则创建挂载点。如果是存在两个，那么我们就需要重新再创建新的文件系统，然后创建挂载点
