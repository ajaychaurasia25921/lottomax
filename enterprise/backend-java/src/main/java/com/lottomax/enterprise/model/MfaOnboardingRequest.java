package com.lottomax.enterprise.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record MfaOnboardingRequest(
        @Email @NotBlank String email,
        @NotBlank String phone,
        @Pattern(regexp = "sms|email") String mfaChannel
) {
}
