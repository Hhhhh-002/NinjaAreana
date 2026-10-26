package com.h.sceneserver.actor;

import akka.actor.*;
import com.google.protobuf.Message;
import com.h.gamecommon.code.GameError;
import com.h.gamecommon.command.*;
import com.h.gamecore.actor.*;
import com.h.gamecore.netty.PeerRegistry;
import com.h.gamecore.protocol.*;
import com.h.gameprotocol.codec.DecodedMessage;
import com.h.gameprotocol.codec.decode.ClientMessageDecoder;
import com.h.gameprotocol.proto.*;
import com.h.ninja.config.*;
import com.h.sceneserver.battle.BattleEngine;
import com.h.sceneserver.battle.state.*;
import com.h.sceneserver.dispatch.handlers.SceneGameHandler;
import com.h.sceneserver.registries.SceneGameCommandRegistry;
import com.h.sceneserver.service.SceneDirectoryActor;
import com.h.sceneserver.store.*;
import com.h.sceneserver.config.BattleRules;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import static com.h.gamecore.protocol.Messages.require;

/** 一局一个 Akka Actor；复用参考项目的邮箱、Timer、请求去重和长连接推送。 */
public final class BattleActor extends AbstractActorWithTimers {
    public record Join(String agent,SceneJoinRequest request) {}
    public record Leave(String agent,SceneLeaveRequest request) {}
    public record Input(String agent,ScenePlayerInput request) {}
    public record Resync(String agent) {}
    public record Expire(long idleNanos) {}
    public enum Tick { INSTANCE }
    public enum Snapshot { INSTANCE }

    private static final class Member {
        final String user,actor,agent,join,nickname;
        final int heroId;
        final MessageContext messages=new MessageContext(1024);
        CompletableFuture<Void> actions=CompletableFuture.completedFuture(null);
        long sequence;
        Member(SceneJoinRequest r,String agent) {
            user=r.getUserId();actor=r.getPlayerActorId();join=r.getJoinOperationId();nickname=r.getNickname();
            heroId=r.getHeroId();this.agent=agent;
        }
        String requestScope() {return actor+":"+join;}
    }
    /** 只是尚未消费的玩家输入，不是延迟战斗效果事件。 */
    private record PendingCommand(Member member,SceneGameHandler handler,
            DecodedMessage<ClientEnvelope,GameCommands> message,CompletableFuture<ServerEnvelope> result) {}

    private final ActorRef self=getSelf(),directory;
    private final String instance;
    private final PeerRegistry agents;
    private final SceneRequestStore requests;
    private final MatchRankingStore history;
    private final SceneGameCommandRegistry handlers;
    private final BattleState battle;
    private final BattleEngine engine=new BattleEngine();
    private final ClientMessageDecoder decoder=new ClientMessageDecoder();
    private final Map<String,Member> members=new LinkedHashMap<>();
    private final Map<String,Set<String>> leftJoins=new HashMap<>();
    private final List<PendingCommand> pendingCommands=new ArrayList<>();
    private long lastNanos=System.nanoTime(),accumulator,startedNanos,startedAt,emptySince=System.nanoTime();
    private boolean started,closed,finishing,finalCommitted;
    private int leftJoinCount;
    private int pendingIo;
    private MatchRanking finalRanking;
    private long nextSaveNanos,nextFinalPush;
    private CompletableFuture<Void> saving;

