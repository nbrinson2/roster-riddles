package com.rosterriddles.rosterriddles.config;

public class LoginPostRequestConfig {
    public String email;
    public String password;
    public String name;
    public String getEmail() { return email; }
    public String getPassword() { return password; }
    public String getName() { return name; }


    public String toString() {
        return "LPRC: {" +
            "'email':" + getEmail() + "," +
            "'password':" + getPassword() +
            "'name':" + getName() +
            "}";
    }
}
