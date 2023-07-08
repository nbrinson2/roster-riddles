package com.rosterriddles.rosterriddles.domain.model;

import java.util.HashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class UserAuthenticationData {

    private int user_id = 0;
    private String email;
    private HashMap<String, Object> roles = new HashMap<String, Object>();

    public void setUserID(int id) { user_id = id; } 
    public int getUserID() { return user_id; } 
    public void setEmail(String e) { email = e; } 
    public String getEmail() { return email; } 
    public void setRoles(HashMap<String, Object> r) { roles = r; } 
    public HashMap<String, Object> getRoles() { return roles; } 

    public boolean hasRole(String key) { 
        if (roles.containsKey(key)) { 
            boolean val = (boolean)roles.get(key);
            if (val) { return true; }
        } 
        return false;
    } 
    final static Logger logger = LoggerFactory.getLogger(UserAuthenticationData.class);
}