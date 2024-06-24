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
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@EqualsAndHashCode
@NoArgsConstructor
@Entity
@Table(name = "games")
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = true)
    private LocalDateTime endTime;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private GameStatus status;

    @Column(nullable = false)
    private int remainingGuesses;

    @Column(nullable = false)
    private int numberOfGuesses = 0;

    @Column(nullable = false)
    private int timesViewedActiveRoster = 0;

    @ManyToOne
    @JoinColumn(nullable = false, name = "app_user_id")
    private User user;

    @ManyToOne
    @JoinColumn(nullable = false, name = "sport_id")
    private Sport sport;

    @ManyToOne
    @JoinColumn(nullable = false, name = "game_type_id")
    private GameType gameType;

    public Game(LocalDateTime startTime, GameStatus status, int remainingGuesses, int timesViewedActiveRoster, User user, Sport sport, GameType gameType) {
        this.startTime = startTime;
        this.status = status;
        this.remainingGuesses = remainingGuesses;
        this.user = user;
        this.sport = sport;
        this.gameType = gameType;
        this.timesViewedActiveRoster = timesViewedActiveRoster;
    }
}
