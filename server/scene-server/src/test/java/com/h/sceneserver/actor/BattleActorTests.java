package com.h.sceneserver.actor;

import akka.actor.*;
import com.h.gamecore.actor.AkkaSupport;
import com.h.gamecore.netty.PeerRegistry;
import com.h.gameprotocol.proto.*;
import com.h.gamecommon.command.GameCommands;
import com.h.ninja.config.*;
import com.h.sceneserver.config.BattleRules;
import com.h.sceneserver.dispatch.handlers.*;
import com.h.sceneserver.registries.SceneGameCommandRegistry;
import com.h.sceneserver.store.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 真实 Akka 邮箱、CMD Handler 和真实去重存储逻辑；Redis 传输为替身。 */
class BattleActorTests {
    record Runtime(ActorSystem system,ActorRef actor,SceneRequestStore store,BlockingQueue<ServerEnvelope> replies) implements AutoCloseable {
        public void close() {system.terminate();try{system.getWhenTerminated().toCompletableFuture().get(5,TimeUnit.SECONDS);}catch(Exception e){throw new RuntimeException(e);}}
    }
    Runtime runtime() {
        var fixture=new RedisRequestFixture();var store=spy(fixture.store());
        var replies=new LinkedBlockingQueue<ServerEnvelope>();var peers=mock(PeerRegistry.class);
        when(peers.send(anyString(),any())).thenAnswer(call->{
            ServiceEnvelope envelope=call.getArgument(1);ServerEnvelope r=SceneToAgentEvent.parseFrom(envelope.getEvent().getBody()).getClientMessage();
            if(r.getRequestId()!=0)replies.add(r);return CompletableFuture.completedFuture(null);
        });
        var system=AkkaSupport.system("test-"+UUID.randomUUID(),2);
        var rules=new BattleRules(2,30,5,600,1200,0,-16,1,30,CombatTypes.Mode.TRAINING,Set.of(),256);
        var registry=new SceneGameCommandRegistry(List.of(new ShiftHandler(),new JumpHandler(),new BlockHandler(),new CastSkillHandler()));
        var actor=system.actorOf(BattleActor.props(7,"scene",rules,null,peers,mock(MatchRankingStore.class),store,registry,new CombatConfigLoader().load()));
        return new Runtime(system,actor,store,replies);
    }
    void join(Runtime r) throws Exception {
        AkkaSupport.ask(r.actor(),new BattleActor.Join("agent",SceneJoinRequest.newBuilder().setSceneId(7).setUserId("u")
                .setPlayerActorId("actor").setJoinOperationId("10").setHeroId(101).setNickname("忍者").build())).get(3,TimeUnit.SECONDS);
    }
    ScenePlayerInput input(ClientEnvelope request) {
        return ScenePlayerInput.newBuilder().setSceneId(7).setUserId("u").setPlayerActorId("actor").setJoinOperationId("10")
                .setClientMessage(request).build();
    }
    ClientEnvelope cast(long id,int skill) {
        return ClientEnvelope.newBuilder().setCmd(GameCommands.CAST_SKILL.code()).setRequestId(id)
                .setBody(CastSkillRequest.newBuilder().setSkillId(skill).build().toByteString()).build();
    }
    ServerEnvelope execute(Runtime r,ClientEnvelope request) throws Exception {
        AkkaSupport.ask(r.actor(),new BattleActor.Input("agent",input(request))).get(4,TimeUnit.SECONDS);
        ServerEnvelope response=r.replies().poll(4,TimeUnit.SECONDS);assertNotNull(response);return response;
    }
    BattleStateSnapshot snapshot(Runtime r) throws Exception {
        ServerEnvelope envelope=AkkaSupport.<ServerEnvelope>ask(r.actor(),BattleActor.Snapshot.INSTANCE).get(3,TimeUnit.SECONDS);
        return BattleStateSnapshot.parseFrom(envelope.getBody());
    }
    @Test void duplicateSkillRequestReplaysCastIdWithoutManaOrCooldownReexecution() throws Exception {
        try(var r=runtime()) {
            join(r);var first=execute(r,cast(100,1001));var duplicate=execute(r,cast(100,1001));
            assertEquals(0,first.getCode());assertEquals(first,duplicate);
            assertEquals(CastSkillResponse.parseFrom(first.getBody()).getCastId(),CastSkillResponse.parseFrom(duplicate.getBody()).getCastId());
            assertEquals(75,snapshot(r).getCombatants(0).getMana());
            verify(r.store(),times(1)).claim(eq("scene"),eq(7L),eq("actor:10"),any(),eq(false));
            assertNotEquals(0,execute(r,cast(100,1002)).getCode());
        }
    }
    @Test void committingResponseFailureRetryDoesNotCreateAnotherCast() throws Exception {
        try(var r=runtime()) {
            doReturn(CompletableFuture.failedFuture(new IllegalStateException("write failed"))).doCallRealMethod()
                    .when(r.store()).complete(anyString(),anyLong(),anyString(),any(),any());
            join(r);assertNotEquals(0,execute(r,cast(100,1001)).getCode());
            assertEquals(0,execute(r,cast(100,1001)).getCode());assertEquals(75,snapshot(r).getCombatants(0).getMana());
        }
    }
    @Test void failedClaimCanRetryAndOriginalRequestStillExecutesExactlyOnce() throws Exception {
        try(var r=runtime()) {
            doReturn(CompletableFuture.failedFuture(new IllegalStateException("claim failed"))).doCallRealMethod()
                    .when(r.store()).claim(anyString(),anyLong(),anyString(),any(),anyBoolean());
            join(r);assertNotEquals(0,execute(r,cast(100,1001)).getCode());
            assertEquals(100,snapshot(r).getCombatants(0).getMana());
            assertEquals(0,execute(r,cast(100,1001)).getCode());assertEquals(75,snapshot(r).getCombatants(0).getMana());
        }
    }
    @Test void newerMoveSequenceWinsAndDirectionsAreOneDimensional() throws Exception {
        try(var r=runtime()) {
            join(r);
            for(var pair:List.of(new long[]{11,1},new long[]{10,-1})) {
                var request=ClientEnvelope.newBuilder().setCmd(GameCommands.SHIFT.code()).setClientSequence(pair[0])
                        .setBody(ShiftRequest.newBuilder().setDirectionX(pair[1]).build().toByteString()).build();
                AkkaSupport.ask(r.actor(),new BattleActor.Input("agent",input(request))).get(3,TimeUnit.SECONDS);
            }
            assertTrue(snapshot(r).getCombatants(0).getCenterX()>300);
            verify(r.store(),never()).claim(anyString(),anyLong(),anyString(),any(),anyBoolean());
        }
    }
}
