## packages

- srm-aliyun-fc2

#### post Hook

- tracker

### srm-aliyun-popCore

#### post Hook

- tracker

```
import Pop from '@serverless-cd/srm-aliyun-popCore'
class newPopCore. extends Pop {
  request() {
    super.request();
  }
}
```

### srm-aliyun-nas

- extends srm-aliyun-popCore
- getOrCreate

```
import Pop from '@serverless-cd/srm-aliyun-popCore'
const nasPop = new Pop({
    endpoint,
    apiVersion,
    accessKeyId,
    accessKeySecret,
    securityToken,
    opts,
  });
const originRequest = nasPop.request;
nasPop.request = (name, ...args) => {
  preFunction();
  originRequest(name, ...args);
  postFunction();
}

#### getOrCreate

1. vpc 和 nas 都是 auto

const nasClient = new Client(ak/sk, region)
nasClient.getOrCreate({
  rule: 'cd:auto',
});

2. 指定了 vpcID 创建 nas。 Description 的规则放开给调用者控制。

Description( webide:${vpcId} ) => 查到了就复用。retry => 失败了就重新创建一个新的

const nasClient = new Client(ak/sk, region)
nasClient.getOrCreate({
  rule: 'cd:${vpcId}',
  vpcConfig?: {
    vpcId,
    vswId,
  },
});

```

### srm-aliyun-common

- tracker
