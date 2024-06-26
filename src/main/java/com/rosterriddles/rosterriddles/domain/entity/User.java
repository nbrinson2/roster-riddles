package com.rosterriddles.rosterriddles.domain.entity;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Collections;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.rosterriddles.rosterriddles.domain.enums.UserRole;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
@Table(name = "users")
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String firstName;

    @Column(nullable = false, length = 50)
    private String lastName;

    @Column(nullable = false, length = 100)
    private String email;

    @Column(nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false, columnDefinition = "int default 0")
    private int totalGamesPlayed;

    @Column(nullable = false, columnDefinition = "int default 0")
    private int gamesWon;

    @Column(nullable = false, columnDefinition = "int default 0")
    private int gamesLost;

    @Column(nullable = false, columnDefinition = "int default 0")
    private int totalGuessesMade;

    @Column(nullable = false, columnDefinition = "int default 0")
    private int correctGuesses;

    @Column(nullable = false, columnDefinition = "int default 0")
    private int incorrectGuesses;

    @Column(nullable = false, columnDefinition = "int default 0")
    private int totalHintsUsed;

    @Column(nullable = false, columnDefinition = "int default 0")
    private int totalRosterLinkClicks;

    @Column(nullable = false, columnDefinition = "int default 0")
    private int totalPoints;

    @Column(nullable = true)
    private LocalDateTime lastActive;

    @Enumerated(EnumType.STRING)
    private UserRole userRole;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private Boolean locked = false;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private Boolean enabled = false;

    @Column(nullable = false, columnDefinition = "int default 0")
    private int timesClickedNewGame;

    public User(String firstName, String lastName, String email, String passwordHash, LocalDateTime createdAt, int totalGamesPlayed,
            int gamesWon, int gamesLost, int totalGuessesMade, int correctGuesses, int incorrectGuesses, int totalHintsUsed,
            int totalRosterLinkClicks, int totalPoints, LocalDateTime lastActive, UserRole userRole, Boolean locked, 
            Boolean enabled, int timesClickedNewGame) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.passwordHash = passwordHash;
        this.createdAt = createdAt;
        this.totalGamesPlayed = totalGamesPlayed;
        this.gamesWon = gamesWon;
        this.gamesLost = gamesLost;
        this.totalGuessesMade = totalGuessesMade;
        this.correctGuesses = correctGuesses;
        this.incorrectGuesses = incorrectGuesses;
        this.totalHintsUsed = totalHintsUsed;
        this.totalRosterLinkClicks = totalRosterLinkClicks;
        this.totalPoints = totalPoints;
        this.lastActive = lastActive;
        this.userRole = userRole;
        this.locked = locked;
        this.enabled = enabled;
        this.timesClickedNewGame = timesClickedNewGame;
    }

    public User(String firstName, String lastName, String email, String passwordHash, UserRole userRole) {
        this.createdAt = LocalDateTime.now();
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.passwordHash = passwordHash;
        this.userRole = userRole;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        SimpleGrantedAuthority authority = new SimpleGrantedAuthority(userRole.name());
        return Collections.singletonList(authority);
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return !locked;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

}
