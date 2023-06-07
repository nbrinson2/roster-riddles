package com.rosterriddles.rosterriddles.utils.validator;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

public class PostRequestValidator {
    public boolean validateRequest(Gson toValidate) {
        return false;
    }

    public Gson validateJson(String json) {
        /* Checks here against json 
            size
            content
            null
        */
        GsonBuilder build = new GsonBuilder();
        Gson gson = build.create();
        return gson;
    }
}