    public BattleActor(long id,String instance,BattleRules rules,ActorRef directory,PeerRegistry agents,
            MatchRankingStore history,SceneRequestStore requests,SceneGameCommandRegistry handlers,BattleConfigSnapshot configs) {
        this.instance=instance;this.directory=directory;this.agents=agents;this.history=history;
        this.requests=requests;this.handlers=handlers;this.battle=new BattleState(id,configs,rules);
        for(int skill:rules.basicAttackSkillIds())require(configs.skills().containsKey(skill),GameError.INVALID_INPUT);
    }
    public static Props props(long id,String instance,BattleRules rules,ActorRef directory,PeerRegistry peers,
            MatchRankingStore history,SceneRequestStore requests,SceneGameCommandRegistry handlers,BattleConfigSnapshot configs) {
        return Props.create(BattleActor.class,()->new BattleActor(id,instance,rules,directory,peers,history,requests,handlers,configs));
    }
    @Override public void preStart() {scheduleTick();availability();}
    private void scheduleTick() {getTimers().startSingleTimer(Tick.INSTANCE,Tick.INSTANCE,Duration.ofMillis(10));}
    @Override public Receive createReceive() {
        return receiveBuilder()
                .match(Join.class,m->respond(()->join(m.agent(),m.request())))
                .match(Leave.class,m->respond(()->leave(m.agent(),m.request())))
                .match(Input.class,m->AkkaSupport.reply(getSender(),self,()->input(m.agent(),m.request())))
                .match(Resync.class,m->members.values().stream().filter(x->x.agent.equals(m.agent())).forEach(x->send(x,snapshot())))
                .match(Expire.class,m->respond(()->expire(m.idleNanos())))
                .match(InputFailure.class,m->send(m.member(),Messages.clientError(m.request(),m.error())))
                .matchEquals(Snapshot.INSTANCE,m->respond(this::snapshot))
                .matchEquals(Tick.INSTANCE,m->{try {advance();}finally {availability();scheduleTick();}})
                .match(AkkaSupport.Continuation.class,AkkaSupport::execute).build();
    }
    @Override public void postStop() {
        var failure=new TimeoutException("BattleActor 已停止");
        pendingCommands.forEach(p->p.result().completeExceptionally(failure));
        members.values().forEach(m->m.messages.abort(failure));
    }
    private void respond(Supplier<Object> action) {
        ActorRef reply=getSender();
        try {reply.tell(action.get(),self);}catch(Exception e){reply.tell(new Status.Failure(e),self);}
        finally {availability();}
    }
    private void availability() {
        if(directory!=null)directory.tell(new SceneDirectoryActor.Availability(battle.battleId,
                !closed && !finishing && !started && members.size()<battle.rules.maxPlayers() && leftJoinCount<8192,closed),self);
    }
    private SceneJoinResult join(String agent,SceneJoinRequest r) {
        require(!closed && !finishing,GameError.SCENE_NOT_FOUND);
        require(!r.getUserId().isBlank() && r.getUserId().length()<=64 && !r.getPlayerActorId().isBlank()
                && r.getPlayerActorId().length()<=64 && !r.getJoinOperationId().isBlank() && r.getJoinOperationId().length()<=64
                && r.getNickname().codePointCount(0,r.getNickname().length())<=32,GameError.INVALID_MESSAGE);
        Member previous=members.get(r.getUserId());
        if(previous!=null) {
            require(matches(previous,agent,r.getPlayerActorId(),r.getJoinOperationId()) && previous.heroId==r.getHeroId()
                    && previous.nickname.equals(r.getNickname()),GameError.OPERATION_CONFLICT);
            send(previous,snapshot());return SceneJoinResult.newBuilder().setSceneId(battle.battleId).build();
        }
        require(!started && members.size()<battle.rules.maxPlayers(),GameError.SCENE_FULL);
        require(!leftJoins.getOrDefault(r.getPlayerActorId(),Set.of()).contains(r.getJoinOperationId()),GameError.OPERATION_CONFLICT);
        HeroDefinition hero=battle.configs.heroes().get(r.getHeroId());require(hero!=null,GameError.INVALID_INPUT);
        Member member=new Member(r,agent);
        double x=battle.rules.width()*(members.isEmpty()?0.25:0.75);
        CombatantState c=new CombatantState(battle.nextId(),member.user,hero,battle.configs,battle.rules.mode(),x,
                battle.rules.groundY(),members.isEmpty()?Facing.RIGHT:Facing.LEFT);
        members.put(member.user,member);battle.combatants.put(c.entityId,c);
        if(members.size()>=battle.rules.minPlayersToStart()) {
            started=true;startedNanos=System.nanoTime();startedAt=System.currentTimeMillis();lastNanos=startedNanos;accumulator=0;
        }
        broadcast(snapshot());return SceneJoinResult.newBuilder().setSceneId(battle.battleId).build();
    }
    private SceneLeaveResult leave(String agent,SceneLeaveRequest r) {
        require(!r.getPlayerActorId().isBlank() && r.getPlayerActorId().length()<=64
                && !r.getJoinOperationId().isBlank() && r.getJoinOperationId().length()<=64,GameError.INVALID_MESSAGE);
        Member m=members.get(r.getUserId());
        if(m==null || !m.actor.equals(r.getPlayerActorId()) || !m.join.equals(r.getJoinOperationId())) {
            rememberLeft(r.getPlayerActorId(),r.getJoinOperationId());
            return SceneLeaveResult.newBuilder().setOutcome(SceneLeaveResult.Outcome.ALREADY_LEFT).build();
        }
        require(matches(m,agent,r.getPlayerActorId(),r.getJoinOperationId()),GameError.OPERATION_CONFLICT);
        members.remove(m.user);rememberLeft(m.actor,m.join);
        var c=battle.player(m.user);
        if(!finishing) {
            if(c.alive)engine.damage.die(battle,c,c.entityId,0,0);
            if(!started)battle.combatants.remove(c.entityId);
        }
        pendingCommands.removeIf(p->{if(p.member()!=m)return false;
            p.result().complete(Messages.clientError(p.message().envelope(),new BattleException(GameError.NOT_IN_SCENE)));return true;});
        m.actions.handle((v,e)->null).thenCompose(v->requests.retired(instance,battle.battleId,m.requestScope()));
        broadcast(Messages.push(GameCommands.PLAYER_LEFT,PlayerLeftEvent.newBuilder().setUserId(m.user).build()));
        if(members.isEmpty())emptySince=System.nanoTime();
        if(started && !finishing)finish(MatchRanking.EndReason.ALL_LEFT);
        broadcast(snapshot());return SceneLeaveResult.newBuilder().setOutcome(SceneLeaveResult.Outcome.LEFT).build();
    }
    private boolean matches(Member m,String agent,String actor,String join) {
        return m.agent.equals(agent) && m.actor.equals(actor) && m.join.equals(join);
    }
    private void rememberLeft(String actor,String join) {
        var joins=leftJoins.get(actor);
        if(joins!=null && joins.contains(join))return;
        require(leftJoinCount<8192,GameError.SERVICE_UNAVAILABLE);
        leftJoins.computeIfAbsent(actor,k->new HashSet<>()).add(join);leftJoinCount++;
    }

