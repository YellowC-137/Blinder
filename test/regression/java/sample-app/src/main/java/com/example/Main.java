package com.example;

/**
 * Minimal Java sample with hardcoded secrets — used by Blinder regression test.
 * After `blinder blind`, the constants below should be rewritten to System.getenv("...").
 */
public class Main {

    private static final String STRIPE_LIVE_SECRET_KEY = "sk_live_abcdefghijklmnopqrstuvwxyz0123";
    private static final String GITHUB_PAT = "ghp_abcdefghijklmnopqrstuvwxyzABCDEFGHIJ";
    private static final String AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";

    public static void main(String[] args) {
        System.out.println("stripe configured: " + (STRIPE_LIVE_SECRET_KEY != null && !STRIPE_LIVE_SECRET_KEY.isEmpty()));
        System.out.println("github configured: " + (GITHUB_PAT != null && !GITHUB_PAT.isEmpty()));
        System.out.println("aws configured: " + (AWS_ACCESS_KEY != null && !AWS_ACCESS_KEY.isEmpty()));
    }
}
