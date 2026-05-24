package com.lottomax.enterprise.model;

import java.util.UUID;

public record WithdrawalDecision(
        UUID withdrawalId,
        String status,
        String reason
) {
}
