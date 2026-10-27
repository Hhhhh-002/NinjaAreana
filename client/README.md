# 影斗客户端

仓库目录：`client/`（本机 `D:\IdeaProjects\NinjaAreana\client`）。兼容副本同步在 `D:\VSCodeProjects\NinjaArenaClient`。TypeScript + PixiJS v8 + Vite + Protobuf，连接现有 Java 网关。整个客户端目录可以放到另一台电脑或任意位置，不依赖服务端源码和原始动画工程。

## 启动

在本目录的 PowerShell 执行：

```powershell
.\start-client.ps1
```

打开 http://127.0.0.1:5173/ 。首次运行会执行 `npm ci`。需要 Node.js 22.12+，推荐24 LTS；脚本优先检查 PATH，也支持当前机器 Codex 自带的 Node24，仅修改当前进程 PATH。若系统禁止运行脚本，可对本次进程使用：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-client.ps1
```

已有符合要求的 Node 时也可使用 `npm ci`、`npm run dev`。构建、验证分别使用 `start-client.ps1 build`、`start-client.ps1 test`；构建产物在 `dist`，本地预览用 `start-client.ps1 preview`。

默认网关 `ws://127.0.0.1:9001/ws`，可在界面“设置”修改，或复制 `.env.example` 为 `.env.local` 设置 `VITE_GATEWAY_URL`。设置只保存网关地址，不保存密码。HTTPS 页面应连接 WSS 网关。

另一台电脑启动：复制整个客户端工程（保留 `src/generated`、`public/assets`、`src/vendor`、`package.json`、`package-lock.json`），安装 Node.js 22.12+，执行 `npm ci` 和 `npm run dev`。无需复制服务端工程或 Spine 原始工程。网关地址填写服务端所在电脑可访问的 IP 或域名；`127.0.0.1` 始终指当前运行浏览器的电脑。界面保存的网关地址优先于 `.env.local`。

发布时执行 `npm run build`，将生成的 `dist` 整个目录部署到静态网站服务器；玩家浏览器只加载网站资源并连接网关，不需要 Node.js、Java 源码或本地 D 盘目录。

## 当前功能

- 两张实际场景背景、本地切换、等比缩放、Spine 角色动作和受击框调试。
- 注册、登录、英雄选择、昵称入场、等待对手、退出战场。
- A/D 或方向键移动，空格/W/↑跳跃，K按住格挡，U/I/J按配置施法；支持画面按钮触控，失焦或切出页面释放按住输入。
- 显示权威角色/投射物、血量/蓝量/防御值/状态、战斗结果飘字、结束排名、战绩分页。
- WebSocket二进制信封按CMD分发，requestId关联响应，clientSequence递增，64位ID保留为字符串。
- 每15秒应用心跳；请求超时提示结果未确认，断开后重新登录，不自动重发施法或恢复战场。

启动后首先显示独立登录页；注册页包含确认密码，注册成功返回登录。登录后进入对战大厅，可切换出战忍者、查看忍者技能、对战记录和操作指南，填写昵称并开始对战。对局结束关闭结算面板返回大厅；断线返回登录，不自动恢复对局。

登录及对战需要已运行的网关、Login、AgentMgr、Agent、Scene及对应基础设施。使用两个浏览器窗口、不同账号验证对战。界面采用深蓝与金色的游戏面板样式，支持桌面和窄屏；战斗场景与 Spine 素材保持原有实现。

进入对战后，战斗画布铺满浏览器窗口，血条、移动与技能按钮悬浮显示；左上角「全屏」可进入浏览器全屏，Esc 退出全屏。离开战场或关闭结算返回大厅。背景适配窗口尺寸，角色与判定按统一比例缩放，完整保留战场横向范围；不改变服务端坐标和结算。

## 帧循环

`src/loop/FixedStepLoop.ts` 使用唯一的 `requestAnimationFrame`，Pixi自动Ticker关闭。

1. 累积实际经过时间，每个固定步长为 `1/30` 秒。
2. 每次显示帧最多执行10次固定更新，推进客户端显示时间。
3. 超出10步的整步积压丢弃，保留小数余量 `alpha`；过度落后时将显示时间对齐到最新快照附近。
4. 每次显示帧只渲染一次，按 `alpha` 在前后显示时刻之间采样权威快照。

`SnapshotBuffer` 以初始延迟2个服务器tick缓冲，最多保存120个快照；仅角色/投射物坐标插值，血量、死亡、施法阶段、对象生成/消失按对应快照切换。缺少后续快照时停在最新位置。切回前台重新对齐，不补打旧输入或旧伤害。

这里的追帧推进**客户端显示时钟**；伤害、被动、碰撞、移动规则仍由服务器执行，没有复制一套本地战斗结算，也没有加入预测回滚。

## 协议与配置同步

`npm run dev`、`npm run build`、`npm test` 都只使用客户端自身文件，不自动同步，也不读取服务端或动画工程目录。

- `src/generated/protocol.json`、`commands.ts`：客户端使用的协议和 CMD 副本。
- `src/generated/catalog.json`：客户端展示用角色与技能配置副本。
- `src/generated/animations.json`、`spine-fx.json`：动作与原生特效映射副本。
- `public/assets`：客户端已打包的背景和 Spine 资源。

