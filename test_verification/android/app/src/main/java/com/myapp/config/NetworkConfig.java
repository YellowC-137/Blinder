package com.myapp.config;

public class NetworkConfig {
    public static final String BASE_URL = "https://api.androidapp.com";
    public static final String DB_PASS = "super-secret-password-1234";
    
    public void printUrl() {
        System.out.println("URL: " + BASE_URL);
    }
}
