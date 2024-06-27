package com.rosterriddles.rosterriddles.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rosterriddles.rosterriddles.domain.entity.Sport;

public interface SportRepository extends JpaRepository<Sport, Long> {
   
}
