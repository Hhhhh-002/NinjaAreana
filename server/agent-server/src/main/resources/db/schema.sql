-- Ninja Arena：在 Nacos spring.datasource.url 指定的数据库中手动执行。
-- 应用不会自动执行，不创建数据库，不删除/修改已有表。
-- 沿用 BallsGame 的 MyBatis-Plus + Protobuf 二进制存储，只需要三张表。

-- Login：UserProto，账号、BCrypt 密码哈希、禁用状态、创建/登录时间。
CREATE TABLE IF NOT EXISTS game_account (
    user_id VARCHAR(64) NOT NULL COMMENT '邮箱账号ID',
    data BLOB NOT NULL COMMENT 'UserProto序列化字节',
    PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='账号';

-- Scene：MatchProto，一局的时间、结束原因、最终玩家结果。
-- match_id = Scene实例ID + ':' + 无符号battleId。
CREATE TABLE IF NOT EXISTS game_match (
    match_id VARCHAR(288) NOT NULL COMMENT '实例ID与战场ID的组合',
    data MEDIUMBLOB NOT NULL COMMENT 'MatchProto序列化字节',
    PRIMARY KEY (match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='比赛记录';

-- Scene：MatchResultProto，结束时仍在场的每名玩家一条，含heroId、最终HP、名次。
-- result_id = '<userId字符数>:<userId>:<match_id>'，同局重试不会重复插入。
-- 比赛和个人结果在一个事务中提交；沿用参考项目的不可变最终结果校验。
CREATE TABLE IF NOT EXISTS game_match_result (
    result_id VARCHAR(384) NOT NULL COMMENT '玩家与比赛的固定结果标识',
    data BLOB NOT NULL COMMENT 'MatchResultProto序列化字节',
    PRIMARY KEY (result_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='个人战绩';

-- 不为 SkillCastInstance、CombatantState、StatusInstance、ProjectileInstance、
-- PassiveProgress、冷却、命令暂存或请求去重建立 MySQL 表。
-- hero/skill/skill_effect 使用 CSV；请求去重使用原有 Redis 和 Actor 本地窗口。
-- Actor/Agent/Gateway 路由不建持久化表；当前没有新增解锁、装备、成长、回放表。
