package com.example;

/**
 * Minimal Spring-Boot-style secrets holder — used by Blinder regression test.
 * Avoids Spring runtime imports so `javac` compiles without dependencies.
 * After `blinder blind`, hardcoded constants should be rewritten to
 * System.getenv("...") accessors.
 */
public class SecretsConfig {

    private static final String STRIPE_SECRET_KEY = "sk_live_abcdefghijklmnopqrstuvwxyz0123";
    private static final String GITHUB_TOKEN = "ghp_abcdefghijklmnopqrstuvwxyzABCDEFGHIJ";

    public static void main(String[] args) {
        System.out.println("stripe configured: " + (STRIPE_SECRET_KEY != null && !STRIPE_SECRET_KEY.isEmpty()));
        System.out.println("github configured: " + (GITHUB_TOKEN != null && !GITHUB_TOKEN.isEmpty()));
    }
}
