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
- CreateOrUpdate
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
nasPop.createOrUpdate = () => {
  xxx
```

### srm-aliyun-common
- tracker
