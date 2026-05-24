package com.lottomax.enterprise.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record BroadGroupRequest(
        @NotBlank String name,
        @Min(2) int maxPlayers,
        @Valid @NotNull Money ticketPrice
) {
}
