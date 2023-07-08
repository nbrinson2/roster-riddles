package com.rosterriddles.rosterriddles.domain.service;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;
import com.rosterriddles.rosterriddles.domain.model.UserAuthenticationData;
import org.springframework.http.HttpStatus;

@Service
@Transactional
public class UserService {

    @Value("${sportsbiz.baseurl}")
    private String baseUrl;

    @Value("${sportsbiz.fromemail}")
    private String fromEmail;

    @Value("${sportsbiz.fromname}")
    private String fromName;

    @Value("${sportsbiz.smtpuser}")
    private String smtpUser;

    @Value("${sportsbiz.smtppass}")
    private String smtpPass;

    @Value("${sportsbiz.smtphost}")
    private String smtpHost;

    @Value("${sportsbiz.smtpport}")
    private String smtpPort;

    @Value("${sportsbiz.sqldialect}")
    private String dialect;

    @Autowired
    private UserRepository userRepository;

    public List < User > getAllUser() {
        return this.userRepository.findAll();
    }

    public HashMap<String, Object> resetPasswordRequest(ResetPasswordPostRequestConfiguration req) throws Exception {
        logger.debug("resetpasswordrequest");
        HashMap<String, Object> options = new HashMap<String, Object>();
        req.fromName = fromName;
        req.fromEmail = fromEmail;
        req.smtpUser = smtpUser;
        req.smtpPass = smtpPass;
        req.smtpHost = smtpHost;
        req.smtpPort = smtpPort;
        req.baseUrl = baseUrl;

        ResetPassword rp = new ResetPassword();
        return rp.resetPasswordRequest(req, dialect, em);
    }

    public HashMap<String, Object> createUser(UserAuthenticationData uad, UserUpdatePostRequestConfiguration req) throws Exception {
        logger.debug(req.toString());
        HashMap<String, ArrayList<Object>> options = new HashMap<String, ArrayList<Object>>();
        UserUpdate uu = new UserUpdate();
        req.fromName = fromName;
        req.fromEmail = fromEmail;
        req.smtpUser = smtpUser;
        req.smtpPass = smtpPass;
        req.smtpHost = smtpHost;
        req.smtpPort = smtpPort;
        req.baseUrl = baseUrl;
        return uu.createUser(uad.getOrganizationID(), dialect, req, em);
    }

    public HashMap<String, Object> changeContext(UserAuthenticationData uad, SessionService session, UserUpdatePostRequestConfiguration req) throws Exception {
        HashMap<String, Object> options = new HashMap<String, Object>();
        options.put("success", true);
        session.setSession(req.user_id,req.id,dialect);
        return options;
    }
    public HashMap<String, Object> deleteContext(UserAuthenticationData uad, SessionService session, UserUpdatePostRequestConfiguration req) throws Exception {
        HashMap<String, Object> options = new HashMap<String, Object>();
        options.put("success", true);
        session.deleteSession(req.user_id, req.org_id);
        return options;
    }

    public HashMap<String, Object> landingCreate(UserAuthenticationData uad, LandingPagePostRequestConfiguration req) throws Exception { 
        logger.debug(req.toString());
        LandingPageUpdate lp = new LandingPageUpdate();
        return lp.createLandingPage(uad.getOrganizationID(), uad.getUserID(), req, em);
    } 

    public HashMap<String, Object> landingUpdate(UserAuthenticationData uad, LandingPagePostRequestConfiguration req) throws Exception { 
        logger.debug(req.toString());
        LandingPageUpdate lp = new LandingPageUpdate();
        return lp.updateLandingPage(uad.getOrganizationID(), uad.getUserID(), req, em);
    } 

    public HashMap<String, Object> updateUser(UserAuthenticationData uad, UserUpdatePostRequestConfiguration req) throws Exception { 
        logger.debug(req.toString());
        HashMap<String, ArrayList<Object>> options = new HashMap<String, ArrayList<Object>>();
        UserUpdate uu = new UserUpdate();
        req.fromName = fromName;
        req.fromEmail = fromEmail;
        req.smtpUser = smtpUser;
        req.smtpPass = smtpPass;
        req.smtpHost = smtpHost;
        req.smtpPort = smtpPort;
        req.baseUrl = baseUrl;
        return uu.updateUser(uad.getOrganizationID(), req, em);
    }

