package com.h.ninja.config;

/** skill.csv 身前攻击框；水平距离根据本次施法朝向镜像。 */
public record HitboxDefinition(double forwardStart, double forwardEnd, double bottomFromFeet, double topFromFeet) {}
