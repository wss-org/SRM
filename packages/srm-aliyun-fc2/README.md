```
class AliyunSrm extends FC {
  client
  constructor(client: any,region: string) {
    
  }
  @update({
    action: () => {}
  }) // 更新规则
  @tag('xx') // 添加标签
  create() {

  }

  @condition({
    tag: xx
  }) // 根据标签删除
  delete() {

  }
}
```

# create decorators
## update
作用于create创建的动作。主要作用为
- 判断是否更新
- 执行更新操作

### 生效
在pre阶段生效

### 使用
```
update({
  condition: () => {}, // 判断是否更新
  action: () => {}, // 执行更新操作
})
```

## tag
给当前的云资源打上TAG标签

### 生效
在post阶段生效

### 使用
```
tag(name: string)
```
创建完成后打标签，后续用于删除操作


# delete decorators
## condition
根据标签进行删除

### 生效
在pre阶段生效

### 使用
```
condition(name: string)
```
用于判断是否可以删除的条件

