package com.rosterriddles.rosterriddles.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@EqualsAndHashCode
@NoArgsConstructor
@Entity
public class PlayerAttributes {

    @Column(nullable = false)
    private AttributeType attType;

    @Column(nullable = false)
    private String value;
    
    @Column(nullable = false)
    private Enum color;

}
