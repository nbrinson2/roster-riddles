package com.rosterriddles.rosterriddles.domain.entity;

import jakarta.persistence.*;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@EqualsAndHashCode
@NoArgsConstructor
@Entity
@Inheritance(strategy = InheritanceType.TABLE_PER_CLASS)
public abstract class Player {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 100)
    private String countryOfBirth;

    @Column(nullable = false)
    private int age;

    @ManyToOne
    @JoinColumn(nullable = false, name = "league_id")
    private League league;

    public Player(String name, String countryOfBirth, int age, League league) {
        this.name = name;
        this.countryOfBirth = countryOfBirth;
        this.age = age;
        this.league = league;
    }
}