只有开发人员更新协议、配置表或动画素材时，才手动执行同步。同步输入为：

- `game-protocol/src/main/proto`：生成Protobuf描述。
- `game-common/.../GameCommands.java`：生成CMD编号。
- `config/src/main/resources`：读取hero、skill、skill_effect三个CSV。
- 统一素材包中的 `特效_Spine_V1.0/manifest.json` 与 `骨骼动画_V1.0/manifest.json`：读取组合工程、16段原生特效与动作映射。
- 正式导出的角色/独立特效库 JSON 和 atlas；源工程 JSON 提供附件设计尺寸，`images/` 提供原始 RGBA 像素。

更新服务端协议和配置表（需要有服务端源码的开发机器）：

```powershell
$env:NINJA_SERVER_ROOT = 'D:\IdeaProjects\Ninja Arena'
npm run sync:data
```

更新动画资源（需要有原始动画工程的开发机器）：

```powershell
$env:NINJA_ANIMATION_ROOT = '你的影斗_动作与特效_统一素材包_V1.0目录'
# 也可以直接填该目录中的 特效_Spine_V1.0
npm run sync:animations
```

同时设置两个变量后，也可使用 `npm run sync` 一次更新两者。同步命令没有默认外部路径；未设置所需变量时明确报错，不影响普通启动。上述变量只用于手动同步，不是服务器网络地址，也不由 Vite 的 `.env.local` 自动加载。

同步后将 `src/generated` 和 `public/assets` 一起保存、分发并重新构建客户端，保证与目标服务端的协议和配置版本一致；其他电脑直接使用这些文件。浏览器从客户端自身 `/assets/spine/` 加载动画，不读取 D 盘绝对路径。

## Spine 动作与特效接入

当前使用统一素材包内 Spine 3.8.75 的 `hero_101_hayate_with_fx`（44段）、`hero_102_iwaya_with_fx`（40段）和 `shadow_duel_fx_library`（16段）。角色动作、影替预设姿势残影与16种特效均来自原生骨骼、插槽颜色和图片附件，旧程序绘制的刀光、星形飞镖和护盾轮廓已移除。

- `SpineMesh.ts` 共用角色/特效的区域附件渲染器，包含透明度、颜色、混合和绘制顺序；透明插槽按需创建网格。
- 角色位置、朝向、施法和状态来自服务器快照；角色身高仅按本体附件计算，忽略透明特效与残影。
- `AnimationDirector.ts` 按显示 Tick 采样动作。阶段变化不中途重播；移动前摇使用下半身行为与上半身动作叠加；死亡在最终 Tick 停止后继续播完。普攻使用 `attack_light_1`；其他无玩法配置的预留攻击不会擅自新增按键。
- `SkillVfx.ts` 用独立特效实例管理施法表现、持续状态、飞镖与结算反馈。组合角色中的 `fx_*` 插槽不重复绘制；影替的 `shadow_pose_*` 残影与主体透明仍由角色动画播放。`*_fx_preview` 制作演示不作为游戏技能动作。
- 疾影斩：前摇聚风挂在实际武器骨骼位置，生效后播放风刃；崩岳击：生效挥斩后接地面冲击；两种普攻复用对应风/岩挥斩。
- 护盾、铁壁、逐风、无敌、中毒、流血、灼烧、回血光点按实际目标状态显示、刷新和移除；不会在挥空时给敌人添加状态。
- 飞镖使用原生 `fx_shuriken`，世界位置及消失跟随投射物快照；不播放演示文件里的固定飞行路线。
- 命中/格挡共用素材中的 `fx_guard_contact` 接触火花；实际 `HEAL` 结果触发 `fx_regen_pulse`。周期伤害不重复播接触火花或受击姿势。
- 动作与特效共用插值显示时间；断帧后直接采样正确进度，技能打断、角色死亡和退出对局会清理相关表现。客户端动画事件不参与扣血或玩法判定。

导入时修复了本批素材的两处打包问题：正式导出把附件显示尺寸重置为PNG尺寸，导入脚本按源工程还原宽高；旧图集生成器的 RGB MaxFilter 改动了不透明像素，`scripts/spine-atlas.mjs` 从原附件重建同坐标图集，保留原RGBA和透明边距。没有重画原始美术、修改原始 `.spine` 工程或技能关键帧。走路腿部修正仅对本批已验证骨骼启用。

运行库仅为已验证的JSON骨骼hash开放3.8.75兼容；二进制SKEL未接入。见 `src/vendor/NOTICE.md`。许可证随客户端静态资源发布。

## 当前范围与验证

J 为两位角色的普攻（1101/2101），无需蓝量；L 为风隐的训练飞镖。回蓝由服务端控制，默认每30逻辑帧恢复5点。冷却显示依据成功响应/CAST_STARTED与本地同步CSV估算，最终以服务器校验为准。背景选择仅影响本地外观。

测试覆盖追帧上限与插值、64位ID与协议编码、响应关联、断线不重发、登录入场界面状态、输入释放、两个 Spine 骨骼的全动作采样和动画选择。已完成类型检查、生产构建与自动测试；已完成本机 Chrome 的原生动作/特效画面检查；本次未运行真实双人后端联调。

服务端仓库：[NinjaArenaServer](https://github.com/Hhhhh-002/NinjaAreana/tree/main/server)。
