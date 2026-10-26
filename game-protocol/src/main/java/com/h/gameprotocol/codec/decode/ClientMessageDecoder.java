package com.h.gameprotocol.codec.decode;

import com.google.protobuf.InvalidProtocolBufferException;
import com.google.protobuf.Message;

import com.h.gamecommon.exception.InvalidCommandBodyException;
import com.h.gamecommon.exception.UnknownCommandException;
import com.h.gameprotocol.codec.DecodedMessage;
import com.h.gamecommon.command.GameCommands;
import com.h.gameprotocol.proto.*;

import java.util.Map;

/** 按 cmd 把信封内的 body 解析成对应 Protobuf 消息类型。 */
public final class ClientMessageDecoder {
    // 只解析客户端请求；MOVE 等服务端推送不在此表中。
    private static final Map<GameCommands, com.google.protobuf.Parser<? extends Message>> PARSERS = Map.ofEntries(
            Map.entry(GameCommands.LOGIN, LoginRequest.parser()),
            Map.entry(GameCommands.REGISTER, RegisterRequest.parser()),
            Map.entry(GameCommands.HEARTBEAT, HeartbeatRequest.parser()),
            Map.entry(GameCommands.MATCH_HISTORY, MatchHistoryRequest.parser()),
            Map.entry(GameCommands.SPLIT, SplitRequest.parser()),
            Map.entry(GameCommands.EJECT, EjectRequest.parser()),
            Map.entry(GameCommands.START_GAME, StartGameRequest.parser()),
            Map.entry(GameCommands.SHIFT, ShiftRequest.parser()),
            Map.entry(GameCommands.JUMP, JumpRequest.parser()),
            Map.entry(GameCommands.BLOCK, BlockRequest.parser()),
            Map.entry(GameCommands.CAST_SKILL, CastSkillRequest.parser()),
            Map.entry(GameCommands.LEAVE, LeaveRequest.parser())

    );

    /** 先解析信封，再按 cmd 解析 body；未知 cmd 和非法 Protobuf 分别抛出不同异常。 */
    public DecodedMessage<ClientEnvelope, GameCommands> decode(byte[] bytes) throws InvalidProtocolBufferException {
        return decode(ClientEnvelope.parseFrom(bytes));
    }

    /** 接收入口已解析信封时复用，记录日志不需要再次解析整个消息。 */
    public DecodedMessage<ClientEnvelope, GameCommands> decode(ClientEnvelope envelope) {
        GameCommands command = GameCommands.fromCode(envelope.getCmd());
        if (command == null) {
            throw new UnknownCommandException(envelope.getCmd(), envelope.getRequestId());
        }
        var parser = PARSERS.get(command);
        if (parser == null) {
            throw new UnknownCommandException(envelope.getCmd(), envelope.getRequestId());
        }
        try {
            Message body = parser.parseFrom(envelope.getBody());
            return new DecodedMessage<>(envelope, command, body);
        } catch (InvalidProtocolBufferException exception) {
            // 信封已解析成功，错误响应仍可携带原请求的 cmd/requestId。但是body里面protobuf二进制损坏；抛出【body非法异常】
            throw new InvalidCommandBodyException(
                    envelope.getCmd(), envelope.getRequestId(), exception);
        }
    }
}
