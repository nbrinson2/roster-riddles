package com.rosterriddles.rosterriddles.domain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rosterriddles.rosterriddles.domain.model.SessionControl;
import com.rosterriddles.rosterriddles.utils.login.ProcessLogin;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Service
@Transactional
public class SessionService {

    final static Logger logger = LoggerFactory.getLogger(ProcessLogin.class);

    public void setSession(int user_id, int org_id, String dialect) { 
        SessionControl sc = new SessionControl();
        sc.setSession(user_id, org_id, dialect, em);
    } 

    public void deleteSession(int user_id, int org_id) { 
        SessionControl sc = new SessionControl();
        sc.deleteSession(user_id, org_id, em);
    } 

    public int validateSession(int user_id) { 
        SessionControl sc = new SessionControl();
        return sc.validateSession(user_id, em);
    } 

    @PersistenceContext
    private EntityManager em;
}
