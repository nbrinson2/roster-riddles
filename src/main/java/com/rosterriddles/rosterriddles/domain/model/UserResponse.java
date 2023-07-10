package com.rosterriddles.rosterriddles.domain.model;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.ToString;

@Getter
@AllArgsConstructor
@EqualsAndHashCode
@ToString
public class UserResponse {
    private final String id;
    private final String firstName;
    private final String lastName;
    private final String email;
}
