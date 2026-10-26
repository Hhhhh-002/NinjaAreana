package com.h.sceneserver.dispatch.handlers;
import com.google.protobuf.Message;
import com.h.sceneserver.actor.BattleActor;
import com.h.gamecommon.annotation.GameCommand;
import com.h.gamecommon.command.GameCommands;
import com.h.gameprotocol.codec.DecodedMessage;
import com.h.gameprotocol.proto.*;
import org.springframework.stereotype.Component;
@Component
@GameCommand(GameCommands.CAST_SKILL)
public final class CastSkillHandler implements SceneGameHandler {
    public Message handle(BattleActor battle,String user,DecodedMessage<ClientEnvelope,GameCommands> message) {
        return battle.cast(user,((CastSkillRequest)message.body()).getSkillId(),message.envelope().getRequestId());
    }
}
