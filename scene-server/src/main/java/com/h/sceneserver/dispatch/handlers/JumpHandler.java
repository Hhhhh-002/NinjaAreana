package com.h.sceneserver.dispatch.handlers;
import com.google.protobuf.Message;
import com.h.sceneserver.actor.BattleActor;
import com.h.gamecommon.annotation.GameCommand;
import com.h.gamecommon.command.GameCommands;
import com.h.gameprotocol.codec.DecodedMessage;
import com.h.gameprotocol.proto.ClientEnvelope;
import org.springframework.stereotype.Component;
@Component
@GameCommand(GameCommands.JUMP)
public final class JumpHandler implements SceneGameHandler {
    public Message handle(BattleActor battle,String user,DecodedMessage<ClientEnvelope,GameCommands> message) {
        battle.jump(user);return null;
    }
}
