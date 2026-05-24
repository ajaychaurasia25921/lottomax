package com.lottomax.enterprise.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateDepositRequest(
        @Valid @NotNull Money amount,
        @NotBlank String gatewayToken
) {
}
