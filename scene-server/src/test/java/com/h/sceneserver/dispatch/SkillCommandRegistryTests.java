package com.h.sceneserver.dispatch;

import com.h.sceneserver.dispatch.handlers.*;
import com.h.sceneserver.registries.SceneGameCommandRegistry;
import com.h.gamecommon.command.GameCommands;
import com.h.gameprotocol.codec.decode.ClientMessageDecoder;
import com.h.gameprotocol.proto.*;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class SkillCommandRegistryTests {
    @Test void springCollectsCommandHandlersAndRegistryUsesCmdRatherThanSkillId() {
        try(var context=new AnnotationConfigApplicationContext()) {
            context.register(ShiftHandler.class,JumpHandler.class,BlockHandler.class,CastSkillHandler.class,SceneGameCommandRegistry.class);
            context.refresh();var registry=context.getBean(SceneGameCommandRegistry.class);
            assertInstanceOf(CastSkillHandler.class,registry.get(GameCommands.CAST_SKILL));
            assertInstanceOf(JumpHandler.class,registry.get(GameCommands.JUMP));
            assertInstanceOf(BlockHandler.class,registry.get(GameCommands.BLOCK));
            assertInstanceOf(ShiftHandler.class,registry.get(GameCommands.SHIFT));
            var request=ClientEnvelope.newBuilder().setCmd(GameCommands.CAST_SKILL.code()).setRequestId(100)
                    .setBody(CastSkillRequest.newBuilder().setSkillId(1001).build().toByteString()).build();
            var decoded=new ClientMessageDecoder().decode(request);
            assertSame(registry.get(GameCommands.CAST_SKILL),registry.get(decoded.command()));
            assertEquals(1001,((CastSkillRequest)decoded.body()).getSkillId());
        }
        assertThrows(IllegalStateException.class,()->new SceneGameCommandRegistry(List.of(new CastSkillHandler(),new CastSkillHandler())));
    }
}
