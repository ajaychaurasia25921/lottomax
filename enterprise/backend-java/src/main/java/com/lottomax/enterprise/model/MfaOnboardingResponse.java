package com.lottomax.enterprise.model;

import java.util.UUID;

public record MfaOnboardingResponse(
        UUID challengeId,
        String status,
        String kycStatus
) {
}
