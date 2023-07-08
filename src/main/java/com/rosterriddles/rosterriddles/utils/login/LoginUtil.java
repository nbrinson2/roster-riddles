package com.rosterriddles.rosterriddles.utils.login;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.rosterriddles.rosterriddles.domain.model.UserIdData;
import com.rosterriddles.rosterriddles.domain.service.JwtUserService;
import com.rosterriddles.rosterriddles.exceptions.InvalidUserException;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import jakarta.persistence.EntityManager;

@Component
public class LoginUtil {
    public static final long JWT_TOKEN_VALIDITY = 7 * 24 * 60 * 60;

    @Autowired
    private JwtUserService jwtUserService;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Value("${jwt.secret}")
    private String secret;

    final static Logger logger = LoggerFactory.getLogger(LoginUtil.class);

    public HashMap<String, Object> checkLogin(String email, String dialect, boolean login, EntityManager entityManager)
            throws Exception {
        HashMap<String, Object> response = new HashMap<String, Object>();
        UserIdData userIdData = jwtUserService.getUserIdData(email, entityManager);
        logger.debug("userdata=" + userIdData.toString());
        boolean isActive = userIdData.is_active;

        if (userIdData.user_id == 0) {
            logger.debug("USER_DOES_NOT_EXIST");
            throw new InvalidUserException("USER_DOES_NOT_EXIST");
        }

        response.put("user_id", userIdData.user_id);
        response.put("is_active", userIdData.is_active);
        response.put("email", userIdData.email);
        response.put("password", userIdData.password);
        response.put("name", userIdData.name);

        if (!isActive) {
            response.put("enabled", false);
        }

        return response;
    }

    public void authenticate(String username, String password, int userId) throws Exception {
        try {
            logger.debug("authenticating user " + username);
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
        } catch (DisabledException e) {
            logger.debug("disabled user " + username);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "INVALID_LOGIN");
        } catch (BadCredentialsException e) {
            logger.debug("bad credentials " + username);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "LOGIN_FAILED_BAD_CREDENTIALS");
        }
    }

    public String generateToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        return doGenerateToken(claims, userDetails.getUsername());
    }

    private String doGenerateToken(Map<String, Object> claims, String subject) {
		return Jwts.builder().setClaims(claims).setSubject(subject).setIssuedAt(new Date(System.currentTimeMillis()))
				.setExpiration(new Date(System.currentTimeMillis() + JWT_TOKEN_VALIDITY * 1000))
				.signWith(SignatureAlgorithm.HS512, secret).compact();
    }
}
