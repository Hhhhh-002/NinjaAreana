package com.h.ninja.config;

/** hero.csv 受击框参数；Y 向下为正，上下边界表示距脚底向上的距离。 */
public record HurtboxDefinition(double width, double offsetX, double topFromFeet, double bottomFromFeet) {}
