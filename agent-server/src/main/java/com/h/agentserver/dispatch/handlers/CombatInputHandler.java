package com.h.agentserver.dispatch.handlers;

import com.h.agentserver.actor.PlayerActor;
import com.h.gamecommon.annotation.GameCommand;
import com.h.gamecommon.command.GameCommands;
import com.h.gameprotocol.codec.DecodedMessage;
import com.h.gameprotocol.proto.*;
import org.springframework.stereotype.Component;
import java.util.concurrent.CompletableFuture;

/** 复用已有 PlayerActor 的请求去重及长连接转发，等 BattleActor 的实际响应。 */
@Component
@GameCommand({GameCommands.JUMP,GameCommands.BLOCK,GameCommands.CAST_SKILL})
public final class CombatInputHandler implements AgentGameHandler {
    public boolean battleInput() {return true;}
    public boolean forwardedResponse() {return true;}
    public CompletableFuture<ServerEnvelope> handle(PlayerActor actor,DecodedMessage<ClientEnvelope,GameCommands> message) {
        return actor.forwardSceneInput(message.envelope()).thenApply(v->null);
    }
}