    /** 沿用参考项目：本地请求窗口 + Redis claim，异步完成后重新进入本 Actor 邮箱。 */
    private CompletableFuture<Void> input(String agent,ScenePlayerInput input) {
        Member m=members.get(input.getUserId());
        if(closed || finishing || m==null || !matches(m,agent,input.getPlayerActorId(),input.getJoinOperationId()))
            return CompletableFuture.completedFuture(null);
        ClientEnvelope request=input.getClientMessage();
        try {
            SceneGameHandler handler=handlers.get(GameCommands.fromCode(request.getCmd()));require(handler!=null,GameError.UNKNOWN_COMMAND);
            var message=decoder.decode(request);
            if(!handler.cacheResponse()) {
                m.actions=m.actions.handle((v,e)->null)
                        .thenCompose(v->AkkaSupport.call(self,()->enqueue(m,handler,message)))
                        .thenCompose(f->f).thenCompose(response->AkkaSupport.run(self,()-> {
                            if(response.getCode()!=0)send(m,response);
                        })).exceptionally(error->{self.tell(new InputFailure(m,request,error),ActorRef.noSender());return null;});
                return m.actions;
            }
            var admission=m.messages.begin(request,true);var pending=admission.pending();
            pending.result().thenAccept(response->send(m,response));
            if(!admission.owner())return pending.result().thenApply(v->null);
            pendingIo++;
            boolean replayOnly=m.messages.retired(request.getRequestId());
            m.actions=m.actions.handle((v,e)->null)
                    .thenCompose(v->requests.claim(instance,battle.battleId,m.requestScope(),request,replayOnly))
                    .thenCompose(stored->AkkaSupport.call(self,()-> {
                        if(stored.stored().done())return CompletableFuture.completedFuture(stored.stored().result());
                        if(admission.uncommitted()!=null)return CompletableFuture.completedFuture(admission.uncommitted());
                        require(stored.owner(),GameError.SERVICE_UNAVAILABLE);
                        try {return enqueue(m,handler,message);}
                        catch(Exception e) {return CompletableFuture.completedFuture(Messages.clientError(request,e));}
                    })).thenCompose(f->f)
                    .thenCompose(response->requests.complete(instance,battle.battleId,m.requestScope(),request,response)
                            .handle((ignored,error)->new ActionResult(response,error)))
                    .handle((result,error)->error==null?result:new ActionResult(null,error))
                    .thenCompose(result->AkkaSupport.run(self,()-> {
                        pendingIo--;
                        if(result.error()==null)m.messages.complete(pending,result.response(),MessageContext.retryable(result.response()));
                        else if(result.response()!=null)m.messages.writeFailed(pending,result.response(),Messages.clientError(request,result.error()));
                        else m.messages.reject(pending,Messages.clientError(request,result.error()));
                    }));
            m.actions.whenComplete((v,e)->{if(e!=null)pending.result().completeExceptionally(e);});
            return pending.result().thenApply(v->null);
        } catch(Exception e) {send(m,Messages.clientError(request,e));return CompletableFuture.completedFuture(null);}
    }
    private record ActionResult(ServerEnvelope response,Throwable error) {}
    private record InputFailure(Member member,ClientEnvelope request,Throwable error) {}
    private CompletableFuture<ServerEnvelope> enqueue(Member m,SceneGameHandler handler,DecodedMessage<ClientEnvelope,GameCommands> message) {
        require(!closed && !finishing && members.get(m.user)==m,GameError.NOT_IN_SCENE);
        require(started,GameError.MATCH_WAITING);
        require(pendingCommands.size()<battle.rules.maxPendingCommands(),GameError.SERVICE_UNAVAILABLE);
        var result=new CompletableFuture<ServerEnvelope>();pendingCommands.add(new PendingCommand(m,handler,message,result));return result;
    }
    private void processCommands() {
        List<PendingCommand> commands=List.copyOf(pendingCommands);pendingCommands.clear();
        for(var p:commands) {
            ClientEnvelope request=p.message().envelope();
            try {
                require(members.get(p.member().user)==p.member(),GameError.NOT_IN_SCENE);
                Message response=p.handler().handle(this,p.member().user,p.message());
                p.result().complete(Messages.client(request,response));
            } catch(Exception e) {p.result().complete(Messages.clientError(request,e));}
        }
    }

