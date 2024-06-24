package com.rosterriddles.rosterriddles.domain.model;

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
@Table(name = "user_game_statistics")
public class UserGameStatistic {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long userGameStatId;

    @ManyToOne
    @JoinColumn(nullable = false, name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(nullable = false, name = "game_id")
    private Game game;

    @Column(nullable = false)
    private int guessesMade;

    @Column(nullable = false)
    private int hintsUsed;

    @Column(nullable = false)
    private int rosterLinkClicks;

    @Column(nullable = false)
    private int timeSpent;

    public UserGameStatistic(User user, Game game, int guessesMade, int hintsUsed, int rosterLinkClicks, int timeSpent) {
        this.user = user;
        this.game = game;
        this.guessesMade = guessesMade;
        this.hintsUsed = hintsUsed;
        this.rosterLinkClicks = rosterLinkClicks;
        this.timeSpent = timeSpent;
    }
}
