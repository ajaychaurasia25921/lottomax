package com.lottomax.enterprise.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record WithdrawalRequest(
        @Valid @NotNull Money amount,
        @NotBlank String payoutAccountId
) {
}
