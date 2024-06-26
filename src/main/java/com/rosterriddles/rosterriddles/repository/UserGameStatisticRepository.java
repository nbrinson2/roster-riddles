package com.rosterriddles.rosterriddles.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rosterriddles.rosterriddles.domain.entity.UserGameStatistic;

public interface UserGameStatisticRepository extends JpaRepository<UserGameStatistic, Long>{
   List<UserGameStatistic> findAllByUserId(Long userId);
}
