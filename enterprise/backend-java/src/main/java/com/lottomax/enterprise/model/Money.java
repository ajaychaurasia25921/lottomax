package com.lottomax.enterprise.model;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record Money(
        @Min(0) long cents,
        @NotBlank String currency
) {
}
