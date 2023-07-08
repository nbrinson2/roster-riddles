package com.rosterriddles.rosterriddles.utils.login;

import java.util.List;
import java.util.ArrayList;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.HashMap;

import com.rosterriddles.rosterriddles.domain.model.UserIdData;
import com.rosterriddles.rosterriddles.domain.service.SessionService;
import com.rosterriddles.rosterriddles.exceptions.InvalidUserException;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;

public class ProcessLogin {

    @Autowired
    private SessionService sessionService;

    final static Logger logger = LoggerFactory.getLogger(ProcessLogin.class);

    public HashMap<String, Object> resetPasswordRequest(String email, EntityManager em) throws Exception {
        HashMap<String, Object> options = new HashMap<String, Object>();
        UserIdData userData = getUserData(email, em);
        PasswordGeneration pg = new PasswordGeneration();

        return options;
    }

    public HashMap<String, Object> resetPassword(String email, String password, EntityManager em) throws Exception {
        HashMap<String, Object> options = new HashMap<String, Object>();
        UserIdData userData = getUserData(email, em);
        PasswordGeneration pg = new PasswordGeneration();

        return options;
    }

    public HashMap<String, Object> checkLogin(String email, String dialect, boolean login, EntityManager em) throws Exception {
        HashMap<String, Object> options = new HashMap<String, Object>();
        UserIdData userData = getUserData(email, em);
        logger.debug("ud="+userData.toString());
        boolean is_active = userData.is_active;
        if (userData.user_id == 0) { 
            logger.debug("USER_DOESNT_EXIST");
            throw new InvalidUserException("USER_DOESNT_EXIST");
        }
        LockedAccountCheck lac = new LockedAccountCheck();
        int count = 0;
        if (login) { 
            lac.placeLock(userData, dialect, em);
            count = lac.checkLockCount(userData,dialect,em);
        } 
        boolean locked = false;
        /* It gets run twice by jwt, just make it 10 */
        /* Future: Make this configurable */
        if (count >= 10) { locked = true; } 
        logger.debug("LOCKED"+locked);
        options.put("username", userData.email);
        options.put("password", userData.password);
        options.put("user_id", userData.user_id);
        options.put("enabled", userData.is_active); 
        options.put("account_locked", locked);
        options.put("account_expired", false);  // not enabled yet
        options.put("credentials_expired", false);  // not enabled yet
        return options;
    }

    public HashMap<String, Object> doLogin(String email, String password, String dialect, EntityManager em) throws Exception {
        // logger.debug("doLogin");
        HashMap<String, Object> options = new HashMap<String, Object>();
        /* Get user id */
        UserIdData userData = getUserData(email, em);
        if (!userData.is_active) { 
            logger.debug("USER_ISNT_ACTIVE");
            throw new InvalidUserException("USER_ISNT_ACTIVE");
        }
        if (password == null || password.length() < 8) { 
            logger.debug("INVALID_PASSWORD");
            throw new InvalidUserException("INVALID_PASSWORD");
        }
        if (userData.user_id == 0) {
            logger.debug("USER_DOESNT_EXIST");
            throw new InvalidUserException("USER_DOESNT_EXIST");
        }
        // logger.debug(userData.toString());
        /* Validate password */
        PasswordGeneration pg = new PasswordGeneration();
        boolean matches = pg.validatePassword(password, userData.password);
        options.put("username", email);
        options.put("password", password);
        options.put("enabled", userData.is_active);
        options.put("account_locked", false);  // not enabled yet
        options.put("account_expired", false);  // not enabled yet
        options.put("credentials_expired", false);  // not enabled yet
        options.put("user_id", userData.user_id);
        return options;
    }

    public HashMap <String, Object> getUserProfileByID(int user_id, int org_id, EntityManager em) {
        HashMap <String, Object> ret = new HashMap<String, Object>();
        // logger.debug("getUserProfile");
        String query = "select" +
            " u.id as user_id, o.id as org_id, u.first as first, u.last as last," +
            " u.email as email, u.phone as phone, u.title as title, o.name as org_name," +
            " u.locale as locale " +
            " from sportsbiz.user u, sportsbiz.organization o " +
            " where u.id = :userId and u.organization_id = o.id " +
            " and u.organization_id = :orgId";
        // logger.debug("query=" + query);
        Query data = em.createNativeQuery(query);
        data.setParameter("userId", user_id);
        List<Object[]> response =  data.getResultList();
        for (Object[] db: response) {
            ret.put("user_id", db[0]);
            ret.put("first", db[2]);
            ret.put("last", db[3]);
            ret.put("email", db[4]);
            ret.put("phone", db[5]);
            ret.put("title", db[6]);
            ret.put("locale", db[8]);
        }
        // logger.debug("results=" + ret);
        return ret;
    }

    public HashMap <String, Object> getUserProfile(String email, EntityManager em) {
        HashMap <String, Object> ret = new HashMap<String, Object>();
        // logger.debug("getUserProfile");
        String query = "select" +
            " u.id as user_id, o.id as org_id, u.first as first, u.last as last," +
            " u.email as email, u.phone as phone, u.title as title, o.name as org_name," +
            " u.locale as locale " +
            " from sportsbiz.user u, sportsbiz.organization o " +
            " where email = :email and u.organization_id = o.id ";
        // logger.debug("query=" + query);
        Query data = em.createNativeQuery(query);
        data.setParameter("email", email);
        List<Object[]> response =  data.getResultList();
        UserIdData uidd = new UserIdData();
        uidd.email = email;
        for (Object[] db: response) {
            ret.put("user_id", db[0]);
            ret.put("org_id", db[1]);
            ret.put("first", db[2]);
            ret.put("last", db[3]);
            ret.put("email", db[4]);
            ret.put("phone", db[5]);
            ret.put("title", db[6]);
            ret.put("organization_name", db[7]);
            ret.put("locale", db[8]);
        }
        // logger.debug("results=" + ret);
        return ret;
    }
    public UserIdData getUserData(String email, EntityManager em) {
        // logger.debug("getUserData");
        String query = "select u.id as uid,o.id oid ,u.password as pass, u.first as first, u.last as last," +
            " o.is_active as org_active, u.is_active as user_active " +
            " from sportsbiz.user u, sportsbiz.organization o " +
            " where email = :email and u.organization_id = o.id ";
        logger.debug("query=" + query);
        Query data = em.createNativeQuery(query);
        data.setParameter("email", email);
        List<Object[]> response =  data.getResultList();
        UserIdData uidd = new UserIdData();
        uidd.email = email;
        for (Object[] db: response) {
            uidd.user_id = (int) db[0];
            uidd.password = (String) db[2];
            uidd.name = (String) db[3];
            int uactive = (int)db[6];
            uidd.is_active = uactive == 0 ? false : true;
        }
        // logger.debug("results=" + uidd.toString());
        return uidd;
    }

}