    public HashMap<String, ArrayList<Object>> listUsers(UserAuthenticationData uad, UserPostRequestConfiguration req) throws Exception {
        HashMap<String, ArrayList<Object>> options = new HashMap<String, ArrayList<Object>>();
        UserList ul = new UserList();
        options.put("total", ul.getUserListTotal(uad.getOrganizationID(), em));
        options.put("users", ul.getUserList(uad.getOrganizationID(), req, em));
        return options;
    }

    public HashMap<String, Object> changePassword(ResetPasswordPostRequestConfiguration req) throws Exception { 
        HashMap<String, Object> options = new HashMap<String, Object>();
        req.fromName = fromName;
        req.fromEmail = fromEmail;
        req.smtpUser = smtpUser;
        req.smtpPass = smtpPass;
        req.smtpHost = smtpHost;
        req.smtpPort = smtpPort;
        req.baseUrl = baseUrl;
        ChangePassword cp = new ChangePassword();
        return cp.changePassword(req, em);
    }

    public HashMap<String, Object> checkUser(String username, boolean login) throws Exception { 
        HashMap<String, Object> options = new HashMap<String, Object>();
        ProcessLogin pl = new ProcessLogin();
        options = pl.checkLogin(username, dialect, login, em);
        // logger.debug("checkUser returning");
        return options;
    }

    public HashMap<String, Object> loginUser(String username, String password) throws Exception { 
        HashMap<String, Object> options = new HashMap<String, Object>();
        ProcessLogin pl = new ProcessLogin();
        options = pl.doLogin(username, password, dialect, em);
        // logger.debug("loginUser returning");
        return options;
    }

    public HashMap<String, Object> getUserProfileByID(int user_id, int org_id) throws Exception {
        HashMap<String, Object> options = new HashMap<String, Object>();
        ProcessLogin pl = new ProcessLogin();
        options = pl.getUserProfileByID(user_id, org_id, em);
        UserRoles ur = new UserRoles();
        if (!options.containsKey("org_id")) {
            throw new Exception("ORG MISSING FROM GET PROFILE");
        }
        if (!options.containsKey("user_id")) {
            throw new Exception("USER MISSING FROM GET PROFILE");
        }
        HashMap<String, Object> roles = ur.getUserRoles((int)options.get("org_id"), (int)options.get("user_id"), em);
        options.put("roles", roles);
        UserEntitlements ue = new UserEntitlements();
        HashMap<String, Object> ent = ue.getUserEntitlements((int)options.get("org_id"), (int)options.get("user_id"), em);
        options.put("entitlements", ent);
        return options;
    }

    public HashMap<String, Object> getUserProfileByEmail(String username) { 
        HashMap<String, Object> options = new HashMap<String, Object>();
        ProcessLogin pl = new ProcessLogin();
        options = pl.getUserProfile(username, em);
        if (!options.containsKey("org_id")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        if (!options.containsKey("user_id")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        UserRoles ur = new UserRoles();
        HashMap<String, Object> roles = ur.getUserRoles((int)options.get("org_id"), (int)options.get("user_id"), em);
        UserEntitlements ue = new UserEntitlements();
        /* we pass in their context org_id so we get the right permissions */
        HashMap<String, Object> ent = ue.getUserEntitlements((int)options.get("org_id"), (int)options.get("user_id"), em);
        options.put("entitlements", ent);
        options.put("roles", roles);
        return options;
    }

    public HashMap<String,Object> getLandingPage(int org_id, boolean filterIsActive) { 
        LandingPage lp = new LandingPage();
        return lp.getLandingPage(org_id,dialect,filterIsActive,em);
    } 

    public HashMap<String, Object> getUserProfile(int org_id, String username) { 
        HashMap<String, Object> options = new HashMap<String, Object>();
        ProcessLogin pl = new ProcessLogin();
        options = pl.getUserProfile(username, em);
        if (!options.containsKey("org_id")) { 
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        } 
        if (!options.containsKey("user_id")) { 
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        } 
        UserRoles ur = new UserRoles();
        HashMap<String, Object> roles = ur.getUserRoles((int)options.get("org_id"), (int)options.get("user_id"), em);
        UserEntitlements ue = new UserEntitlements();
        /* we pass in their context org_id so we get the right permissions */
        HashMap<String, Object> ent = ue.getUserEntitlements(org_id, (int)options.get("user_id"), em);
        options.put("entitlements", ent);
        options.put("roles", roles);
        return options;
    }

    @PersistenceContext
    private EntityManager em;

    final static Logger logger = LoggerFactory.getLogger(UserService.class);
}
