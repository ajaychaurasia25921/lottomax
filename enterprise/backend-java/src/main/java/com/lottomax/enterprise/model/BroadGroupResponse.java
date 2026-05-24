package com.lottomax.enterprise.model;

import java.util.UUID;

public record BroadGroupResponse(
        UUID id,
        String name,
        String status,
        int maxPlayers,
        Money ticketPrice
) {
}
