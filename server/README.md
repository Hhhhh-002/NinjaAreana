# Ninja Arena 服务端

基于 `D:\IdeaProjects\BallsGame` 的 Java 17 服务端实现迁入，新增影斗技能系统。参考项目保持不变。

项目架构图、技能实体关系图、主循环逻辑图及广播机制见 [项目架构与技能系统说明](项目架构与技能系统说明.md)。

本机 `prod-Ninja` 命名空间已发布 `global-prod.yaml`，连接信息、场地及跳跃参数见 [Nacos与场地配置](config/nacos/README.md)。

## 模块

| 模块 | 当前职责 |
|---|---|
| config | 三个 CSV、只读 Definition、配置解析和启动校验 |
| game-common | CMD、注解和 Handler 注册器、错误码、公共工具 |
| game-protocol | 外层信封、服务协议、技能输入/响应/快照、持久化 Protobuf |
| game-core | 原 Akka 接入工具、MessageContext、Netty 内部 WebSocket、PeerRegistry |
| gateway-server | 原网关登录绑定、按 CMD 查 Handler、客户端 WebSocket |
| login-server | 原注册、登录、密码校验、账号 MyBatis-Plus 存取 |
| agentmgr-server | 原登录生命周期仲裁、Agent 实例选择、幂等和断线处理 |
| agent-server | 原 PlayerActor、玩家路由、入场/离场、消息去重和转发 |
| scene-server | BattleActor、技能主循环、命中、伤害、状态、被动、战绩存取 |

没有自建 Actor/Socket/消息队列框架；使用原项目的 Akka Classic、Netty 和内部长连接。

## 消息路径

```text
ClientEnvelope(cmd, requestId, clientSequence, body)
  → GatewayMessageDispatcher → GatewayCommandRegistry → Handler
  → 原长连接 → PlayerActor 邮箱 → AgentGameCommandRegistry → Handler
  → 原长连接 → SceneDirectory 按 sceneId 找 BattleActor
  → BattleActor 邮箱 → 原 MessageContext / SceneRequestStore 去重
  → pendingCommands 暂存输入
  → Tick 第2步按 cmd 查 SceneGameCommandRegistry → Handler
  → 技能/移动领域处理器
  → Tick 第8步构建 BATTLE_SNAPSHOT
  → SceneToAgentEvent → PlayerActor → Gateway → 客户端
```

`cmd` 决定操作类型；`skillId` 选择配置；`requestId` 去重并匹配响应；`castId` 是服务端的一次施法实例标识。
`castId` 在本局唯一，与 `battleId` 共同定位一次施法，不要求全服务器单个 long 唯一。
重复请求返回原 `CastSkillResponse`，不重复扣蓝、启动冷却或创建施法。
已有会话/入场身份校验保留，过期输入不能污染新登录或新战场。

## 客户端输入协议

| cmd | body | 含义 |
|---|---|---|
| START_GAME / 2006 | StartGameRequest(nickname, heroId) | 角色必须是101/102等实际配置，不能省略 |
| SHIFT / 2004 | ShiftRequest(directionX, directionY=0) | 横向输入，方向符号 -1/0/1；clientSequence 非零递增 |
| JUMP / 2010 | JumpRequest | 一次跳跃，requestId 非零 |
| BLOCK / 2011 | BlockRequest(blocking) | 按下/松开格挡，requestId 非零 |
| CAST_SKILL / 2012 | CastSkillRequest(skillId) | 施法，requestId 非零；成功响应含castId、skillId、serverTick |
| BATTLE_SNAPSHOT / 3010 | BattleStateSnapshot | 服务端推送角色、施法、状态、投射物和本tick结果 |

同一连接的 requestId 延续参考项目的递增约定；同一个 requestId 重试必须保持 cmd、body 等完整信封一致。
球类 SPLIT/EJECT 不提供网关游戏入口；旧编号不复用。

## 主循环

入口是 `scene-server/.../actor/BattleActor.java`，固定逻辑步长 30Hz，Akka Timer 唤醒并有界补帧。
不为每局创建线程。每次更新调用 `battle/BattleEngine.java`：

1. 更新已有状态：周期伤害/回血、到期移除，释放结束的施法占用。
2. 消费暂存输入，按 CMD 查 Handler，校验、扣蓝、开始冷却、创建施法。
3. 推进技能阶段、ON_CAST、攻击框，然后移动角色。
4. 更新投射物并记录扫掠轨迹。
5. 检测碰撞，生成 HitIntent 列表，不扣血。
6. 稳定顺序逐条结算：无敌/格挡/伤害/护盾/死亡/被动当场完成。
7. 清理结束施法、攻击框、销毁投射物及移除状态。
8. 发送已经发生的结果和全量战斗快照，然后清空结果列表。

**没有 BattleEventQueue。** pendingCommands 只是输入暂存；combatResults 是已发生结果；被动的 hitTicks 只是滑动窗口时间记录。
同 tick 命中是确定顺序逐次结算，前一击死亡、加盾会影响后一击，不保证互杀。

## 已实现的技能规则

