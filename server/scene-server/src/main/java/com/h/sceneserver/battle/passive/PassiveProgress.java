package com.h.sceneserver.battle.passive;
import java.util.*;
public final class PassiveProgress {
    /** 最近计数窗口内每次有效普攻的 tick，不是事件派发队列。 */
    public final Deque<Long> hitTicks=new ArrayDeque<>();
    public long cooldownEndTick;
    public int triggerCount;
}
