package com.lottomax.enterprise.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SettleDrawRequest(
        @NotBlank @Size(min = 16) String rngNonce
) {
}
