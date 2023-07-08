package com.rosterriddles.rosterriddles.domain.model;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.sportsbiz.deepsport.audit.AuditProcessing;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;

import org.springframework.transaction.annotation.Transactional;

public class SessionControl {

    final static Logger logger = LoggerFactory.getLogger(SessionControl.class);

    public void setSession(int user_id, int org_id, String dialect, EntityManager em) {
        String query = "insert into sportsbiz.session (user_id,organization_id,expires) values " +
                " (:userId,:orgId, ";
        if (dialect.equals("mysql")) {
            query += " date_add(NOW(), INTERVAL 4 HOUR)) ";
        } else {
            query += " dateadd('HOUR', 4, CURRENT_TIMESTAMP)) ";
        }
        Query data = em.createNativeQuery(query);
        data.setParameter("orgId", org_id);
        data.setParameter("userId", user_id);
        data.executeUpdate();
        AuditProcessing ap = new AuditProcessing();
        logger.info("User " + user_id + " has exited context with " + org_id);
        ap.addMessage(user_id, org_id, "CONTEXT_CHANGE", em);
        if (dialect.equals("mysql")) {
            query = "delete from sportsbiz.session where expires < DATE_ADD(NOW(), INTERVAL -10 DAY)";
        } else {
            query = "delete from sportsbiz.session where expires < DATEADD('DAY',-10, NOW())";
        }
        data = em.createNativeQuery(query);
        data.executeUpdate();
    }

    public void deleteSession(int user_id, int org_id, EntityManager em) {
        String query = "delete from sportsbiz.session where user_id=:userId ";
        Query data = em.createNativeQuery(query);
        data.setParameter("userId", user_id);
        data.executeUpdate();
        AuditProcessing ap = new AuditProcessing();
        logger.info("User " + user_id + " has exited context");
        ap.addMessage(user_id, org_id, "CONTEXT_EXIT", em);
    }

    public int validateSession(int user_id, EntityManager em) {
        String query = "select id,organization_id from sportsbiz.session where user_id=:userId " +
                " and expires > NOW() ";
        Query data = em.createNativeQuery(query);
        data.setParameter("userId", user_id);
        List<Object[]> response = data.getResultList();
        int ret = 0;
        for (Object[] db : response) {
            ret = (int) db[1];
        }
        return ret;
    }
}
