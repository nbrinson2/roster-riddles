package com.rosterriddles.rosterriddles.utils.login;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Base64;
import java.util.List;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.rosterriddles.rosterriddles.utils.login.UserPasswords.UserPassword;

import org.springframework.beans.factory.annotation.Value;
import java.security.SecureRandom;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.KeyGenerator;
import javax.crypto.Cipher;
import java.security.NoSuchAlgorithmException;

public class PasswordGeneration {

    final static Logger logger = LoggerFactory.getLogger(ProcessLogin.class);

    @Value("${jwt.secret}")
    private String salt;

    public boolean validatePassword(String cleartext, String password) throws Exception { 
        logger.debug("ct: " + cleartext + ",pass:" + password);
        String shouldbe = generatePassword(cleartext);
        boolean matches = decryptPassword(cleartext, password);
        return matches;
    }

    public boolean checkPreviousPasswords(String cleartext, List<UserPassword> passwords) throws Exception {
    	
        for (UserPassword p : passwords) {
            logger.debug("ct: " + cleartext + ",pass: " + p.getPassword());
            if(decryptPassword(cleartext, p.getPassword())) {
                return true;
            }
        }
        return false;
    }

    public boolean decryptPassword(String cleartext, String cipherText) throws Exception { 
        logger.debug("decryptPassword");
        SecretKey key = generateKey(128);
        BCryptPasswordEncoder enc = new BCryptPasswordEncoder();
        boolean pwMatches = enc.matches(cleartext, cipherText);
        logger.debug("passwords match: " + pwMatches);
        return pwMatches;
    }
    public String generatePassword(String cleartext) throws Exception { 
        logger.debug("generatePassword");
        BCryptPasswordEncoder enc = new BCryptPasswordEncoder();
        String cipherText = enc.encode(cleartext);
        boolean matches = enc.matches(cleartext, cipherText);
        logger.debug("matches:" + matches + ",ct:" + cipherText);
        return cipherText;
    } 

    public SecretKey generateKey(int n) throws NoSuchAlgorithmException {
        KeyGenerator keyGenerator = KeyGenerator.getInstance("AES");
        keyGenerator.init(n);
        SecretKey key = keyGenerator.generateKey();
        return key;
    }

    private IvParameterSpec generateIv() {
        byte[] iv = new byte[16];
        new SecureRandom().nextBytes(iv);
        return new IvParameterSpec(iv);
    }

    private String encrypt(String algorithm, String input, SecretKey key, IvParameterSpec iv) throws Exception {
        
        Cipher cipher = Cipher.getInstance(algorithm);
        cipher.init(Cipher.ENCRYPT_MODE, key, iv);
        byte[] cipherText = cipher.doFinal(input.getBytes());
        return Base64.getEncoder()
            .encodeToString(cipherText);
    }

    private String decrypt(String algorithm, String cipherText, SecretKey key,
        IvParameterSpec iv) throws Exception {
        
        Cipher cipher = Cipher.getInstance(algorithm);
        cipher.init(Cipher.DECRYPT_MODE, key, iv);
        byte[] plainText = cipher.doFinal(Base64.getDecoder()
            .decode(cipherText));
        return new String(plainText);
    }
}
