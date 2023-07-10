package com.rosterriddles.rosterriddles.domain.service;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.rosterriddles.rosterriddles.api.repository.UserRepository;
import com.rosterriddles.rosterriddles.domain.model.ConfirmationToken;
import com.rosterriddles.rosterriddles.domain.model.User;
import com.rosterriddles.rosterriddles.domain.model.UserStatistics;
import com.rosterriddles.rosterriddles.domain.model.UserUpdateRequest;
import com.rosterriddles.rosterriddles.utils.EmailSender;

import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class UserService implements UserDetailsService {

    private final static String USER_NOT_FOUND_MSG = "user with email %s not found";
    private final static String EMAIL_EXISTS_MSG = "Email %s already exists";
    private final static String USER_NOT_ENABLED = "User %s not enabled";

    private final UserRepository userRepository;
    private final PasswordEncoder encoder;
    private final EmailSender emailSender;
    private final ConfirmationTokenService confirmationTokenService;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException(String.format(USER_NOT_FOUND_MSG, email)));
    }
    
    public User loadUserById(Long id) throws UsernameNotFoundException {
        return userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException(String.format(USER_NOT_FOUND_MSG, id)));
    }

    public String registerUser(User user) {
        boolean userExists = userRepository.findByEmail(user.getEmail()).isPresent();
        boolean userEnabled = user.getEnabled();

        if (userExists) {
            if (userEnabled) {
                throw new IllegalStateException(String.format(EMAIL_EXISTS_MSG, user.getEmail()));
            } else {
                throw new IllegalStateException(String.format(USER_NOT_ENABLED, user.getFirstName()));
            }
        }

        String encodedPassword = encoder.encode(user.getPassword());
        user.setPassword(encodedPassword);
        userRepository.save(user);

        String token = UUID.randomUUID().toString();
        ConfirmationToken confirmationToken = new ConfirmationToken(
                token,
                LocalDateTime.now(),
                LocalDateTime.now().plusMinutes(15),
                null,
                user);
        confirmationTokenService.saveToken(confirmationToken);

        return token;
    }

    public int enableUser(String email) {
        return userRepository.enableUser(email);
    }

    public User updateUser(UserUpdateRequest request, Long id) {
        User user = loadUserById(id);

        user.setEmail(request.getEmail());
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());

        userRepository.save(user);

        return user;
    }

    
    // public UserStatistics getUserStatistics(User user) {
    //     return new UserStatistics(user);
    // }

}
