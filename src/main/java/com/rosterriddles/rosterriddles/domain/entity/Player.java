package com.rosterriddles.rosterriddles.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Lob;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@EqualsAndHashCode
@NoArgsConstructor
@Entity
@Table(name = "players")
public class Player {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long playerId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 50)
    private String team;

    @Column(nullable = false, length = 50)
    private String position;

    @Column(nullable = false)
    private int age;

    @Column(nullable = false, length = 10)
    private String height;

    @Column(nullable = false)
    private int weight;

    @Lob
    @Column(nullable = false)
    private String stats;

    @ManyToOne
    @JoinColumn(nullable = false, name = "sport_id")
    private Sport sport;

    public Player(String name, String team, String position, int age, String height, int weight, String stats, Sport sport) {
        this.name = name;
        this.team = team;
        this.position = position;
        this.age = age;
        this.height = height;
        this.weight = weight;
        this.stats = stats;
        this.sport = sport;
    }
}
