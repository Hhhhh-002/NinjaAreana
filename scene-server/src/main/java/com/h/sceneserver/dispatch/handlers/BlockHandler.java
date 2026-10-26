package com.h.sceneserver.dispatch.handlers;
import com.google.protobuf.Message;
import com.h.sceneserver.actor.BattleActor;
import com.h.gamecommon.annotation.GameCommand;
import com.h.gamecommon.command.GameCommands;
import com.h.gameprotocol.codec.DecodedMessage;
import com.h.gameprotocol.proto.*;
import org.springframework.stereotype.Component;
@Component
@GameCommand(GameCommands.BLOCK)
public final class BlockHandler implements SceneGameHandler {
    public Message handle(BattleActor battle,String user,DecodedMessage<ClientEnvelope,GameCommands> message) {
        battle.block(user,((BlockRequest)message.body()).getBlocking());return null;
    }
}
