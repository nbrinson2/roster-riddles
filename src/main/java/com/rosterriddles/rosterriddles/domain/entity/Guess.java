package com.rosterriddles.rosterriddles.domain.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "guesses")
public class Guess {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(nullable = false, name = "game_id")
    private Game game;

    @Column(nullable = false)
    private int guessNumber;

    @ManyToOne
    @JoinColumn(nullable = false, name = "guessed_player_id")
    private Player guessedPlayer;

    @Column(nullable = false)
    private boolean correct;

    @ManyToOne
    @JoinColumn(nullable = true, name = "hint")
    private Attribute hint;

    @ManyToOne
    @JoinColumn(nullable = false, name = "sport_id")
    private Sport sport;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(nullable = true, length = 255)
    private String rosterLink;

    public Guess(Game game, int guessNumber, Player guessedPlayer, boolean correct, Attribute hint, Sport sport, LocalDateTime timestamp, String rosterLink) {
        this.game = game;
        this.guessNumber = guessNumber;
        this.guessedPlayer = guessedPlayer;
        this.correct = correct;
        this.hint = hint;
        this.sport = sport;
        this.timestamp = timestamp;
        this.rosterLink = rosterLink;
    }
}
