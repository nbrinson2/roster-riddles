package com.rosterriddles.rosterriddles.domain.model;

import java.time.LocalDateTime;

import com.rosterriddles.rosterriddles.utils.GameStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@EqualsAndHashCode
@NoArgsConstructor
@Entity
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private GameStatus status;

    @Column(nullable = false)
    private int timesViewedActiveRoster = 0;

    @Column(nullable = false)
    private int numberOfGuesses = 0;

    @ManyToOne
    @JoinColumn(nullable = false, name = "app_user_id")
    private User user;

    public Game(LocalDateTime createdAt, GameStatus status, int timesViewedActiveRoster, int numberOfGuesses,
            User user) {
        this.createdAt = createdAt;
        this.status = status;
        this.timesViewedActiveRoster = timesViewedActiveRoster;
        this.numberOfGuesses = numberOfGuesses;
        this.user = user;
    }
    
}
