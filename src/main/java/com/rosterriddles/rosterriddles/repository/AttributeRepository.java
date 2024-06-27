package com.rosterriddles.rosterriddles.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rosterriddles.rosterriddles.domain.entity.Attribute;

public interface AttributeRepository extends JpaRepository<Attribute, Long> {
   Attribute findByAttributeName(String attributeName);

   List<Attribute> findAllByLeagueId(Long leagueId);
}