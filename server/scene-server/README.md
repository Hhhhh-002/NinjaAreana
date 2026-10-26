# 技能战斗场景服务

本模块复用 BallsGame 的服务入口、目录Actor、消息路由、请求去重、内部长连接和战绩存储。
原球类 SceneActor 已替换为 `actor/BattleActor.java`。开发说明见父工程 `README.md`。

- 主循环：`battle/BattleEngine.java`，八个阶段同tick同步执行。
- 命令：`dispatch/handlers/ShiftHandler`、`JumpHandler`、`BlockHandler`、`CastSkillHandler`，按cmd注册。
- 实体：`battle/state`、`skill`、`status`、`projectile`、`collision`、`passive`。
- 配置：依赖父工程 config 模块，读取三份CSV。
- 同步：`battle/result/CombatResultSink` 构建 BATTLE_SNAPSHOT。
- 持久化：只保存最终比赛和个人战绩，不把战斗实例映射成表。
- 必填规则：`config/nacos-global-battle.yaml`，地图和跳跃已填写首版联调数值，并发布到prod-Ninja命名空间的global-prod.yaml。

命中、伤害、状态和被动立即执行，没有 BattleEventQueue；结果列表只负责通知客户端。
