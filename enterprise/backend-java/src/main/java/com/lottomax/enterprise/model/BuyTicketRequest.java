package com.lottomax.enterprise.model;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record BuyTicketRequest(
        @NotNull UUID walletId,
        @NotEmpty @Size(min = 6, max = 6) List<Integer> numberSet
) {
}
