package com.rosterriddles.rosterriddles.domain.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rosterriddles.rosterriddles.domain.model.UserIdData;
import com.rosterriddles.rosterriddles.domain.model.UserJwtDetails;
import com.rosterriddles.rosterriddles.utils.login.LoginUtil;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;

@Service
@Transactional
public class UserService {
    @Value("${rosterriddles.sqldialect}")
    private String dialect;

    @PersistenceContext
    private EntityManager entityManager;

    final static Logger logger = LoggerFactory.getLogger(LoginUtil.class);

    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        try {
            HashMap<String, Object> options = checkUser(username, true);
            boolean enabled = (boolean) options.get("enabled");
            boolean accountExpired = false;
            boolean accountLocked = false;
            boolean credentialsExpired = false;
            UserJwtDetails details = new UserJwtDetails(
                username,
                (String) options.get("password"),
                enabled,
                credentialsExpired,
                accountExpired,
                accountLocked,
                new ArrayList<>());

            details.setUserID((int) options.get("user_id"));
            return details;
        } catch (Exception e) {
            e.printStackTrace();
            logger.debug("loadUserByNameException: " + e.getMessage());
            throw new UsernameNotFoundException("INVALID_USER_CHECK");
        }
    }

    public HashMap<String, Object> checkUser(String username, boolean login) throws Exception {
        HashMap<String, Object> result = new HashMap<String, Object>();
        LoginUtil util = new LoginUtil();
        result = util.checkLogin(username, dialect, login, entityManager);
        return result;
    }

    public UserIdData getUserIdData(String email, EntityManager entityManager) throws Exception {
        String query = "SELECT u.id from rosterriddles.user u where email = :email";
        logger.debug("query=" + query);
        Query data = entityManager.createNativeQuery(query);
        data.setParameter("email", email);
        List<Object[]> result = data.getResultList();
        UserIdData userIdData = new UserIdData();
        userIdData.email = email;
        for (Object[] dbUser : result) {
            userIdData.user_id = (int) dbUser[0];
            int active = (int)dbUser[1];
            userIdData.is_active = active == 0 ? false : true;
            userIdData.email = (String) dbUser[2];
            userIdData.password = (String) dbUser[3];
            userIdData.name = (String) dbUser[4];
        }
        return userIdData;
    }
}