七个主动（含两个普攻）和两个被动、CSV 全部21条效果已接入。持续状态、飞镖独立于施法存活。
逐风读 `trigger_window_ticks`，有效普攻计数、挥空保留、普攻被格挡清零、冷却中不累计。
岩魂护体在实际 HP 从 >=阈值 跨至 <阈值且存活时立即加盾，盾只抵挡后续伤害。
中毒/流血/灼烧/回血刷新后重置周期，允许结束tick最后一跳；普通防御状态在到期tick已失效。
前摇5帧在接受tick到T+4无攻击，T+5进入ACTIVE，同tick可移动和命中。

## 开发启动

1. 在父工程执行 `mvn clean test`，Maven 自动生成 Protobuf。IDE 导入根 `pom.xml`。
2. 先手工建库，再执行 `agent-server/src/main/resources/db/schema.sql`，仅三张表，见下文。
3. Nacos 命名空间使用 `prod-Ninja`（ID `e7aa1b7a-358b-418b-92c4-afcb85fb585e`），环境仍为 `prod`，读取 DEFAULT_GROUP 的 `global-prod.yaml`。已发布本机 MySQL 3307 / Ninja、Redis 6379 的配置。
4. 场地和跳跃参数已配置：宽1440、地面Y=400、跳跃初速度-18、重力1.2、最大下落速度18，30Hz。同步模板为 `scene-server/config/nacos-global-battle.yaml`，缺失必填项仍会明确失败。
5. 启动 Login、AgentMgr、Agent、Scene、Gateway；每实例填写独立实例ID，HTTP/内部WS端口沿用参考模块。
6. 客户端位于 `D:\vscodproject\NinjaArenaClient`，运行该目录的 `start-client.ps1`，访问 `http://127.0.0.1:5173/`。启动前自动同步本工程协议和CSV；START_GAME 带 heroId，技能发 CAST_SKILL，不直接发伤害或位置。

浏览器客户端每15秒发送应用层 HEARTBEAT（CMD=1004），网关本地响应，不进入PlayerActor/BattleActor。浏览器无法主动发送WebSocket控制帧Ping，因此使用此心跳维持空闲连接并测量RTT。

CSV 在启动时读一次，每局持有只读快照。修改 CSV 后重新加载服务；本次没有新增配置热加载管理器。
Nacos 的通用 BattleRules 在新建战场时取快照，不中途改变一局规则。
Redis Key 使用 `ninja:` 前缀；若 Nacos 覆盖了前缀，也要改为本项目独立值。

## 数据库需要什么表

| 表 | Java实体 | data内容 |
|---|---|---|
| game_account | 原Login账号实体 | UserProto：账号、密码哈希、禁用、时间 |
| game_match | MatchEntity | MatchProto：一局时间、结束原因、最终排名及角色HP |
| game_match_result | MatchResultEntity | MatchResultProto：某玩家某局的heroId、最终HP和名次 |

都是参考项目已有“主键 + Protobuf data”存储。比赛和个人战绩同事务提交，重复保存核对原结果。
旧球类 `area` 字段保留协议编号兼容，本项目不再写球面积；结果新增 hp、heroId。
当前结算沿用参考项目时限，死亡结束并按最终HP排序；提前离场保留原项目“不写该玩家个人最终战绩”的口径。
不为技能、英雄基础配置或任何战斗运行时实例建表。Agent/AgentMgr 也不需要新增 MySQL 表。
本次未增加成长、装备、角色解锁、匹配服务、回放录制/查询功能或相关表。

## 当前配置缺项

- CSV 已包含两位角色的 J 普攻，`battle.basic-attack-skill-ids` 设置为 `1101,2101`；风隐普攻命中已接入逐风计数。
- 跳跃、场地已提供首版联调数值；两张背景共用1440×480逻辑画布，当前运动只支持平地和左右边界，没有新增复杂地图系统。
- 当前没有受击硬直/控制、格挡恢复和破防硬直配置，因此普通攻击不会自动附加这些效果。
- 飞镖仅 TRAINING，使用显式skillId入口，不抢占普攻J；没有增加穿透、多段、连招系统。
- 原AgentMgr按单实例仲裁部署，在线集合在内存；本次没有实现多管理器共享状态或进程崩溃战斗恢复。

测试验证为离线领域测试、真实Akka邮箱/模拟Redis传输和H2事务测试；不代表已启动真实Nacos/MySQL/Redis全链路联调。

## 普攻、自然回蓝与匹配

J 普攻：风隐1101（65基础伤害，3/3/9帧，15帧冷却）；岩牙2101（80基础伤害，4/3/8帧，18帧冷却）。均为地面攻击、不耗蓝；沿用现有普攻5%概率、1.5倍暴击。普攻经过同一个 CAST_SKILL Handler、去重、阶段/命中流程，风隐有效命中计入逐风。训练飞镖1003改为L。

Nacos `battle.basic-attack-skill-ids: "1101,2101"`；`battle.mana-regen-amount: 5`、`battle.mana-regen-interval-ticks: 30`。30Hz下每秒恢复5蓝，间隔1可每帧恢复；数量0关闭。自然回蓝在战斗Tick第1阶段执行，死亡不恢复、不超过上限；新建对局读取参数，旧局保持创建时规则。无需新数据库表。

当前匹配先按Nacos实例权重随机选Scene服务，同宿主机可加权；在选中的实例里优先加入sceneId最小且可加入的房间，无房间则创建，两人到齐开战。没有段位/Elo匹配，也没有跨Scene实例的统一匹配池。

客户端仓库：[NinjaArenaClient](https://github.com/Hhhhh-002/NinjaArenaClient)。
