package com.rosterriddles.rosterriddles.api.controller;

import java.util.ArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.rosterriddles.rosterriddles.config.LoginPostRequestConfig;
import com.rosterriddles.rosterriddles.domain.model.JwtResponse;
import com.rosterriddles.rosterriddles.domain.model.UserJwtDetails;
import com.rosterriddles.rosterriddles.domain.service.UserService;
import com.rosterriddles.rosterriddles.utils.login.LoginPostRequestValidator;
import com.rosterriddles.rosterriddles.utils.login.LoginUtil;

@RestController
@CrossOrigin(origins = { "http://localhost:4200" })
public class JwtAuthenticationController {
    @Autowired
    private UserService userService;

    @Autowired
    private LoginUtil util;

    final static Logger logger = LoggerFactory.getLogger(JwtAuthenticationController.class);

    @RequestMapping(value = "/login", method = RequestMethod.POST)
    public ResponseEntity<?> createAuthToken(@RequestBody String json) throws Exception {
        logger.debug("Login creating auth token");
        try {
            LoginPostRequestValidator loginPostRequestValidator = new LoginPostRequestValidator();
            LoginPostRequestConfig loginRequest = loginPostRequestValidator.validateJson(json).fromJson(json,
                    LoginPostRequestConfig.class);

            Object user = userService.loadUserByUsername(loginRequest.getEmail());

            util.authenticate(loginRequest.getEmail(), loginRequest.getPassword(), ((UserJwtDetails) user).getUserID());
            logger.debug("Auth token generated successfully");

            final String token = util.generateToken(new User(loginRequest.getEmail(), loginRequest.getPassword(), new ArrayList<>()));

            return ResponseEntity.ok(new JwtResponse(token));
        } catch (Exception e) {
            logger.debug("Login creating auth token failed: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }
}
