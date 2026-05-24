package com.lottomax.enterprise.model;

import java.util.List;
import java.util.UUID;

public record TicketResponse(
        UUID id,
        UUID drawId,
        UUID userId,
        List<Integer> numberSet,
        Money price
) {
}