    /** 下面四个方法只由 Tick 第 2 步的 Handler 调用。 */
    public void move(String user,ShiftRequest request,long sequence) {
        Member m=members.get(user);
        require(sequence!=0 && Float.isFinite(request.getDirectionX()) && request.getDirectionY()==0,GameError.INVALID_INPUT);
        if(Long.compareUnsigned(sequence,m.sequence)<=0)return;m.sequence=sequence;
        var c=battle.player(user);
        if(c.alive)c.input.moveAxis=request.getDirectionX()>0?1:request.getDirectionX()<0?-1:0;
    }
    public void jump(String user) {
        var c=battle.player(user);
        require(c.alive && c.currentCastId==null && c.movement.grounded && !c.input.blocking,GameError.INVALID_INPUT);
        c.movement.grounded=false;c.movement.velocityY=battle.rules.jumpVelocity();
    }
    public void block(String user,boolean blocking) {
        var c=battle.player(user);
        if(blocking)require(c.alive && c.currentCastId==null && c.movement.grounded && c.guard>0,GameError.INVALID_INPUT);
        c.input.blocking=blocking;
    }
    public CastSkillResponse cast(String user,int skillId,long requestId) {
        var cast=engine.skills.cast(battle,battle.player(user),skillId,requestId);
        return CastSkillResponse.newBuilder().setCastId(cast.castId).setSkillId(skillId).setServerTick(battle.tick).build();
    }
    private void advance() {
        long now=System.nanoTime();
        if(finishing){flushFinal(now);return;}
        if(!started){lastNanos=now;accumulator=0;return;}
        if(now-startedNanos>=TimeUnit.SECONDS.toNanos(battle.rules.matchDurationSeconds())) {
            finish(MatchRanking.EndReason.TIME_LIMIT);flushFinal(now);return;
        }
        long step=1_000_000_000L/battle.rules.tickRate();accumulator+=Math.max(0,now-lastNanos);lastNanos=now;
        int loops=0;
        while(accumulator>=step && loops++<battle.rules.maxCatchUp() && !finishing) {
            engine.onTick(battle,this::processCommands,()->broadcast(snapshot()));accumulator-=step;
            if(battle.rules.mode()==CombatTypes.Mode.VERSUS && battle.combatants.values().stream().filter(c->c.alive).count()<=1)
                finish(MatchRanking.EndReason.KNOCKOUT);
        }
        if(accumulator>=step)accumulator%=step; // 复用参考项目的有界补帧策略。
        if(finishing)flushFinal(now);
    }
    private void finish(MatchRanking.EndReason reason) {
        if(finishing)return;finishing=true;
        var result=MatchRanking.newBuilder().setSceneId(battle.battleId).setSceneInstanceId(instance)
                .setServerTick(battle.tick).setFrozen(true).setStartedAtMs(startedAt)
                .setEndsAtMs(startedAt+battle.rules.matchDurationSeconds()*1000L).setEndedAtMs(System.currentTimeMillis()).setEndReason(reason);
        List<CombatantState> sorted=battle.combatants.values().stream().filter(c->members.containsKey(c.playerId))
                .sorted(Comparator.comparingInt((CombatantState c)->c.hp).reversed().thenComparingLong(c->c.entityId)).toList();
        int rank=0,index=0,lastHp=-1;
        for(var c:sorted) {
            if(c.hp!=lastHp)rank=index+1;index++;lastHp=c.hp;
            result.addPlayers(MatchRankingEntry.newBuilder().setUserId(c.playerId).setNickname(members.get(c.playerId).nickname)
                    .setRank(rank).setHp(c.hp).setHeroId(c.definition.heroId()));
        }
        finalRanking=result.build();
        pendingCommands.forEach(p->p.result().complete(Messages.clientError(p.message().envelope(),new BattleException(GameError.SCENE_NOT_FOUND))));
        pendingCommands.clear();
    }
    /** 只保存不可变最终结果；异步 I/O 不阻塞战斗邮箱。 */
    private void flushFinal(long now) {
        if(saving!=null && saving.isDone()) {
            try{saving.join();finalCommitted=true;}catch(CompletionException e){nextSaveNanos=now+TimeUnit.SECONDS.toNanos(1);}
            saving=null;
        }
        if(finalCommitted) {
            if(now>=nextFinalPush){broadcast(Messages.push(GameCommands.MATCH_ENDED,finalRanking));nextFinalPush=now+TimeUnit.SECONDS.toNanos(5);}
        } else if(saving==null && now>=nextSaveNanos)saving=history.save(finalRanking);
    }
    private boolean expire(long idleNanos) {
        if(members.isEmpty() && pendingIo==0 && (!finishing || finalCommitted) && System.nanoTime()-emptySince>=idleNanos)closed=true;
        return closed;
    }
    private ServerEnvelope snapshot() {
        return Messages.push(GameCommands.BATTLE_SNAPSHOT,com.h.sceneserver.battle.result.CombatResultSink.snapshot(battle,started));
    }
    private void broadcast(ServerEnvelope message) {
        Map<String,SceneToAgentEvent.Builder> grouped=new HashMap<>();
        for(var m:members.values())grouped.computeIfAbsent(m.agent,k->SceneToAgentEvent.newBuilder().setSceneId(battle.battleId).setClientMessage(message))
                .addTargetUserIds(m.user).addTargetPlayerActorIds(m.actor).addTargetJoinOperationIds(m.join);
        grouped.forEach((agent,event)->agents.send(agent,Messages.event(ServiceCommands.SCENE_TO_AGENT,event.build())));
    }
    private void send(Member m,ServerEnvelope message) {
        agents.send(m.agent,Messages.event(ServiceCommands.SCENE_TO_AGENT,SceneToAgentEvent.newBuilder().setSceneId(battle.battleId)
                .addTargetUserIds(m.user).addTargetPlayerActorIds(m.actor).addTargetJoinOperationIds(m.join).setClientMessage(message).build()));
    }
}
