package com.rosterriddles.rosterriddles.domain.model;

import java.util.*;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@EqualsAndHashCode
@NoArgsConstructor
@Entity
public class Guess {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToMany
    List<PlayerAttributes> playerAttributes = new ArrayList<PlayerAttributes>();
    
}
