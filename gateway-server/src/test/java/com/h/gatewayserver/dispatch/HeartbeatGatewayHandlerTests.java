package com.h.gatewayserver.dispatch;

import com.h.gamecommon.command.GameCommands;
import com.h.gameprotocol.codec.decode.ClientMessageDecoder;
import com.h.gameprotocol.proto.*;
import com.h.gatewayserver.dispatch.client.handlers.HeartbeatGatewayHandler;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HeartbeatGatewayHandlerTests {
    @Test void browserHeartbeatReturnsCorrelatedResponseWithoutLoginOrDownstreamCalls() throws Exception {
        var request = ClientEnvelope.newBuilder().setCmd(GameCommands.HEARTBEAT.code()).setRequestId(19)
                .setBody(HeartbeatRequest.getDefaultInstance().toByteString()).build();
        var decoded = new ClientMessageDecoder().decode(request);
        assertInstanceOf(HeartbeatRequest.class, decoded.body());
        var result = new HeartbeatGatewayHandler().handle(null, decoded).block();
        assertNotNull(result);
        var response = result.clientResponse();
        assertEquals(request.getCmd(), response.getCmd());
        assertEquals(request.getRequestId(), response.getRequestId());
        assertEquals(0, response.getCode());
        assertTrue(HeartbeatResponse.parseFrom(response.getBody()).getServerTimeMs() > 0);
    }
}
