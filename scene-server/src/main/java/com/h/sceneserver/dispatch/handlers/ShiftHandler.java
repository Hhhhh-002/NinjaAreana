package com.h.sceneserver.dispatch.handlers;

import com.h.sceneserver.actor.BattleActor;
import com.google.protobuf.Message;
import com.h.gamecommon.annotation.GameCommand;
import com.h.gamecommon.command.GameCommands;
import com.h.gameprotocol.codec.DecodedMessage;
import com.h.gameprotocol.proto.*;
import org.springframework.stereotype.Component;

/** SHIFT 的独立处理器，只在 BattleActor 的 Tick 第2阶段执行。 */
@Component
@GameCommand(GameCommands.SHIFT)
public final class ShiftHandler implements SceneGameHandler {
    public boolean cacheResponse() { return false; }
    public Message handle(BattleActor scene, String userId, DecodedMessage<ClientEnvelope, GameCommands> message) {
        scene.move(userId, (ShiftRequest) message.body(), message.envelope().getClientSequence());
        return null;
    }
}
