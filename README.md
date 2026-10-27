# NinjaAreana

影斗游戏项目，客户端与服务端统一管理。

- [client](client/README.md)：TypeScript、PixiJS、Spine 客户端。
- [server](server/README.md)：Java 17、Spring Boot、Akka、Netty、Protobuf 服务端。

## 目录

```text
NinjaAreana/
├── client/    客户端源码、静态素材、测试和构建脚本
└── server/    服务端父工程、各服务模块、技能配置和数据库建表脚本
```

客户端在 client 目录执行 npm ci、npm run dev，或使用 start-client.ps1。服务端启动步骤见 server/README.md；Nacos 配置示例为 server/config/nacos/global-prod.example.yaml。数据库密码等本机配置不纳入版本控制。

角色动作和技能表现已接入统一素材包的 Spine 组合工程及16段独立原生特效；施法、状态、投射物和结算结果由服务端数据驱动。详见 client/README.md。

原客户端与服务端的提交历史保留在本仓库中。
