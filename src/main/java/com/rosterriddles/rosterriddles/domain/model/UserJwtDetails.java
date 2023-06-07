package com.rosterriddles.rosterriddles.domain.model;

import java.util.Collection;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

public class UserJwtDetails extends User{
    public UserJwtDetails(String username, String password, Collection<GrantedAuthority> authorities) {
        super(username, password, authorities);
    } 
    public UserJwtDetails(String username, String password, boolean enabled, boolean accountNonExpired, 
            boolean credentialsNonExpired, boolean accountNonLocked, java.util.Collection<GrantedAuthority> authorities) {
        super(username, password, enabled, accountNonExpired, credentialsNonExpired, accountNonLocked, authorities);
    } 
    private int user_id = 0;

    public void setUserID(int id) { 
        this.user_id = id;
    } 

    public int getUserID() { 
        return this.user_id;
    }
}
