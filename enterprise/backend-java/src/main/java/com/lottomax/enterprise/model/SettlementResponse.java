package com.lottomax.enterprise.model;

import java.util.UUID;

public record SettlementResponse(
        UUID id,
        UUID drawId,
        UUID winnerUserId,
        UUID winnerTicketId,
        Money companyAmount,
        Money winnerAmount,
        String status
) {
}
