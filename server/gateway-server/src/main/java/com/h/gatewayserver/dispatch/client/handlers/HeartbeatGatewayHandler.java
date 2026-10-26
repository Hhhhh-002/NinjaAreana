package com.h.gatewayserver.dispatch.client.handlers;

import com.h.gamecommon.command.GameCommands;
import com.h.gameprotocol.codec.DecodedMessage;
import com.h.gameprotocol.proto.*;
import com.h.gatewayserver.annotions.GatewayCommand;
import com.h.gatewayserver.context.GatewayContext;
import com.h.gatewayserver.dispatch.client.result.GatewayHandlerResult;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/** 浏览器连接保活：直接响应，不访问数据库或进入战斗逻辑。 */
@Component
@GatewayCommand(GameCommands.HEARTBEAT)
public final class HeartbeatGatewayHandler implements GatewayCommandHandler {
    @Override
    public Mono<GatewayHandlerResult> handle(GatewayContext context,
            DecodedMessage<ClientEnvelope, GameCommands> message) {
        return Mono.just(new GatewayHandlerResult(ServerEnvelope.newBuilder()
                .setCmd(message.envelope().getCmd()).setRequestId(message.envelope().getRequestId())
                .setBody(HeartbeatResponse.newBuilder().setServerTimeMs(System.currentTimeMillis())
                        .build().toByteString()).build()));
    }
}
