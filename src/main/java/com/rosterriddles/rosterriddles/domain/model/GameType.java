package com.rosterriddles.rosterriddles.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "game_types")
public class GameType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long gameTypeId;

    @Column(nullable = false, length = 50)
    private String gameTypeName;

    public GameType(String gameTypeName) {
        this.gameTypeName = gameTypeName;
    }
}
