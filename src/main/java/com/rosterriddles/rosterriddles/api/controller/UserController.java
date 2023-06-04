package com.rosterriddles.rosterriddles.api.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;

import org.springframework.http.MediaType;

@CrossOrigin(origins = {"http://localhost:4200"})
@RestController
@ResponseBody
public class UserController {

    @GetMapping(value = "/user", produces = MediaType.APPLICATION_JSON_VALUE)
    public Object getUser() throws Exception {
        HashMap<String, Object> response = new HashMap<String, Object>();
        HashMap<String, Object> user = new HashMap<String, Object>();
        user.put("name", "Nicky B");
        response.put("user", user);
        return response;
    }
    
}
