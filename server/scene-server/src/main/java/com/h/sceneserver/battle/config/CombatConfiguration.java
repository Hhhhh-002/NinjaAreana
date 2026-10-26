package com.h.sceneserver.battle.config;

import com.h.ninja.config.*;
import org.springframework.context.annotation.*;

@Configuration
public class CombatConfiguration {
    @Bean public BattleConfigSnapshot combatConfigSnapshot() {return new CombatConfigLoader().load();}
}
